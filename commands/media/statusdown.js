const { getBaileys } = require('../../lib/baileys')

module.exports = {
    name: 'statusdown',
    category: 'media',
    desc: 'Télécharge le statut (photo/vidéo) auquel vous répondez.',
    commands: ['statusdown', 'telestatus', 'dlstatus'],
    run: async (sock, m, args, { reply }) => {
        if (!m.quoted) return reply('❌ Répondez à un statut avec `.statusdown`.')

        // Le handler déplie les enveloppes vue-unique / éphémères du cité
        const { msg, type } = m.quoted.unwrapped || {}
        const targetType = type || m.quoted.mtype
        const targetMsg = msg || m.quoted.msg

        if (!targetMsg || !/imageMessage|videoMessage|audioMessage/.test(targetType)) {
            return reply('⚠️ Le message cité n\'est pas un statut (image, vidéo ou audio).')
        }

        await reply('📥 Téléchargement du statut en cours...')

        try {
            const { downloadContentFromMessage } = await getBaileys()
            const kind = targetType.replace('Message', '')
            const flux = await downloadContentFromMessage(targetMsg, kind)
            let buffer = Buffer.from([])
            for await (const chunk of flux) buffer = Buffer.concat([buffer, chunk])

            if (!buffer.length) throw new Error('Média vide')

            const cible = (global.db.settings.privateMode ? global.ownerJid() : null) || m.key.remoteJid
            const opts = { quoted: cible === m.key.remoteJid ? m : undefined }

            if (kind === 'image') {
                await sock.sendMessage(cible, { image: buffer, caption: '✅ *Statut téléchargé*' }, opts)
            } else if (kind === 'video') {
                await sock.sendMessage(cible, { video: buffer, caption: '✅ *Statut téléchargé*' }, opts)
            } else {
                await sock.sendMessage(cible, {
                    audio: buffer,
                    mimetype: targetMsg.mimetype || 'audio/ogg; codecs=opus',
                    ptt: !!targetMsg.ptt
                }, opts)
            }
        } catch (e) {
            console.error('[STATUSDOWN]', e.message)
            reply('❌ Échec du téléchargement. Le statut a peut-être expiré.')
        }
    }
}
