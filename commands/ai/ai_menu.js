module.exports = {
    name: 'ai',
    category: 'ai',
    desc: 'Affiche les commandes d\'intelligence artificielle.',
    commands: ['ai', 'ia', 'ai_menu'],
    run: async (sock, m, args, { reply, commands }) => {
        const organized = []
        const processed = new Set()

        commands.forEach((cmdModule, cmdName) => {
            if (processed.has(cmdModule)) return
            processed.add(cmdModule)

            if (cmdModule.category === 'ai') {
                organized.push({
                    name: cmdModule.name,
                    desc: cmdModule.desc || 'Pas de description.'
                })
            }
        })

        let text = `🧠 *ELY-AI INTELLIGENCE* 🧠\n\n`
        organized.forEach(cmd => {
            text += `✨ *.${cmd.name}* : _${cmd.desc}_\n`
        })

        text += `\n👉 *Posez vos questions au bot !*`
        reply(text.trim())
    }
}
