const { getBaileys } = require('../../lib/baileys')
const fs = require('fs')
const path = require('path')
const { exec } = require('child_process')

module.exports = {
    name: 'sticker',
    category: 'media',
    desc: 'Convertit une image ou une vidéo en sticker.',
    commands: ['sticker', 's'],
    run: async (sock, m, args, { reply, tempDir }) => {
        const quoted = m.quoted ? m.quoted : m
        const source = quoted.msg || quoted
        const mime = source.mimetype || ''

        if (!/image|video|webp/.test(mime)) return reply('❌ Répondez à une image ou une vidéo !')

        await reply('🎨 Création du sticker...')

        const dossier = tempDir || path.join(__dirname, '../../temp')
        if (!fs.existsSync(dossier)) fs.mkdirSync(dossier, { recursive: true })

        try {
            const { downloadContentFromMessage } = await getBaileys()
            const flux = await downloadContentFromMessage(source, mime.split('/')[0])
            let buffer = Buffer.from([])
            for await (const chunk of flux) buffer = Buffer.concat([buffer, chunk])

            const tempIn = path.join(dossier, `s_${Date.now()}.${mime.split('/')[1]}`)
            const tempOut = path.join(dossier, `s_${Date.now()}.webp`)
            fs.writeFileSync(tempIn, buffer)

            exec(`ffmpeg -y -i "${tempIn}" -vcodec libwebp -vf "scale='min(320,iw)':min'(320,ih)':force_original_aspect_ratio=decrease,fps=15, pad=320:320:-1:-1:color=white@0.0, split [a][b]; [a] palettegen=reserve_transparent=on:transparency_color=ffffff [p]; [b][p] paletteuse" "${tempOut}"`, (err) => {
                try { if (fs.existsSync(tempIn)) fs.unlinkSync(tempIn) } catch (e) { /* ignore */ }
                if (err) {
                    console.error('[STICKER ffmpeg]', err.message)
                    return reply('❌ Erreur FFmpeg. Vérifiez que ffmpeg est installé sur le serveur.')
                }
                try {
                    sock.sendMessage(m.key.remoteJid, { sticker: fs.readFileSync(tempOut) }, { quoted: m })
                } finally {
                    try { if (fs.existsSync(tempOut)) fs.unlinkSync(tempOut) } catch (e) { /* ignore */ }
                }
            })
        } catch (e) {
            console.error('[STICKER]', e.message)
            reply('❌ Échec de la création du sticker.')
        }
    }
}
