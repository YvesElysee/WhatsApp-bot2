const { execFile } = require('child_process')
const util = require('util')
const fs = require('fs')
const path = require('path')
const os = require('os')

const execFilePromise = util.promisify(execFile)

/**
 * Compileur LOCAL — l'ancienne version appelait l'API Piston
 * (piston.rayon.sh : domaine disparu ; emkc.org : passée en
 * « whitelist only » le 15/02/2026 → la commande ne marchait plus).
 *
 * On exécute donc directement avec les outils de la machine :
 * python3, node, gcc, g++, javac, bash — instantané, sans réseau.
 *
 * Exécution cloisonnée : dossier temporaire jeté, timeouts stricts,
 * sortie limitée, et filtre de sécurité sur le code envoyé.
 */

const ALIAS = {
    python: 'python3', py: 'python3', python3: 'python3',
    js: 'node', javascript: 'node', node: 'node',
    c: 'c', cpp: 'cpp', 'c++': 'cpp', gpp: 'cpp',
    java: 'java',
    bash: 'bash', sh: 'bash', shell: 'bash', zsh: 'bash'
}

const MOTEURS = {
    python3: { binaire: 'python3', fichier: 'code.py', lancer: () => ['code.py'], nom: 'Python 3' },
    node: { binaire: 'node', fichier: 'code.js', lancer: () => ['code.js'], nom: 'Node.js' },
    bash: { binaire: 'bash', fichier: 'code.sh', lancer: () => ['code.sh'], nom: 'Bash' },
    c: { binaire: 'gcc', fichier: 'code.c', compilateur: () => ['code.c', '-o', 'prog', '-lm'], lancer: () => ['./prog'], nom: 'C (gcc)' },
    cpp: { binaire: 'g++', fichier: 'code.cpp', compilateur: () => ['code.cpp', '-o', 'prog'], lancer: () => ['./prog'], nom: 'C++ (g++)' },
    java: { binaire: 'javac', fichier: 'Main.java', compilateur: () => ['Main.java'], executable: 'java', lancer: () => ['Main'], nom: 'Java' }
}

// Filtre de sécurité : refuse les snippets destructeurs ou qui
// visent les fichiers sensibles du bot (.env, session, base…).
const INTERDITS = [
    [/\brm\s+-[rf]/i, 'suppression forcée de fichiers'],
    [/\bsudo\b/i, 'commandes administrateur'],
    [/\bmkfs\b|\/dev\/sd[a-z]/i, 'formatage de disque'],
    [/\b(pkill|killall)\b|kill\s+-9/i, 'arrêt de processus'],
    [/(\.env\b|creds\.json|database\.json|session\/)/i, 'fichiers sensibles du bot'],
    [/\/etc\/(passwd|shadow)/i, 'fichiers système'],
    [/\b(curl|wget)\b/i, 'téléchargement réseau'],
    [/\b(subprocess|os\.system|shutil|rmtree)\b/i, 'appels système'],
    [/\b(socket|urllib|requests)\b/i, 'accès réseau (Python)'],
    [/require\(\s*['"](fs|child_process|http|https|net)['"]\s*\)/i, 'accès disque/processus/réseau (Node)'],
    [/\bfetch\s*\(/i, 'accès réseau (Node)'],
    [/\b(import\s+os|from\s+os\s+import)\b/i, 'module système Python']
]

const TRONQUE = (txt, max) => {
    const t = (txt || '').toString()
    return t.length > max ? t.slice(0, max) + '\n… _(sortie tronquée)_' : t
}

module.exports = {
    name: 'compile',
    category: 'tools',
    desc: 'Compile et exécute du code en local (Python, JS, C, C++, Java, Bash).',
    commands: ['compile', 'run', 'code'],
    run: async (sock, m, args, { reply, text, isAdmins, isOwner }) => {
        // ── Accès : exécution de code sur le serveur = cercle restreint ──
        const numeroExp = global.jidToNumber ? global.jidToNumber(m.sender) : null
        const estMod = (global.db?.mods || []).some(mod =>
            global.jidToNumber(mod) && numeroExp && global.jidToNumber(mod) === numeroExp)

        if (!isOwner && !isAdmins && !estMod) {
            return reply('🔒 *.compile* exécute du code sur le serveur.\nRéservé au propriétaire, aux admins et aux mods.')
        }

        if (!args[0]) {
            return reply(
                '❌ Format : `.compile [langage] [code]`\n' +
                'Exemples :\n' +
                '`.compile python print("hello")`\n' +
                '`.compile js console.log(40+2)`\n' +
                '`.compile c #include <stdio.h>…`\n\n' +
                '💡 Vous pouvez aussi *répondre* à un message de code avec `.compile python`\n\n' +
                'Langages : python, js, c, cpp, java, bash'
            )
        }

        const lang = args[0].toLowerCase()
        const moteur = MOTEURS[ALIAS[lang]]
        if (!moteur) {
            return reply('❌ Langage inconnu. Disponibles : `python`, `js`, `c`, `cpp`, `java`, `bash`')
        }

        // Code : arguments restants, sinon le message auquel on répond
        let code = text.slice(args[0].length).trim()
        if (!code && m.quoted?.body) code = m.quoted.body.trim()
        if (!code) return reply('❌ Veuillez fournir le code à exécuter.')

        // ── Filtre de sécurité ──
        for (const [regex, raison] of INTERDITS) {
            if (regex.test(code)) {
                return reply(`⛔ Code refusé : *${raison}* non autorisé depuis le bot.`)
            }
        }

        // ── Binaire disponible ? ──
        const chemin = (process.env.PATH || '').split(path.delimiter).map(d => path.join(d, moteur.binaire))
            .find(p => { try { return fs.existsSync(p) } catch (e) { return false } })
        if (!chemin) return reply(`❌ *${moteur.nom}* n'est pas installé sur la machine.`)

        await reply(`⚙️ Exécution *${moteur.nom}* en cours...`)

        // ── Exécution cloisonnée ──
        const dossier = path.join(os.tmpdir(), `ely-compile-${Date.now()}-${Math.floor(Math.random() * 9999)}`)
        try {
            fs.mkdirSync(dossier, { recursive: true })

            const source = path.join(dossier, moteur.fichier)
            fs.writeFileSync(source, code)

            let executable = chemin
            let argsExec = moteur.lancer()

            // Étape compilation (C, C++, Java)
            if (moteur.compilateur) {
                try {
                    await execFilePromise(chemin, moteur.compilateur(), {
                        cwd: dossier, timeout: 25000, maxBuffer: 1024 * 1024 * 4
                    })
                } catch (e) {
                    const err = (e.stderr || e.message || '').toString()
                    return sock.sendMessage(m.key.remoteJid, {
                        text: `❌ *Erreur de compilation* — ${moteur.nom}\n\n\`\`\`\n${TRONQUE(err, 2500)}\n\`\`\``
                    }, { quoted: m })
                }
                if (moteur.executable) {
                    // Java : lancer la JVM sur la classe compilée
                    const javaChemin = (process.env.PATH || '').split(path.delimiter).map(d => path.join(d, moteur.executable)).find(p => { try { return fs.existsSync(p) } catch (e2) { return false } })
                    if (!javaChemin) return reply('❌ `java` n\'est pas installé sur la machine.')
                    executable = javaChemin
                } else {
                    // C/C++ : exécuter le binaire produit
                    executable = path.join(dossier, 'prog')
                    fs.chmodSync(executable, 0o755)
                }
            }

            let stdout = '', stderr = ''
            try {
                const r = await execFilePromise(executable, argsExec, {
                    cwd: dossier,
                    timeout: 12000,
                    maxBuffer: 1024 * 1024 * 2,
                    env: { PATH: process.env.PATH, HOME: dossier, TEMP: dossier, TMPDIR: dossier }
                })
                stdout = r.stdout || ''
            } catch (e) {
                stdout = e.stdout || ''
                stderr = (e.stderr || e.message || '').toString()
                if (e.killed) stderr = '⏱️ Temps d\'exécution dépassé (12 s max).'
            }

            const entete = `⚙️ *${moteur.nom}* — code exécuté`
            let corps = ''
            if (stdout.trim()) corps += `\n📤 *Sortie :*\n\`\`\`\n${TRONQUE(stdout, 3000)}\n\`\`\``
            if (stderr.trim()) corps += `\n⚠️ *Erreurs :*\n\`\`\`\n${TRONQUE(stderr, 1500)}\n\`\`\``
            if (!corps) corps = '\n_(aucune sortie)_'

            await sock.sendMessage(m.key.remoteJid, { text: entete + corps }, { quoted: m })
        } catch (e) {
            console.error('[COMPILE]', e.message)
            await reply(`❌ Échec de l'exécution : ${e.message}`)
        } finally {
            try { fs.rmSync(dossier, { recursive: true, force: true }) } catch (e) { /* ignore */ }
        }
    }
}
