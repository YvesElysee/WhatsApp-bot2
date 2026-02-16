const yts = require('yt-search')
const fs = require('fs')
const path = require('path')
let ytdl = null
try { ytdl = require('@distube/ytdl-core') } catch (e) { }

module.exports = {
    name: 'play',
    run: async (sock, m, args, { reply, text }) => {
        if (!text) return reply('🎶 Envoyez le nom d\'une chanson !')
        if (!ytdl) return reply('❌ Bibliothèque de téléchargement manquante.')

        reply('🔍 Recherche...')
        const res = await yts(text)
        const vid = res.videos[0]
        if (!vid) return reply('❌ Rien trouvé.')

        reply(`📥 Téléchargement: ${vid.title}...`)
        const filePath = path.join(__dirname, '../../temp', `${vid.videoId}.mp3`)

        try {
            const stream = ytdl(vid.url, { filter: 'audioonly' })
            const writer = fs.createWriteStream(filePath)
            stream.pipe(writer)

            writer.on('finish', () => {
                sock.sendMessage(m.key.remoteJid, { audio: { url: filePath }, mimetype: 'audio/mp4' }, { quoted: m })
                // Cleanup after a delay to ensure send
                setTimeout(() => { if (fs.existsSync(filePath)) fs.unlinkSync(filePath) }, 10000)
            })
        } catch (e) {
            reply('❌ Erreur de téléchargement.')
        }
    }
}
