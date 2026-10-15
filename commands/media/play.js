const yts = require('yt-search')
const fs = require('fs')
const path = require('path')
const { telechargerAudio, fichierProduit } = require('../../lib/ytdlp')

module.exports = {
    name: 'play',
    category: 'media',
    desc: 'Recherche et télécharge de la musique depuis YouTube.',
    commands: ['play', 'music', 'mp3'],
    run: async (sock, m, args, { reply, text, tempDir }) => {
        if (!text) return reply('❌ Veuillez fournir un titre ou un lien YouTube.\n_Exemple :_ `.play Afrobeats mix`')

        await reply('🔍 *Recherche en cours...*')

        let video
        try {
            const resultats = await yts(text)
            video = resultats.videos?.[0]
        } catch (e) {
            return reply(`❌ Erreur de recherche YouTube : ${e.message}`)
        }
        if (!video) return reply('❌ Aucun résultat trouvé. Essayez avec d\'autres mots-clés.')

        const dossier = tempDir || path.join(__dirname, '../../temp')
        if (!fs.existsSync(dossier)) fs.mkdirSync(dossier, { recursive: true })

        const infoTexte =
            `🎵 *ELY MUSIC PLAYER* 🎵\n\n` +
            `📌 *Titre :* ${video.title}\n` +
            `🕒 *Durée :* ${video.timestamp}\n` +
            `👀 *Vues :* ${Number(video.views || 0).toLocaleString('fr-FR')}\n` +
            `🔗 *Lien :* ${video.url}\n\n` +
            `📥 _Téléchargement en cours..._`

        try {
            await sock.sendMessage(m.key.remoteJid, {
                image: { url: video.thumbnail },
                caption: infoTexte
            }, { quoted: m })
        } catch (e) {
            await reply(infoTexte)
        }

        // Sécurité : 10 minutes max pour éviter les timeouts serveur
        const duree = Number(video.seconds || 0)
        if (duree > 600) {
            return reply(`⚠️ Titre trop long (${video.timestamp}).\n_Limite : 10 minutes._\n🔗 ${video.url}`)
        }

        const horodatage = Date.now()
        const prefixe = `ely_play_${horodatage}`
        const sortie = path.join(dossier, `${prefixe}_%(ext)s`)

        try {
            await telechargerAudio(video.url, sortie)

            const fichier = fichierProduit(sortie)
            if (!fichier) throw new Error('Aucun fichier audio généré.')

            await sock.sendMessage(m.key.remoteJid, {
                audio: fs.readFileSync(fichier),
                mimetype: 'audio/mp4',
                ptt: false,
                fileName: `${(video.title || 'audio').substring(0, 48)}.mp3`
            }, { quoted: m })

            console.log(`[PLAY] Audio envoyé : ${video.title}`)
        } catch (erreur) {
            console.error('[PLAY ERREUR]', erreur.message)
            return reply(
                `❌ *Échec du téléchargement*\n\n` +
                `_${erreur.message}_\n\n` +
                `🔗 Écoutez directement sur YouTube :\n${video.url}`
            )
        } finally {
            // Nettoyage : uniquement les fichiers produits par cet appel
            try {
                for (const f of fs.readdirSync(dossier).filter(x => x.startsWith(prefixe))) {
                    try { fs.unlinkSync(path.join(dossier, f)) } catch (e) { /* ignore */ }
                }
            } catch (e) { /* ignore */ }
        }
    }
}
