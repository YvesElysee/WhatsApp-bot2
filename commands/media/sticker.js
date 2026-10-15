const { getBaileys } = require('../../lib/baileys')
const { execFfmpeg } = require('../../lib/ffmpeg')
const fs = require('fs')
const path = require('path')

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

        const horodatage = Date.now()
        const tempIn = path.join(dossier, `s_${horodatage}.${mime.split('/')[1] || 'jpg'}`)
        const tempOut = path.join(dossier, `s_${horodatage}.webp`)

        try {
            const { downloadContentFromMessage } = await getBaileys()
            const flux = await downloadContentFromMessage(source, mime.split('/')[0])
            let buffer = Buffer.from([])
            for await (const chunk of flux) buffer = Buffer.concat([buffer, chunk])
            if (!buffer.length) throw new Error('média vide')

            fs.writeFileSync(tempIn, buffer)

            // Recette sticker WhatsApp : carré 320x320, fond transparent, webp
            const filtre =
                "scale='min(320,iw)':'min(320,ih)':force_original_aspect_ratio=decrease:flags=lanczos," +
                "fps=15," +
                "pad=320:320:(ow-iw)/2:(oh-ih)/2:color=white@0.0," +
                'split[0][1];' +
                '[0]palettegen=reserve_transparent=on:transparency_color=ffffff[p];' +
                '[1][p]paletteuse=new=1:alpha_threshold=128'

            // Sticker animé : WhatsApp refuse au-delà de ~6 s
            const argsFFmpeg = ['-y', '-i', tempIn]
            if (/video/.test(mime) && Number(source.seconds || 0) > 6) argsFFmpeg.push('-t', '6')
            argsFFmpeg.push('-vcodec', 'libwebp', '-vf', filtre, '-loop', '0', '-an', '-vsync', '0', tempOut)

            await execFfmpeg(argsFFmpeg)

            const octets = fs.readFileSync(tempOut)
            if (!octets.length) throw new Error('sticker vide')

            await sock.sendMessage(m.key.remoteJid, { sticker: octets }, { quoted: m })
        } catch (e) {
            console.error('[STICKER]', e.message)
            await reply(`❌ Échec de la création du sticker.\n_${e.message}_`)
        } finally {
            for (const f of [tempIn, tempOut]) {
                try { if (fs.existsSync(f)) fs.unlinkSync(f) } catch (e) { /* ignore */ }
            }
        }
    }
}
