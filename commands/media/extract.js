const { downloadContentFromMessage, getContentType } = require('@whiskeysockets/baileys')

module.exports = {
    name: 'extract',
    run: async (sock, m, args, { reply }) => {
        if (!m.quoted) return reply('❌ Répondez à un message ViewOnce !')

        const quoted = m.quoted
        const msgType = getContentType(quoted.message)

        let targetMsg = quoted.message
        if (msgType === 'viewOnceMessageV2') targetMsg = quoted.message.viewOnceMessageV2.message
        if (msgType === 'viewOnceMessage') targetMsg = quoted.message.viewOnceMessage.message

        const type = getContentType(targetMsg)
        if (!/imageMessage|videoMessage|audioMessage/.test(type)) {
            return reply('❌ Ce n\'est pas un média ViewOnce valide.')
        }

        reply('🔄 Extraction en cours...')
        try {
            const mediaMsg = targetMsg[type]
            const stream = await downloadContentFromMessage(mediaMsg, type.replace('Message', ''))
            let buffer = Buffer.from([])
            for await (const chunk of stream) { buffer = Buffer.concat([buffer, chunk]) }

            if (type === 'imageMessage') {
                await sock.sendMessage(m.key.remoteJid, { image: buffer, caption: '✅ Extrait par Ely' }, { quoted: m })
            } else if (type === 'videoMessage') {
                await sock.sendMessage(m.key.remoteJid, { video: buffer, caption: '✅ Extrait par Ely' }, { quoted: m })
            } else if (type === 'audioMessage') {
                await sock.sendMessage(m.key.remoteJid, { audio: buffer, mimetype: 'audio/mp4' }, { quoted: m })
            }
        } catch (e) {
            console.error(e)
            reply('❌ Échec de l\'extraction. Média expiré ou protégé.')
        }
    }
}
