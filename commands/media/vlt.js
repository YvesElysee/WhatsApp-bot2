const yts = require('yt-search')
const fs = require('fs')
const path = require('path')
const { telechargerVideo, fichierProduit } = require('../../lib/ytdlp')

module.exports = {
    name: 'vlt',
    category: 'media',
    desc: 'Télécharge une vidéo YouTube (max 5 min).',
    commands: ['vlt', 'video4', 'clip', 'video'],
    run: async (sock, m, args, { reply, text, tempDir }) => {
        if (!text) return reply('❌ Veuillez fournir un titre ou un lien YouTube.')

        await reply('🔍 Recherche du clip...')

        let vid
        try {
            const res = await yts(text)
            vid = res.videos?.[0]
        } catch (e) {
            return reply(`❌ Erreur de recherche : ${e.message}`)
        }
        if (!vid) return reply('❌ Aucun résultat trouvé.')

        // Limite de 5 minutes
        if (Number(vid.seconds || 0) > 300) {
            return reply(
                `⏳ *Ce clip est trop long !*\nDurée : *${vid.timestamp}*\n` +
                `Choisissez une vidéo de *moins de 5 minutes*.`
            )
        }

        const msgText =
            `🎞 *ELY-VIDEO DOWNLOADER* 🎞\n\n` +
            `📌 *Titre :* ${vid.title}\n` +
            `🕒 *Durée :* ${vid.timestamp}\n` +
            `👀 *Vues :* ${Number(vid.views || 0).toLocaleString('fr-FR')}\n` +
            `🔗 *Lien :* ${vid.url}\n\n` +
            `📥 _Téléchargement en cours (qualité limitée pour WhatsApp)..._`

        await sock.sendMessage(m.key.remoteJid, {
            image: { url: vid.thumbnail },
            caption: msgText
        }, { quoted: m })

        const dossier = tempDir || path.join(__dirname, '../../temp')
        if (!fs.existsSync(dossier)) fs.mkdirSync(dossier, { recursive: true })

        const prefixe = `ely_vlt_${Date.now()}`
        const sortie = path.join(dossier, `${prefixe}_%(ext)s`)

        try {
            await telechargerVideo(vid.url, sortie)

            const fichier = fichierProduit(sortie)
            if (!fichier) throw new Error('Fichier vidéo non généré.')

            // Mimetype calé sur l'extension réelle (mp4 / webm / mkv…)
            const ext = path.extname(fichier).slice(1).toLowerCase() || 'mp4'
            const mimeVideo = ext === 'webm' ? 'video/webm'
                : ext === 'mkv' ? 'video/x-matroska'
                    : ext === '3gp' ? 'video/3gpp'
                        : 'video/mp4'

            await sock.sendMessage(m.key.remoteJid, {
                video: fs.readFileSync(fichier),
                caption: `✅ *${vid.title}*`,
                mimetype: mimeVideo
            }, { quoted: m })
        } catch (e) {
            console.error('[VLT ERREUR]', e.message)
            await reply(`❌ Échec du téléchargement : ${e.message}\n🔗 ${vid.url}`)
        } finally {
            try {
                for (const f of fs.readdirSync(dossier).filter(x => x.startsWith(prefixe))) {
                    try { fs.unlinkSync(path.join(dossier, f)) } catch (e) { /* ignore */ }
                }
            } catch (e) { /* ignore */ }
        }
    }
}
