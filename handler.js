const { getContentType } = require('@whiskeysockets/baileys')
const fs = require('fs')
const path = require('path')
const { GoogleGenerativeAI } = require('@google/generative-ai')

const commands = new Map()
const commandsPath = path.join(__dirname, 'commands')

// Recursive Command Loader
const loadCommands = (dir = commandsPath) => {
    try {
        if (!fs.existsSync(dir)) return
        const files = fs.readdirSync(dir)
        for (let file of files) {
            const fullPath = path.join(dir, file)
            const stat = fs.statSync(fullPath)

            if (stat.isDirectory()) {
                loadCommands(fullPath)
            } else if (file.endsWith('.js')) {
                delete require.cache[require.resolve(fullPath)]
                const cmdModule = require(fullPath)
                if (cmdModule.commands && Array.isArray(cmdModule.commands)) {
                    for (let cmdName of cmdModule.commands) {
                        commands.set(cmdName, cmdModule)
                    }
                } else {
                    const name = cmdModule.name || file.replace('.js', '')
                    commands.set(name, cmdModule)
                }
            }
        }
    } catch (e) {
        console.error('[ELY-ERROR] Failed to load commands:', e)
    }
}

loadCommands()
console.log(`[ELY-SYSTEM] ${commands.size} commandes indexées.`)

// Gemini SDK Rotation Helper
const getGeminiModel = (modelName = 'gemini-1.5-flash') => {
    const keys = [
        process.env.GEMINI_KEY_1,
        process.env.GEMINI_KEY_2,
        process.env.GEMINI_KEY_3
    ].filter(k => k && k.length > 10)

    if (keys.length === 0) {
        // Fallback to legacy key if present
        const legacyKey = process.env.GEMINI_API_KEY
        if (!legacyKey) return null
        const genAI = new GoogleGenerativeAI(legacyKey)
        return genAI.getGenerativeModel({ model: modelName })
    }

    const key = keys[global.db.geminiIndex % keys.length]
    global.db.geminiIndex++
    const genAI = new GoogleGenerativeAI(key)
    return genAI.getGenerativeModel({ model: modelName })
}

module.exports = async (sock, m, chatUpdate) => {
    try {
        if (!m.message) return

        // --- Robust Message Unwrapping ---
        let msg = m.message
        let msgType = getContentType(msg)

        if (msgType === 'ephemeralMessage') {
            msg = msg.ephemeralMessage.message
            msgType = getContentType(msg)
        }
        if (msgType === 'viewOnceMessageV2') {
            msg = msg.viewOnceMessageV2.message
            msgType = getContentType(msg)
        } else if (msgType === 'viewOnceMessage') {
            msg = msg.viewOnceMessage.message
            msgType = getContentType(msg)
        }

        m.unwrapped = { msg, type: msgType }

        // --- Metadata ---
        const from = m.key.remoteJid
        const isGroup = from.endsWith('@g.us')
        const sender = sock.decodeJid(m.key.participant || m.key.remoteJid)
        const botNumber = sock.decodeJid(sock.user.id)
        const isOwner = global.owner.includes(sender.split('@')[0]) || m.key.fromMe

        // --- Anti-Delete ---
        if (msgType && msgType !== 'protocolMessage' && !m.key.fromMe) {
            global.db.msgStore.set(m.key.id, { m, msg, type: msgType, sender, from })
            if (global.db.msgStore.size > 500) global.db.msgStore.delete(global.db.msgStore.keys().next().value)
        }

        if (msgType === 'protocolMessage' && msg.protocolMessage.type === 0) {
            const cached = global.db.msgStore.get(msg.protocolMessage.key.id)
            if (cached && global.db.settings.antidelete) {
                await sock.sendMessage(from, { text: `🚨 *ANTI-DELETE* 🚨\n\n👤 @${cached.sender.split('@')[0]}\n📝 Message supprimé ci-dessous :`, mentions: [cached.sender] }, { quoted: cached.m })
                await sock.copyNForward(from, cached.m, true)
            }
        }

        // --- Private Mode Check ---
        if (global.db.settings.privateMode && isGroup && !isOwner) return

        // --- Body Extraction ---
        let body = (msgType === 'conversation') ? msg.conversation :
            (msgType === 'imageMessage') ? msg.imageMessage.caption :
                (msgType === 'videoMessage') ? msg.videoMessage.caption :
                    (msgType === 'extendedTextMessage') ? msg.extendedTextMessage.text :
                        (msgType === 'buttonsResponseMessage') ? msg.buttonsResponseMessage.selectedButtonId :
                            (msgType === 'listResponseMessage') ? msg.listResponseMessage.singleSelectReply.selectedRowId :
                                (msgType === 'templateButtonReplyMessage') ? msg.templateButtonReplyMessage.selectedId : ''

        m.text = (body || '').trim()
        const prefix = '.'
        const isCmd = m.text.startsWith(prefix)

        // --- Strict Prefix Filter ---
        if (!isCmd) {
            // Listeners for active games
            if (global.db.games[from]) {
                const game = global.db.games[from]
                if (game.listener) await game.listener(sock, m, { body: m.text, sender, reply: (text) => sock.sendMessage(from, { text }, { quoted: m }) })
            }
            // Auto-reaction
            if (global.db.settings.autoreact && m.text && !m.key.fromMe) {
                const emojis = ['👍', '❤️', '🔥', '😂', '✨']
                await sock.sendMessage(from, { react: { text: emojis[Math.floor(Math.random() * emojis.length)], key: m.key } })
            }
            return
        }

        // --- Command Setup ---
        const command = m.text.slice(1).trim().split(/ +/).shift().toLowerCase()
        const args = m.text.trim().split(/ +/).slice(1)
        const text = args.join(" ")

        // --- Admin Detection ---
        let isAdmins = false
        let isBotAdmins = false
        if (isGroup) {
            const groupMetadata = await sock.groupMetadata(from).catch(() => null)
            if (groupMetadata) {
                const participants = groupMetadata.participants || []
                const admins = participants.filter(v => v.admin !== null).map(v => sock.decodeJid(v.id))
                isAdmins = admins.includes(sender) || isOwner
                isBotAdmins = admins.includes(botNumber)
            }
        }

        // --- Execute Command ---
        const cmd = commands.get(command)
        if (cmd) {
            console.log(`[EXEC] .${command} by ${sender.split('@')[0]}`)
            await cmd.run(sock, m, args, {
                reply: (t) => sock.sendMessage(from, { text: t }, { quoted: m }),
                text, isAdmins, isBotAdmins, isGroup, commands, isOwner, getGeminiModel
            })
        }

    } catch (e) {
        console.error('[ELY-HANDLER ERROR]', e)
    }
}
