const { getContentType } = require('@whiskeysockets/baileys')
const fs = require('fs')
const path = require('path')

const commands = new Map()
const commandsPath = path.join(__dirname, 'commands')

// Cache commands for lower latency
const loadCommands = () => {
    try {
        if (!fs.existsSync(commandsPath)) return
        const files = fs.readdirSync(commandsPath)
        for (let file of files) {
            if (file.endsWith('.js')) {
                const cmdModule = require(path.join(commandsPath, file))
                // Handle complex command modules (multiple commands per file)
                if (cmdModule.commands && Array.isArray(cmdModule.commands)) {
                    for (let cmdName of cmdModule.commands) {
                        commands.set(cmdName, cmdModule)
                    }
                }
                // Handle simple command modules (name equals filename or specified)
                else {
                    const name = cmdModule.name || file.replace('.js', '')
                    commands.set(name, cmdModule)
                }
            }
        }
        console.log(`[ELY-SYSTEM] ${commands.size} commandes chargées avec succès.`)
    } catch (e) {
        console.error('[ELY-ERROR] Échec du chargement des commandes:', e)
    }
}

loadCommands()

module.exports = async (sock, m, chatUpdate) => {
    try {
        if (!m.message) return

        // Message Unwrapping
        const msgType = getContentType(m.message)
        const msgContent = (msgType === 'ephemeralMessage') ? m.message.ephemeralMessage.message : (msgType === 'viewOnceMessage') ? m.message.viewOnceMessage.message.imageMessage || m.message.viewOnceMessage.message.videoMessage : m.message
        const type = getContentType(msgContent)

        // Body Extraction
        var body = (type === 'conversation') ? msgContent.conversation :
            (type === 'imageMessage') ? msgContent.imageMessage.caption :
                (type === 'videoMessage') ? msgContent.videoMessage.caption :
                    (type === 'extendedTextMessage') ? msgContent.extendedTextMessage.text :
                        (type === 'buttonsResponseMessage') ? msgContent.buttonsResponseMessage.selectedButtonId :
                            (type === 'listResponseMessage') ? msgContent.listResponseMessage.singleSelectReply.selectedRowId :
                                (type === 'templateButtonReplyMessage') ? msgContent.templateButtonReplyMessage.selectedId : ''

        if (!body && type === 'messageContextInfo') {
            body = msgContent.buttonsResponseMessage?.selectedButtonId || msgContent.listResponseMessage?.singleSelectReply.selectedRowId || ''
        }
        if (!body) return

        // Command detection logic
        m.text = body.trim().replace(/^[^\w\.\!\#\+\/\\]+/, '')
        const cleanBody = m.text
        const prefix = /^[\\/!#+.]/gi.test(cleanBody) ? cleanBody.match(/^[\\/!#+.]/gi)[0] : '.'
        const isCmd = cleanBody.startsWith(prefix)

        if (!isCmd) return

        const command = cleanBody.replace(prefix, '').trim().split(/ +/).shift().toLowerCase()
        const args = cleanBody.trim().split(/ +/).slice(1)
        const text = args.join(" ")

        // Metadata
        const sender = m.key.fromMe ? (sock.user.id.split(':')[0] + '@s.whatsapp.net' || sock.user.id) : (m.key.participant || m.key.remoteJid)
        const botNumber = sock.decodeJid(sock.user.id)
        const isGroup = m.key.remoteJid.endsWith('@g.us')
        const groupMetadata = isGroup ? await sock.groupMetadata(m.key.remoteJid).catch(e => { }) : null
        const participants = isGroup ? (groupMetadata?.participants || []) : []
        const groupAdmins = isGroup ? participants.filter(v => v.admin !== null).map(v => v.id) : []
        const isBotAdmins = isGroup ? groupAdmins.includes(botNumber) : false
        const isAdmins = isGroup ? groupAdmins.includes(sender) : false

        const reply = (resText) => {
            sock.sendMessage(m.key.remoteJid, { text: resText }, { quoted: m })
        }

        // Logic
        const cmd = commands.get(command)
        if (cmd) {
            console.log(`[EXEC] ${command} | Sender: ${sender.split('@')[0]} | Group: ${isGroup}`)
            await cmd.run(sock, m, args, { reply, text, isAdmins, isBotAdmins, isGroup })
        }

    } catch (e) {
        console.error('[HANDLER ERROR]', e)
    }
}
