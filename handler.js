// Baileys v7 est ESM pur — getContentType est mis en cache dans global._baileysGetContentType
const { getBaileys } = require('./lib/baileys')
const fs = require('fs')
const path = require('path')

// Résolution de getContentType : cache global d'abord, sinon chargement dynamique
const obtenirGetContentType = async () => {
    if (global._baileysGetContentType) return global._baileysGetContentType
    const baileys = await getBaileys()
    global._baileysGetContentType = baileys.getContentType
    return baileys.getContentType
}

// Registre de toutes les commandes chargées dynamiquement
const commands = new Map()
const cheminCommandes = path.join(__dirname, 'commands')

// ─────────────────────────────────────────────────────────
// CHARGEUR DE COMMANDES (récursif)
// ─────────────────────────────────────────────────────────
const chargerCommandes = (dossier = cheminCommandes) => {
    try {
        if (!fs.existsSync(dossier)) return
        const fichiers = fs.readdirSync(dossier)
        for (const fichier of fichiers) {
            const cheminComplet = path.join(dossier, fichier)
            const stat = fs.statSync(cheminComplet)

            if (stat.isDirectory()) {
                chargerCommandes(cheminComplet)
            } else if (fichier.endsWith('.js')) {
                try {
                    delete require.cache[require.resolve(cheminComplet)]
                    const module = require(cheminComplet)
                    if (module.commands && Array.isArray(module.commands)) {
                        for (const nomCmd of module.commands) {
                            commands.set(nomCmd, module)
                        }
                    } else {
                        const nom = module.name || fichier.replace('.js', '')
                        commands.set(nom, module)
                    }
                } catch (err) {
                    console.error(`[ELY-ERREUR] Échec du chargement de ${fichier} :`, err)
                }
            }
        }
    } catch (e) {
        console.error('[ELY-ERREUR] Impossible de scanner le dossier commandes :', e)
    }
}

chargerCommandes()
console.log(`[ELY-SYSTÈME] ${commands.size} commandes indexées.`)

// Détection des URLs et liens
const regexLien = /(https?:\/\/[^\s]+|www\.[^\s]+|chat\.whatsapp\.com\/[^\s]+)/gi

// ─────────────────────────────────────────────────────────
// GESTIONNAIRE PRINCIPAL DES MESSAGES
// ─────────────────────────────────────────────────────────
module.exports = async (sock, m, chatUpdate) => {
    const getContentType = await obtenirGetContentType()
    try {
        if (!m.message) return

        // --- Déballage du message ---
        let msg = m.message
        let typeMsg = getContentType(msg)

        if (typeMsg === 'ephemeralMessage') {
            msg = msg.ephemeralMessage.message
            typeMsg = getContentType(msg)
        }
        if (typeMsg === 'viewOnceMessageV2') {
            msg = msg.viewOnceMessageV2.message
            typeMsg = getContentType(msg)
        } else if (typeMsg === 'viewOnceMessage') {
            msg = msg.viewOnceMessage.message
            typeMsg = getContentType(msg)
        } else if (typeMsg === 'viewOnceMessageV2Extension') {
            msg = msg.viewOnceMessageV2Extension.message
            typeMsg = getContentType(msg)
        } else if (typeMsg === 'documentWithCaptionMessage') {
            msg = msg.documentWithCaptionMessage.message
            typeMsg = getContentType(msg)
        }

        m.unwrapped = { msg, type: typeMsg }

        // --- Métadonnées de base ---
        const from = m.key.remoteJid
        const estGroupe = from.endsWith('@g.us')

        const expediteur = sock.decodeJid(m.key.participant || m.key.remoteJid)
        if (!expediteur) return console.error('[DEBUG] JID expéditeur introuvable')

        // Numéro du bot (format: 1234567890@s.whatsapp.net)
        const numeroBot = (sock.user?.id) ? sock.decodeJid(sock.user.id) : null
        const idExpediteur = expediteur.split('@')[0]

        // ─────────────────────────────────────────────────────────
        // VÉRIFICATION OWNER : compare le numéro de la session
        // global.owner est mis à jour dynamiquement dans index.js
        // ─────────────────────────────────────────────────────────
        const listeMods = global.db?.mods || []
        const ownerNumero = numeroBot ? global.jidToNumber(numeroBot) : global.jidToNumber(global.owner?.[0] || '')

        const estProprietaire = m.key.fromMe ||  // Message envoyé par le bot lui-même
            (!!ownerNumero && idExpediteur === ownerNumero) ||
            (!!global.jidToNumber(global.owner?.[0] || '') &&
                idExpediteur === global.jidToNumber(global.owner[0])) ||
            (!!global.ownerLid && idExpediteur === global.ownerLid) ||
            listeMods.some(mod => global.jidToNumber(mod) && global.jidToNumber(mod) === idExpediteur)

        // --- Stockage des messages (pour anti-suppression et purge) ---
        if (typeMsg && typeMsg !== 'protocolMessage') {
            global.db.msgStore.set(m.key.id, { m, msg, type: typeMsg, sender: expediteur, from })
            if (global.db.msgStore.size > 1000) {
                global.db.msgStore.delete(global.db.msgStore.keys().next().value)
            }
        }

        // --- Gestion de l'anti-suppression ---
        if (typeMsg === 'protocolMessage' && msg.protocolMessage.type === 0) {
            const msgCache = global.db.msgStore.get(msg.protocolMessage.key.id)
            if (msgCache && (global.db.settings.antidelete || (msgCache.isStatus && global.db.settings.statusAntidelete))) {
                const jidOwner = global.ownerJid() || (ownerNumero ? ownerNumero + '@s.whatsapp.net' : null)
                if (!jidOwner) return

                const numAuteur = global.jidToNumber(msgCache.sender)
                let texteNotif = `🚨 *ANTI-SUPPRESSION* 🚨\n\n`
                texteNotif += msgCache.isStatus
                    ? `👤 *Statut de* : @${numAuteur}\n📝 Statut supprimé.`
                    : `👤 @${numAuteur}\n📝 Message supprimé à l'instant.\n📍 Chat : ${msgCache.from || from}`

                // Envoi UNIQUEMENT en privé au propriétaire
                await sock.sendMessage(jidOwner, { text: texteNotif, mentions: [msgCache.sender] }, { quoted: msgCache.m })
                await sock.copyNForward(jidOwner, msgCache.m, true).catch(() => { })
            }
        }

        // --- Mode privé : seuls le propriétaire et les mods peuvent utiliser le bot ---
        if (global.db.settings.privateMode && !estProprietaire) return

        // --- Extraction du corps du message (inclut audioMessage) ---
        let corps = ''
        if (typeMsg === 'conversation') {
            corps = msg.conversation
        } else if (typeMsg === 'imageMessage') {
            corps = msg.imageMessage?.caption || ''
        } else if (typeMsg === 'videoMessage') {
            corps = msg.videoMessage?.caption || ''
        } else if (typeMsg === 'extendedTextMessage') {
            corps = msg.extendedTextMessage?.text || ''
        } else if (typeMsg === 'audioMessage') {
            corps = '' // Les audios n'ont pas de corps texte (traité par commande stt)
        } else if (typeMsg === 'buttonsResponseMessage') {
            corps = msg.buttonsResponseMessage?.selectedButtonId || ''
        } else if (typeMsg === 'listResponseMessage') {
            corps = msg.listResponseMessage?.singleSelectReply?.selectedRowId || ''
        } else if (typeMsg === 'templateButtonReplyMessage') {
            corps = msg.templateButtonReplyMessage?.selectedId || ''
        }

        m.text = (corps || '').trim()

        // --- Vérification de l'état du bot ---
        if (!global.db.settings.active && !estProprietaire && !m.text.startsWith('.bot')) return

        // ─────────────────────────────────────────────────────────
        // PROTECTION DES GROUPES (anti-lien)
        // ─────────────────────────────────────────────────────────
        if (estGroupe && !m.key.fromMe && typeMsg !== 'protocolMessage') {
            const donneesGroupe = global.getGroupDB ? global.getGroupDB(from) : null

            if (donneesGroupe?.antilink) {
                // Métadonnées mises en cache (60 s) : plus d'appel réseau par message
                const meta = await global.getGroupMetadata(sock, from).catch(() => null)
                const estAdminGroupe = (meta && global.estAdminDans(meta, expediteur)) || estProprietaire

                if (!estAdminGroupe && m.text && regexLien.test(m.text)) {
                    regexLien.lastIndex = 0
                    try {
                        await sock.sendMessage(from, { delete: m.key })
                        // Notification uniquement en privé au propriétaire
                        const jidOwner2 = global.ownerJid() || (ownerNumero ? ownerNumero + '@s.whatsapp.net' : null)
                        if (jidOwner2) {
                            await sock.sendMessage(jidOwner2, {
                                text: `🔗 *ANTI-LIEN*\n📍 Groupe : ${from}\n👤 @${idExpediteur} a envoyé un lien et il a été supprimé.`,
                                mentions: [expediteur]
                            }, { quoted: m })
                        }
                    } catch (e) {
                        console.error('[ANTI-LIEN] Erreur :', e.message)
                    }
                    return
                }
            }
        }

        // --- Gestion des réactions (téléchargement de statut) ---
        if (typeMsg === 'reactionMessage') {
            const reaction = msg.reactionMessage
            const estMoi = reaction.key.fromMe
            const msgCache = global.db.msgStore.get(reaction.key.id)

            if (estMoi && msgCache?.isStatus) {
                const jidOwner = global.owner[0]?.endsWith('@s.whatsapp.net')
                    ? global.owner[0] : (global.owner[0] || ownerNumero) + '@s.whatsapp.net'
                await sock.sendMessage(jidOwner, {
                    text: `📥 *TÉLÉCHARGEMENT STATUT*\nDe : @${msgCache.sender.split('@')[0]}`,
                    mentions: [msgCache.sender]
                })
                await sock.copyNForward(jidOwner, msgCache.m, true)
            }
        }

        // --- Sérialisation du message ---
        m.sender = expediteur
        const contextInfo = msg[typeMsg]?.contextInfo || {}
        m.mentionedJid = contextInfo.mentionedJid || []

        if (contextInfo.quotedMessage) {
            const typeQuote = getContentType(contextInfo.quotedMessage)
            m.quoted = {
                key: {
                    remoteJid: from,
                    fromMe: numeroBot ? (sock.decodeJid(contextInfo.participant || '') === numeroBot) : false,
                    id: contextInfo.stanzaId,
                    participant: contextInfo.participant
                },
                sender: sock.decodeJid(contextInfo.participant || ''),
                message: contextInfo.quotedMessage,
                msg: contextInfo.quotedMessage[typeQuote],
                mtype: typeQuote
            }
            if (['viewOnceMessageV2', 'viewOnceMessage', 'viewOnceMessageV2Extension'].includes(typeQuote)) {
                const inner = m.quoted.message[typeQuote].message
                m.quoted.unwrapped = { msg: inner, type: getContentType(inner) }
            } else if (typeQuote === 'ephemeralMessage') {
                const inner = m.quoted.message.ephemeralMessage.message
                m.quoted.unwrapped = { msg: inner, type: getContentType(inner) }
            }
        } else {
            m.quoted = null
        }

        const prefixe = '.'
        const estCommande = m.text.startsWith(prefixe)

        // --- Traitement des messages non-commandes ---
        if (!estCommande) {
            // Listener de jeu actif (une seule partie par chat)
            const jeuActif = global.db.games?.[from]

            // Mémoire IA : on retient TOUS les échanges naturels du chat
            // (hors parties de jeu) pour que l'IA suive la conversation
            // sans perdre le contexte, même sans être mentionnée.
            // En groupe, on préfixe par le nom de l'auteur pour que l'IA
            // sache "qui a dit quoi".
            const texteHistorique = estGroupe
                ? `[${m.pushName || global.jidToNumber(expediteur)}] ${m.text}`
                : m.text
            if (m.text && !m.key.fromMe && !jeuActif) {
                global.ajouterHistorique(from, 'user', texteHistorique)
            }

            if (jeuActif?.listener) {
                try {
                    await jeuActif.listener(sock, m, {
                        body: m.text,
                        sender: expediteur,
                        reply: (content, options = {}) => {
                            if (typeof content === 'string') return sock.sendMessage(from, { text: content, ...options }, { quoted: m })
                            return sock.sendMessage(from, { ...content, ...options }, { quoted: m })
                        }
                    })
                } catch (e) {
                    console.error('[JEU] Erreur listener :', e)
                }
            }

            // Réaction automatique
            if (global.db.settings.autoreact && m.text && !m.key.fromMe) {
                const emojis = ['👍', '❤️', '🔥', '😂', '✨']
                await sock.sendMessage(from, {
                    react: { text: emojis[Math.floor(Math.random() * emojis.length)], key: m.key }
                })
            }

            // Chatbot / Réponse à un message de l'IA
            const candidatsBot = [sock.user?.id, sock.user?.lid].filter(Boolean)
            const estMentionne = (m.mentionedJid || []).some(j => candidatsBot.some(c => global.sameJid(j, c)))
            const estAppeleParNom = !estMentionne && !!sock.user?.name && typeof m.text === 'string' && m.text.startsWith(sock.user.name)
            let doitRepondreIA = (estMentionne || estAppeleParNom)
            // Si l'utilisateur répond à un message envoyé par l'IA -> répondre directement (sans .ai)
            if (!doitRepondreIA && estGroupe && m.quoted?.key?.id) {
                try {
                    const aiCtx = require('./lib/ai_context')
                    if (aiCtx.isReplyToAI(from, m.quoted.key.id)) {
                        doitRepondreIA = true
                    }
                } catch (e) {}
            }
            if (doitRepondreIA && !m.key.fromMe) {
                if (global.db.settings.aiOnly && !estProprietaire) {
                    await sock.sendMessage(from, {
                        text: '🔒 L\'IA est actuellement réservée au propriétaire du bot.'
                    }, { quoted: m })
                } else {
                    const hist = global.getHistorique(from)
                    const dernier = hist[hist.length - 1]
                    const base = dernier && dernier.contenu === texteHistorique ? hist.slice(0, -1) : hist
                    const reponse = await global.getAIResponse(m.text, 'auto', null, base)
                    if (reponse?.out) {
                        global.ajouterHistorique(from, 'bot', reponse.out)
                        const sent = await sock.sendMessage(from, { text: reponse.out }, { quoted: m })
                        try {
                            const aiCtx = require('./lib/ai_context')
                            if (sent?.key?.id) aiCtx.addAIReply(from, sent.key.id)
                        } catch (e) {}
                    }
                }
            }
            return
        }

        // --- Extraction de la commande et des arguments ---
        const commande = m.text.slice(1).trim().split(/ +/).shift().toLowerCase()
        const args = m.text.trim().split(/ +/).slice(1)
        const text = args.join(' ')

        const cmd = commands.get(commande)
        if (!cmd) return

        // ─────────────────────────────────────────────────────────
        // VÉRIFICATION ADMIN GROUPE — utilise groupMetadata
        // ─────────────────────────────────────────────────────────
        let estAdmin = false
        let botEstAdmin = false
        let proprietaireGroupe = ''

        if (estGroupe) {
            // Métadonnées mises en cache (global.getGroupMetadata, TTL 60 s)
            // → plus d'appel réseau ni de délais de retry à chaque commande.
            let metaDonnees = await global.getGroupMetadata(sock, from)

            if (!metaDonnees) {
                // Une seule tentative forcee si le cache est vide
                metaDonnees = await global.getGroupMetadata(sock, from, true).catch(() => null)
            }

            if (metaDonnees) {
                const participants = metaDonnees.participants || []
                proprietaireGroupe = metaDonnees.owner ||
                    participants.find(p => p.admin === 'superadmin')?.id ||
                    participants.find(p => p.admin === 'superadmin')?.lid || ''

                // Comparaison par numéro (+ support @lid) pour l'expéditeur et le bot :
                // évite les faux négatifs quand WhatsApp utilise des JID @lid.
                estAdmin = global.estAdminDans(metaDonnees, expediteur) || estProprietaire

                // Le bot est admin si SON numéro (ou SON lid) est dans les admins
                const candidatsBot = [numeroBot, sock.user?.id, sock.user?.lid].filter(Boolean)
                botEstAdmin = candidatsBot.some(j => global.estAdminDans(metaDonnees, j))

                if (process.env.DEBUG_ADMIN) {
                    console.log(`[VÉRIF-ADMIN] expéditeur=${idExpediteur} | estAdmin=${estAdmin} | botAdmin=${botEstAdmin}`)
                }
            } else {
                console.warn('[VÉRIF-ADMIN] Métadonnées introuvables — fallback estProprietaire')
                estAdmin = estProprietaire
            }
        }

        // Le propriétaire du bot est TOUJOURS admin
        if (estProprietaire) estAdmin = true

        // ─────────────────────────────────────────────────────────
        // PROTECTION DE LA CIBLE
        // - Actions sur un membre (kick/promote/demote/delete/purge...) : on bloque
        //   si on vise le propriétaire
        // - Accès aux infos personnelles (pp/info/whois) : on bloque si on vise
        //   le propriétaire (mais on autorise l'utilisation normale des autres
        //   commandes sur ses messages, ex. sticker/toimg/translate)
        // ─────────────────────────────────────────────────────────
        const cibleJid = m.mentionedJid?.[0] || (m.quoted ? m.quoted.sender : null)
        const numeroOwner = global.jidToNumber(global.owner?.[0] || '')

        // Actions à l'encontre d'un membre
        const COMMANDES_SENSIBLES = new Set([
            'kick', 'promote', 'demote', 'delete', 'del',
            'delgrp', 'purge', 'cleanme', 'delmsg', 'warn', 'report'
        ])
        // Commandes qui révèlent des infos/personnelles
        const COMMANDES_INFOS = new Set([
            'pp', 'profile', 'getpp', 'avatar', 'pfp', 'profil',
            'whois', 'info', 'userinfo', 'infouser'
        ])

        const estLeProprietaire = (jid) => {
            if (!jid) return false
            const jidDecode = sock.decodeJid(jid)
            return global.sameJid(jidDecode, global.owner?.[0]) ||
                global.sameJid(jidDecode, global.ownerLid) ||
                global.sameJid(jidDecode, numeroBot) ||
                global.sameJid(jidDecode, proprietaireGroupe)
        }

        if (cibleJid) {
            const cibleDecode = sock.decodeJid(cibleJid)
            const estCibleProtegee = estLeProprietaire(cibleDecode)
            const estCommandeSensible = COMMANDES_SENSIBLES.has(commande)
            const estCommandeInfos = COMMANDES_INFOS.has(commande)

            if (estCibleProtegee && !estProprietaire && !global.sameJid(cibleDecode, expediteur) && (estCommandeSensible || estCommandeInfos)) {
                return sock.sendMessage(from, {
                    text: estCommandeInfos
                        ? '❌ *Action interdite.*\nImpossible d\'accéder à la photo de profil ou aux informations du propriétaire.'
                        : '❌ *Action interdite.*\nImpossible d\'utiliser une commande du bot contre le propriétaire.'
                }, { quoted: m })
            }
        }

        // Repli : numéro du propriétaire écrit en dur dans les arguments
        if (!estProprietaire && numeroOwner && (COMMANDES_SENSIBLES.has(commande) || COMMANDES_INFOS.has(commande)) && text.includes(numeroOwner)) {
            return sock.sendMessage(from, {
                text: COMMANDES_INFOS.has(commande)
                    ? '❌ *Action interdite.*\nImpossible d\'accéder à la photo de profil ou aux informations du propriétaire.'
                    : '❌ *Action interdite.*\nCette commande viserait le propriétaire du bot.'
            }, { quoted: m })
        }

        // Groupe en mode "seul IA" : bloquer toutes les commandes
        if (estGroupe && global.db.iaOnlyGroups?.[from]) {
            const commandesIA = new Set(['ai', 'ely', 'gpt', 'llama', 'meta'])
            if (!commandesIA.has(commande)) {
                return
            }
        }

        console.log(`[EXEC] .${commande} par ${idExpediteur} | estAdmin=${estAdmin} | botAdmin=${botEstAdmin} | owner=${estProprietaire}`)

        // ─────────────────────────────────────────────────────────
        // MODE PRIVÉ : toutes les réponses vont en PV
        // En mode privé, même dans un groupe, la réponse va au propriétaire
        // ─────────────────────────────────────────────────────────
        const jidOwner = global.ownerJid() || (ownerNumero ? ownerNumero + '@s.whatsapp.net' : from)

        const repondre = (contenu, options = {}) => {
            const versPv = global.db.settings.replyInPv &&
                (global.db.settings.privateMode || estProprietaire)
            let cibleReponse = versPv ? jidOwner : from
            // Si groupe bloqué par .blockgroup on -> répondre en PV
            if (estGroupe && global.db.blockedGroups?.[from]) {
                cibleReponse = jidOwner
            }
            const opts = { ...options }
            if (cibleReponse !== from) delete opts.quoted
            if (typeof contenu === 'string') return sock.sendMessage(cibleReponse, { text: contenu, ...opts }, { quoted: cibleReponse === from ? m : undefined })
            return sock.sendMessage(cibleReponse, { ...contenu, ...opts }, { quoted: cibleReponse === from ? m : undefined })
        }

        // Exécution de la commande
        await cmd.run(sock, m, args, {
            reply: repondre,
            text,
            commande,
            isAdmins: estAdmin,
            isBotAdmins: botEstAdmin,
            isGroup: estGroupe,
            commands,
            isOwner: estProprietaire,
            getAIResponse: global.getAIResponse,
            getGeminiResponse: global.getAIResponse,
            getDeepSeekResponse: global.getDeepSeekResponse,
            getMetaAIResponse: global.getMetaAIResponse,
            downloadContentFromMessage: global._downloadContentFromMessage,
            tempDir: global.tempDir,
            groupOwner: proprietaireGroupe,
            getGroupDB: global.getGroupDB
        }).catch(e => {
            console.error(`[ERREUR-CMD] ${commande} :`, e)
            sock.sendMessage(from, { text: `❌ Erreur : ${e.message || e}` }, { quoted: m })
        })

    } catch (e) {
        console.error('[ELY-GESTIONNAIRE-ERREUR]', e)
    }
}
