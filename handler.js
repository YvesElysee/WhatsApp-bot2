const { proto, getContentType } = require('@whiskeysockets/baileys')

module.exports = async (sock, m, chatUpdate) => {
    try {
        const fs = require('fs')
        const path = require('path')
        const commandsPath = path.join(__dirname, 'commands')

        if (!m.message) return

        // Handle different message types (Ephemeral, ViewOnce, etc.)
        const msgType = getContentType(m.message)
        const msgContent = (msgType === 'ephemeralMessage') ? m.message.ephemeralMessage.message : (msgType === 'viewOnceMessage') ? m.message.viewOnceMessage.message : m.message

        // Re-calculate type based on unwrapped content
        const type = getContentType(msgContent)

        // Extract body text
        var body = (type === 'conversation') ? msgContent.conversation :
            (type === 'imageMessage') ? msgContent.imageMessage.caption :
                (type === 'videoMessage') ? msgContent.videoMessage.caption :
                    (type === 'extendedTextMessage') ? msgContent.extendedTextMessage.text :
                        (type === 'buttonsResponseMessage') ? msgContent.buttonsResponseMessage.selectedButtonId :
                            (type === 'listResponseMessage') ? msgContent.listResponseMessage.singleSelectReply.selectedRowId :
                                (type === 'templateButtonReplyMessage') ? msgContent.templateButtonReplyMessage.selectedId : ''

        // Handle Quoted Messages for commands
        if (!body && type === 'messageContextInfo') {
            body = msgContent.buttonsResponseMessage?.selectedButtonId || msgContent.listResponseMessage?.singleSelectReply.selectedRowId || ''
        }

        // Create m.text for legacy command support
        m.text = body.trim().replace(/^[^\w\.\!\#\+\/\\]+/, '')
        const cleanBody = m.text

        // Default prefix handling
        const prefix = /^[\\/!#+.]/gi.test(cleanBody) ? cleanBody.match(/^[\\/!#+.]/gi)[0] : '.'
        const isCmd = cleanBody.startsWith(prefix)

        if (cleanBody) console.log(`[DEBUG] CleanBody: "${cleanBody}", Prefix: "${prefix}", isCmd: ${isCmd}`)
        const command = isCmd ? cleanBody.replace(prefix, '').trim().split(/ +/).shift().toLowerCase() : ''
        const args = cleanBody.trim().split(/ +/).slice(1)
        const text = args.join(" ")
        const sender = m.key.fromMe ? (sock.user.id.split(':')[0] + '@s.whatsapp.net' || sock.user.id) : (m.key.participant || m.key.remoteJid)
        const botNumber = sock.decodeJid(sock.user.id)
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

            // Ensure commands folder exists
            // commandsPath already defined above if moved, or use distinct name
            // Actually, looking at the file, I pasted the definition twice in previous turn.
            // I will clean up the duplicates.

            // Try enabling debug logger
            // console.log(`Looking for command: ${command} in ${commandsPath}`)

            // ... (rest of the loader logic)

            // Check if command exists
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
