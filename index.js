require('./config')
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion, jidDecode, proto, getContentType } = require('@whiskeysockets/baileys')
const pino = require('pino')
const fs = require('fs')
const path = require('path')

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

// Global Database & Settings
global.db = {
    games: {},
    settings: {
        antidelete: false,
        autoreact: false,
        privateMode: false,
        ibOnly: false,
        aiOnly: false
    },
    mods: [],
    msgStore: new Map(),
    geminiIndex: 0
}

// Multi-AI Global Helper (Gemini 1-4 & DeepSeek 1-2)
global.getAIResponse = async (text) => {
    const geminiKeys = [
        process.env.GEMINI_KEY_1,
        process.env.GEMINI_KEY_2,
        process.env.GEMINI_KEY_3,
        process.env.GEMINI_KEY_4
    ].filter(k => k && k.length > 10)

    const dsKeys = [
        process.env.DEEPSEEK_KEY_1,
        process.env.DEEPSEEK_KEY_2
    ].filter(k => k && k.length > 10)

    if (geminiKeys.length === 0 && dsKeys.length === 0) throw new Error('No API Keys configured')

    // Try Gemini first (Rotational)
    if (geminiKeys.length > 0) {
        const key = geminiKeys[global.db.geminiIndex % geminiKeys.length]
        global.db.geminiIndex++

        const tryGemini = async (modelId) => {
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${key}`
            return await axios.post(url, {
                contents: [{ parts: [{ text }] }]
            }, { timeout: 20000 })
        }

        try {
            const res = await tryGemini('gemini-2.0-flash')
            return res.data.candidates?.[0]?.content?.parts?.[0]?.text || null
        } catch (e) {
            console.error(`[AI-ROTATION] Gemini failed: ${e.message}`)
            // Fallback to flash-latest if pro fails or vice versa
            try {
                const res = await tryGemini('gemini-1.5-flash')
                return res.data.candidates?.[0]?.content?.parts?.[0]?.text || null
            } catch (err2) {
                console.error(`[AI-ROTATION] Gemini fallback failed, trying DeepSeek...`)
            }
        }
    }

    // Fallback to DeepSeek if Gemini fails or no keys
    if (dsKeys.length > 0) {
        const key = dsKeys[global.db.geminiIndex % dsKeys.length] // Reuse index or separate one? GeminiIndex is fine for general rotation
        try {
            const res = await axios.post('https://api.deepseek.com/chat/completions', {
                model: "deepseek-chat",
                messages: [{ role: "user", content: text }],
                stream: false
            }, {
                headers: { 'Authorization': `Bearer ${key}` },
                timeout: 30000
            })
            return res.data.choices?.[0]?.message?.content || null
        } catch (err) {
            console.error(`[AI-ROTATION] DeepSeek failed: ${err.message}`)
            throw new Error('All AI providers exhausted.')
        }
    }
}

// Keep legacy name for compatibility with old commands not yet updated
global.getGeminiResponse = global.getAIResponse;

// Aggressive Self-Ping (Anti-Sleep)
const axios = require('axios')
setInterval(() => {
    const url = process.env.RENDER_URL
    if (url) {
        axios.get(url).catch(() => { })
        console.log('[ELY-PING] Aggressive keep-alive ping sent.')
    }
}, 5000)

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

    sock.ev.on('messages.upsert', async chatUpdate => {
        try {
            console.log(`[DEBUG] messages.upsert event received, type: ${chatUpdate.type}, count: ${chatUpdate.messages?.length || 0}`)

            // Only process new incoming messages, not history/appended
            if (chatUpdate.type !== 'notify') return

            for (const m of chatUpdate.messages) {
                if (!m.message) continue
                if (m.key && m.key.remoteJid === 'status@broadcast') continue

                const sender = m.key.remoteJid
                console.log(`[MSG] New message from ${sender}`)

                // Pass the raw message to the handler which handles unwrapping
                require('./handler')(sock, m, chatUpdate)
            }
        } catch (err) {
            console.log('[ERROR] messages.upsert handler:', err)
        }
    })

    return sock
}

startBot()
