/**
 * Helper universel yt-dlp.
 *
 * Résout l'inviteur yt-dlp quel que soit le système :
 *  1. binaire `yt-dlp` présent dans le PATH (Linux, Docker, Render, macOS)
 *  2. binaire téléchargé automatiquement dans le dossier temporaire
 *  3. `yt-dlp.exe` local (Windows) en dernier recours
 *
 * IMPORTANT : l'exécution se fait avec `execFile` (tableau d'arguments)
 * et non `exec('sh -c ...')`. Le template de sortie `-o file_%(ext)s`
 * contient des parenthèses → `/bin/sh` plantait avec
 * « Syntax error: "(" unexpected » et aucun téléchargement ne démarrait.
 */
const fs = require('fs')
const path = require('path')
const os = require('os')
const { execFile } = require('child_process')
const util = require('util')
const axios = require('axios')

const execFilePromise = util.promisify(execFile)

const DOSSIER_BIN = path.join(os.tmpdir(), 'ely-ytdlp')

const URL_BINAIRE = {
    linux: 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp',
    win32: 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe',
    darwin: 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_macos'
}

const trouveDansPath = (binaire) => {
    const chemins = String(process.env.PATH || '').split(path.delimiter)
    for (const d of chemins) {
        if (!d) continue
        const p = path.join(d, binaire)
        try { if (fs.existsSync(p)) return p } catch (e) { /* ignore */ }
    }
    return null
}

let resolutionEnCours = null
let cacheBinaire = null

/**
 * @returns {Promise<string>} chemin vers yt-dlp
 */
const resolveYtDlp = async () => {
    if (cacheBinaire) return cacheBinaire
    if (resolutionEnCours) return resolutionEnCours

    const promesse = (async () => {
        // 1. PATH système
        const binaire = process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp'
        const dansPath = trouveDansPath(binaire)
        if (dansPath) {
            cacheBinaire = dansPath
            return dansPath
        }

        // 2. Fichier local (développement Windows)
        const localExe = path.join(__dirname, '..', 'yt-dlp.exe')
        if (process.platform === 'win32' && fs.existsSync(localExe)) {
            cacheBinaire = localExe
            return localExe
        }

        // 3. Téléchargement automatique
        const url = URL_BINAIRE[process.platform] || URL_BINAIRE.linux
        const cible = path.join(DOSSIER_BIN, process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp')
        try {
            if (!fs.existsSync(DOSSIER_BIN)) fs.mkdirSync(DOSSIER_BIN, { recursive: true })
            if (!fs.existsSync(cible)) {
                console.log(`[YT-DLP] Téléchargement du binaire ${process.platform}...`)
                const reponse = await axios({ url, method: 'GET', responseType: 'stream', timeout: 120000 })
                await new Promise((resolve, reject) => {
                    const sortie = fs.createWriteStream(cible)
                    reponse.data.pipe(sortie)
                    sortie.on('finish', resolve)
                    sortie.on('error', reject)
                })
                if (process.platform !== 'win32') fs.chmodSync(cible, 0o755)
            }
            cacheBinaire = cible
            return cible
        } catch (e) {
            // 4. Dernier espoir : on suppose yt-dlp dispo plus tard
            console.warn('[YT-DLP] Téléchargement impossible :', e.message)
            cacheBinaire = 'yt-dlp'
            return 'yt-dlp'
        } finally {
            resolutionEnCours = null
        }
    })()

    resolutionEnCours = promesse
    return promesse
}

/** Arguments du fichier cookies optionnel (améliore la stabilité YouTube). */
const argsCookies = () => {
    const p = path.join(__dirname, '..', 'cookies.txt')
    return fs.existsSync(p) ? ['--cookies', p] : []
}

/**
 * Exécute yt-dlp avec un tableau d'arguments (aucune interprétation shell).
 * @param {string[]} options arguments yt-dlp
 * @param {number} timeout délai max en ms
 */
const runYtDlp = async (options, timeout = 300000) => {
    const binaire = await resolveYtDlp()
    console.log(`[YT-DLP] ${binaire} ${options.join(' ')}`)
    try {
        await execFilePromise(binaire, options, {
            timeout,
            maxBuffer: 1024 * 1024 * 50
        })
    } catch (e) {
        const detail = (e.stderr || e.message || '').toString().split('\n').filter(Boolean).slice(-6).join(' | ')
        throw new Error(detail || 'yt-dlp a échoué')
    }
}

/**
 * Télécharge l'audio d'une URL YouTube vers `sortie` (mp3).
 * @param {string} url
 * @param {string} sortie chemin de sortie (l'extension `%(ext)s` est ajoutée par yt-dlp)
 */
const telechargerAudio = async (url, sortie) => {
    await runYtDlp([
        '-f', 'bestaudio/best',
        '-x', '--audio-format', 'mp3', '--audio-quality', '0',
        '--no-playlist', '--no-warnings', '--no-part',
        ...argsCookies(),
        '-o', sortie,
        url
    ], 300000)
}

/**
 * Télécharge une vidéo en MP4 (qualité limitée pour WhatsApp).
 * Fusion video+audio via ffmpeg pour garantir un `.mp4` lisible partout.
 */
const telechargerVideo = async (url, sortie) => {
    await runYtDlp([
        '-f', 'bv*[height<=480]+ba/b[height<=480]/bv*+ba/b',
        '-S', 'res:480,ext:mp4:m4a',
        '--merge-output-format', 'mp4',
        '--no-playlist', '--no-warnings', '--no-part',
        ...argsCookies(),
        '-o', sortie,
        url
    ], 300000)
}

/** Renvoie le premier fichier réellement produit autour de `sortie`. */
const fichierProduit = (sortie) => {
    const dir = path.dirname(sortie)
    const base = path.basename(sortie).replace(/%\(ext\)s$/, '')
    try {
        const fichiers = fs.readdirSync(dir).filter(f => f.startsWith(base) && !f.endsWith('.part'))
        const complet = fichiers
            .map(f => path.join(dir, f))
            .find(f => { try { return fs.statSync(f).size > 0 } catch (e) { return false } })
        if (complet) return complet
    } catch (e) { /* ignore */ }
    return (fs.existsSync(sortie) && fs.statSync(sortie).size > 0) ? sortie : null
}

module.exports = {
    resolveYtDlp,
    runYtDlp,
    telechargerAudio,
    telechargerVideo,
    fichierProduit
}
