const axios = require('axios')

module.exports = {
    name: 'compile',
    category: 'tools',
    desc: 'Compile et exécute du code (C, Python, Java, etc.).',
    commands: ['compile', 'run', 'code'],
    run: async (sock, m, args, { reply, text }) => {
        if (!args[0]) return reply('❌ Format: `.compile [langage] [code]`\nExemple: `.compile python print("hello")`')

        const lang = args[0].toLowerCase()
        const code = text.replace(args[0], '').trim()

        if (!code) return reply('❌ Veuillez fournir le code à exécuter.')

        const languageMap = {
            'python': 'python3',
            'py': 'python3',
            'java': 'java',
            'c': 'c',
            'cpp': 'cpp',
            'javascript': 'javascript',
            'js': 'javascript',
            'node': 'javascript'
        }

        const runLang = languageMap[lang] || lang

        reply(`⚙️ Exécution du code *${runLang}* en cours...`)

        try {
            const response = await axios.post('https://emkc.org/api/v2/piston/execute', {
                language: runLang,
                version: "*",
                files: [{ content: code }]
            }, { timeout: 15000 })

            const { run } = response.data

            let output = `💻 *RÉSULTAT D'EXÉCUTION (${runLang})* 💻\n\n`

            if (run.stdout) {
                output += `✅ *SORTIE :*\n\`\`\`\n${run.stdout}\n\`\`\`\n`
            }

            if (run.stderr) {
                output += `⚠️ *ERREUR :*\n\`\`\`\n${run.stderr}\n\`\`\`\n`
            }

            if (!run.stdout && !run.stderr) {
                output += `ℹ️ *Code exécuté sans retour (vide).*`
            }

            reply(output.trim())

        } catch (e) {
            console.error('[COMPILE ERROR]', e)
            reply('❌ Erreur lors de l\'exécution du code. Vérifiez le langage ou réessayez.')
        }
    }
}
