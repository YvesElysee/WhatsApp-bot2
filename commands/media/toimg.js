const { getBaileys } = require('../../lib/baileys')
const { exec } = require('child_process')
const fs = require('fs')
const path = require('path')

module.exports = {
    name: 'toimg',
    category: 'media',
    desc: 'Transforme un sticker en image.',
    commands: ['toimg', 'img'],
    run: async (sock, m, args, { reply, tempDir }) => {
        if (!m.quoted || m.quoted.mtype !== 'stickerMessage') return reply('❌ Répondez à un sticker !')

        await reply('🔄 Conversion en cours...')

        const dossier = tempDir || path.join(__dirname, '../../temp')
        if (!fs.existsSync(dossier)) fs.mkdirSync(dossier, { recursive: true })

        try {
            const { downloadContentFromMessage } = await getBaileys()
            const flux = await downloadContentFromMessage(m.quoted.msg, 'sticker')
            let buffer = Buffer.from([])
            for await (const chunk of flux) buffer = Buffer.concat([buffer, chunk])

            const inputPath = path.join(dossier, `in_${Date.now()}.webp`)
            const outputPath = path.join(dossier, `out_${Date.now()}.png`)

            fs.writeFileSync(inputPath, buffer)

            exec(`ffmpeg -y -i "${inputPath}" "${outputPath}"`, async (err) => {
                try { if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath) } catch (e) { /* ignore */ }
                if (err) {
                    console.error('[TOIMG ffmpeg]', err.message)
                    return reply('❌ Erreur de conversion. Assurez-vous que ffmpeg est installé.')
                }
                try {
                    await sock.sendMessage(m.key.remoteJid, {
                        image: fs.readFileSync(outputPath),
                        caption: '✅ Sticker converti en image !'
                    }, { quoted: m })
                } catch (e) {
                    await reply('❌ Échec de l\'envoi de l\'image.')
                } finally {
                    try { if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath) } catch (e) { /* ignore */ }
                }
            })
        } catch (e) {
            console.error('[TOIMG]', e.message)
            reply('❌ Échec de la conversion.')
        }
    }
}
