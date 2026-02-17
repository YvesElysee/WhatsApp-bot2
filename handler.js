const { getContentType } = require('@whiskeysockets/baileys')
const fs = require('fs')
const path = require('path')
const { GoogleGenAI } = require('@google/genai')

const commands = new Map()
const commandsPath = path.join(__dirname, 'commands')

// Recursive Command Loader with error safety
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
                try {
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
                } catch (err) {
                    console.error(`[ELY-ERROR] Failed to load command ${file}:`, err)
                }
            }
        }
    } catch (e) {
        console.error('[ELY-ERROR] Failed to scan commands directory:', e)
    }
}

loadCommands()
console.log(`[ELY-SYSTEM] ${commands.size} commandes indexées.`)

// Gemini SDK Rotation Helper (@google/genai)
const getGeminiClient = () => {
    const keys = [
        process.env.GEMINI_KEY_1,
        process.env.GEMINI_KEY_2,
        process.env.GEMINI_KEY_3
    ].filter(k => k && k.length > 10)

    let key = keys.length > 0 ? keys[global.db.geminiIndex % keys.length] : process.env.GEMINI_API_KEY
    if (!key) return null

    global.db.geminiIndex++
    return new GoogleGenAI({ apiKey: key })
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
                const ownerNumber = global.owner[0].endsWith('@s.whatsapp.net') ? global.owner[0] : global.owner[0] + '@s.whatsapp.net'
                const notificationText = `🚨 *ANTI-DELETE* 🚨\n\n👤 @${cached.sender.split('@')[0]}\n📝 Message supprimé ci-dessous :`

                // Envoi de la notification
                await sock.sendMessage(from, { text: notificationText, mentions: [cached.sender] }, { quoted: cached.m })
                // Redirection du message original
                await sock.copyNForward(from, cached.m, true)

                // Optionnel: Envoyer aussi à l'owner si c'est important
                if (from !== ownerNumber) {
                    await sock.sendMessage(ownerNumber, { text: `🚨 *ANTI-DELETE (Audit)* 🚨\n\n📍 Groupe/Chat: ${from}\n👤 Auteur: @${cached.sender.split('@')[0]}`, mentions: [cached.sender] })
                    await sock.copyNForward(ownerNumber, cached.m, true)
                }
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

        // --- Message Serialization (CRITICAL) ---
        m.sender = sender
        const contextInfo = msg[msgType]?.contextInfo || {}
        m.mentionedJid = contextInfo.mentionedJid || []
        if (contextInfo.quotedMessage) {
            const quotedType = getContentType(contextInfo.quotedMessage)
            m.quoted = {
                key: {
                    remoteJid: from,
                    fromMe: sock.decodeJid(contextInfo.participant || '') === botNumber,
                    id: contextInfo.stanzaId,
                    participant: contextInfo.participant
                },
                sender: sock.decodeJid(contextInfo.participant || ''),
                message: contextInfo.quotedMessage,
                msg: contextInfo.quotedMessage[quotedType],
                mtype: quotedType
            }
            // Unwrap quoted viewOnce messages
            if (quotedType === 'viewOnceMessageV2' || quotedType === 'viewOnceMessage') {
                const inner = m.quoted.message[quotedType].message
                m.quoted.unwrapped = { msg: inner, type: getContentType(inner) }
            }
        } else {
            m.quoted = null
        }

        const prefix = '.'
        const isCmd = m.text.startsWith(prefix)

        // --- Strict Prefix Filter ---
        if (!isCmd) {
            if (global.db.games[from]) {
                const game = global.db.games[from]
                if (game.listener) await game.listener(sock, m, { body: m.text, sender, reply: (text) => sock.sendMessage(from, { text }, { quoted: m }) })
            }
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

        // --- Admin & Owner Detection ---
        let isAdmins = false
        let groupOwner = ''
        if (isGroup) {
            const groupMetadata = await sock.groupMetadata(from).catch(() => null)
            if (groupMetadata) {
                const participants = groupMetadata.participants || []
                groupOwner = groupMetadata.owner || participants.find(p => p.admin === 'superadmin')?.id || ''
                const admins = participants.filter(v => v.admin !== null).map(v => sock.decodeJid(v.id))
                isAdmins = admins.includes(sender) || isOwner
            }
        }

        // --- Execute Command ---
        const cmd = commands.get(command)
        if (cmd) {
            // Protection Logic: Identify targeted user
            const quoted = m.quoted ? m.quoted : m
            const targetJid = m.mentionedJid?.[0] || (m.quoted ? m.quoted.sender : null)

            if (targetJid) {
                const decodedTarget = sock.decodeJid(targetJid)
                const isTargetOwner = global.owner.includes(decodedTarget.split('@')[0])
                const isTargetGroupOwner = decodedTarget === groupOwner

                // List of commands that shouldn't touch the owner
                const restrictedCommands = ['pp', 'info', 'sticker', 'kick', 'promote', 'demote']
                if (restrictedCommands.includes(command) && (isTargetOwner || isTargetGroupOwner) && !m.key.fromMe) {
                    return sock.sendMessage(from, { text: '❌ Action interdite contre le propriétaire du bot ou du groupe.' }, { quoted: m })
                }
            }

            console.log(`[EXEC] .${command} by ${sender.split('@')[0]}`)
            await cmd.run(sock, m, args, {
                reply: (t) => sock.sendMessage(from, { text: t }, { quoted: m }),
                text, isAdmins, isGroup, commands, isOwner, getGeminiClient, groupOwner
            }).catch(e => {
                console.error(`[CMD ERROR] ${command}:`, e)
                sock.sendMessage(from, { text: `❌ Erreur lors de l'exécution de .${command}` }, { quoted: m })
            })
        }

    } catch (e) {
        console.error('[ELY-HANDLER ERROR]', e)
    }
}
