require('./config')
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion, jidDecode, proto, getContentType } = require('@whiskeysockets/baileys')
const pino = require('pino')
const fs = require('fs')
const path = require('path')
const axios = require('axios')
const { OpenAI } = require('openai')
const { GoogleGenerativeAI } = require('@google/generative-ai')
const handler = require('./handler')

// Global Error Catching
process.on('uncaughtException', (err) => {
    console.error('[CRITICAL] Uncaught Exception:', err)
})
process.on('unhandledRejection', (reason, promise) => {
    console.error('[CRITICAL] Unhandled Rejection at:', promise, 'reason:', reason)
})

// Ensure temp directory exists — use /tmp on Vercel/serverless, ./temp locally
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

// Keep-alive / Health check
app.get('/health', (req, res) => res.json({ status: 'ok', bot: 'Ely-bot', connected: connectionStatus === 'open' }))

// API endpoint to manually trigger bot start (useful for Vercel cold starts)
app.get('/api/start', async (req, res) => {
    if (!botStarted) {
        botStarted = true
        startBot().catch(err => {
            console.error('[START-ERROR]', err)
            botStarted = false
        })
        return res.json({ status: 'starting', message: 'Bot initialization triggered.' })
    }
    res.json({ status: connectionStatus, message: 'Bot already initialized.' })
})

server.listen(port, '0.0.0.0', () => console.log(`Server listening on port ${port}`))

let qrCodeData = ''
let connectionStatus = 'close'
let botStarted = false

io.on('connection', (socket) => {
    socket.emit('status', connectionStatus)
    if (qrCodeData && connectionStatus !== 'open') socket.emit('qr', qrCodeData)

    socket.on('request-pairing', async (phone) => {
        process.emit('request-pairing', phone, socket)
    })
})

const usePairingCode = process.env.PAIRING_NUMBER || ''

// ─────────────────────────────────────────────────────────
// Global DB — includes new "groups" namespace for group mgmt
// ─────────────────────────────────────────────────────────
global.db = {
    games: {},
    groups: {},       // Group management state (antilink, rules, warnings, etc.)
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

// ─────────────────────────────────────────────────────────
// Group DB Helper — initializes a group entry if missing
// ─────────────────────────────────────────────────────────
global.getGroupDB = (groupJid) => {
    if (!global.db.groups[groupJid]) {
        global.db.groups[groupJid] = {
            antilink: false,
            rules: [],
            warnLimit: 3,
            warnings: {},
            autoclose: null,   // "HH:MM" 24h format
            autoopen: null     // "HH:MM" 24h format
        }
    }
    return global.db.groups[groupJid]
}

// ─────────────────────────────────────────────────────────
// Multi-AI Global Helper
// Priority: OpenRouter (Meta Llama-3 free) → Gemini → WisdomGate
// ─────────────────────────────────────────────────────────
global.getAIResponse = async (text, provider = 'auto') => {
    const clean = (k) => (typeof k === 'string') ? k.trim() : ''

    const geminiKeys = [
        clean(process.env.GEMINI_KEY_1),
        clean(process.env.GEMINI_KEY_2),
        clean(process.env.GEMINI_KEY_3),
        clean(process.env.GEMINI_KEY_4)
    ].filter(k => k.length > 10 && k.startsWith('AIza'))

    const wgKeys = [
        clean(process.env.WISDOM_GATE_KEY_1),
        clean(process.env.WISDOM_GATE_KEY_2)
    ].filter(k => k.length > 10 && !k.includes('votre_cle'))

    const openRouterKey = clean(process.env.OPENROUTER_KEY)

    console.log(`[AI-DEBUG] Gemini:${geminiKeys.length} WG:${wgKeys.length} OpenRouter:${openRouterKey ? 'yes' : 'no'}`)

    // ── OpenRouter / Meta AI (Llama-3.3 free) ──
    const tryOpenRouter = async () => {
        if (!openRouterKey) return null
        const orModels = [
            'meta-llama/llama-3.3-70b-instruct:free',
            'meta-llama/llama-3.1-8b-instruct:free',
            'mistralai/mistral-7b-instruct:free'
        ]
        const client = new OpenAI({
            apiKey: openRouterKey,
            baseURL: 'https://openrouter.ai/api/v1',
            defaultHeaders: {
                'HTTP-Referer': process.env.RENDER_EXTERNAL_URL || 'https://ely-bot.vercel.app',
                'X-Title': 'Ely WhatsApp Bot'
            }
        })
        for (const model of orModels) {
            try {
                console.log(`[AI-OPENROUTER] Trying ${model}`)
                const completion = await client.chat.completions.create({
                    model,
                    messages: [
                        { role: 'system', content: 'Tu es Ely, un assistant WhatsApp intelligent, sympathique et utile. Réponds en français sauf si l\'utilisateur écrit dans une autre langue.' },
                        { role: 'user', content: text }
                    ],
                    max_tokens: 1200
                })
                const out = completion.choices?.[0]?.message?.content
                if (out) return out
            } catch (err) {
                console.error(`[AI-OPENROUTER] ${model} failed: ${err.message}`)
                if (err.status === 401 || err.status === 402) break
            }
        }
        return null
    }

    // ── Gemini ──
    const tryGemini = async () => {
        if (geminiKeys.length === 0) return null
        for (let i = 0; i < geminiKeys.length; i++) {
            const index = (global.db.geminiIndex + i) % geminiKeys.length
            const key = geminiKeys[index]
            const genAI = new GoogleGenerativeAI(key)

            const models = [
                'gemini-2.5-flash',
                'gemini-2.0-flash',
                'gemini-1.5-flash',
                'gemini-pro'
            ]

            for (const modelId of models) {
                try {
                    console.log(`[AI-GEMINI] Trying ${modelId} Key #${index + 1}`)
                    const model = genAI.getGenerativeModel({ model: modelId })
                    const result = await model.generateContent({
                        contents: [{ role: 'user', parts: [{ text }] }]
                    })
                    const response = await result.response
                    const out = response.text()
                    if (out) {
                        global.db.geminiIndex = (index + 1) % geminiKeys.length
                        return out
                    }
                } catch (e) {
                    console.error(`[AI-GEMINI] ${modelId} Key #${index + 1} failed: ${e.message}`)
                }
            }
        }
        return null
    }

    // ── WisdomGate ──
    const tryWisdomGate = async () => {
        if (wgKeys.length === 0) return null
        for (let i = 0; i < wgKeys.length; i++) {
            const index = (global.db.geminiIndex + i) % wgKeys.length
            const key = wgKeys[index]
            const client = new OpenAI({
                apiKey: key,
                baseURL: 'https://wisdom-gate.juheapi.com/v1'
            })
            const wgModels = ['deepseek-r1', 'deepseek-v3.1-terminus', 'gpt-5-nano']
            for (const modelId of wgModels) {
                try {
                    console.log(`[AI-WG] Trying ${modelId} Key #${index + 1}`)
                    const completion = await client.chat.completions.create({
                        model: modelId,
                        messages: [{ role: 'user', content: text }],
                        max_tokens: 1000
                    })
                    const out = completion.choices?.[0]?.message?.content
                    if (out) return out
                } catch (err) {
                    console.error(`[AI-WG] ${modelId} Key #${index + 1} failed: ${err.message}`)
                    if (err.status === 401 || err.status === 402) break
                }
            }
        }
        return null
    }

    // Selection logic
    if (provider === 'gemini') {
        const out = await tryGemini()
        if (out) return { out, provider: 'gemini' }
    } else if (provider === 'meta' || provider === 'llama' || provider === 'openrouter') {
        const out = await tryOpenRouter()
        if (out) return { out, provider: 'meta-llama' }
    } else if (provider === 'wisdom' || provider === 'wg') {
        const out = await tryWisdomGate()
        if (out) return { out, provider: 'wisdomgate' }
    } else {
        // Default cascade: OpenRouter → Gemini → WisdomGate
        const orOut = await tryOpenRouter()
        if (orOut) return { out: orOut, provider: 'meta-llama' }

        const geminiOut = await tryGemini()
        if (geminiOut) return { out: geminiOut, provider: 'gemini' }

        const wgOut = await tryWisdomGate()
        if (wgOut) return { out: wgOut, provider: 'wisdomgate' }
    }

    return { error: 'ALL_AI_FAILED' }
}

global.getGeminiResponse = global.getAIResponse

// ─────────────────────────────────────────────────────────
// Auto Open/Close Group Scheduler (runs every minute)
// ─────────────────────────────────────────────────────────
let schedulerSocket = null
setInterval(async () => {
    if (!schedulerSocket || connectionStatus !== 'open') return
    const now = new Date()
    const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`

    for (const [groupJid, grpData] of Object.entries(global.db.groups || {})) {
        try {
            if (grpData.autoclose === currentTime) {
                await schedulerSocket.groupSettingUpdate(groupJid, 'announcement')
                await schedulerSocket.sendMessage(groupJid, { text: '🔒 *Groupe fermé automatiquement.*\nSeuls les admins peuvent écrire maintenant.' })
                console.log(`[SCHEDULER] Group ${groupJid} auto-closed at ${currentTime}`)
            }
            if (grpData.autoopen === currentTime) {
                await schedulerSocket.groupSettingUpdate(groupJid, 'not_announcement')
                await schedulerSocket.sendMessage(groupJid, { text: '🔓 *Groupe ouvert automatiquement.*\nTout le monde peut écrire maintenant.' })
                console.log(`[SCHEDULER] Group ${groupJid} auto-opened at ${currentTime}`)
            }
        } catch (e) {
            console.error(`[SCHEDULER-ERROR] Group ${groupJid}:`, e.message)
        }
    }
}, 60000)

// Anti-sleep self-ping
setInterval(() => {
    const url = process.env.RENDER_EXTERNAL_URL || process.env.RENDER_URL
    if (url && axios) {
        axios.get(url).catch(() => { })
    }
}, 60000)

// ─────────────────────────────────────────────────────────
// Bot Startup
// ─────────────────────────────────────────────────────────
async function startBot() {
    // Session stored in /tmp on Vercel (ephemeral) or ./session locally
    const sessionDir = isVercel ? '/tmp/session' : 'session'
    const { state, saveCreds } = await useMultiFileAuthState(sessionDir)
    const { version, isLatest } = await fetchLatestBaileysVersion()

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

    schedulerSocket = sock

    sock.decodeJid = (jid) => {
        if (!jid) return jid
        if (/:\d+@/gi.test(jid)) {
            let decode = jidDecode(jid) || {}
            return decode.user && decode.server && decode.user + '@' + decode.server || jid
        } else return jid
    }

    sock.copyNForward = async (jid, message, forceForward = false, options = {}) => {
        let vtype
        if (options.readViewOnce) {
            message.message = message.message && message.message.ephemeralMessage && message.message.ephemeralMessage.message ? message.message.ephemeralMessage.message : (message.message || undefined)
            vtype = Object.keys(message.message.viewOnceMessage.message)[0]
            delete (message.message && message.message.ignore ? message.message.ignore : (message.message || undefined))
            delete message.message.viewOnceMessage.message[vtype].viewOnce
            message.message = {
                ...message.message.viewOnceMessage.message
            }
        }

        let mtype = Object.keys(message.message)[0]
        let content = await proto.Message.fromObject(message.message)
        if (forceForward) {
            options.quoted = message
        }
        let forward = await proto.WebMessageInfo.fromObject({
            key: {
                remoteJid: jid,
                fromMe: true,
                id: message.key.id,
            },
            message: content,
            ...(options.quoted ? { quoted: options.quoted } : {})
        })
        return await sock.relayMessage(jid, forward.message, { messageId: forward.key.id })
    }

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update

        if (qr) {
            qrCodeData = await QRCode.toDataURL(qr)
            io.emit('qr', qrCodeData)
        }

        if (connection === 'close') {
            connectionStatus = 'close'
            botStarted = false
            io.emit('status', 'close')
            let reason = new Boom(lastDisconnect?.error)?.output.statusCode

            if (reason === DisconnectReason.badSession) {
                console.log('[DISCONNECT] Bad Session — Please delete session and reconnect.')
            } else if (reason === DisconnectReason.connectionClosed) {
                console.log('[DISCONNECT] Connection closed — reconnecting...')
                botStarted = true
                startBot()
            } else if (reason === DisconnectReason.connectionLost) {
                console.log('[DISCONNECT] Connection Lost — reconnecting...')
                botStarted = true
                startBot()
            } else if (reason === DisconnectReason.connectionReplaced) {
                console.log('[DISCONNECT] Connection Replaced — Another session opened.')
                process.exit()
            } else if (reason === DisconnectReason.loggedOut) {
                console.log('[DISCONNECT] Logged Out — Please delete session and reconnect.')
                process.exit()
            } else if (reason === DisconnectReason.restartRequired) {
                console.log('[DISCONNECT] Restart Required — restarting...')
                botStarted = true
                startBot()
            } else if (reason === DisconnectReason.timedOut) {
                console.log('[DISCONNECT] Timed Out — reconnecting...')
                botStarted = true
                startBot()
            } else {
                console.log(`[DISCONNECT] Unknown reason: ${reason}`)
                botStarted = true
                startBot()
            }
        } else if (connection === 'open') {
            const botId = sock.user.id.split(':')[0]
            console.log(`[BOT] Connected as ${botId}`)
            connectionStatus = 'open'
            botStarted = true
            io.emit('status', 'open')
            qrCodeData = ''

            try {
                const ownerNumber = global.owner[0].endsWith('@s.whatsapp.net')
                    ? global.owner[0]
                    : global.owner[0] + '@s.whatsapp.net'
                await sock.sendMessage(ownerNumber, {
                    text: '🤖 *Ely-bot connecté !*\n\n✅ Tous les systèmes sont opérationnels.\n\n📝 Tapez `.menu` pour commencer.\n🆕 Nouvelle fonctionnalité : `.grp` pour gérer vos groupes.'
                })
            } catch (err) {
                console.error('[BOT] Failed to send welcome message:', err.message)
            }
        }
    })

    process.on('request-pairing', async (phone, socket) => {
        if (!sock.authState.creds.registered) {
            try {
                let code = await sock.requestPairingCode(phone)
                code = code?.match(/.{1,4}/g)?.join('-') || code
                socket.emit('pairing-code', code)
            } catch (e) {
                socket.emit('log', 'Erreur demande code: ' + e.message)
            }
        } else {
            socket.emit('log', 'Déjà connecté !')
        }
    })

    sock.ev.on('creds.update', saveCreds)
    sock.public = true

    // ── Database persistence (disabled on Vercel — stateless) ──
    const dbPath = path.join(__dirname, 'database.json')

    const loadDatabase = () => {
        try {
            if (!isVercel && fs.existsSync(dbPath)) {
                const data = JSON.parse(fs.readFileSync(dbPath, 'utf-8'))
                global.db = {
                    ...global.db,
                    ...data,
                    // Ensure groups key exists
                    groups: { ...(data.groups || {}) }
                }
                global.db.msgStore = new Map()
                global.db.geminiIndex = 0
                console.log('[DB] Database loaded successfully.')
            } else if (isVercel) {
                console.log('[DB] Running on Vercel — using in-memory database.')
            }
        } catch (e) {
            console.error('[DB] Error loading database:', e)
        }
    }

    const saveDatabase = () => {
        if (isVercel) return // Can't write persistent files on Vercel
        try {
            const dataToSave = { ...global.db }
            delete dataToSave.msgStore
            fs.writeFileSync(dbPath, JSON.stringify(dataToSave, null, 2))
        } catch (e) {
            console.error('[DB] Error saving database:', e)
        }
    }

    loadDatabase()
    setInterval(saveDatabase, 30000)

    sock.ev.on('messages.upsert', async chatUpdate => {
        try {
            if (chatUpdate.type !== 'notify' && chatUpdate.type !== 'append') return

            const now = Date.now() / 1000
            for (const m of chatUpdate.messages) {
                if (!m.message) continue

                // Status handler
                if (m.key && m.key.remoteJid === 'status@broadcast') {
                    const sender = sock.decodeJid(m.key.participant || m.key.remoteJid)
                    const senderId = sender.split('@')[0]

                    if (global.db.settings.statusView) {
                        await sock.readMessages([m.key])
                    }
                    if (global.db.settings.statusLike && !m.key.fromMe) {
                        await sock.sendMessage('status@broadcast', {
                            react: { text: '❤️', key: m.key }
                        }, { statusJidList: [sender] })
                    }

                    const statusId = m.key.id
                    global.db.msgStore.set(statusId, {
                        m,
                        msg: m.message,
                        type: getContentType(m.message),
                        sender,
                        from: 'status@broadcast',
                        isStatus: true
                    })
                    continue
                }

                // Ignore old messages on initial connect
                const msgTime = m.messageTimestamp
                if (chatUpdate.type === 'notify' && (now - msgTime) > 60) continue

                const senderJid = m.key.remoteJid
                const senderNumber = senderJid.split('@')[0]

                const msg = m.message
                const msgType = Object.keys(msg)[0]
                let content = ''
                if (msgType === 'conversation') content = msg.conversation
                else if (msgType === 'extendedTextMessage') content = msg.extendedTextMessage.text
                else if (msgType === 'imageMessage') content = '[IMAGE] ' + (msg.imageMessage.caption || '')
                else if (msgType === 'videoMessage') content = '[VIDEO] ' + (msg.videoMessage.caption || '')
                else content = `[${msgType}]`

                console.log(`[MSG] ${senderNumber}: ${content}`)

                handler(sock, m, chatUpdate).catch(err => {
                    console.error('[ERROR] Handler:', err)
                })
            }
        } catch (err) {
            console.error('[ERROR] messages.upsert:', err)
        }
    })

    return sock
}

// Auto-start on non-Vercel environments
if (!isVercel) {
    botStarted = true
    startBot()
} else {
    console.log('[VERCEL] Serverless mode — bot will start on first /api/start request.')
    // On Vercel, try to start immediately since it's a long-running process
    botStarted = true
    startBot().catch(err => {
        console.error('[VERCEL] Auto-start failed:', err.message)
        botStarted = false
    })
}
