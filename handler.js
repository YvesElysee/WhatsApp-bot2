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
        const ownerNumero = numeroBot ? numeroBot.split('@')[0] : (global.owner?.[0] || '')

        const estProprietaire = m.key.fromMe ||  // Message envoyé par le bot lui-même
            global.owner.includes(idExpediteur) ||
            listeMods.some(mod => sock.decodeJid(mod)?.split('@')[0] === idExpediteur) ||
            (ownerNumero && idExpediteur === ownerNumero)

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
                const jidOwner = global.owner[0]?.endsWith('@s.whatsapp.net')
                    ? global.owner[0] : (global.owner[0] || ownerNumero) + '@s.whatsapp.net'

                let texteNotif = `🚨 *ANTI-SUPPRESSION* 🚨\n\n`
                texteNotif += msgCache.isStatus
                    ? `👤 *Statut de* : @${msgCache.sender.split('@')[0]}\n📝 Statut supprimé.`
                    : `👤 @${msgCache.sender.split('@')[0]}\n📝 Message supprimé à l'instant.`

                // En mode privé OU si c'est un statut : envoyer au propriétaire
                const cible = (msgCache.isStatus || global.db.settings.privateMode) ? jidOwner : from

                await sock.sendMessage(cible, { text: texteNotif, mentions: [msgCache.sender] }, { quoted: msgCache.m })
                await sock.copyNForward(cible, msgCache.m, true)

                if (!msgCache.isStatus && from !== jidOwner && !global.db.settings.privateMode) {
                    await sock.sendMessage(jidOwner, {
                        text: `🚨 *AUDIT ANTI-SUPPRESSION*\n📍 Chat : ${from}\n👤 Auteur : @${msgCache.sender.split('@')[0]}`,
                        mentions: [msgCache.sender]
                    })
                    await sock.copyNForward(jidOwner, msgCache.m, true)
                }
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
                let estAdminGroupe = false
                try {
                    const meta = await sock.groupMetadata(from).catch(() => null)
                    if (meta) {
                        const admins = meta.participants
                            .filter(p => p.admin !== null && p.admin !== undefined)
                            .map(p => sock.decodeJid(p.id))
                        estAdminGroupe = admins.includes(expediteur) || estProprietaire
                    }
                } catch (e) {
                    estAdminGroupe = estProprietaire
                }

                if (!estAdminGroupe && m.text && regexLien.test(m.text)) {
                    regexLien.lastIndex = 0
                    try {
                        await sock.sendMessage(from, { delete: m.key })
                        await sock.sendMessage(from, {
                            text: `⚠️ @${idExpediteur} — Les liens ne sont pas autorisés dans ce groupe !\n_Merci de respecter les règles._`,
                            mentions: [expediteur]
                        })
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
            if (typeQuote === 'viewOnceMessageV2' || typeQuote === 'viewOnceMessage') {
                const inner = m.quoted.message[typeQuote].message
                m.quoted.unwrapped = { msg: inner, type: getContentType(inner) }
            }
        } else {
            m.quoted = null
        }

        const prefixe = '.'
        const estCommande = m.text.startsWith(prefixe)

        // --- Traitement des messages non-commandes ---
        if (!estCommande) {
            // Listener de jeu actif
            if (global.db.jeux?.[from]?.listener) {
                await global.db.jeux[from].listener(sock, m, {
                    body: m.text,
                    sender: expediteur,
                    reply: (content, options = {}) => {
                        if (typeof content === 'string') return sock.sendMessage(from, { text: content, ...options }, { quoted: m })
                        return sock.sendMessage(from, { ...content, ...options }, { quoted: m })
                    }
                }).catch(e => console.error('[DEBUG] Erreur listener jeu :', e))
            }

            // Réaction automatique
            if (global.db.settings.autoreact && m.text && !m.key.fromMe) {
                const emojis = ['👍', '❤️', '🔥', '😂', '✨']
                await sock.sendMessage(from, {
                    react: { text: emojis[Math.floor(Math.random() * emojis.length)], key: m.key }
                })
            }

            // Chatbot : répond quand le bot est mentionné
            const idBot = sock.user?.id.split(':')[0]
            const estMentionne = m.mentionedJid.includes(idBot + '@s.whatsapp.net') || m.text.includes(idBot)
            if (global.db.settings.chatbot && estMentionne && !m.key.fromMe) {
                const reponse = await global.getAIResponse(m.text)
                if (reponse?.out) {
                    await sock.sendMessage(from, { text: `🤖 *ELY-AI* :\n\n${reponse.out}` }, { quoted: m })
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
            // Récupération robuste avec retry
            const recupererMeta = async (tentatives = 3, delai = 1000) => {
                for (let essai = 0; essai < tentatives; essai++) {
                    try {
                        const meta = await sock.groupMetadata(from)
                        if (meta?.participants?.length > 0) return meta
                    } catch (e) {
                        console.warn(`[VÉRIF-ADMIN] Tentative ${essai + 1} échouée : ${e.message}`)
                    }
                    if (essai < tentatives - 1) await new Promise(r => setTimeout(r, delai))
                }
                return null
            }

            try {
                const metaDonnees = await recupererMeta()
                if (metaDonnees) {
                    const participants = metaDonnees.participants || []
                    proprietaireGroupe = metaDonnees.owner ||
                        participants.find(p => p.admin === 'superadmin')?.id || ''

                    // Tous les admins (admin + superadmin)
                    const admins = participants
                        .filter(v => v.admin === 'admin' || v.admin === 'superadmin')
                        .map(v => sock.decodeJid(v.id))

                    const expediteurDecode = sock.decodeJid(expediteur)

                    // L'expéditeur est admin si dans la liste OU s'il est propriétaire du bot
                    estAdmin = admins.includes(expediteurDecode) || estProprietaire

                    // Le bot est admin ?
                    botEstAdmin = numeroBot ? admins.includes(numeroBot) : false

                    console.log(`[VÉRIF-ADMIN] expéditeur=${expediteurDecode} | estAdmin=${estAdmin} | botAdmin=${botEstAdmin} | admins=[${admins.join(',')}]`)
                } else {
                    console.warn('[VÉRIF-ADMIN] Métadonnées introuvables — fallback estProprietaire')
                    estAdmin = estProprietaire
                }
            } catch (e) {
                console.error('[VÉRIF-ADMIN-ERREUR]', e.message)
                estAdmin = estProprietaire
            }
        }

        // Le propriétaire du bot est TOUJOURS admin
        if (estProprietaire) estAdmin = true

        // --- Protection de la cible ---
        const cibleJid = m.mentionedJid?.[0] || (m.quoted ? m.quoted.sender : null)
        if (cibleJid) {
            const cibleDecode = sock.decodeJid(cibleJid)
            const estCibleProprietaire = global.owner.includes(cibleDecode.split('@')[0])
            const estCibleProprietaireGroupe = cibleDecode === proprietaireGroupe

            if ((estCibleProprietaire || estCibleProprietaireGroupe) && !estProprietaire && cibleDecode !== sock.decodeJid(expediteur)) {
                return sock.sendMessage(from, {
                    text: '❌ Action interdite : vous ne pouvez pas utiliser de commandes contre le propriétaire.'
                }, { quoted: m })
            }
        }

        console.log(`[EXEC] .${commande} par ${idExpediteur} | estAdmin=${estAdmin} | botAdmin=${botEstAdmin} | owner=${estProprietaire}`)

        // ─────────────────────────────────────────────────────────
        // MODE PRIVÉ : toutes les réponses vont en PV
        // En mode privé, même dans un groupe, la réponse va au propriétaire
        // ─────────────────────────────────────────────────────────
        const jidOwner = global.owner[0]?.endsWith('@s.whatsapp.net')
            ? global.owner[0] : (global.owner[0] || ownerNumero) + '@s.whatsapp.net'

        const repondre = (contenu, options = {}) => {
            // En mode privé : toutes les réponses en PV propriétaire
            // En mode public : répondre dans le chat d'origine
            const cibleReponse = global.db.settings.privateMode ? jidOwner : from
            if (typeof contenu === 'string') return sock.sendMessage(cibleReponse, { text: contenu, ...options }, { quoted: m })
            return sock.sendMessage(cibleReponse, { ...contenu, ...options }, { quoted: m })
        }

        // Exécution de la commande
        await cmd.run(sock, m, args, {
            reply: repondre,
            text,
            isAdmins: estAdmin,
            isBotAdmins: botEstAdmin,
            isGroup: estGroupe,
            commands,
            isOwner: estProprietaire,
            getAIResponse: global.getAIResponse,
            getGeminiResponse: global.getAIResponse,
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
