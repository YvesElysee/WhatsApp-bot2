require('./config')
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion, makeInMemoryStore, jidDecode, proto, getContentType } = require('@whiskeysockets/baileys')
const pino = require('pino')
const fs = require('fs')
const path = require('path')
const { Boom } = require('@hapi/boom')
const express = require('express')
const app = express()
const port = process.env.PORT || 3000

// Quick Keep-Alive for Render
app.get('/', (req, res) => res.send('Bot is running!'))
app.listen(port, () => console.log(`Server listening on port ${port}`))

const usePairingCode = process.env.PAIRING_NUMBER || ''
const store = makeInMemoryStore({ logger: pino().child({ level: 'silent', stream: 'store' }) })

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState('session')
    const { version, isLatest } = await fetchLatestBaileysVersion()

    const sock = makeWASocket({
        version,
        logger: pino({ level: 'silent' }),
        printQRInTerminal: !usePairingCode,
        auth: state,
        browser: ['Ubuntu', 'Chrome', '20.0.04'],
    })

    store.bind(sock.ev)

    if (usePairingCode && !sock.authState.creds.registered) {
        const phoneNumber = usePairingCode.replace(/[^0-9]/g, '')
        setTimeout(async () => {
            let code = await sock.requestPairingCode(phoneNumber)
            code = code?.match(/.{1,4}/g)?.join('-') || code
            console.log(`\n\nYour Pairing Code: ${code}\n\n`)
        }, 3000)
    }

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect } = update
        if (connection === 'close') {
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
            console.log('Bot Connected to WhatsApp')
        }
    })

    sock.ev.on('creds.update', saveCreds)

    sock.ev.on('messages.upsert', async chatUpdate => {
        try {
            let m = chatUpdate.messages[0]
            if (!m.message) return
            m.message = (Object.keys(m.message)[0] === 'ephemeralMessage') ? m.message.ephemeralMessage.message : m.message
            if (m.key && m.key.remoteJid === 'status@broadcast') return
            if (!sock.public && !m.key.fromMe && chatUpdate.type === 'notify') return

            // Simple command handler
            const msgContentType = getContentType(m.message)
            const text = (msgContentType === 'conversation') ? m.message.conversation : (msgContentType === 'imageMessage') ? m.message.imageMessage.caption : (msgContentType === 'videoMessage') ? m.message.videoMessage.caption : (msgContentType === 'extendedTextMessage') ? m.message.extendedTextMessage.text : ''

            const prefix = /^[\\/!#+.]/gi.test(text) ? text.match(/^[\\/!#+.]/gi)[0] : '.'
            const isCmd = text.startsWith(prefix)
            const command = isCmd ? text.replace(prefix, '').trim().split(' ')[0].toLowerCase() : ''
            const args = text.trim().split(' ').slice(1)

            if (isCmd) {
                console.log(`Command detected: ${command}`)
                try {
                    // Start simplified dynamic command loader
                    // This is a basic implementation. For production, use require dynamic path.
                    const cmdFile = path.join(__dirname, 'commands', `${command}.js`)
                    // Also check categories if needed, but for now flat
                    // Better: loop through folders or map

                    // Let's implement a simple router here for now or delegate
                    // For the "tout maintenant" request, I'll put a router logic here.

                    // We need to load commands first
                } catch (e) {
                    console.error(e)
                }
            }

            // Pass to handler (we will create a handler file)
            require('./handler')(sock, m, chatUpdate, store)

        } catch (err) {
            console.log(err)
        }
    })

    return sock
}

startBot()
