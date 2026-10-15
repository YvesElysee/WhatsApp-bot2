/**
 * Helper FFmpeg — résolution du binaire + exécution sans shell.
 *
 * Problème réglé : sur Ubuntu, `ffmpeg` vient souvent de Snap, qui n'a PAS
 * le codec `libwebp` (donc impossible de créer un sticker) et qui tourne
 * dans un espace cloisonné. On préfère donc le binaire `ffmpeg-static`
 * (installé par npm, complet : libwebp inclus), sinon ffmpeg du PATH.
 *
 * On utilise execFile (pas de `sh -c`) : plus d'interprétation des
 * guillemets, parenthèses ou `$` par le shell.
 */
const fs = require('fs')
const { execFile } = require('child_process')
const util = require('util')

const execFilePromise = util.promisify(execFile)

let binaireFFmpeg = null

/** Renvoie le chemin du binaire ffmpeg utilisable. */
const resoudreFFmpeg = () => {
    if (binaireFFmpeg) return binaireFFmpeg

    // 1. ffmpeg-static (npm) — complet, non cloisonné
    try {
        const chemin = require('ffmpeg-static')
        if (chemin && fs.existsSync(chemin)) {
            binaireFFmpeg = chemin
            return binaireFFmpeg
        }
    } catch (e) { /* module absent → on continue */ }

    // 2. ffmpeg du système (PATH) — Docker/Render/apt
    binaireFFmpeg = 'ffmpeg'
    return binaireFFmpeg
}

/**
 * Exécute ffmpeg avec un tableau d'arguments (aucune interprétation shell).
 * @param {string[]} args arguments ffmpeg (ex: ['-y', '-i', 'in.png', 'out.webp'])
 * @param {number} timeout délai max en ms
 * @returns {Promise<{stdout:string, stderr:string}>}
 */
const execFfmpeg = async (args, timeout = 180000) => {
    const binaire = resoudreFFmpeg()
    try {
        return await execFilePromise(binaire, args, {
            timeout,
            maxBuffer: 1024 * 1024 * 50
        })
    } catch (e) {
        const detail = (e.stderr || e.message || '').toString().split('\n').filter(Boolean).slice(-4).join(' | ')
        const err = new Error(`ffmpeg (${binaire}) : ${detail || 'échec inconnu'}`)
        err.stderr = e.stderr
        throw err
    }
}

/** Vérifie rapidement que ffmpeg répond (utile au démarrage). */
const verifierFFmpeg = async () => {
    try {
        await execFilePromise(resoudreFFmpeg(), ['-version'], { timeout: 15000 })
        return true
    } catch (e) {
        return false
    }
}

module.exports = { resoudreFFmpeg, execFfmpeg, verifierFFmpeg }
