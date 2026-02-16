const { proto, getContentType } = require('@whiskeysockets/baileys')

module.exports = async (sock, m, chatUpdate, store) => {
    try {
        var body = (m.mtype === 'conversation') ? m.message.conversation : (m.mtype == 'imageMessage') ? m.message.imageMessage.caption : (m.mtype == 'videoMessage') ? m.message.videoMessage.caption : (m.mtype == 'extendedTextMessage') ? m.message.extendedTextMessage.text : (m.mtype == 'buttonsResponseMessage') ? m.message.buttonsResponseMessage.selectedButtonId : (m.mtype == 'listResponseMessage') ? m.message.listResponseMessage.singleSelectReply.selectedRowId : (m.mtype == 'templateButtonReplyMessage') ? m.message.templateButtonReplyMessage.selectedId : (m.mtype === 'messageContextInfo') ? (m.message.buttonsResponseMessage?.selectedButtonId || m.message.listResponseMessage?.singleSelectReply.selectedRowId || m.text) : ''
        var budy = (typeof m.text == 'string' ? m.text : '')

        const type = getContentType(m.message)
        const prefix = /^[\\/!#+.]/gi.test(body) ? body.match(/^[\\/!#+.]/gi)[0] : '/'  // Default prefix /
        const isCmd = body.startsWith(prefix)
        const command = isCmd ? body.replace(prefix, '').trim().split(/ +/).shift().toLowerCase() : ''
        const args = body.trim().split(/ +/).slice(1)
        const text = args.join(" ")
        const sender = m.key.fromMe ? (sock.user.id.split(':')[0] + '@s.whatsapp.net' || sock.user.id) : (m.key.participant || m.key.remoteJid)
        const botNumber = await sock.decodeJid(sock.user.id)
        const senderNumber = sender.split('@')[0]
        const isGroup = m.key.remoteJid.endsWith('@g.us')
        const groupMetadata = isGroup ? await sock.groupMetadata(m.key.remoteJid).catch(e => { }) : ''
        const groupName = isGroup ? groupMetadata.subject : ''
        const participants = isGroup ? await groupMetadata.participants : ''
        const groupAdmins = isGroup ? await participants.filter(v => v.admin !== null).map(v => v.id) : ''
        const isBotAdmins = isGroup ? groupAdmins.includes(botNumber) : false
        const isAdmins = isGroup ? groupAdmins.includes(sender) : false

        const reply = (text) => {
            sock.sendMessage(m.key.remoteJid, { text: text }, { quoted: m })
        }

        if (isCmd) {
            console.log(`[CMD] ${command} from ${senderNumber} in ${isGroup ? groupName : 'Private Chat'}`)

            // Dynamic Command Handling
            // We'll load commands from the 'commands' folder
            // For now, let's implement the router logic in 'index.js' or here. 
            // Better here.

            const fs = require('fs')
            const path = require('path')

            const commandsPath = path.join(__dirname, 'commands')
            // Read all files in commands folder
            // Note: In production, caching commands is better than reading every time

            if (fs.existsSync(path.join(commandsPath, command + '.js'))) {
                const cmd = require(path.join(commandsPath, command + '.js'))
                // Execute command
                cmd.run(sock, m, args, {
                    reply, text, isAdmins, isBotAdmins, isGroup
                })
            } else if (fs.existsSync(path.join(commandsPath, 'features.js'))) {
                // Or we scan all files and check metadata (better for organization)
                // Keeping it simple: 1 file = 1 commandname for now unless needed
            }

            // Fallback for features that need to scan specific categories or multiple commands per file
            // Let's implement a smarter loader:
            const files = fs.readdirSync(commandsPath)
            for (let file of files) {
                if (file.endsWith('.js')) {
                    const cmdModule = require(path.join(commandsPath, file))
                    if (cmdModule.commands && cmdModule.commands.includes(command)) {
                        cmdModule.run(sock, m, args, { reply, text, isAdmins, isBotAdmins, isGroup })
                        return; // Executed
                    }
                }
            }
        }

    } catch (e) {
        console.error(e)
    }
}
