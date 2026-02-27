const yts = require('yt-search')
const fs = require('fs')
const path = require('path')
const { exec } = require('child_process')
const util = require('util')
const execPromise = util.promisify(exec)

module.exports = {
    name: 'vlt',
    category: 'media',
    desc: 'Télécharge une vidéo YouTube (max 5 min).',
    commands: ['vlt', 'video4', 'clip'],
    run: async (sock, m, args, { reply, text }) => {
        if (!text) return reply('❌ Veuillez fournir un titre ou un lien YouTube.')

        reply('🔍 Recherche du clip...')
        const res = await yts(text)
        const vid = res.videos[0]
        if (!vid) return reply('❌ Aucun résultat trouvé.')

        // Check duration (5 minutes = 300 seconds)
        if (vid.seconds > 300) {
            return reply(`⏳ *Désolé, ce clip est trop long !*\nLa durée est de *${vid.timestamp}*.\nVeuillez choisir une chanson/vidéo de *moins de 5 minutes*.`)
        }

        const msgText = `🎞 *ELY-VIDEO DOWNLOADER* 🎞\n\n` +
            `📌 *Titre :* ${vid.title}\n` +
            `🕒 *Durée :* ${vid.timestamp}\n` +
            `👀 *Vues :* ${vid.views.toLocaleString()}\n` +
            `🔗 *Lien :* ${vid.url}\n\n` +
            `📥 _Téléchargement en cours (Qualité moyenne pour WhatsApp)..._`

        await sock.sendMessage(m.key.remoteJid, {
            image: { url: vid.thumbnail },
            caption: msgText
        }, { quoted: m })

        const tempDir = path.join(__dirname, '../../temp')
        if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true })

        const fileName = `${Date.now()}.mp4`
        const filePath = path.join(tempDir, fileName)

        try {
            // Check for yt-dlp binary
            let ytDlpBinary = 'yt-dlp'
            const localBin = path.join(__dirname, '../../yt-dlp.exe')
            if (fs.existsSync(localBin)) ytDlpBinary = `"${localBin}"`

            // Download video - Simplified command for better stability and lower resolution
            // -f "best[height<=360][ext=mp4]": direct 360p mp4 selection
            const command = `${ytDlpBinary} -f "best[height<=360][ext=mp4]/best[ext=mp4]/best" --output "${filePath.replace(/\\/g, '/')}" "${vid.url}"`

            console.log(`[VLT] Executing: ${command}`)
            await execPromise(command)

            if (fs.existsSync(filePath)) {
                await sock.sendMessage(m.key.remoteJid, {
                    video: fs.readFileSync(filePath),
                    caption: `✅ *${vid.title}*`,
                    mimetype: 'video/mp4'
                }, { quoted: m })
                fs.unlinkSync(filePath)
            } else {
                throw new Error('File not found after download')
            }
        } catch (e) {
            console.error('[VLT ERROR]', e)
            reply(`❌ Échec du téléchargement: ${e.message}`)
        }
    }
}
