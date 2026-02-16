const { getContentType } = require('@whiskeysockets/baileys')
const fs = require('fs')
const path = require('path')

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

// Database for Games & State
if (!global.db) global.db = {}
if (!global.db.games) global.db.games = {}

module.exports = async (sock, m, chatUpdate) => {
    try {
        if (!m.message) return

        // --- Message Unwrapping ---
        const msgType = getContentType(m.message)
        let msgContent = m.message

        if (msgType === 'ephemeralMessage') {
            msgContent = m.message.ephemeralMessage.message
        } else if (msgType === 'viewOnceMessageV2') {
            msgContent = m.message.viewOnceMessageV2.message
        } else if (msgType === 'viewOnceMessage') {
            msgContent = m.message.viewOnceMessage.message
        }

        const type = getContentType(msgContent)

        // --- Body Extraction ---
        let body = (type === 'conversation') ? msgContent.conversation :
            (type === 'imageMessage') ? msgContent.imageMessage.caption :
                (type === 'videoMessage') ? msgContent.videoMessage.caption :
                    (type === 'extendedTextMessage') ? msgContent.extendedTextMessage.text :
                        (type === 'buttonsResponseMessage') ? msgContent.buttonsResponseMessage.selectedButtonId :
                            (type === 'listResponseMessage') ? msgContent.listResponseMessage.singleSelectReply.selectedRowId :
                                (type === 'templateButtonReplyMessage') ? msgContent.templateButtonReplyMessage.selectedId : ''

        if (!body && type === 'messageContextInfo') {
            body = msgContent.buttonsResponseMessage?.selectedButtonId || msgContent.listResponseMessage?.singleSelectReply.selectedRowId || ''
        }

        // --- Metadata ---
        const from = m.key.remoteJid
        const sender = sock.decodeJid(m.key.participant || m.key.remoteJid)
        const botNumber = sock.decodeJid(sock.user.id)

        m.text = body.trim()
        const cleanBody = m.text
        const prefix = /^[\\/!#+.]/gi.test(cleanBody) ? cleanBody.match(/^[\\/!#+.]/gi)[0] : '.'
        const isCmd = cleanBody.startsWith(prefix)

        const isGroup = from.endsWith('@g.us')
        const groupMetadata = isGroup ? await sock.groupMetadata(from).catch(() => null) : null
        const participants = isGroup ? (groupMetadata?.participants || []) : []
        const groupAdmins = isGroup ? participants.filter(v => v.admin !== null).map(v => v.id) : []

        // Fix: Use decodeJid for robust comparison
        const isAdmins = isGroup ? groupAdmins.includes(sender) : false
        const isBotAdmins = isGroup ? groupAdmins.includes(botNumber) : false

        const reply = (text) => {
            sock.sendMessage(from, { text: text }, { quoted: m })
        }

        // --- Command Execution ---
        if (isCmd) {
            const command = cleanBody.replace(prefix, '').trim().split(/ +/).shift().toLowerCase()
            const args = cleanBody.trim().split(/ +/).slice(1)
            const text = args.join(" ")

            const cmd = commands.get(command)
            if (cmd) {
                console.log(`[CMD] ${command} from ${sender.split('@')[0]}`)
                await cmd.run(sock, m, args, { reply, text, isAdmins, isBotAdmins, isGroup, commands })
            }
        }

        // --- Non-Prefix Game Listeners ---
        if (global.db.games[from]) {
            const game = global.db.games[from]
            if (game.listener) {
                await game.listener(sock, m, { body: cleanBody, sender, reply })
            }
        }

    } catch (e) {
        console.error('[HANDLER ERROR]', e)
    }
}
