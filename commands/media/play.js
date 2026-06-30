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

        // Recherche de la vidéo sur YouTube
        let video
        try {
            const resultats = await yts(text)
            video = resultats.videos[0]
        } catch (e) {
            return reply(`❌ Erreur de recherche YouTube : ${e.message}`)
        }

        if (!video) return reply('❌ Aucun résultat trouvé. Essayez avec d\'autres mots-clés.')

        // Message d'information sur la vidéo trouvée
        const infoTexte =
            `🎵 *ELY MUSIC PLAYER* 🎵\n\n` +
            `📌 *Titre :* ${video.title}\n` +
            `🕒 *Durée :* ${video.timestamp}\n` +
            `👀 *Vues :* ${Number(video.views).toLocaleString('fr-FR')}\n` +
            `🔗 *Lien :* ${video.url}\n\n` +
            `📥 _Téléchargement en cours..._`

        // Afficher la miniature avec les informations
        try {
            await sock.sendMessage(m.key.remoteJid, {
                image: { url: video.thumbnail },
                caption: infoTexte
            }, { quoted: m })
        } catch (e) {
            // Si l'image échoue, envoyer juste le texte
            await reply(infoTexte)
        }

        const from = m.key.remoteJid
        // Utiliser /tmp sur Vercel (seul dossier accessible en écriture), sinon ./temp
        const dossierTemp = global.tempDir || '/tmp'
        const nomFichier = `ely_play_${Date.now()}.mp3`
        const cheminFichier = path.join(dossierTemp, nomFichier)
        const estVercel = !!process.env.VERCEL || !!process.env.VERCEL_ENV

        try {
            const ytdl = require('@distube/ytdl-core')

            // Vérifier que l'URL est valide avant de télécharger
            if (!ytdl.validateURL(video.url)) {
                throw new Error('URL YouTube invalide ou vidéo non disponible dans votre région.')
            }

            // Récupérer les informations de la vidéo pour vérifier la durée
            const infos = await ytdl.getInfo(video.url).catch(() => null)
            if (infos) {
                const dureeSecondes = parseInt(infos.videoDetails.lengthSeconds || 0)
                if (dureeSecondes > 600) { // Limite de 10 minutes pour éviter les timeouts
                    return reply(`⚠️ Vidéo trop longue (${Math.floor(dureeSecondes / 60)} min).\n_Limite : 10 minutes pour éviter les timeouts serveur._`)
                }
            }

            // Téléchargement via stream audio (évite de charger la vidéo entière)
            await new Promise((resolve, reject) => {
                const stream = ytdl(video.url, {
                    filter: 'audioonly',      // Audio uniquement
                    quality: 'highestaudio',  // Meilleure qualité audio disponible
                    requestOptions: {
                        headers: {
                            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36'
                        }
                    }
                })

                const fluxEcriture = fs.createWriteStream(cheminFichier)
                stream.pipe(fluxEcriture)

                stream.on('error', reject)
                fluxEcriture.on('error', reject)
                fluxEcriture.on('finish', resolve)

                // Timeout de sécurité : 2 minutes maximum pour le téléchargement
                const timeout = setTimeout(() => {
                    stream.destroy()
                    reject(new Error('Délai dépassé : téléchargement trop lent.'))
                }, 120000)

                fluxEcriture.on('finish', () => clearTimeout(timeout))
            })

            // Vérifier que le fichier a bien été créé et n'est pas vide
            if (!fs.existsSync(cheminFichier) || fs.statSync(cheminFichier).size === 0) {
                throw new Error('Fichier audio vide ou non créé après téléchargement.')
            }

            // Envoyer le fichier audio sur WhatsApp
            await sock.sendMessage(from, {
                audio: fs.readFileSync(cheminFichier),
                mimetype: 'audio/mp4',
                ptt: false,
                fileName: `${video.title.substring(0, 50)}.mp3`
            }, { quoted: m })

            console.log(`[PLAY] ✅ Audio envoyé : ${video.title}`)

        } catch (erreurPrincipale) {
            console.error('[PLAY ERREUR]', erreurPrincipale.message)

            // Tentative de fallback avec yt-dlp (uniquement en local, pas sur Vercel)
            if (!estVercel) {
                try {
                    const { exec } = require('child_process')
                    const util = require('util')
                    const execPromise = util.promisify(exec)

                    // Chercher le binaire yt-dlp (local ou système)
                    let binYtDlp = 'yt-dlp'
                    const binLocal = path.join(__dirname, '../../yt-dlp.exe')
                    if (fs.existsSync(binLocal)) binYtDlp = `"${binLocal}"`

                    const cmd = `${binYtDlp} -x --audio-format mp3 --audio-quality 0 --output "${cheminFichier.replace(/\\/g, '/')}" "${video.url}"`
                    await execPromise(cmd)

                    if (fs.existsSync(cheminFichier)) {
                        await sock.sendMessage(from, {
                            audio: fs.readFileSync(cheminFichier),
                            mimetype: 'audio/mp4',
                            ptt: false,
                            fileName: `${video.title.substring(0, 50)}.mp3`
                        }, { quoted: m })
                        console.log(`[PLAY] ✅ yt-dlp fallback réussi : ${video.title}`)
                    } else {
                        throw new Error('yt-dlp : fichier non créé.')
                    }
                } catch (erreurYtDlp) {
                    console.error('[PLAY] yt-dlp fallback échoué :', erreurYtDlp.message)
                    return reply(
                        `❌ *Échec du téléchargement*\n\n` +
                        `_${erreurPrincipale.message}_\n\n` +
                        `🔗 Écoutez directement sur YouTube :\n${video.url}`
                    )
                }
            } else {
                // Sur Vercel, proposer le lien direct en alternative
                return reply(
                    `❌ *Téléchargement impossible sur Vercel*\n\n` +
                    `_${erreurPrincipale.message}_\n\n` +
                    `🔗 Écoutez sur YouTube :\n${video.url}\n\n` +
                    `💡 _Pour les téléchargements, hébergez sur Render ou Railway._`
                )
            }
        } finally {
            // Nettoyage du fichier temporaire dans tous les cas
            try {
                if (fs.existsSync(cheminFichier)) fs.unlinkSync(cheminFichier)
            } catch (e) { /* Ignorer les erreurs de nettoyage */ }
        }
    }
}
