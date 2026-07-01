require('./config')
// Baileys v7 est ESM pur — on utilise le wrapper d'import() dynamique
const { getBaileys } = require('./lib/baileys')
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
    connecte: connectionStatus === 'open',
    owner: global.owner?.[0] || 'non défini'
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
// ─────────────────────────────────────────────────────────
global.db = {
    jeux: {},
    groups: {},
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
    msgStore: new Map(),
    geminiIndex: 0
}

// Initialise les données d'un groupe s'il n'existe pas encore
global.getGroupDB = (groupJid) => {
    if (!global.db.groups[groupJid]) {
        global.db.groups[groupJid] = {
            antilink: false,
            rules: [],
            warnLimit: 3,
            warnings: {},
            autoclose: null,
            autoopen: null
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

    const clefsGemini = [
        nettoyer(process.env.GEMINI_KEY_1),
        nettoyer(process.env.GEMINI_KEY_2),
        nettoyer(process.env.GEMINI_KEY_3),
        nettoyer(process.env.GEMINI_KEY_4)
    ].filter(k => k.length > 10 && k.startsWith('AIza'))

    const clefsWG = [
        nettoyer(process.env.WISDOM_GATE_KEY_1),
        nettoyer(process.env.WISDOM_GATE_KEY_2)
    ].filter(k => k.length > 10 && !k.includes('votre_cle'))

    // ── OpenRouter : accepte sk-or-v1-... (ne PAS filtrer par startsWith)
    const cleOpenRouter = nettoyer(process.env.OPENROUTER_KEY)
    const openRouterValide = cleOpenRouter.length > 10

    console.log(`[IA-DEBUG] Gemini:${clefsGemini.length} WG:${clefsWG.length} OpenRouter:${openRouterValide ? 'OUI('+cleOpenRouter.substring(0,12)+'...)' : 'NON'}`)

    // ── OpenRouter — Meta Llama-3 (gratuit) ──
    const essayerOpenRouter = async () => {
        if (!openRouterValide) {
            console.log('[IA-OPENROUTER] Clé manquante ou invalide, saut.')
            return null
        }
        const modeles = [
            'meta-llama/llama-3.3-70b-instruct:free',
            'meta-llama/llama-3.1-8b-instruct:free',
            'mistralai/mistral-7b-instruct:free',
            'deepseek/deepseek-r1:free'
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
                console.log(`[IA-OPENROUTER] Essai modèle: ${modele}`)
                const completion = await client.chat.completions.create({
                    model: modele,
                    messages: [
                        { role: 'system', content: 'Tu es Ely, un assistant WhatsApp intelligent. Réponds en français sauf si l\'utilisateur écrit dans une autre langue.' },
                        { role: 'user', content: text }
                    ],
                    max_tokens: 1200
                })
                const reponse = completion.choices?.[0]?.message?.content
                if (reponse && reponse.trim().length > 0) {
                    console.log(`[IA-OPENROUTER] Succès avec ${modele}`)
                    return reponse
                }
            } catch (err) {
                console.error(`[IA-OPENROUTER] Échec ${modele} : ${err.message}`)
                // Seulement arrêter si c'est une erreur d'auth (401/402)
                if (err.status === 401 || err.status === 402) {
                    console.error('[IA-OPENROUTER] Erreur d\'authentification, vérifiez OPENROUTER_KEY')
                    break
                }
                // Pour les autres erreurs, essayer le modèle suivant
            }
        }
        return null
    }

    // ── Google Gemini ──
    const essayerGemini = async () => {
        if (clefsGemini.length === 0) return null
        for (let i = 0; i < clefsGemini.length; i++) {
            const index = (global.db.geminiIndex + i) % clefsGemini.length
            const cle = clefsGemini[index]
            const genAI = new GoogleGenerativeAI(cle)
            const modeles = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-pro']
            for (const modeleId of modeles) {
                try {
                    const modele = genAI.getGenerativeModel({ model: modeleId })
                    const resultat = await modele.generateContent({
                        contents: [{ role: 'user', parts: [{ text }] }]
                    })
                    const texte = (await resultat.response).text()
                    if (texte) {
                        global.db.geminiIndex = (index + 1) % clefsGemini.length
                        return texte
                    }
                } catch (e) {
                    console.error(`[IA-GEMINI] Échec ${modeleId} : ${e.message}`)
                }
            }
        }
        return null
    }

    // ── WisdomGate ──
    const essayerWisdomGate = async () => {
        if (clefsWG.length === 0) return null
        for (let i = 0; i < clefsWG.length; i++) {
            const index = (global.db.geminiIndex + i) % clefsWG.length
            const client = new OpenAI({ apiKey: clefsWG[index], baseURL: 'https://wisdom-gate.juheapi.com/v1' })
            for (const modeleId of ['deepseek-r1', 'deepseek-v3.1-terminus', 'gpt-5-nano']) {
                try {
                    const completion = await client.chat.completions.create({
                        model: modeleId,
                        messages: [{ role: 'user', content: text }],
                        max_tokens: 1000
                    })
                    const reponse = completion.choices?.[0]?.message?.content
                    if (reponse) return reponse
                } catch (err) {
                    console.error(`[IA-WG] Échec ${modeleId} : ${err.message}`)
                    if (err.status === 401 || err.status === 402) break
                }
            }
        }
        return null
    }

    // Sélection du fournisseur IA
    if (provider === 'gemini') {
        const r = await essayerGemini(); if (r) return { out: r, provider: 'gemini' }
    } else if (provider === 'meta' || provider === 'llama' || provider === 'openrouter') {
        const r = await essayerOpenRouter(); if (r) return { out: r, provider: 'meta-llama' }
    } else if (provider === 'wisdom' || provider === 'wg') {
        const r = await essayerWisdomGate(); if (r) return { out: r, provider: 'wisdomgate' }
    } else {
        // Mode automatique : OpenRouter → Gemini → WisdomGate
        const r1 = await essayerOpenRouter(); if (r1) return { out: r1, provider: 'meta-llama' }
        const r2 = await essayerGemini(); if (r2) return { out: r2, provider: 'gemini' }
        const r3 = await essayerWisdomGate(); if (r3) return { out: r3, provider: 'wisdomgate' }
    }
    return { error: 'TOUS_IA_ECHOUES' }
}
global.getGeminiResponse = global.getAIResponse

// ─────────────────────────────────────────────────────────
// PLANIFICATEUR OUVERTURE/FERMETURE DES GROUPES
// ─────────────────────────────────────────────────────────
let socketPlanificateur = null
setInterval(async () => {
    if (!socketPlanificateur || connectionStatus !== 'open') return
    const maintenant = new Date()
    const heure = `${String(maintenant.getHours()).padStart(2, '0')}:${String(maintenant.getMinutes()).padStart(2, '0')}`
    for (const [jid, grp] of Object.entries(global.db.groups || {})) {
        try {
            if (grp.autoclose === heure) {
                await socketPlanificateur.groupSettingUpdate(jid, 'announcement')
                await socketPlanificateur.sendMessage(jid, { text: '🔒 *Groupe fermé automatiquement.* Seuls les admins peuvent écrire.' })
            }
            if (grp.autoopen === heure) {
                await socketPlanificateur.groupSettingUpdate(jid, 'not_announcement')
                await socketPlanificateur.sendMessage(jid, { text: '🔓 *Groupe ouvert automatiquement.* Tout le monde peut écrire.' })
            }
        } catch (e) { console.error(`[PLANIFICATEUR] ${jid} :`, e.message) }
    }
}, 60000)

// Ping anti-veille pour Render / keep-alive général
setInterval(() => {
    const url = process.env.RENDER_EXTERNAL_URL || process.env.RENDER_URL
    if (url) axios.get(`${url}/health`).catch(() => { })
}, 45000)

// ─────────────────────────────────────────────────────────
// DÉMARRAGE DU BOT
// ─────────────────────────────────────────────────────────
async function startBot() {
    const {
        default: makeWASocket,
        useMultiFileAuthState,
        DisconnectReason,
        fetchLatestBaileysVersion,
        jidDecode,
        proto,
        getContentType,
        makeCacheableSignalKeyStore,
        Browsers
    } = await getBaileys()

    // Rendre getContentType accessible globalement pour le handler
    global._baileysGetContentType = getContentType

    // Dossier de session stable
    const dossierSession = isVercel ? '/tmp/session' : path.join(__dirname, 'session')
    if (!fs.existsSync(dossierSession)) fs.mkdirSync(dossierSession, { recursive: true })

    const { state, saveCreds } = await useMultiFileAuthState(dossierSession)
    const { version } = await fetchLatestBaileysVersion()

    const sock = makeWASocket({
        version,
        logger: pino({ level: 'silent' }),
        printQRInTerminal: false,
        auth: state,
        // Imite WhatsApp Desktop pour une session plus stable
        browser: Browsers ? Browsers.ubuntu('Chrome') : ['Ubuntu', 'Chrome', '124.0.0'],
        syncFullHistory: false,
        shouldSyncHistoryMessage: () => false,
        markOnlineOnConnect: true,
        generateHighQualityLinkPreview: false,
        // Keepalive pour éviter les déconnexions
        keepAliveIntervalMs: 30000,
        connectTimeoutMs: 60000,
        defaultQueryTimeoutMs: 60000,
        retryRequestDelayMs: 2000,
    })

    socketPlanificateur = sock

    // Décodage propre des JIDs WhatsApp
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
        if (options.readViewOnce) {
            message.message = message.message?.ephemeralMessage?.message || message.message
            const vtype = Object.keys(message.message.viewOnceMessage.message)[0]
            delete message.message?.ignore
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
            const statusCode = new Boom(lastDisconnect?.error)?.output?.statusCode
            console.log(`[DÉCONNEXION] Code de statut: ${statusCode}`)

            if (statusCode === DisconnectReason.connectionReplaced) {
                console.log('[DÉCONNEXION] Session remplacée sur un autre appareil.'); process.exit(0)
            } else if (statusCode === DisconnectReason.loggedOut) {
                console.log('[DÉCONNEXION] Déconnecté manuellement — supprimez le dossier session.')
                // Ne pas redémarrer si déconnexion volontaire
            } else if (statusCode === DisconnectReason.badSession) {
                console.log('[DÉCONNEXION] Session corrompue — suppression et redémarrage...')
                try {
                    fs.rmSync(dossierSession, { recursive: true, force: true })
                    fs.mkdirSync(dossierSession, { recursive: true })
                } catch (e) { }
                setTimeout(() => { botDemarre = true; startBot() }, 5000)
            } else {
                // Reconnexion automatique avec délai croissant
                const delai = statusCode === 408 ? 10000 : 5000
                console.log(`[DÉCONNEXION] Reconnexion dans ${delai/1000}s...`)
                setTimeout(() => { botDemarre = true; startBot() }, delai)
            }
        } else if (connection === 'open') {
            connectionStatus = 'open'
            botDemarre = true
            io.emit('status', 'open')
            qrCodeData = ''

            // ── OWNER DYNAMIQUE : lire le numéro réel de la session ──
            const jidConnecte = sock.user?.id ? sock.decodeJid(sock.user.id) : null
            if (jidConnecte) {
                const numeroConnecte = jidConnecte.split('@')[0]
                // Si pas de OWNER_NUMBER dans .env, utiliser le numéro de la session
                if (!process.env.OWNER_NUMBER || global.owner[0] === '') {
                    global.owner = [numeroConnecte]
                    console.log(`[OWNER] Numéro détecté automatiquement : ${numeroConnecte}`)
                } else {
                    console.log(`[OWNER] Numéro depuis .env : ${global.owner[0]}`)
                }
                global.authorNum = jidConnecte
            }

            console.log(`[BOT] ✅ Connecté en tant que ${sock.user?.id?.split(':')[0]} | Owner: ${global.owner[0]}`)

            try {
                const jidOwner = global.owner[0].endsWith('@s.whatsapp.net')
                    ? global.owner[0] : global.owner[0] + '@s.whatsapp.net'
                await sock.sendMessage(jidOwner, {
                    text: `🤖 *Ely-bot connecté !*\n\n✅ Tous les systèmes sont opérationnels.\n📱 Numéro : ${global.owner[0]}\n\n📝 Tapez \`.menu\` pour commencer.\n🦙 Tapez \`.meta\` pour Meta AI (Llama-3) gratuit.`
                })
            } catch (err) { console.error('[BOT] Échec message de bienvenue :', err.message) }
        }
    })

    // Gestionnaire de code de jumelage
    process.on('request-pairing', async (phone, socket) => {
        if (!sock.authState.creds.registered) {
            try {
                let code = await sock.requestPairingCode(phone)
                code = code?.match(/.{1,4}/g)?.join('-') || code
                socket.emit('pairing-code', code)
            } catch (e) { socket.emit('log', 'Erreur code : ' + e.message) }
        } else { socket.emit('log', 'Déjà connecté !') }
    })

    sock.ev.on('creds.update', saveCreds)
    sock.public = true

    // ── Persistance de la base de données ──
    const cheminDB = path.join(__dirname, 'database.json')

    const chargerDB = () => {
        try {
            if (!isVercel && fs.existsSync(cheminDB)) {
                const data = JSON.parse(fs.readFileSync(cheminDB, 'utf-8'))
                global.db = { ...global.db, ...data, groups: { ...(data.groups || {}) } }
                global.db.msgStore = new Map()
                global.db.geminiIndex = 0
                console.log('[DB] Base de données chargée.')
            } else if (isVercel) {
                console.log('[DB] Mode Vercel — base en mémoire uniquement.')
            }
        } catch (e) { console.error('[DB] Erreur chargement :', e) }
    }

    const sauvegarderDB = () => {
        if (isVercel) return
        try {
            const donnees = { ...global.db }
            delete donnees.msgStore
            fs.writeFileSync(cheminDB, JSON.stringify(donnees, null, 2))
        } catch (e) { console.error('[DB] Erreur sauvegarde :', e) }
    }

    chargerDB()
    setInterval(sauvegarderDB, 30000)

    // ── Mémoriser les groupes pour les commandes par nom ──
    // Met à jour la liste des groupes périodiquement
    const mettreAJourGroupes = async () => {
        if (connectionStatus !== 'open') return
        try {
            const groupes = await sock.groupFetchAllParticipating()
            global.db.groupsCache = groupes  // { [jid]: { id, subject, ... } }
            console.log(`[GROUPES] ${Object.keys(groupes).length} groupes en cache.`)
        } catch (e) {
            console.warn('[GROUPES] Échec mise à jour cache :', e.message)
        }
    }
    setTimeout(mettreAJourGroupes, 10000)
    setInterval(mettreAJourGroupes, 600000) // toutes les 10 minutes

    // Traitement des messages entrants
    sock.ev.on('messages.upsert', async chatUpdate => {
        try {
            if (chatUpdate.type !== 'notify' && chatUpdate.type !== 'append') return
            const maintenant = Date.now() / 1000
            for (const m of chatUpdate.messages) {
                if (!m.message) continue

                // Gestion des statuts WhatsApp
                if (m.key?.remoteJid === 'status@broadcast') {
                    const exp = sock.decodeJid(m.key.participant || m.key.remoteJid)
                    if (global.db.settings.statusView) await sock.readMessages([m.key])
                    if (global.db.settings.statusLike && !m.key.fromMe) {
                        await sock.sendMessage('status@broadcast', { react: { text: '❤️', key: m.key } }, { statusJidList: [exp] })
                    }
                    global.db.msgStore.set(m.key.id, { m, msg: m.message, type: getContentType(m.message), sender: exp, from: 'status@broadcast', isStatus: true })
                    continue
                }

                // Ignorer les vieux messages reçus à la reconnexion (> 60s)
                if (chatUpdate.type === 'notify' && (maintenant - m.messageTimestamp) > 60) continue

                console.log(`[MSG] ${m.key.remoteJid.split('@')[0]}`)

                // Passer le message au gestionnaire principal
                handler(sock, m, chatUpdate).catch(err => console.error('[ERREUR] Handler :', err))
            }
        } catch (err) { console.error('[ERREUR] messages.upsert :', err) }
    })

    return sock
}

// Démarrage immédiat
botDemarre = true
startBot().catch(err => {
    console.error('[DEMARRAGE] Erreur critique :', err.message)
    botDemarre = false
})
