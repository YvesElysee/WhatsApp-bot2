const { downloadContentFromMessage } = require('@whiskeysockets/baileys')
const { exec } = require('child_process')
const fs = require('fs')
const path = require('path')

module.exports = {
    name: 'toimg',
    category: 'media',
    desc: 'Transforme un sticker en image.',
    commands: ['toimg', 'img'],
    run: async (sock, m, args, { reply }) => {
        if (!m.quoted || m.quoted.mtype !== 'stickerMessage') return reply('❌ Répondez à un sticker !')

        reply('🔄 Conversion en cours...')

        try {
            const stream = await downloadContentFromMessage(m.quoted.msg, 'sticker')
            let buffer = Buffer.from([])
            for await (const chunk of stream) { buffer = Buffer.concat([buffer, chunk]) }

            const inputPath = path.join(__dirname, `../../temp/sticker_${Date.now()}.webp`)
            const outputPath = path.join(__dirname, `../../temp/image_${Date.now()}.png`)

            fs.writeFileSync(inputPath, buffer)

            exec(`ffmpeg -i ${inputPath} ${outputPath}`, async (err) => {
                if (err) {
                    console.error(err)
                    return reply('❌ Erreur lors de la conversion. Assurez-vous que ffmpeg est installé.')
                }

                await sock.sendMessage(m.key.remoteJid, {
                    image: fs.readFileSync(outputPath),
                    caption: '✅ Sticker converti en image !'
                }, { quoted: m })

                // Cleanup
                if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath)
                if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath)
            })
        } catch (e) {
            console.error(e)
            reply('❌ Échec de la conversion.')
        }
    }
}
