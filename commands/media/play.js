const yts = require('yt-search')
const fs = require('fs')
const path = require('path')
let ytdl = null
try { ytdl = require('@distube/ytdl-core') } catch (e) { }

module.exports = {
    name: 'play',
    category: 'media',
    desc: 'Recherche et joue de la musique depuis YouTube.',
    run: async (sock, m, args, { reply, text }) => {
        reply('🔍 Recherche...')
        const res = await yts(text)
        const vid = res.videos[0]
        if (!vid) return reply('❌ Rien trouvé.')

        reply(`📌 *Titre :* ${vid.title}\n🕒 *Durée :* ${vid.timestamp}\n👀 *Vues :* ${vid.views.toLocaleString()}\n📅 *Publié :* ${vid.ago}\n\n📥 _Téléchargement du MP3 en cours..._`)

        const filePath = path.join(__dirname, '../../temp', `${vid.videoId}.mp3`)

        try {
            const stream = ytdl(vid.url, { filter: 'audioonly', quality: 'highestaudio' })
            const writer = fs.createWriteStream(filePath)
            stream.pipe(writer)

            writer.on('finish', () => {
                sock.sendMessage(m.key.remoteJid, {
                    audio: { url: filePath },
                    mimetype: 'audio/mp4',
                    ptt: false, // Send as audio file, not voice note
                    fileName: `${vid.title}.mp3`
                }, { quoted: m })
                // Cleanup after a delay to ensure send
                setTimeout(() => { if (fs.existsSync(filePath)) fs.unlinkSync(filePath) }, 30000)
            })
        } catch (e) {
            console.error(e)
            reply('❌ Erreur de téléchargement.')
        }
    }
}
