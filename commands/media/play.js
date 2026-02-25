const yts = require('yt-search')
const fs = require('fs')
const path = require('path')
const { exec } = require('child_process')
const util = require('util')
const execPromise = util.promisify(exec)

module.exports = {
    name: 'play',
    category: 'media',
    desc: 'Recherche et joue de la musique depuis YouTube.',
    run: async (sock, m, args, { reply, text }) => {
        if (!text) return reply('❌ Veuillez fournir un titre ou un lien YouTube.')

        reply('🔍 Recherche...')
        const res = await yts(text)
        const vid = res.videos[0]
        if (!vid) return reply('❌ Aucun résultat trouvé.')

        const msgText = `🎵 *ELY-MUSIC PLAYER* 🎵\n\n` +
            `📌 *Titre :* ${vid.title}\n` +
            `🕒 *Durée :* ${vid.timestamp}\n` +
            `👀 *Vues :* ${vid.views.toLocaleString()}\n` +
            `🔗 *Lien :* ${vid.url}\n\n` +
            `📥 _Téléchargement du MP3 en cours..._`

        await sock.sendMessage(m.key.remoteJid, {
            image: { url: vid.thumbnail },
            caption: msgText
        }, { quoted: m })

        const tempDir = path.join(__dirname, '../../temp')
        if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true })

        const fileName = `${Date.now()}.mp3`
        const filePath = path.join(tempDir, fileName)

        try {
            // Use yt-dlp to download and convert to mp3
            let ytDlpBinary = 'yt-dlp'

            // Check for local yt-dlp.exe in bot root
            const localBin = path.join(__dirname, '../../yt-dlp.exe')
            if (fs.existsSync(localBin)) {
                ytDlpBinary = `"${localBin}"`
                console.log(`[PLAY] Using local binary: ${ytDlpBinary}`)
            }

            const command = `${ytDlpBinary} -x --audio-format mp3 --audio-quality 0 --output "${filePath.replace(/\\/g, '/')}" "${vid.url}"`

            console.log(`[PLAY] Executing: ${command}`)
            await execPromise(command).catch(err => {
                const msg = err.message.toLowerCase()
                if (msg.includes('not found') || msg.includes('reconnu') || msg.includes('recognized')) {
                    throw new Error('yt-dlp non reconnu. Si vous venez de l\'installer, redémarrez le terminal ou placez yt-dlp.exe dans le dossier du bot.')
                }
                throw err
            })

            if (fs.existsSync(filePath)) {
                await sock.sendMessage(m.key.remoteJid, {
                    audio: fs.readFileSync(filePath),
                    mimetype: 'audio/mp4',
                    ptt: false,
                    fileName: `${vid.title}.mp3`
                }, { quoted: m })
                fs.unlinkSync(filePath)
            } else {
                throw new Error('File not found after download')
            }
        } catch (e) {
            console.error('[PLAY ERROR]', e)
            reply(`❌ *Échec du téléchargement* :\n${e.message}\n\n💡 *Solution* : Tapez \`winget install yt-dlp\` dans votre terminal ou téléchargez \`yt-dlp.exe\` et placez-le dans le dossier du bot.`)
        }
    }
}
