const { getBaileys } = require('../../lib/baileys')
const { execFfmpeg } = require('../../lib/ffmpeg')
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

        const horodatage = Date.now()
        const inputPath = path.join(dossier, `in_${horodatage}.webp`)
        const outputPath = path.join(dossier, `out_${horodatage}.png`)

        try {
            const { downloadContentFromMessage } = await getBaileys()
            const flux = await downloadContentFromMessage(m.quoted.msg, 'sticker')
            let buffer = Buffer.from([])
            for await (const chunk of flux) buffer = Buffer.concat([buffer, chunk])
            if (!buffer.length) throw new Error('sticker vide')

            fs.writeFileSync(inputPath, buffer)

            await execFfmpeg(['-y', '-i', inputPath, '-frames:v', '1', outputPath])

            const octets = fs.readFileSync(outputPath)
            if (!octets.length) throw new Error('image vide')

            await sock.sendMessage(m.key.remoteJid, {
                image: octets,
                caption: '✅ Sticker converti en image !'
            }, { quoted: m })
        } catch (e) {
            console.error('[TOIMG]', e.message)
            await reply(`❌ Échec de la conversion.\n_${e.message}_`)
        } finally {
            for (const f of [inputPath, outputPath]) {
                try { if (fs.existsSync(f)) fs.unlinkSync(f) } catch (e) { /* ignore */ }
            }
        }
    }
}
