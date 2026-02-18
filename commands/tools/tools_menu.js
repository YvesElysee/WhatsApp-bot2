module.exports = {
    name: 'tools',
    category: 'tools',
    desc: 'Affiche les outils et utilitaires.',
    commands: ['outils'],
    run: async (sock, m, args, { reply, commands }) => {
        const organized = []
        const processed = new Set()

        commands.forEach((cmdModule, cmdName) => {
            if (processed.has(cmdModule)) return
            processed.add(cmdModule)

            if (cmdModule.category === 'tools') {
                organized.push({
                    name: cmdModule.name,
                    desc: cmdModule.desc || 'Pas de description.'
                })
            }
        })

        let text = `🛠 *BOITE À OUTILS ELY-BOT* 🛠\n\n`
        organized.sort((a, b) => a.name.localeCompare(b.name)).forEach(cmd => {
            text += `▸ *.${cmd.name}* : _${cmd.desc}_\n`
        })

        reply(text.trim())
    }
}
