require('./config')
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion, jidDecode, proto, getContentType } = require('@whiskeysockets/baileys')
const pino = require('pino')
const fs = require('fs')
const path = require('path')
const axios = require('axios')
const { OpenAI } = require('openai')
const { GoogleGenerativeAI } = require('@google/generative-ai')
const handler = require('./handler')

// Capture globale des erreurs non gérées
process.on('uncaughtException', (err) => {
    console.error('[CRITIQUE] Exception non capturée :', err)
})
process.on('unhandledRejection', (reason, promise) => {
    console.error('[CRITIQUE] Promesse rejetée :', promise, 'raison :', reason)
})

// Dossier temporaire : /tmp sur Vercel (seul dossier accessible en écriture), ./temp en local
const isVercel = !!process.env.VERCEL || !!process.env.VERCEL_ENV
const tempDir = isVercel ? '/tmp' : path.join(__dirname, 'temp')
if (!isVercel && !fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true })
}
global.tempDir = tempDir

const { Boom } = require('@hapi/boom')
const express = require('express')
const app = express()
const server = require('http').createServer(app)
const io = require('socket.io')(server)
const QRCode = require('qrcode')
const port = process.env.PORT || 3000

app.use(express.json())
app.use(express.static(path.join(__dirname, 'public')))

// Vérification de l'état du bot
app.get('/health', (req, res) => res.json({
    status: 'ok',
    bot: 'Ely-bot',
    connecte: connectionStatus === 'open'
}))

// Démarrage manuel du bot (utile pour Vercel au premier démarrage)
app.get('/api/start', async (req, res) => {
    if (!botDemarre) {
        botDemarre = true
        startBot().catch(err => {
            console.error('[DEMARRAGE-ERREUR]', err)
            botDemarre = false
        })
        return res.json({ statut: 'demarrage', message: 'Initialisation du bot déclenchée.' })
    }
    res.json({ statut: connectionStatus, message: 'Bot déjà initialisé.' })
})

server.listen(port, '0.0.0.0', () => console.log(`Serveur démarré sur le port ${port}`))

let qrCodeData = ''
let connectionStatus = 'close'
let botDemarre = false

// Gestion des connexions Socket.IO pour le panneau web
io.on('connection', (socket) => {
    socket.emit('status', connectionStatus)
    if (qrCodeData && connectionStatus !== 'open') socket.emit('qr', qrCodeData)

    socket.on('request-pairing', async (phone) => {
        process.emit('request-pairing', phone, socket)
    })
})

// ─────────────────────────────────────────────────────────
// BASE DE DONNÉES GLOBALE
// Inclut le nouveau namespace "groups" pour la gestion des groupes
// ─────────────────────────────────────────────────────────
global.db = {
    jeux: {},
    groups: {},       // Données de modération par groupe
    settings: {
        antidelete: false,
        autoreact: false,
        privateMode: false,
        ibOnly: false,
        aiOnly: false,
        chatbot: false,
        statusView: false,
        statusLike: false,
        statusAntidelete: false,
        active: true
    },
    mods: [],
    msgStore: new Map(),  // Stockage temporaire des messages (non persisté)
    geminiIndex: 0        // Index de rotation des clés Gemini
}

// Initialise les données d'un groupe s'il n'existe pas encore
global.getGroupDB = (groupJid) => {
    if (!global.db.groups[groupJid]) {
        global.db.groups[groupJid] = {
            antilink: false,          // Suppression automatique des liens
            rules: [],                // Règles définies par l'admin via WhatsApp
            warnLimit: 3,             // Nombre d'avertissements avant expulsion
            warnings: {},             // Compteur d'avertissements par utilisateur
            autoclose: null,          // Heure de fermeture automatique (HH:MM)
            autoopen: null            // Heure d'ouverture automatique (HH:MM)
        }
    }
    return global.db.groups[groupJid]
}

// ─────────────────────────────────────────────────────────
// SYSTÈME MULTI-IA
// Priorité : OpenRouter (Meta Llama-3 gratuit) → Gemini → WisdomGate
// ─────────────────────────────────────────────────────────
global.getAIResponse = async (text, provider = 'auto') => {
    const nettoyer = (k) => (typeof k === 'string') ? k.trim() : ''

    // Clés Gemini valides (commencent par AIza)
    const clefsGemini = [
        nettoyer(process.env.GEMINI_KEY_1),
        nettoyer(process.env.GEMINI_KEY_2),
        nettoyer(process.env.GEMINI_KEY_3),
        nettoyer(process.env.GEMINI_KEY_4)
    ].filter(k => k.length > 10 && k.startsWith('AIza'))

    // Clés WisdomGate valides
    const clefsWG = [
        nettoyer(process.env.WISDOM_GATE_KEY_1),
        nettoyer(process.env.WISDOM_GATE_KEY_2)
    ].filter(k => k.length > 10 && !k.includes('votre_cle'))

    // Clé OpenRouter (Meta AI gratuit)
    const cleOpenRouter = nettoyer(process.env.OPENROUTER_KEY)

    console.log(`[IA-DEBUG] Gemini:${clefsGemini.length} WG:${clefsWG.length} OpenRouter:${cleOpenRouter ? 'oui' : 'non'}`)

    // ── Tentative via OpenRouter (Meta Llama-3 gratuit) ──
    const essayerOpenRouter = async () => {
        if (!cleOpenRouter) return null
        // Modèles gratuits disponibles sur OpenRouter
        const modeles = [
            'meta-llama/llama-3.3-70b-instruct:free',
            'meta-llama/llama-3.1-8b-instruct:free',
            'mistralai/mistral-7b-instruct:free'
        ]
        const client = new OpenAI({
            apiKey: cleOpenRouter,
            baseURL: 'https://openrouter.ai/api/v1',
            defaultHeaders: {
                'HTTP-Referer': process.env.RENDER_EXTERNAL_URL || 'https://ely-bot.vercel.app',
                'X-Title': 'Ely WhatsApp Bot'
            }
        })
        for (const modele of modeles) {
            try {
                console.log(`[IA-OPENROUTER] Essai du modèle ${modele}`)
                const completion = await client.chat.completions.create({
                    model: modele,
                    messages: [
                        { role: 'system', content: 'Tu es Ely, un assistant WhatsApp intelligent et sympathique. Réponds en français sauf si l\'utilisateur écrit dans une autre langue.' },
                        { role: 'user', content: text }
                    ],
                    max_tokens: 1200
                })
                const reponse = completion.choices?.[0]?.message?.content
                if (reponse) return reponse
            } catch (err) {
                console.error(`[IA-OPENROUTER] Échec ${modele} : ${err.message}`)
                if (err.status === 401 || err.status === 402) break // Clé invalide, on arrête
            }
        }
        return null
    }

    // ── Tentative via Google Gemini ──
    const essayerGemini = async () => {
        if (clefsGemini.length === 0) return null
        for (let i = 0; i < clefsGemini.length; i++) {
            const index = (global.db.geminiIndex + i) % clefsGemini.length
            const cle = clefsGemini[index]
            const genAI = new GoogleGenerativeAI(cle)
            // Modèles Gemini à essayer dans l'ordre
            const modeles = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-pro']
            for (const modeleId of modeles) {
                try {
                    console.log(`[IA-GEMINI] Essai ${modeleId} Clé #${index + 1}`)
                    const modele = genAI.getGenerativeModel({ model: modeleId })
                    const resultat = await modele.generateContent({
                        contents: [{ role: 'user', parts: [{ text }] }]
                    })
                    const reponse = await resultat.response
                    const texte = reponse.text()
                    if (texte) {
                        // Passer à la clé suivante pour équilibrer la charge
                        global.db.geminiIndex = (index + 1) % clefsGemini.length
                        return texte
                    }
                } catch (e) {
                    console.error(`[IA-GEMINI] Échec ${modeleId} Clé #${index + 1} : ${e.message}`)
                }
            }
        }
        return null
    }

    // ── Tentative via WisdomGate ──
    const essayerWisdomGate = async () => {
        if (clefsWG.length === 0) return null
        for (let i = 0; i < clefsWG.length; i++) {
            const index = (global.db.geminiIndex + i) % clefsWG.length
            const cle = clefsWG[index]
            const client = new OpenAI({ apiKey: cle, baseURL: 'https://wisdom-gate.juheapi.com/v1' })
            const modeles = ['deepseek-r1', 'deepseek-v3.1-terminus', 'gpt-5-nano']
            for (const modeleId of modeles) {
                try {
                    console.log(`[IA-WG] Essai ${modeleId} Clé #${index + 1}`)
                    const completion = await client.chat.completions.create({
                        model: modeleId,
                        messages: [{ role: 'user', content: text }],
                        max_tokens: 1000
                    })
                    const reponse = completion.choices?.[0]?.message?.content
                    if (reponse) return reponse
                } catch (err) {
                    console.error(`[IA-WG] Échec ${modeleId} Clé #${index + 1} : ${err.message}`)
                    if (err.status === 401 || err.status === 402) break
                }
            }
        }
        return null
    }

    // Sélection du fournisseur IA selon la commande utilisée
    if (provider === 'gemini') {
        const reponse = await essayerGemini()
        if (reponse) return { out: reponse, provider: 'gemini' }
    } else if (provider === 'meta' || provider === 'llama' || provider === 'openrouter') {
        const reponse = await essayerOpenRouter()
        if (reponse) return { out: reponse, provider: 'meta-llama' }
    } else if (provider === 'wisdom' || provider === 'wg') {
        const reponse = await essayerWisdomGate()
        if (reponse) return { out: reponse, provider: 'wisdomgate' }
    } else {
        // Mode automatique : OpenRouter → Gemini → WisdomGate
        const orReponse = await essayerOpenRouter()
        if (orReponse) return { out: orReponse, provider: 'meta-llama' }

        const geminiReponse = await essayerGemini()
        if (geminiReponse) return { out: geminiReponse, provider: 'gemini' }

        const wgReponse = await essayerWisdomGate()
        if (wgReponse) return { out: wgReponse, provider: 'wisdomgate' }
    }

    return { error: 'TOUS_IA_ECHOUES' }
}

// Alias pour compatibilité avec l'ancien code
global.getGeminiResponse = global.getAIResponse

// ─────────────────────────────────────────────────────────
// PLANIFICATEUR D'OUVERTURE/FERMETURE DES GROUPES
// Vérifie chaque minute si un groupe doit être ouvert ou fermé
// ─────────────────────────────────────────────────────────
let socketPlanificateur = null
setInterval(async () => {
    if (!socketPlanificateur || connectionStatus !== 'open') return
    const maintenant = new Date()
    const heureCourante = `${String(maintenant.getHours()).padStart(2, '0')}:${String(maintenant.getMinutes()).padStart(2, '0')}`

    for (const [groupJid, donneesGroupe] of Object.entries(global.db.groups || {})) {
        try {
            // Fermeture automatique programmée
            if (donneesGroupe.autoclose === heureCourante) {
                await socketPlanificateur.groupSettingUpdate(groupJid, 'announcement')
                await socketPlanificateur.sendMessage(groupJid, {
                    text: '🔒 *Groupe fermé automatiquement.*\nSeuls les admins peuvent écrire maintenant.'
                })
                console.log(`[PLANIFICATEUR] Groupe ${groupJid} fermé à ${heureCourante}`)
            }
            // Ouverture automatique programmée
            if (donneesGroupe.autoopen === heureCourante) {
                await socketPlanificateur.groupSettingUpdate(groupJid, 'not_announcement')
                await socketPlanificateur.sendMessage(groupJid, {
                    text: '🔓 *Groupe ouvert automatiquement.*\nTout le monde peut écrire maintenant.'
                })
                console.log(`[PLANIFICATEUR] Groupe ${groupJid} ouvert à ${heureCourante}`)
            }
        } catch (e) {
            console.error(`[PLANIFICATEUR-ERREUR] Groupe ${groupJid} :`, e.message)
        }
    }
}, 60000) // Vérification toutes les minutes

// Ping anti-veille pour Render (évite l'endormissement du serveur)
setInterval(() => {
    const url = process.env.RENDER_EXTERNAL_URL || process.env.RENDER_URL
    if (url && axios) axios.get(url).catch(() => { })
}, 60000)

// ─────────────────────────────────────────────────────────
// DÉMARRAGE DU BOT
// ─────────────────────────────────────────────────────────
async function startBot() {
    // Dossier de session : /tmp/session sur Vercel (éphémère), ./session en local
    const dossierSession = isVercel ? '/tmp/session' : 'session'
    const { state, saveCreds } = await useMultiFileAuthState(dossierSession)
    const { version } = await fetchLatestBaileysVersion()

    const sock = makeWASocket({
        version,
        logger: pino({ level: 'silent' }),
        printQRInTerminal: false,
        auth: state,
        browser: ['Ubuntu', 'Chrome', '20.0.04'],
        syncFullHistory: false,
        shouldSyncHistoryMessage: () => false,
        markOnlineOnConnect: true,
        generateHighQualityLinkPreview: false,
    })

    socketPlanificateur = sock

    // Décodage propre des JIDs (identifiants WhatsApp)
    sock.decodeJid = (jid) => {
        if (!jid) return jid
        if (/:\d+@/gi.test(jid)) {
            const decode = jidDecode(jid) || {}
            return decode.user && decode.server ? decode.user + '@' + decode.server : jid
        }
        return jid
    }

    // Retransmettre un message vers un autre chat
    sock.copyNForward = async (jid, message, forceForward = false, options = {}) => {
        let vtype
        if (options.readViewOnce) {
            message.message = message.message?.ephemeralMessage?.message || message.message || undefined
            vtype = Object.keys(message.message.viewOnceMessage.message)[0]
            delete (message.message?.ignore || undefined)
            delete message.message.viewOnceMessage.message[vtype].viewOnce
            message.message = { ...message.message.viewOnceMessage.message }
        }
        const mtype = Object.keys(message.message)[0]
        const content = await proto.Message.fromObject(message.message)
        if (forceForward) options.quoted = message
        const forward = await proto.WebMessageInfo.fromObject({
            key: { remoteJid: jid, fromMe: true, id: message.key.id },
            message: content,
            ...(options.quoted ? { quoted: options.quoted } : {})
        })
        return await sock.relayMessage(jid, forward.message, { messageId: forward.key.id })
    }

    // Gestion des événements de connexion
    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update

        if (qr) {
            qrCodeData = await QRCode.toDataURL(qr)
            io.emit('qr', qrCodeData)
        }

        if (connection === 'close') {
            connectionStatus = 'close'
            botDemarre = false
            io.emit('status', 'close')
            const raison = new Boom(lastDisconnect?.error)?.output.statusCode

            if (raison === DisconnectReason.badSession) {
                console.log('[DÉCONNEXION] Session corrompue — supprimez le dossier session et reconnectez.')
            } else if (raison === DisconnectReason.connectionReplaced) {
                console.log('[DÉCONNEXION] Session remplacée — une autre session est active.')
                process.exit()
            } else if (raison === DisconnectReason.loggedOut) {
                console.log('[DÉCONNEXION] Déconnecté — supprimez la session et reconnectez.')
                process.exit()
            } else {
                // Pour toutes les autres raisons, on tente de se reconnecter
                console.log(`[DÉCONNEXION] Raison : ${raison} — reconnexion en cours...`)
                botDemarre = true
                startBot()
            }
        } else if (connection === 'open') {
            const botId = sock.user.id.split(':')[0]
            console.log(`[BOT] Connecté en tant que ${botId}`)
            connectionStatus = 'open'
            botDemarre = true
            io.emit('status', 'open')
            qrCodeData = ''

            // Message de bienvenue envoyé au propriétaire
            try {
                const numeroProprietaire = global.owner[0].endsWith('@s.whatsapp.net')
                    ? global.owner[0] : global.owner[0] + '@s.whatsapp.net'
                await sock.sendMessage(numeroProprietaire, {
                    text: '🤖 *Ely-bot connecté !*\n\n✅ Tous les systèmes sont opérationnels.\n\n📝 Tapez `.menu` pour commencer.\n🆕 Nouveau : `.grp` pour gérer vos groupes.\n🦙 Nouveau : `.meta` pour Meta AI (Llama-3) gratuit.'
                })
            } catch (err) {
                console.error('[BOT] Échec d\'envoi du message de bienvenue :', err.message)
            }
        }
    })

    // Gestionnaire de demande de code de jumelage
    process.on('request-pairing', async (phone, socket) => {
        if (!sock.authState.creds.registered) {
            try {
                let code = await sock.requestPairingCode(phone)
                code = code?.match(/.{1,4}/g)?.join('-') || code
                socket.emit('pairing-code', code)
            } catch (e) {
                socket.emit('log', 'Erreur demande code : ' + e.message)
            }
        } else {
            socket.emit('log', 'Déjà connecté !')
        }
    })

    sock.ev.on('creds.update', saveCreds)
    sock.public = true

    // ── Persistance de la base de données (désactivée sur Vercel) ──
    const cheminDB = path.join(__dirname, 'database.json')

    const chargerDB = () => {
        try {
            if (!isVercel && fs.existsSync(cheminDB)) {
                const data = JSON.parse(fs.readFileSync(cheminDB, 'utf-8'))
                global.db = {
                    ...global.db,
                    ...data,
                    groups: { ...(data.groups || {}) }
                }
                global.db.msgStore = new Map()  // Non persisté (trop lourd)
                global.db.geminiIndex = 0
                console.log('[DB] Base de données chargée avec succès.')
            } else if (isVercel) {
                console.log('[DB] Mode Vercel — base de données en mémoire uniquement.')
            }
        } catch (e) {
            console.error('[DB] Erreur de chargement :', e)
        }
    }

    const sauvegarderDB = () => {
        if (isVercel) return // Pas d'écriture persistante possible sur Vercel
        try {
            const donnees = { ...global.db }
            delete donnees.msgStore // Ne pas sauvegarder le stockage de messages (trop lourd)
            fs.writeFileSync(cheminDB, JSON.stringify(donnees, null, 2))
        } catch (e) {
            console.error('[DB] Erreur de sauvegarde :', e)
        }
    }

    chargerDB()
    setInterval(sauvegarderDB, 30000) // Sauvegarde automatique toutes les 30 secondes

    // Traitement des messages entrants
    sock.ev.on('messages.upsert', async chatUpdate => {
        try {
            if (chatUpdate.type !== 'notify' && chatUpdate.type !== 'append') return

            const maintenant = Date.now() / 1000
            for (const m of chatUpdate.messages) {
                if (!m.message) continue

                // Gestion des statuts WhatsApp
                if (m.key?.remoteJid === 'status@broadcast') {
                    const expediteur = sock.decodeJid(m.key.participant || m.key.remoteJid)
                    if (global.db.settings.statusView) await sock.readMessages([m.key])
                    if (global.db.settings.statusLike && !m.key.fromMe) {
                        await sock.sendMessage('status@broadcast', {
                            react: { text: '❤️', key: m.key }
                        }, { statusJidList: [expediteur] })
                    }
                    // Stockage du statut pour anti-suppression
                    global.db.msgStore.set(m.key.id, {
                        m, msg: m.message,
                        type: getContentType(m.message),
                        sender: expediteur,
                        from: 'status@broadcast',
                        isStatus: true
                    })
                    continue
                }

                // Ignorer les vieux messages reçus à la reconnexion
                if (chatUpdate.type === 'notify' && (maintenant - m.messageTimestamp) > 60) continue

                const expediteurJid = m.key.remoteJid
                console.log(`[MSG] ${expediteurJid.split('@')[0]}: ${JSON.stringify(m.message).substring(0, 80)}`)

                // Passer le message au gestionnaire de commandes
                handler(sock, m, chatUpdate).catch(err => {
                    console.error('[ERREUR] Gestionnaire :', err)
                })
            }
        } catch (err) {
            console.error('[ERREUR] messages.upsert :', err)
        }
    })

    return sock
}

// Démarrage automatique : immédiat en local, à la demande sur Vercel
if (!isVercel) {
    botDemarre = true
    startBot()
} else {
    console.log('[VERCEL] Mode serverless — le bot démarre sur la première requête /api/start.')
    botDemarre = true
    startBot().catch(err => {
        console.error('[VERCEL] Échec du démarrage automatique :', err.message)
        botDemarre = false
    })
}
