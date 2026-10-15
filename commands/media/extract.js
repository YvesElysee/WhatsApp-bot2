const { getBaileys } = require('../../lib/baileys')

module.exports = {
    name: 'extract',
    category: 'media',
    desc: 'Récupère le média d\'un message cité (dont les messages à vue unique).',
    commands: ['extract', 'extrait', 'recup'],
    run: async (sock, m, args, { reply, tempDir }) => {
        if (!m.quoted) return reply('❌ Répondez au message à récupérer avec `.extract`.')

        // Le handler déplie déjà les enveloppes vue-unique / éphémères
        const { msg, type } = m.quoted.unwrapped || {}
        const targetType = type || m.quoted.mtype
        const targetMsg = msg || m.quoted.msg

        if (!targetMsg || !/imageMessage|videoMessage|audioMessage|documentMessage|stickerMessage/.test(targetType)) {
            return reply('❌ Aucun média récupérable dans le message cité.')
        }

        await reply('🔄 Récupération du média en cours...')

        try {
            const { downloadContentFromMessage } = await getBaileys()
            const kind = targetType.replace('Message', '')
            const flux = await downloadContentFromMessage(targetMsg, kind)
            let buffer = Buffer.from([])
            for await (const chunk of flux) buffer = Buffer.concat([buffer, chunk])

            if (!buffer.length) throw new Error('Média vide')

            // En mode privé, tout part en PV au propriétaire, sinon dans le chat d'origine
            const cible = (global.db.settings.privateMode ? global.ownerJid() : null) || m.key.remoteJid

            if (kind === 'image') {
                await sock.sendMessage(cible, { image: buffer, caption: '✅ Média récupéré par Ely Bot' }, { quoted: cible === m.key.remoteJid ? m : undefined })
            } else if (kind === 'video') {
                await sock.sendMessage(cible, { video: buffer, caption: '✅ Média récupéré par Ely Bot' }, { quoted: cible === m.key.remoteJid ? m : undefined })
            } else if (kind === 'audio') {
                await sock.sendMessage(cible, { audio: buffer, mimetype: targetMsg.mimetype || 'audio/ogg; codecs=opus', ptt: !!targetMsg.ptt }, { quoted: cible === m.key.remoteJid ? m : undefined })
            } else if (kind === 'sticker') {
                await sock.sendMessage(cible, { sticker: buffer }, { quoted: cible === m.key.remoteJid ? m : undefined })
            } else {
                await sock.sendMessage(cible, {
                    document: buffer,
                    fileName: targetMsg.fileName || `extrait_${Date.now()}`,
                    caption: '✅ Document récupéré par Ely Bot'
                }, { quoted: cible === m.key.remoteJid ? m : undefined })
            }
        } catch (e) {
            console.error('[EXTRACT]', e.message)
            reply('❌ Échec de la récupération. Le média a peut-être expiré (vue unique déjà ouverte).')
        }
    }
}
