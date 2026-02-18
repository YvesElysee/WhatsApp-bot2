module.exports = {
    name: 'dl',
    category: 'media',
    desc: 'Affiche les commandes de téléchargement et média.',
    commands: ['dl', 'media', 'media_menu', 'pub'],
    run: async (sock, m, args, { reply, commands }) => {
        const organized = []
        const processed = new Set()

        commands.forEach((cmdModule, cmdName) => {
            if (processed.has(cmdModule)) return
            processed.add(cmdModule)

            if (cmdModule.category === 'media') {
                organized.push({
                    name: cmdModule.name,
                    desc: cmdModule.desc || 'Pas de description.'
                })
            }
        })

        let text = `🎞 *MÉDIAS & TÉLÉCHARGEMENTS* 🎞\n\n`
        organized.sort((a, b) => a.name.localeCompare(b.name)).forEach(cmd => {
            text += `📥 *.${cmd.name}* : _${cmd.desc}_\n`
        })

        text += `\n👉 *Téléchargez vos sons et vidéos préférés !*`
        reply(text.trim())
    }
}
