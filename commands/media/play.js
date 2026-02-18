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
        if (!vid) return reply('❌ Aucun résultat trouvé.')

        const msgText = `🎵 *ELY-MUSIC PLAYER* 🎵\n\n` +
            `📌 *Titre :* ${vid.title}\n` +
            `🕒 *Durée :* ${vid.timestamp}\n` +
            `👀 *Vues :* ${vid.views.toLocaleString()}\n` +
            `📅 *Publié :* ${vid.ago}\n` +
            `🔗 *Lien :* ${vid.url}\n\n` +
            `📥 _Téléchargement du MP3 en cours..._`

        await sock.sendMessage(m.key.remoteJid, {
            image: { url: vid.thumbnail },
            caption: msgText
        }, { quoted: m })

        const filePath = path.join(__dirname, '../../temp', `${vid.videoId}.mp3`)

        try {
            const requestOptions = {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
                    'Accept': '*/*',
                    'Accept-Language': 'en-US,en;q=0.5',
                    'Referer': 'https://www.google.com/',
                    'Origin': 'https://www.youtube.com'
                }
            }

            const stream = ytdl(vid.url, {
                filter: 'audioonly',
                quality: 'highestaudio',
                highWaterMark: 1 << 25,
                requestOptions
            })
            const writer = fs.createWriteStream(filePath)
            stream.pipe(writer)

            writer.on('finish', () => {
                sock.sendMessage(m.key.remoteJid, {
                    audio: { url: filePath },
                    mimetype: 'audio/mp4',
                    ptt: false,
                    fileName: `${vid.title}.mp3`
                }, { quoted: m })
                setTimeout(() => { if (fs.existsSync(filePath)) fs.unlinkSync(filePath) }, 60000)
            })

            stream.on('error', (err) => {
                console.error('[YTDL ERROR]', err)
                reply(`❌ Erreur lors du téléchargement: ${err.message}`)
            })
        } catch (e) {
            console.error(e)
            reply('❌ Échec de la conversion MP3.')
        }
    }
}
