const { downloadContentFromMessage } = require('@whiskeysockets/baileys')
const fs = require('fs')
const path = require('path')
const { exec } = require('child_process')

module.exports = {
    name: 'sticker',
    commands: ['sticker', 's'],
    run: async (sock, m, args, { reply }) => {
        const quoted = m.quoted ? m.quoted : m
        const mime = (quoted.msg || quoted).mimetype || ''

        if (!/image|video|webp/.test(mime)) return reply('❌ Répondez à une image ou une vidéo !')

        reply('🎨 Création du sticker...')
        try {
            const stream = await downloadContentFromMessage(quoted.msg || quoted, mime.split('/')[0])
            let buffer = Buffer.from([])
            for await (const chunk of stream) { buffer = Buffer.concat([buffer, chunk]) }

            const tempIn = path.join(__dirname, '../../temp', `${Date.now()}.${mime.split('/')[1]}`)
            const tempOut = path.join(__dirname, '../../temp', `${Date.now()}.webp`)
            fs.writeFileSync(tempIn, buffer)

            exec(`ffmpeg -i "${tempIn}" -vcodec libwebp -vf "scale='min(320,iw)':min'(320,ih)':force_original_aspect_ratio=decrease,fps=15, pad=320:320:-1:-1:color=white@0.0, split [a][b]; [a] palettegen=reserve_transparent=on:transparency_color=ffffff [p]; [b][p] paletteuse" "${tempOut}"`, (err) => {
                if (fs.existsSync(tempIn)) fs.unlinkSync(tempIn)
                if (err) return reply('❌ Erreur FFmpeg. Vérifiez que ffmpeg est installé.')

                sock.sendMessage(m.key.remoteJid, { sticker: fs.readFileSync(tempOut) }, { quoted: m })
                if (fs.existsSync(tempOut)) fs.unlinkSync(tempOut)
            })
        } catch (e) {
            console.error(e)
            reply('❌ Échec de la création.')
        }
    }
}
