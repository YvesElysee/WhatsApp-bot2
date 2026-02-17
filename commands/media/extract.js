const { downloadContentFromMessage } = require('@whiskeysockets/baileys')

module.exports = {
    name: 'extract',
    category: 'media',
    desc: 'Extrait le texte d\'une image (OCR).',
    run: async (sock, m, args, { reply }) => {
        if (!m.quoted) return reply('❌ Répondez à un message ViewOnce !')

        // Use the unwrapped message from handler for reliability
        const { msg, type } = m.quoted.unwrapped || {}
        // fallback if unwrapped not present on quoted
        const targetType = type || m.quoted.mtype
        const targetMsg = msg || (m.quoted.msg || m.quoted)

        if (!/imageMessage|videoMessage|audioMessage/.test(targetType)) {
            return reply('❌ Ce message n\'est pas un média à vue unique (ou déjà ouvert).')
        }

        reply('🔄 Extraction en cours...')
        try {
            const mediaType = targetType.replace('Message', '')
            const stream = await downloadContentFromMessage(targetMsg, mediaType)
            let buffer = Buffer.from([])
            for await (const chunk of stream) { buffer = Buffer.concat([buffer, chunk]) }

            if (targetType === 'imageMessage') {
                await sock.sendMessage(m.key.remoteJid, { image: buffer, caption: '✅ Extrait par Ely' }, { quoted: m })
            } else if (targetType === 'videoMessage') {
                await sock.sendMessage(m.key.remoteJid, { video: buffer, caption: '✅ Extrait par Ely' }, { quoted: m })
            } else if (targetType === 'audioMessage') {
                await sock.sendMessage(m.key.remoteJid, { audio: buffer, mimetype: 'audio/mp4' }, { quoted: m })
            }
        } catch (e) {
            console.error(e)
            reply('❌ Échec de l\'extraction. Le média a peut-être expiré.')
        }
    }
}
