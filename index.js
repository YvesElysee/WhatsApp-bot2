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
// JUMELAGE PAR CODE (PAIRING CODE) — gestionnaire UNIQUE
// (avant : enregistré dans startBot() → un listener par reconnexion,
//  les anciens utilisaient un socket mort → code invalide)
// ─────────────────────────────────────────────────────────
const NUMBER_PAIRING = String(process.env.PAIRING_NUMBER || '').replace(/[^0-9]/g, '')
let socketCourant = null
let dernierCodePairing = 0

const AFFICHER_CODE = (code) => {
    const L = 36
    const centrer = (txt) => {
        const vide = Math.max(0, L - txt.length)
        const gauche = Math.floor(vide / 2)
        return '║' + ' '.repeat(gauche) + txt + ' '.repeat(vide - gauche) + '║'
    }
    console.log('')
    console.log('╔' + '═'.repeat(L) + '╗')
    console.log(centrer(''))
    console.log(centrer('  CODE DE JUMELAGE  '))
    console.log(centrer(''))
    console.log(centrer('   ' + code + '   '))
    console.log(centrer(''))
    console.log('╚' + '═'.repeat(L) + '╝')
    console.log('')
    console.log('📱 Sur votre téléphone :')
    console.log('   WhatsApp → Réglages → Appareils connectés')
    console.log('   → Connecter un appareil → Lier avec le numéro')
    console.log('   → Saisissez le code ci-dessus (valable ~2 min)')
    console.log('')
}

const demanderCodePairing = async (phone, force = false) => {
    const sock = socketCourant
    if (!sock) return false
    if (sock.authState?.creds?.registered) return false
    if (!force && Date.now() - dernierCodePairing < 90000) return false
    dernierCodePairing = Date.now()
    try {
        const brut = await sock.requestPairingCode(phone)
        const code = brut?.match(/.{1,4}/g)?.join('-') || brut
        AFFICHER_CODE(code)
        io.emit('pairing-code', code)
        return true
    } catch (e) {
        console.error('[JUMELAGE] Impossible de générer le code :', e.message)
        // On retente une fois après reconnexion du socket
        setTimeout(() => {
            if (!sock.authState?.creds?.registered) demanderCodePairing(phone, true).catch(() => { })
        }, 8000)
        return false
    }
}

// Unique listener : utilise TOUJOURS le socket en cours
process.on('request-pairing', (phone) => {
    const num = String(phone || '').replace(/[^0-9]/g, '')
    if (num.length < 10) return console.warn('[JUMELAGE] Numéro invalide :', phone)
    demanderCodePairing(num, true)
})

// ─────────────────────────────────────────────────────────
// BASE DE DONNÉES GLOBALE
// ─────────────────────────────────────────────────────────
global.db = {
    // Jeux en cours (clé = JID du chat). En mémoire uniquement, jamais persistés.
    games: {},
    groups: {},
    settings: {
        antidelete: false,
        autoreact: false,
        privateMode: false,
        ibOnly: false,
        // Accès IA : false = tout le monde, true = propriétaire uniquement (.aionly on/off)
        aiOnly: false,
        chatbot: false,
        statusView: false,
        statusLike: false,
        statusAntidelete: false,
        // Mode privé : seul le propriétaire utilise le bot (les réponses
        // restent dans le chat). replyInPv : réponses envoyées en PV owner.
        replyInPv: false,
        active: true
    },
    mods: [],
    msgStore: new Map(),
    geminiIndex: 0,
    // Mémoire conversationnelle de l'IA (par chat) et niveaux de jeu
    historique: {},
    difficulte: {},
    difficulteJoueur: {},
    // Résumés glissants (conversations longues) et mémoire des participants
    resumes: {},
    memoire: {},
    // Scores des jeux (classement .top)
    scores: {}
}

// Alias rétro-compatible : certains modules utilisent encore global.db.jeux
Object.defineProperty(global.db, 'jeux', {
    get() { return this.games },
    set(v) { this.games = v },
    enumerable: false,
    configurable: true
})

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
// HELPERS GLOBAUX (partagés par handler.js et les commandes)
// ─────────────────────────────────────────────────────────

// Numéro "propre" sans device ni domaine : 123:4@s.whatsapp.net → 123
global.jidToNumber = (jid) => {
    if (!jid || typeof jid !== 'string') return ''
    return jid.split('@')[0].split(':')[0]
}

// Comparaison robuste de deux JID (gère @s.whatsapp.net, @lid et le suffixe :device)
global.sameJid = (a, b) => {
    if (!a || !b) return false
    return global.jidToNumber(a) === global.jidToNumber(b)
}

// JID du propriétaire (toujours au format @s.whatsapp.net)
global.ownerJid = () => {
    const o = global.owner?.[0] || global.authorNum || ''
    if (!o) return null
    return o.endsWith('@s.whatsapp.net') ? o : `${global.jidToNumber(o)}@s.whatsapp.net`
}

// Cache des métadonnées de groupe pour éviter un appel réseau à chaque message
// (cause principale de lenteur dans les groupes)
const _groupMetaCache = new Map()
const GROUP_META_TTL = 60 * 1000 // 60 s

global.getGroupMetadata = async (sock, jid, force = false) => {
    if (!jid || !jid.endsWith('@g.us')) return null
    const cached = _groupMetaCache.get(jid)
    if (!force && cached && (Date.now() - cached.at) < GROUP_META_TTL) {
        return cached.meta
    }
    try {
        const meta = await sock.groupMetadata(jid)
        if (meta?.participants?.length) {
            _groupMetaCache.set(jid, { meta, at: Date.now() })
            return meta
        }
    } catch (e) {
        // En cas d'échec, renvoyer le cache périmé s'il existe
        if (cached) return cached.meta
        console.warn(`[GROUPES] groupMetadata(${jid}) échoué : ${e.message}`)
    }
    return cached ? cached.meta : null
}

// Vérifie si un JID (bot ou membre) est admin d'après les métadonnées
// Gère les JID classiques ET les JID @lid (migration WhatsApp)
global.estAdminDans = (meta, jid) => {
    if (!meta?.participants || !jid) return false
    const cible = global.jidToNumber(jid)
    if (!cible) return false
    const p = meta.participants.find(part => {
        const id = global.jidToNumber(part.id)
        const lid = global.jidToNumber(part.lid)
        return id === cible || (lid && lid === cible)
    })
    return !!(p && (p.admin === 'admin' || p.admin === 'superadmin'))
}

// ─────────────────────────────────────────────────────────
// SYSTÈME MULTI-IA
// Priorité : OpenRouter (Meta Llama-3 gratuit) → Gemini → WisdomGate
// `systemPrompt` optionnel permet aux commandes (jeux, jeux de rôle...) de
// définir leur propre persona, ce qui évite que l'IA "refuse" la tâche.
// ─────────────────────────────────────────────────────────
const PROMPT_SYSTEME_DEFAUT =
    "Tu es ElyAi, un assistant IA créé et conçu exclusivement par Elysee. " +
    "Tu fais partie intégrante de ce bot WhatsApp personnel. " +
    "Tu connais ton créateur : Elysee. " +
    "Réponds toujours dans la langue de l'utilisateur. " +
    "Apprends au fur et à mesure de chaque conversation. Garde en mémoire l'identité, le nom et le contexte de chaque personne avec qui tu parles. " +
    "Sois naturel, direct, utile. Ne dis jamais que tu es Gemini, ni un autre modèle. " +
    "Si on te demande qui tu es, réponds : Je suis ElyAi, conçu par Elysee pour ce bot."

// Applique un délai maximum à une promesse (évite les blocages réseau)
const avecDelai = (promesse, ms, libelle) => Promise.race([
    promesse,
    new Promise((_, reject) => setTimeout(() => reject(new Error(`Délai dépassé (${libelle})`)), ms))
])

global.getAIResponse = async (text, provider = 'auto', systemPrompt = null, historiqueChat = []) => {
    const nettoyer = (k) => (typeof k === 'string') ? k.trim() : ''
    const sys = systemPrompt || PROMPT_SYSTEME_DEFAUT

    // ── Mémoire de conversation ──
    // `historiqueChat` = derniers échanges [{role:'user'|'bot', contenu}] du
    // chat. L'IA revoit donc le fil de la discussion et garde le contexte.
    const entrees = Array.isArray(historiqueChat) ? historiqueChat.slice(-20) : []
    const messagesIA = [
        { role: 'system', content: sys },
        ...entrees.map(e => ({ role: e.role === 'bot' ? 'assistant' : 'user', content: e.contenu })),
        { role: 'user', content: text }
    ]
    // Gemini utilise {role:'user'|'model', parts:[...]} au lieu de messages
    const contentsGemini = [
        ...entrees.map(e => ({
            role: e.role === 'bot' ? 'model' : 'user',
            parts: [{ text: e.contenu }]
        })),
        { role: 'user', parts: [{ text }] }
    ]
    // Gemini refuse deux rôles identiques consécutifs : on fusionne
    for (let i = contentsGemini.length - 2; i >= 0; i--) {
        if (contentsGemini[i].role === contentsGemini[i + 1].role) {
            contentsGemini[i].parts[0].text += '\n' + contentsGemini[i + 1].parts[0].text
            contentsGemini.splice(i + 1, 1)
        }
    }
    if (contentsGemini[0]?.role === 'model') contentsGemini.shift()

    // Budget global : toute la chaîne (tous fournisseurs confondus) ne doit
    // jamais dépasser 60 s — évite de faire attendre un chat ou un jeu.
    const debut = Date.now()
    const BUDGET_MS = 60000
    const resteDuTemps = () => BUDGET_MS - (Date.now() - debut)
    const delaiPour = (ms) => Math.max(2000, Math.min(ms, resteDuTemps()))
    const budgetEpuise = () => resteDuTemps() < 3000

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

    console.log(`[IA-DEBUG] Gemini:${clefsGemini.length} WG:${clefsWG.length} OpenRouter:${openRouterValide ? 'OUI' : 'NON'}`)

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
            if (budgetEpuise()) break
            try {
                console.log(`[IA-OPENROUTER] Essai modèle: ${modele}`)
                const completion = await avecDelai(client.chat.completions.create({
                    model: modele,
                    messages: messagesIA,
                    max_tokens: 1200
                }), delaiPour(30000), 'openrouter')
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
            if (budgetEpuise()) return null
            const index = (global.db.geminiIndex + i) % clefsGemini.length
            const cle = clefsGemini[index]
            const genAI = new GoogleGenerativeAI(cle)
            const modeles = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-pro']
            for (const modeleId of modeles) {
                if (budgetEpuise()) return null
                try {
                    const modele = genAI.getGenerativeModel({
                        model: modeleId,
                        systemInstruction: sys
                    })
                    const resultat = await avecDelai(modele.generateContent({
                        contents: contentsGemini,
                        // Désactive les filtres qui font "refuser" l'IA sur des sujets anodins
                        safetySettings: [
                            { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_ONLY_HIGH' },
                            { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_ONLY_HIGH' },
                            { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_ONLY_HIGH' },
                            { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_ONLY_HIGH' }
                        ]
                    }), delaiPour(30000), 'gemini')
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
            if (budgetEpuise()) return null
            const index = (global.db.geminiIndex + i) % clefsWG.length
            const client = new OpenAI({ apiKey: clefsWG[index], baseURL: 'https://wisdom-gate.juheapi.com/v1' })
            for (const modeleId of ['deepseek-r1', 'deepseek-v3.1-terminus', 'gpt-5-nano']) {
                if (budgetEpuise()) return null
                try {
                    const completion = await avecDelai(client.chat.completions.create({
                        model: modeleId,
                        messages: messagesIA,
                        max_tokens: 1000
                    }), delaiPour(30000), 'wisdomgate')
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
    // Un fournisseur explicite qui échoue retombe sur la chaîne complète
    // au lieu de renvoyer une erreur immédiate.
    const chaineComplete = async () => {
        if (!budgetEpuise()) { const r1 = await essayerOpenRouter(); if (r1) return { out: r1, provider: 'meta-llama' } }
        if (!budgetEpuise()) { const r2 = await essayerGemini(); if (r2) return { out: r2, provider: 'gemini' } }
        if (!budgetEpuise()) { const r3 = await essayerWisdomGate(); if (r3) return { out: r3, provider: 'wisdomgate' } }
        return null
    }

    if (provider === 'gemini') {
        const r = await essayerGemini(); if (r) return { out: r, provider: 'gemini' }
        if (!budgetEpuise()) { const o = await essayerOpenRouter(); if (o) return { out: o, provider: 'meta-llama' } }
        if (!budgetEpuise()) { const w = await essayerWisdomGate(); if (w) return { out: w, provider: 'wisdomgate' } }
    } else if (provider === 'meta' || provider === 'llama' || provider === 'openrouter') {
        const r = await essayerOpenRouter(); if (r) return { out: r, provider: 'meta-llama' }
        if (!budgetEpuise()) { const g = await essayerGemini(); if (g) return { out: g, provider: 'gemini' } }
        if (!budgetEpuise()) { const w = await essayerWisdomGate(); if (w) return { out: w, provider: 'wisdomgate' } }
    } else if (provider === 'wisdom' || provider === 'wg') {
        const r = await essayerWisdomGate(); if (r) return { out: r, provider: 'wisdomgate' }
        if (!budgetEpuise()) { const o = await essayerOpenRouter(); if (o) return { out: o, provider: 'meta-llama' } }
        if (!budgetEpuise()) { const g = await essayerGemini(); if (g) return { out: g, provider: 'gemini' } }
    } else {
        // Mode automatique : OpenRouter → Gemini → WisdomGate
        const r = await chaineComplete(); if (r) return r
    }
    return { error: 'TOUS_IA_ECHOUES' }
}
global.getGeminiResponse = global.getAIResponse
// Alias historiques utilisés par plusieurs commandes de jeux
global.getDeepSeekResponse = (text, sys) => global.getAIResponse(text, 'auto', sys)
global.getMetaAIResponse = (text, sys) => global.getAIResponse(text, 'meta', sys)

// ─────────────────────────────────────────────────────────
// MÉMOIRE DE CONVERSATION (par chat)
// L'IA revoit les derniers échanges du groupe/MP pour suivre
// le fil de la discussion sans perdre le contexte.
// ─────────────────────────────────────────────────────────
const HISTORIQUE_MAX_PAR_CHAT = 20      // 20 derniers échanges retenus
const HISTORIQUE_MAX_CARACTES = 1200    // tronque un échange trop long
const HISTORIQUE_MAX_CHATS = 300        // nombre de chats mémorisés (anti-gonflement)

global.getHistorique = (chatId) => {
    if (!global.db.historique) global.db.historique = {}
    if (!global.db.historique[chatId]) global.db.historique[chatId] = []
    return global.db.historique[chatId]
}

global.ajouterHistorique = (chatId, role, texte) => {
    if (!texte) return
    const h = global.getHistorique(chatId)
    h.push({
        role,
        contenu: String(texte).slice(0, HISTORIQUE_MAX_CARACTES),
        ts: Date.now()
    })
    // On garde seulement les N derniers échanges
    while (h.length > HISTORIQUE_MAX_PAR_CHAT) h.shift()

    // Anti-gonflement : on ne conserve que les chats les plus récents
    const chats = Object.keys(global.db.historique)
    if (chats.length > HISTORIQUE_MAX_CHATS) {
        chats
            .sort((a, b) => {
                const da = global.db.historique[a].slice(-1)[0]?.ts || 0
                const db = global.db.historique[b].slice(-1)[0]?.ts || 0
                return da - db
            })
            .slice(0, chats.length - HISTORIQUE_MAX_CHATS)
            .forEach(vieux => delete global.db.historique[vieux])
    }
    try { global.resumerSiBesoin?.(chatId) } catch (e) { }
}

global.effacerHistorique = (chatId) => {
    if (global.db.historique) delete global.db.historique[chatId]
    if (global.db.resumes) delete global.db.resumes[chatId]
}

// Mémoire par participant
global.recordMembre = (chatId, userJid, nom, texte) => {
    if (!chatId || !userJid) return
    if (!global.db.memoire) global.db.memoire = {}
    if (!global.db.memoire[chatId]) global.db.memoire[chatId] = {}
    const cle = (global.jidToNumber ? global.jidToNumber(userJid) : userJid) || userJid
    if (!global.db.memoire[chatId][cle]) global.db.memoire[chatId][cle] = { nom: nom || '', notes: [], derniers: [], vus: 0 }
    const m = global.db.memoire[chatId][cle]
    if (nom) m.nom = nom
    m.derniers = [String(texte || '').slice(0, 150), ...(m.derniers || [])].slice(0, 5)
    m.vus = (m.vus || 0) + 1
    m.ts = Date.now()
}

global.memoireParticipants = (chatId) => {
    try {
        const mem = global.db.memoire?.[chatId]
        if (!mem) return ''
        const lignes = []
        for (const [jid, infos] of Object.entries(mem)) {
            if (infos.notes && infos.notes.length) {
                lignes.push(`${infos.nom || jid} : ${infos.notes.slice(-3).join(' | ')}`)
            }
        }
        return lignes.slice(0, 10).join('\n')
    } catch (e) { return '' }
}

// Contexte IA enrichi
global.historiquePourIA = (chatId, exclureDernier = false) => {
    try {
        let h = global.getHistorique(chatId)
        if (exclureDernier && h.length) h = h.slice(0, -1)
        const entrees = []
        const resume = global.db.resumes?.[chatId]
        if (resume) entrees.push({ role: 'user', contenu: `[Résumé des échanges précédents] ${resume}` })
        const memo = typeof global.memoireParticipants === 'function' ? global.memoireParticipants(chatId) : ''
        if (memo) entrees.push({ role: 'user', contenu: `[Mémoire] ${memo}` })
        for (const e of h) entrees.push({ role: e.role, contenu: e.contenu })
        return entrees
    } catch (e) { return [] }
}

if (!global._resumeEnCours) global._resumeEnCours = new Set()
global.resumerSiBesoin = async (chatId) => {
    try {
        const h = global.getHistorique(chatId)
        if (h.length < 24) return
        if (global._resumeEnCours.has(chatId)) return
        if (typeof global.getAIResponse !== 'function') return
        global._resumeEnCours.add(chatId)
        const aResumer = h.slice(0, h.length - 10)
        const texte = aResumer.map(e => `${e.role === 'bot' ? 'Bot' : 'Membre'}: ${e.contenu}`).join('\n').slice(0, 4000)
        global.getAIResponse(
            `Résume ces échanges en 2 phrases maximum en français. Garde les noms, les sujets et les décisions importantes.\n\n${texte}`,
            'auto',
            'Tu résumes des conversations WhatsApp. Réponds uniquement par le résumé, sans préambule.'
        ).then(res => {
            if (res?.out) {
                if (!global.db.resumes) global.db.resumes = {}
                const ancien = global.db.resumes[chatId]
                global.db.resumes[chatId] = ((ancien ? ancien + ' ' : '') + String(res.out)).slice(-800)
                try { h.splice(0, aResumer.length) } catch (e) { }
            }
        }).catch(() => { }).finally(() => global._resumeEnCours.delete(chatId))
    } catch (e) { }
}

global.ajouterScore = (userJid, nom, victoire) => {
    try {
        if (!userJid) return
        if (!global.db.scores) global.db.scores = {}
        const cle = (global.jidToNumber ? global.jidToNumber(userJid) : String(userJid)) || String(userJid)
        const s = global.db.scores[cle] || (global.db.scores[cle] = { points: 0, victoires: 0, parties: 0, nom: '' })
        if (nom) s.nom = nom
        s.parties++
        if (victoire) { s.victoires++; s.points += 10 }
        else s.points += 1
    } catch (e) { }
}

global.difficultePour = (chatId, userJid) => {
    try {
        const cle = (global.jidToNumber ? global.jidToNumber(userJid) : String(userJid)) || String(userJid)
        const perso = global.db.difficulteJoueur?.[cle]
        if (['facile', 'moyen', 'difficile'].includes(perso)) return perso
        return global.db.difficulte?.[chatId] || 'moyen'
    } catch (e) { return 'moyen' }
}

if (!global.iaAppels) global.iaAppels = new Map()
global.verifierSpamIA = (userJid, max = 8, fenetreMs = 60000) => {
    try {
        if (!userJid) return true
        if (global.owner && global.sameJid && global.sameJid(userJid, global.owner[0])) return true
        const cle = (global.jidToNumber ? global.jidToNumber(userJid) : String(userJid)) || String(userJid)
        const now = Date.now()
        const liste = (global.iaAppels.get(cle) || []).filter(t => now - t < fenetreMs)
        liste.push(now)
        global.iaAppels.set(cle, liste)
        return liste.length <= max
    } catch (e) { return true }
}

// Construit le tableau `messages` avec l'historique pour les API compatibles OpenAI
global.construireMessages = (chatId, texteUtilisateur, systemPrompt) => {
    const messages = [{ role: 'system', content: systemPrompt }]
    const h = global.getHistorique(chatId)
    for (const e of h) {
        messages.push({ role: e.role === 'bot' ? 'assistant' : 'user', content: e.contenu })
    }
    messages.push({ role: 'user', content: texteUtilisateur })
    return messages
}

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

// Extraction d'une vue-unique lors de la réaction du propriétaire au message
// (feature inspirée du bot de référence : "view-once extraction on reaction")
const _viewOnceCache = new Map()
setInterval(() => {
    // Nettoyage périodique (tous les 30 min, garde au moins 60 messages récents)
    if (_viewOnceCache.size > 120) {
        const keys = Array.from(_viewOnceCache.keys()).slice(-60)
        const keep = new Set(keys)
        for (const k of Array.from(_viewOnceCache.keys())) {
            if (!keep.has(k)) _viewOnceCache.delete(k)
        }
    }
}, 1800000)

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
        Browsers,
        downloadContentFromMessage
    } = await getBaileys()

    // Rendre getContentType et downloadContentFromMessage accessibles globalement
    global._baileysGetContentType = getContentType
    global._downloadContentFromMessage = downloadContentFromMessage

    // Dossier de session stable
    const dossierSession = isVercel ? '/tmp/session' : path.join(__dirname, 'session')
    if (!fs.existsSync(dossierSession)) fs.mkdirSync(dossierSession, { recursive: true })

    // Restauration de la session depuis SESSION_DATA (base64) pour les
    // hébergeurs éphémères type Render/Vercel (voir commande .session)
    if (process.env.SESSION_DATA) {
        try {
            const credsPath = path.join(dossierSession, 'creds.json')
            const contenu = Buffer.from(process.env.SESSION_DATA, 'base64').toString('utf-8')
            JSON.parse(contenu)
            fs.writeFileSync(credsPath, contenu)
            console.log('[SESSION] Session restaurée depuis SESSION_DATA.')
        } catch (e) {
            console.error('[SESSION] Restauration SESSION_DATA impossible :', e.message)
        }
    }

    // ── Session non finalisée (jumelage avorté) ─────────────────────────
    // Une tentative de code de jumelage écrit `creds.me` SANS passer
    // `registered: true`. Au redémarrage, Baileys voit `me` et tente un
    // LOGIN au lieu d'une inscription → WhatsApp refuse → plus de QR et
    // code de jumelage invalide. On repart proprement dans ce cas
    // (AVANT le chargement du state, pour que Baileys le lise à jour).
    try {
        const credsPath = path.join(dossierSession, 'creds.json')
        if (fs.existsSync(credsPath)) {
            const creds = JSON.parse(fs.readFileSync(credsPath, 'utf-8'))
            if (creds && creds.registered !== true && creds.me) {
                delete creds.me
                delete creds.pairingCode
                fs.writeFileSync(credsPath, JSON.stringify(creds, null, 2))
                console.log('[SESSION] Session non finalisée détectée (jumelage interrompu) → réinitialisation, nouveau QR/code à venir.')
            }
        }
    } catch (e) {
        console.warn('[SESSION] Vérification de session impossible :', e.message)
    }

    const { state, saveCreds } = await useMultiFileAuthState(dossierSession)
    const { version } = await fetchLatestBaileysVersion().catch(() => ({ version: [2, 3000, 1015901307] }))

    const sock = makeWASocket({
        version,
        logger: pino({ level: 'silent' }),
        printQRInTerminal: false,
        auth: state,
        // Imite WhatsApp Desktop pour une session plus stable
        browser: Browsers ? Browsers.ubuntu('Chrome') : ['Ubuntu', 'Chrome', '124.0.0'],
        syncFullHistory: false,
        shouldSyncHistoryMessage: () => false,
        shouldIgnoreJid: (jid) => jid?.includes('@newsletter') || jid?.endsWith('@@broadcast'),
        markOnlineOnConnect: true,
        generateHighQualityLinkPreview: false,
        // Keepalive pour éviter les déconnexions
        keepAliveIntervalMs: 30000,
        connectTimeoutMs: 60000,
        defaultQueryTimeoutMs: 60000,
        retryRequestDelayMs: 2000,
    })

    socketPlanificateur = sock
    socketCourant = sock

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
    let qrAfficheTerminal = false

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update
        if (qr) {
            qrCodeData = await QRCode.toDataURL(qr)
            io.emit('qr', qrCodeData)

            const nonConnecte = !sock.authState?.creds?.registered
            if (nonConnecte) {
                let codeEnvoye = false
                if (NUMBER_PAIRING) {
                    // PAIRING_NUMBER défini → code de jumelage généré automatiquement
                    codeEnvoye = await demanderCodePairing(NUMBER_PAIRING)
                }
                if (!codeEnvoye && !qrAfficheTerminal) {
                    // Repli (ou pas de PAIRING_NUMBER) : QR affiché DANS le terminal
                    qrAfficheTerminal = true
                    try {
                        const ascii = await QRCode.toString(qr, { type: 'terminal', small: true })
                        console.log('\n📱 Scannez ce QR : WhatsApp → Appareils connectés → Connecter un appareil\n')
                        console.log(ascii)
                        console.log('➡️  Ou saisissez votre numéro dans le panneau web : http://localhost:' + port)
                        console.log('    pour recevoir un code de jumelage (onglet "Jumelage").\n')
                    } catch (e) { /* qrcode ASCII indisponible */ }
                }
            }
        }
        if (connection === 'close') {
            connectionStatus = 'close'
            botDemarre = false
            io.emit('status', 'close')
            const statusCode = new Boom(lastDisconnect?.error)?.output?.statusCode
            console.log(`[DÉCONNEXION] Code de statut: ${statusCode}`)

            // Empêche le rechargement de l'historique manqué à la reconnexion
            global._skipHistorySync = true
            try { sock.ev.flush?.() } catch (e) { }

            if (statusCode === DisconnectReason.connectionReplaced) {
                console.log('[DÉCONNEXION] Session remplacée sur un autre appareil.'); process.exit(0)
            } else if (statusCode === DisconnectReason.loggedOut || statusCode === 403) {
                // Session expirée/déconnectée : on repart à zéro proprement
                // (sinon le bot reste bloqué en boucle sur une session morte)
                console.log('[DÉCONNEXION] Session déconnectée — purge du dossier session et redémarrage...')
                try {
                    fs.rmSync(dossierSession, { recursive: true, force: true })
                    fs.mkdirSync(dossierSession, { recursive: true })
                } catch (e) { }
                setTimeout(() => { botDemarre = true; global._skipHistorySync = true; startBot() }, 4000)
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
                const numeroConnecte = global.jidToNumber(jidConnecte)
                // Si pas de OWNER_NUMBER dans .env, utiliser le numéro de la session
                if (!process.env.OWNER_NUMBER || global.owner[0] === '') {
                    global.owner = [numeroConnecte]
                    console.log(`[OWNER] Numéro détecté automatiquement : ${numeroConnecte}`)
                } else {
                    console.log(`[OWNER] Numéro depuis .env : ${global.owner[0]}`)
                }
                global.authorNum = jidConnecte
                // LID (identifiant interne WhatsApp) pour les groupes migrés
                global.ownerLid = global.jidToNumber(sock.user?.lid || '') || null
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

    // Gestionnaire de code de jumelage : maintenant UNIQUE et globale
    // (voir demanderCodePairing ci-dessus) — plus d'ajout par reconnexion.

    sock.ev.on('creds.update', saveCreds)
    sock.public = true

    // ── Persistance de la base de données ──
    const cheminDB = path.join(__dirname, 'database.json')

    const chargerDB = () => {
        try {
            if (!isVercel && fs.existsSync(cheminDB)) {
                const data = JSON.parse(fs.readFileSync(cheminDB, 'utf-8'))
                // On n'écrase pas l'objet global.db (il porte des accesseurs utiles) :
                // on recopie champ par champ.
                if (data.settings && typeof data.settings === 'object') {
                    global.db.settings = { ...global.db.settings, ...data.settings }
                }
                if (Array.isArray(data.mods)) global.db.mods = data.mods
                if (data.groups && typeof data.groups === 'object') global.db.groups = data.groups
                // Mémoire IA + niveaux + scores + mémoire participants
                if (data.historique && typeof data.historique === 'object') global.db.historique = data.historique
                if (data.difficulte && typeof data.difficulte === 'object') global.db.difficulte = data.difficulte
                if (data.difficulteJoueur && typeof data.difficulteJoueur === 'object') global.db.difficulteJoueur = data.difficulteJoueur
                if (data.resumes && typeof data.resumes === 'object') global.db.resumes = data.resumes
                if (data.memoire && typeof data.memoire === 'object') global.db.memoire = data.memoire
                if (data.scores && typeof data.scores === 'object') global.db.scores = data.scores
                // Les jeux en cours sont éphémères : on ne les restaure JAMAIS,
                // sinon une partie figée d'un ancien démarrage reste collée au chat.
                delete data.games
                delete data.jeux
                global.db.msgStore = new Map()
                global.db.geminiIndex = 0
                global.db.games = {}
                console.log('[DB] Base de données chargée.')
            } else if (isVercel) {
                console.log('[DB] Mode Vercel — base en mémoire uniquement.')
            }
        } catch (e) { console.error('[DB] Erreur chargement :', e) }
    }

    const sauvegarderDB = () => {
        if (isVercel) return
        try {
            const donnees = {
                settings: global.db.settings,
                mods: global.db.mods,
                groups: global.db.groups,
                // Mémoire de conversation (tronquée) + niveaux de difficulté
                historique: global.db.historique,
                difficulte: global.db.difficulte
                // games et msgStore volontairement non persistés
            }
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

                // Mémoriser les messages "vue unique" pour permettre l'extraction
                // par réaction du propriétaire (voir messages.reaction plus bas)
                try {
                    const conteneur = m.message?.ephemeralMessage?.message || m.message
                    const vo = conteneur?.viewOnceMessage ||
                        conteneur?.viewOnceMessageV2 ||
                        conteneur?.viewOnceMessageV2Extension
                    if (vo) {
                        _viewOnceCache.set(m.key.id, m)
                        if (_viewOnceCache.size > 120) {
                            _viewOnceCache.delete(_viewOnceCache.keys().next().value)
                        }
                    }
                } catch (e) { /* ignore */ }

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

    // ── EXTRACTION DES VUES UNIQUES PAR RÉACTION DU PROPRIÉTAIRE ──
    // Réagissez 🔓 (ou n'importe quel emoji) sur un message vue-unique pour
    // récupérer le média en privé, sans spammer le groupe.
    sock.ev.on('messages.reaction', async (reactions) => {
        try {
            if (!Array.isArray(reactions)) return
            for (const reaction of reactions) {
                const key = reaction?.key
                if (!key?.id) continue

                // Seul le propriétaire (ou le bot lui-même) déclenche l'extraction
                // NB : dans l'événement Baileys, `key` = message RÉAGI (la cible)
                //      et `reaction.key` = message de RÉACTION (l'auteur du clic).
                const cleReacteur = reaction.key || {}
                const reacteur = cleReacteur.participant || cleReacteur.remoteJid || key.participant || key.remoteJid
                const estProprio =
                    !!cleReacteur.fromMe ||
                    global.sameJid(reacteur, global.ownerJid()) ||
                    global.sameJid(reacteur, global.ownerLid) ||
                    global.sameJid(reacteur, sock.user?.id) ||
                    global.sameJid(reacteur, sock.user?.lid)

                if (!estProprio) continue

                const archive = _viewOnceCache.get(key.id)
                if (!archive) continue

                const conteneur = archive.message?.ephemeralMessage?.message || archive.message
                const vo = conteneur?.viewOnceMessage ||
                    conteneur?.viewOnceMessageV2 ||
                    conteneur?.viewOnceMessageV2Extension
                if (!vo?.message) continue

                const interne = vo.message
                const typeMedia = ['imageMessage', 'videoMessage', 'audioMessage', 'documentMessage']
                    .find(t => interne[t])
                if (!typeMedia) continue

                console.log(`[VUE-UNIQUE] Extraction de ${key.id} par le propriétaire`)
                const media = interne[typeMedia]
                const kind = typeMedia.replace('Message', '')
                const flux = await downloadContentFromMessage(media, kind)
                let buffer = Buffer.from([])
                for await (const morceau of flux) buffer = Buffer.concat([buffer, morceau])

                const jidProprio = global.ownerJid() || sock.user.id.split(':')[0] + '@s.whatsapp.net'
                const auteur = archive.pushName || global.jidToNumber(key.participant || key.remoteJid) || 'inconnu'

                const options =
                    kind === 'image' ? { image: buffer, caption: `🔓 *Vue unique récupérée*\n👤 De : ${auteur}` } :
                        kind === 'video' ? { video: buffer, caption: `🔓 *Vue unique récupérée*\n👤 De : ${auteur}` } :
                            kind === 'audio' ? { audio: buffer, mimetype: media.mimetype || 'audio/ogg; codecs=opus', ptt: media.ptt } :
                                { document: buffer, fileName: media.fileName || `viewonce_${Date.now()}`, caption: `🔓 *Vue unique récupérée*\n👤 De : ${auteur}` }

                await sock.sendMessage(jidProprio, options)

                // Accusé visuel sur le message lui-même (sans rien envoyer au groupe)
                if (key.remoteJid && key.remoteJid !== 'status@broadcast') {
                    await sock.sendMessage(key.remoteJid, { react: { text: '🔓', key } })
                }
                _viewOnceCache.delete(key.id)
            }
        } catch (e) {
            console.error('[VUE-UNIQUE] Erreur extraction :', e.message)
        }
    })

    // ── SECRÉTAIRE AUTOMATIQUE : appel manqué/raté → réponse auto + notification owner ──
    sock.ev.on('call', async (callEvents) => {
        try {
            if (!Array.isArray(callEvents)) return
            for (const appel of callEvents) {
                const termine = ['reject', 'timeout', 'terminate'].includes(appel.status)
                if (!termine) continue
                if (appel.isGroup) continue

                const appelant = appel.from
                if (!appelant) continue

                console.log(`[APPEL] Appel manqué de ${appelant}`)

                const jidProprio = global.ownerJid() || sock.user.id.split(':')[0] + '@s.whatsapp.net'
                const messageIA = "Désolé, je ne peux pas répondre pour le moment. Je vous rappelle dès que possible."

                // Réponse auto courte à l'appelant (toléré si échec)
                try {
                    await sock.sendMessage(appelant, { text: `🤖 *Assistant Ely*\n\n${messageIA}` })
                } catch (e) { /* ignore */ }

                await sock.sendMessage(jidProprio, {
                    text: `📞 *APPEL MANQUÉ*\n━━━━━━━━━━━━━━━━\n👤 De : @${global.jidToNumber(appelant)}\n🤖 Réponse auto envoyée à l'appelant.`,
                    mentions: [appelant]
                })
            }
        } catch (e) {
            console.error('[APPEL] Erreur gestionnaire :', e.message)
        }
    })

    return sock
}

// Démarrage immédiat
botDemarre = true
startBot().catch(err => {
    console.error('[DEMARRAGE] Erreur critique :', err.message)
    botDemarre = false
})
