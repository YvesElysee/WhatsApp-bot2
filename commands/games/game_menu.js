module.exports = {
    name: 'game',
    category: 'games',
    desc: 'Affiche les jeux disponibles.',
    commands: ['game', 'games', 'divertissement'],
    run: async (sock, m, args, { reply, commands }) => {
        const organized = []
        const processed = new Set()

        commands.forEach((cmdModule, cmdName) => {
            if (processed.has(cmdModule)) return
            processed.add(cmdModule)

            if (cmdModule.category === 'games') {
                organized.push({
                    name: cmdModule.name,
                    desc: cmdModule.desc || 'Pas de description.'
                })
            }
        })

        let text = `🎮 *ZONE DE JEUX ELY-BOT* 🎮\n\n`
        organized.sort((a, b) => a.name.localeCompare(b.name)).forEach(cmd => {
            text += `▸ *.${cmd.name}* : _${cmd.desc}_\n`
        })

        text += `\n👉 *Amusez-vous bien !*`
        reply(text.trim())
    }
}
