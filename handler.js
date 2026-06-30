const { getContentType } = require('@whiskeysockets/baileys')
const fs = require('fs')
const path = require('path')

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

// ─────────────────────────────────────────────────────────
// URL / Link detector regex
// ─────────────────────────────────────────────────────────
const linkRegex = /(https?:\/\/[^\s]+|www\.[^\s]+|chat\.whatsapp\.com\/[^\s]+)/gi

// ─────────────────────────────────────────────────────────
// Main Handler
// ─────────────────────────────────────────────────────────
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
        if (!sender) return console.error('[DEBUG] Sender JID not found')

        const botNumber = (sock.user && sock.user.id) ? sock.decodeJid(sock.user.id) : null
        const senderId = sender.split('@')[0]

        // Safety check for mods
        const modsList = (global.db && global.db.mods) ? global.db.mods : []
        const isOwner = global.owner.includes(senderId) ||
            modsList.some(mod => {
                const decoded = sock.decodeJid(mod)
                return decoded && decoded.split('@')[0] === senderId
            }) ||
            m.key.fromMe

        // --- Message Storage (for Anti-Delete and Purge) ---
        if (msgType && msgType !== 'protocolMessage') {
            global.db.msgStore.set(m.key.id, { m, msg, type: msgType, sender, from })
            if (global.db.msgStore.size > 1000) global.db.msgStore.delete(global.db.msgStore.keys().next().value)
        }

        // --- Anti-Delete Handler ---
        if (msgType === 'protocolMessage' && msg.protocolMessage.type === 0) {
            const cached = global.db.msgStore.get(msg.protocolMessage.key.id)
            if (cached && (global.db.settings.antidelete || (cached.isStatus && global.db.settings.statusAntidelete))) {
                const ownerNumber = global.authorNum || (global.owner[0].endsWith('@s.whatsapp.net') ? global.owner[0] : global.owner[0] + '@s.whatsapp.net')

                let notificationText = `🚨 *ANTI-DELETE* 🚨\n\n`
                if (cached.isStatus) {
                    notificationText += `👤 *Statut de* : @${cached.sender.split('@')[0]}\n📝 Statut supprimé.`
                } else {
                    notificationText += `👤 @${cached.sender.split('@')[0]}\n📝 Message supprimé à l'instant.`
                }

                const target = cached.isStatus ? ownerNumber : (global.db.settings.privateMode ? ownerNumber : from)
                await sock.sendMessage(target, { text: notificationText, mentions: [cached.sender] }, { quoted: cached.m })
                await sock.copyNForward(target, cached.m, true)

                if (!cached.isStatus && from !== ownerNumber && !global.db.settings.privateMode) {
                    await sock.sendMessage(ownerNumber, { text: `🚨 *ANTI-DELETE (Audit)*\n📍 Chat: ${from}\n👤 Auteur: @${cached.sender.split('@')[0]}`, mentions: [cached.sender] })
                    await sock.copyNForward(ownerNumber, cached.m, true)
                }
            }
        }

        // --- Private Mode ---
        if (global.db.settings.privateMode && !isOwner) return

        // --- Body Extraction ---
        let body = (msgType === 'conversation') ? msg.conversation :
            (msgType === 'imageMessage') ? msg.imageMessage.caption :
                (msgType === 'videoMessage') ? msg.videoMessage.caption :
                    (msgType === 'extendedTextMessage') ? msg.extendedTextMessage.text :
                        (msgType === 'buttonsResponseMessage') ? msg.buttonsResponseMessage.selectedButtonId :
                            (msgType === 'listResponseMessage') ? msg.listResponseMessage.singleSelectReply.selectedRowId :
                                (msgType === 'templateButtonReplyMessage') ? msg.templateButtonReplyMessage.selectedId : ''

        m.text = (body || '').trim()

        // --- Bot Activity Check ---
        if (!global.db.settings.active && !isOwner && !m.text.startsWith('.bot')) return

        // ─────────────────────────────────────────────────────────
        // GROUP PROTECTION HOOK (runs before command check)
        // ─────────────────────────────────────────────────────────
        if (isGroup && !m.key.fromMe && msgType !== 'protocolMessage') {
            const grpData = global.getGroupDB ? global.getGroupDB(from) : null

            if (grpData) {
                // Fetch group metadata once for protection checks
                let groupAdmins = []
                let isSenderAdmin = false
                try {
                    const meta = await sock.groupMetadata(from).catch(() => null)
                    if (meta) {
                        groupAdmins = meta.participants
                            .filter(p => p.admin !== null)
                            .map(p => sock.decodeJid(p.id))
                        isSenderAdmin = groupAdmins.includes(sender) || isOwner
                    }
                } catch (e) {
                    isSenderAdmin = isOwner
                }

                // Anti-Link: delete messages with URLs from non-admins
                if (grpData.antilink && !isSenderAdmin && m.text && linkRegex.test(m.text)) {
                    linkRegex.lastIndex = 0 // Reset regex state
                    try {
                        await sock.sendMessage(from, { delete: m.key })
                        const warnMsg = `⚠️ @${senderId} — Liens non autorisés dans ce groupe !\n\n_Merci de respecter les règles._`
                        await sock.sendMessage(from, { text: warnMsg, mentions: [sender] })
                        console.log(`[ANTILINK] Deleted link from ${senderId} in ${from}`)
                    } catch (e) {
                        console.error('[ANTILINK] Error:', e.message)
                    }
                    return // Stop processing this message
                }
            }
        }

        // --- Reaction / Status Download Handler ---
        if (msgType === 'reactionMessage') {
            const react = msg.reactionMessage
            const key = react.key
            const isMe = key.fromMe
            const cached = global.db.msgStore.get(key.id)

            if (isMe && cached && cached.isStatus) {
                const ownerNumber = global.authorNum || (global.owner[0].endsWith('@s.whatsapp.net') ? global.owner[0] : global.owner[0] + '@s.whatsapp.net')
                await sock.sendMessage(ownerNumber, { text: `📥 *TÉLÉCHARGEMENT STATUT*\nDe : @${cached.sender.split('@')[0]}`, mentions: [cached.sender] })
                await sock.copyNForward(ownerNumber, cached.m, true)
            }
        }

        // --- Serialization ---
        m.sender = sender
        const contextInfo = msg[msgType]?.contextInfo || {}
        m.mentionedJid = contextInfo.mentionedJid || []

        if (contextInfo.quotedMessage) {
            const quotedType = getContentType(contextInfo.quotedMessage)
            m.quoted = {
                key: {
                    remoteJid: from,
                    fromMe: botNumber ? (sock.decodeJid(contextInfo.participant || '') === botNumber) : false,
                    id: contextInfo.stanzaId,
                    participant: contextInfo.participant
                },
                sender: sock.decodeJid(contextInfo.participant || ''),
                message: contextInfo.quotedMessage,
                msg: contextInfo.quotedMessage[quotedType],
                mtype: quotedType
            }
            if (quotedType === 'viewOnceMessageV2' || quotedType === 'viewOnceMessage') {
                const inner = m.quoted.message[quotedType].message
                m.quoted.unwrapped = { msg: inner, type: getContentType(inner) }
            }
        } else {
            m.quoted = null
        }

        const prefix = '.'
        const isCmd = m.text.startsWith(prefix)

        // --- Non-Command Handlers ---
        if (!isCmd) {
            if (global.db.games[from]) {
                const game = global.db.games[from]
                if (game.listener) {
                    await game.listener(sock, m, {
                        body: m.text,
                        sender,
                        reply: (content, options = {}) => {
                            if (typeof content === 'string') return sock.sendMessage(from, { text: content, ...options }, { quoted: m })
                            return sock.sendMessage(from, { ...content, ...options }, { quoted: m })
                        }
                    }).catch(e => console.error('[DEBUG] Game listener error:', e))
                }
            }

            if (global.db.settings.autoreact && m.text && !m.key.fromMe) {
                const emojis = ['👍', '❤️', '🔥', '😂', '✨']
                await sock.sendMessage(from, { react: { text: emojis[Math.floor(Math.random() * emojis.length)], key: m.key } })
            }

            const botId = sock.user?.id.split(':')[0]
            const isMentioned = m.mentionedJid.includes(botId + '@s.whatsapp.net') || m.text.includes(botId)

            if (global.db.settings.chatbot && isMentioned && !m.key.fromMe) {
                const aiResponse = await global.getAIResponse(m.text)
                if (aiResponse && aiResponse.out) {
                    await sock.sendMessage(from, { text: `🤖 *ELY-AI* :\n\n${aiResponse.out}` }, { quoted: m })
                }
            }
            return
        }

        // --- Command Execution ---
        const command = m.text.slice(1).trim().split(/ +/).shift().toLowerCase()
        const args = m.text.trim().split(/ +/).slice(1)
        const text = args.join(' ')

        const cmd = commands.get(command)
        if (!cmd) return

        // ─────────────────────────────────────────────────────────
        // ADMIN CHECK — Fixed race condition with proper retry + backoff
        // ─────────────────────────────────────────────────────────
        let isAdmins = false
        let isBotAdmins = false
        let groupOwner = ''

        if (isGroup) {
            // Helper: fetch group metadata with retry
            const fetchMeta = async (retries = 2, delay = 800) => {
                for (let attempt = 0; attempt < retries; attempt++) {
                    try {
                        const meta = await sock.groupMetadata(from)
                        if (meta && meta.participants && meta.participants.length > 0) return meta
                    } catch (e) {
                        console.warn(`[ADMIN-CHECK] Attempt ${attempt + 1} failed: ${e.message}`)
                    }
                    if (attempt < retries - 1) await new Promise(r => setTimeout(r, delay * (attempt + 1)))
                }
                return null
            }

            try {
                const groupMetadata = await fetchMeta()
                if (groupMetadata) {
                    const participants = groupMetadata.participants || []
                    groupOwner = groupMetadata.owner ||
                        participants.find(p => p.admin === 'superadmin')?.id || ''

                    // Build admin list: decode ALL participant JIDs properly
                    const admins = participants
                        .filter(v => v.admin !== null && v.admin !== undefined)
                        .map(v => sock.decodeJid(v.id))

                    const decodedSender = sock.decodeJid(sender)
                    isAdmins = admins.includes(decodedSender) || isOwner
                    isBotAdmins = botNumber ? admins.includes(botNumber) : false

                    console.log(`[ADMIN-CHECK] sender=${decodedSender} isAdmins=${isAdmins} isBotAdmins=${isBotAdmins} admins=[${admins.join(',')}]`)
                } else {
                    console.warn('[ADMIN-CHECK] Could not fetch group metadata after retries — defaulting to isOwner for admin status')
                    isAdmins = isOwner
                }
            } catch (e) {
                console.error('[ADMIN-CHECK-ERROR]', e)
                isAdmins = isOwner
            }
        }

        // Owner is always admin
        if (isOwner) isAdmins = true

        // --- Target Protection ---
        const targetJid = m.mentionedJid?.[0] || (m.quoted ? m.quoted.sender : null)
        if (targetJid) {
            const decodedTarget = sock.decodeJid(targetJid)
            const isTargetOwner = global.owner.includes(decodedTarget.split('@')[0])
            const isTargetGroupOwner = decodedTarget === groupOwner

            if ((isTargetOwner || isTargetGroupOwner) && !isOwner && decodedTarget !== sock.decodeJid(sender)) {
                return sock.sendMessage(from, { text: '❌ Action interdite : vous ne pouvez pas utiliser de commandes contre le propriétaire.' }, { quoted: m })
            }
        }

        console.log(`[EXEC] .${command} from ${senderId} | isAdmins=${isAdmins} isBotAdmins=${isBotAdmins}`)

        const ownerNumber = global.authorNum || (global.owner[0].endsWith('@s.whatsapp.net') ? global.owner[0] : global.owner[0] + '@s.whatsapp.net')
        const smartReply = (content, options = {}) => {
            const target = (global.db.settings.privateMode && isOwner && from !== ownerNumber) ? ownerNumber : from
            if (typeof content === 'string') return sock.sendMessage(target, { text: content, ...options }, { quoted: m })
            return sock.sendMessage(target, { ...content, ...options }, { quoted: m })
        }

        await cmd.run(sock, m, args, {
            reply: smartReply,
            text,
            isAdmins,
            isBotAdmins,
            isGroup,
            commands,
            isOwner,
            getAIResponse: global.getAIResponse,
            getGeminiResponse: global.getAIResponse,
            groupOwner,
            getGroupDB: global.getGroupDB
        }).catch(e => {
            console.error(`[CMD ERROR] ${command}:`, e)
            sock.sendMessage(from, { text: `❌ Erreur : ${e.message || e}` }, { quoted: m })
        })
    } catch (e) {
        console.error('[ELY-HANDLER ERROR]', e)
    }
}
