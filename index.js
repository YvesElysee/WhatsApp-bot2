require('./config')
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion, jidDecode, proto, getContentType } = require('@whiskeysockets/baileys')
const pino = require('pino')
const fs = require('fs')
const path = require('path')
const axios = require('axios')
const { OpenAI } = require('openai')
const handler = require('./handler')

// Global Error Catching
process.on('uncaughtException', (err) => {
    console.error('[CRITICAL] Uncaught Exception:', err)
})
process.on('unhandledRejection', (reason, promise) => {
    console.error('[CRITICAL] Unhandled Rejection at:', promise, 'reason:', reason)
})

// Ensure temp directory exists
const tempDir = path.join(__dirname, 'temp')
if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true })
}
const { Boom } = require('@hapi/boom')
const express = require('express')
const app = express()
const server = require('http').createServer(app)
const io = require('socket.io')(server)
const QRCode = require('qrcode')
const port = process.env.PORT || 3000

app.use(express.static(path.join(__dirname, 'public')))
// Keep-alive/Health check
app.get('/health', (req, res) => res.send('Ely-bot is running!'))

server.listen(port, '0.0.0.0', () => console.log(`Server listening on port ${port}`))

let qrCodeData = ''
let connectionStatus = 'close'

io.on('connection', (socket) => {
    socket.emit('status', connectionStatus)
    if (qrCodeData && connectionStatus !== 'open') socket.emit('qr', qrCodeData)

    socket.on('request-pairing', async (phone) => {
        // Logic handled in startBot via global/event or direct reference if possible
        // For simplicity, we'll emit an event that startBot listens to, 
        // or just set a global var that startBot checks (less clean)
        // Better: Use an event emitter structure or pass socket logic to startBot.
        // We will attach an event listener to the global process or a custom emitter
        process.emit('request-pairing', phone, socket)
    })
})

const usePairingCode = process.env.PAIRING_NUMBER || ''

// Initial Global Variables (will be merged with database later)
global.db = {
    games: {},
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

// Multi-AI Global Helper
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

    console.log(`[AI-DEBUG] Gemini Keys: ${geminiKeys.length}, Wisdom Gate Keys: ${wgKeys.length}`)

    const tryGemini = async () => {
        if (geminiKeys.length === 0) return null
        for (let i = 0; i < geminiKeys.length; i++) {
            const index = (global.db.geminiIndex + i) % geminiKeys.length
            const key = geminiKeys[index]
            const genAI = new GoogleGenerativeAI(key)

            // Extensive list based on what we saw in tests
            const models = [
                'gemini-2.5-flash',
                'gemini-2.5-pro',
                'gemini-2.0-flash',
                'gemini-2.0-flash-lite-preview-02-05',
                'gemini-1.5-flash',
                'gemini-1.5-flash-latest',
                'gemini-pro'
            ]

            for (const modelId of models) {
                try {
                    console.log(`[AI-ROTATION] Trying Gemini SDK (${modelId}) with Key ${index + 1}`)
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
                    console.error(`[AI-ROTATION] Gemini ${modelId} (Key ${index + 1}) failed: ${e.message}`)
                }
            }
        }
        return null
    }

    const tryWisdomGate = async () => {
        if (wgKeys.length === 0) return null
        for (let i = 0; i < wgKeys.length; i++) {
            const index = (global.db.geminiIndex + i) % wgKeys.length
            const key = wgKeys[index]

            const client = new OpenAI({
                apiKey: key,
                baseURL: "https://wisdom-gate.juheapi.com/v1"
            })

            const wgModels = ["deepseek-r1", "deepseek-v3.1-terminus", "gpt-5-nano"]

            for (const modelId of wgModels) {
                try {
                    console.log(`[AI-ROTATION] Trying Wisdom Gate (${modelId}) via SDK with Key ${index + 1}`)
                    const completion = await client.chat.completions.create({
                        model: modelId,
                        messages: [{ role: "user", content: text }],
                        max_tokens: 1000
                    })
                    const out = completion.choices?.[0]?.message?.content
                    if (out) return out
                } catch (err) {
                    console.error(`[AI-ROTATION] Wisdom Gate ${modelId} (Key ${index + 1}) failed: ${err.message}`)
                    if (err.status === 401 || err.status === 402) break
                }
            }
        }
        return null
    }

    // Attempt AI selection
    if (provider === 'gemini') {
        const out = await tryGemini()
        if (out) return { out }
    } else if (provider === 'wisdom' || provider === 'wg') {
        const out = await tryWisdomGate()
        if (out) return { out }
    } else {
        // Default: Try Wisdom Gate then Gemini
        const wgOut = await tryWisdomGate()
        if (wgOut) return { out: wgOut }
        const geminiOut = await tryGemini()
        if (geminiOut) return { out: geminiOut }
    }

    return { error: 'ALL_AI_FAILED' }
}

global.getGeminiResponse = global.getAIResponse;

// Aggressive Self-Ping (Anti-Sleep)
setInterval(() => {
    const url = process.env.RENDER_EXTERNAL_URL || process.env.RENDER_URL
    if (url && axios) {
        axios.get(url).catch(() => { })
    }
}, 60000) // 1 minute is enough for Render anti-sleep

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState('session')
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
            io.emit('status', 'close')
            let reason = new Boom(lastDisconnect?.error)?.output.statusCode
            if (reason === DisconnectReason.badSession) {
                console.log('Bad Session File, Please Delete Session and Scan Again')
                // process.exit()
            } else if (reason === DisconnectReason.connectionClosed) {
                console.log('Connection closed, reconnecting....')
                startBot()
            } else if (reason === DisconnectReason.connectionLost) {
                console.log('Connection Lost from Server, reconnecting...')
                startBot()
            } else if (reason === DisconnectReason.connectionReplaced) {
                console.log('Connection Replaced, Another New Session Opened, Please Close Current Session First')
                process.exit()
            } else if (reason === DisconnectReason.loggedOut) {
                console.log(`Device Logged Out, Please Delete Session and Scan Again.`)
                process.exit()
            } else if (reason === DisconnectReason.restartRequired) {
                console.log('Restart Required, Restarting...')
                startBot()
            } else if (reason === DisconnectReason.timedOut) {
                console.log('Connection TimedOut, Reconnecting...')
                startBot()
            } else {
                console.log(`Unknown DisconnectReason: ${reason}|${connection}`)
                startBot()
            }
        } else if (connection === 'open') {
            const botId = sock.user.id.split(':')[0]
            console.log(`Bot Connected to WhatsApp as ${botId}`)
            connectionStatus = 'open'
            io.emit('status', 'open')
            qrCodeData = ''

            // Notify Owner
            try {
                const ownerNumber = global.owner[0].endsWith('@s.whatsapp.net') ? global.owner[0] : global.owner[0] + '@s.whatsapp.net'
                console.log(`Sending welcome message to owner: ${ownerNumber}`)
                await sock.sendMessage(ownerNumber, { text: '🤖 Ely-bot est maintenant connecté et prêt !\n\nTapez `.menu` pour commencer.' })
                console.log('Welcome message sent successfully.')
            } catch (err) {
                console.error('Failed to send welcome message to owner:', err)
            }
        }
    })

    // Pairing Code Request Handler
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

    const dbPath = path.join(__dirname, 'database.json')

    // Load Database from file
    const loadDatabase = () => {
        try {
            if (fs.existsSync(dbPath)) {
                const data = JSON.parse(fs.readFileSync(dbPath, 'utf-8'))
                global.db = { ...global.db, ...data }
                // Re-initialize non-serializable parts
                global.db.msgStore = new Map()
                global.db.geminiIndex = 0
                console.log('[DB] Database loaded successfully.')
            }
        } catch (e) {
            console.error('[DB] Error loading database:', e)
        }
    }

    // Save Database to file
    const saveDatabase = () => {
        try {
            const dataToSave = { ...global.db }
            delete dataToSave.msgStore // Don't save large Map
            fs.writeFileSync(dbPath, JSON.stringify(dataToSave, null, 2))
        } catch (e) {
            console.error('[DB] Error saving database:', e)
        }
    }

    loadDatabase()
    setInterval(saveDatabase, 30000) // Auto-save every 30s

    sock.ev.on('messages.upsert', async chatUpdate => {
        try {
            if (chatUpdate.type !== 'notify' && chatUpdate.type !== 'append') return

            const now = Date.now() / 1000
            for (const m of chatUpdate.messages) {
                if (!m.message) continue

                // --- Status Handler (status@broadcast) ---
                if (m.key && m.key.remoteJid === 'status@broadcast') {
                    const sender = sock.decodeJid(m.key.participant || m.key.remoteJid)
                    const senderId = sender.split('@')[0]

                    // 1. Auto-View
                    if (global.db.settings.statusView) {
                        await sock.readMessages([m.key])
                        console.log(`[STATUS] Viewed status from ${senderId}`)
                    }

                    // 2. Auto-Like (Reaction)
                    if (global.db.settings.statusLike && !m.key.fromMe) {
                        await sock.sendMessage('status@broadcast', {
                            react: { text: '❤️', key: m.key }
                        }, { statusJidList: [sender] })
                        console.log(`[STATUS] Liked status from ${senderId}`)
                    }

                    // 3. Store for Anti-Delete
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

                // Performance Optimization: Ignore old messages on initial connection
                const msgTime = m.messageTimestamp
                if (chatUpdate.type === 'notify' && (now - msgTime) > 60) {
                    continue
                }

                const senderJid = m.key.remoteJid
                const senderNumber = senderJid.split('@')[0]

                // Extract message content for logging
                const msg = m.message
                const msgType = Object.keys(msg)[0]
                let content = ''
                if (msgType === 'conversation') content = msg.conversation
                else if (msgType === 'extendedTextMessage') content = msg.extendedTextMessage.text
                else if (msgType === 'imageMessage') content = '[IMAGE] ' + (msg.imageMessage.caption || '')
                else if (msgType === 'videoMessage') content = '[VIDEO] ' + (msg.videoMessage.caption || '')
                else content = `[${msgType}]`

                console.log(`[MSG] ${senderNumber}: ${content}`)

                // Pass the raw message to the pre-loaded handler
                handler(sock, m, chatUpdate).catch(err => {
                    console.error('[ERROR] Handler Execution:', err)
                })
            }
        } catch (err) {
            console.error('[ERROR] messages.upsert processing:', err)
        }
    })

    return sock
}

startBot()
