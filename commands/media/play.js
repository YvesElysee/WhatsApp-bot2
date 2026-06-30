const yts = require('yt-search')
const fs = require('fs')
const path = require('path')

module.exports = {
    name: 'play',
    category: 'media',
    desc: 'Recherche et télécharge de la musique depuis YouTube.',
    commands: ['play', 'music', 'mp3'],
    run: async (sock, m, args, { reply, text }) => {
        if (!text) return reply('❌ Veuillez fournir un titre ou un lien YouTube.\n_Exemple :_ `.play Afrobeats mix`')

        await reply('🔍 *Recherche en cours...*')

        let vid
        try {
            const res = await yts(text)
            vid = res.videos[0]
        } catch (e) {
            return reply(`❌ Erreur de recherche : ${e.message}`)
        }

        if (!vid) return reply('❌ Aucun résultat trouvé. Essayez avec d\'autres mots-clés.')

        const msgText =
            `🎵 *ELY MUSIC PLAYER* 🎵\n\n` +
            `📌 *Titre :* ${vid.title}\n` +
            `🕒 *Durée :* ${vid.timestamp}\n` +
            `👀 *Vues :* ${Number(vid.views).toLocaleString('fr-FR')}\n` +
            `🔗 *Lien :* ${vid.url}\n\n` +
            `📥 _Téléchargement en cours..._`

        try {
            await sock.sendMessage(m.key.remoteJid, {
                image: { url: vid.thumbnail },
                caption: msgText
            }, { quoted: m })
        } catch (e) {
            await reply(msgText)
        }

        // ── Download using @distube/ytdl-core (works on Vercel/serverless) ──
        const from = m.key.remoteJid
        const tmpDir = global.tempDir || '/tmp'
        const fileName = `ely_play_${Date.now()}.mp3`
        const filePath = path.join(tmpDir, fileName)

        try {
            const ytdl = require('@distube/ytdl-core')

            // Check if URL is playable
            if (!ytdl.validateURL(vid.url)) {
                throw new Error('URL YouTube invalide ou vidéo non disponible.')
            }

            // Check video duration (avoid downloading very long videos)
            const info = await ytdl.getInfo(vid.url).catch(() => null)
            if (info) {
                const durationSec = parseInt(info.videoDetails.lengthSeconds || 0)
                if (durationSec > 600) { // 10 minutes max
                    return reply(`⚠️ Vidéo trop longue (${Math.floor(durationSec / 60)} min).\nLimite : 10 minutes pour éviter les timeouts.`)
                }
            }

            // Stream to file
            await new Promise((resolve, reject) => {
                const stream = ytdl(vid.url, {
                    filter: 'audioonly',
                    quality: 'highestaudio',
                    requestOptions: {
                        headers: {
                            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36'
                        }
                    }
                })

                const writeStream = fs.createWriteStream(filePath)
                stream.pipe(writeStream)

                stream.on('error', reject)
                writeStream.on('error', reject)
                writeStream.on('finish', resolve)

                // Timeout safety (2 minutes)
                const timeout = setTimeout(() => {
                    stream.destroy()
                    reject(new Error('Timeout : téléchargement trop lent.'))
                }, 120000)

                writeStream.on('finish', () => clearTimeout(timeout))
            })

            if (!fs.existsSync(filePath) || fs.statSync(filePath).size === 0) {
                throw new Error('Fichier audio vide ou non créé.')
            }

            await sock.sendMessage(from, {
                audio: fs.readFileSync(filePath),
                mimetype: 'audio/mp4',
                ptt: false,
                fileName: `${vid.title.substring(0, 50)}.mp3`
            }, { quoted: m })

            console.log(`[PLAY] ✅ Sent: ${vid.title}`)
        } catch (e) {
            console.error('[PLAY ERROR]', e.message)

            // Try yt-dlp as fallback (local/non-Vercel only)
            const isVercel = !!process.env.VERCEL || !!process.env.VERCEL_ENV
            if (!isVercel) {
                try {
                    const { exec } = require('child_process')
                    const util = require('util')
                    const execPromise = util.promisify(exec)

                    let ytDlpBinary = 'yt-dlp'
                    const localBin = path.join(__dirname, '../../yt-dlp.exe')
                    if (fs.existsSync(localBin)) ytDlpBinary = `"${localBin}"`

                    const cmd = `${ytDlpBinary} -x --audio-format mp3 --audio-quality 0 --output "${filePath.replace(/\\/g, '/')}" "${vid.url}"`
                    await execPromise(cmd)

                    if (fs.existsSync(filePath)) {
                        await sock.sendMessage(from, {
                            audio: fs.readFileSync(filePath),
                            mimetype: 'audio/mp4',
                            ptt: false,
                            fileName: `${vid.title.substring(0, 50)}.mp3`
                        }, { quoted: m })
                        console.log(`[PLAY] ✅ yt-dlp fallback success: ${vid.title}`)
                    } else {
                        throw new Error('yt-dlp : fichier non créé.')
                    }
                } catch (ytdlpErr) {
                    console.error('[PLAY] yt-dlp fallback failed:', ytdlpErr.message)
                    return reply(
                        `❌ *Échec du téléchargement*\n\n` +
                        `_${e.message}_\n\n` +
                        `🔗 Téléchargez manuellement :\n${vid.url}`
                    )
                }
            } else {
                return reply(
                    `❌ *Téléchargement impossible sur Vercel*\n\n` +
                    `_${e.message}_\n\n` +
                    `🔗 Utilisez ce lien pour écouter :\n${vid.url}\n\n` +
                    `💡 _Pour les téléchargements, hébergez le bot sur Render ou Railway._`
                )
            }
        } finally {
            // Cleanup temp file
            try {
                if (fs.existsSync(filePath)) fs.unlinkSync(filePath)
            } catch (e) { }
        }
    }
}
