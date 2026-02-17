module.exports = {
    name: 'list',
    category: 'tools',
    desc: 'Affiche la liste détaillée de toutes les commandes.',
    run: async (sock, m, args, { reply, commands }) => {
        const categories = {
            tools: '🛠 OUTILS',
            ai: '🧠 IA',
            admin: '👑 ADMIN',
            games: '🎮 JEUX',
            media: '🎞 MÉDIA',
            settings: '⚙ RÉGLAGES'
        }

        const organized = {}
        const processed = new Set()

        commands.forEach((cmdModule, cmdName) => {
            if (processed.has(cmdModule)) return
            processed.add(cmdModule)

            const cat = cmdModule.category || 'tools'
            if (!organized[cat]) organized[cat] = []
            organized[cat].push({
                name: cmdModule.name,
                desc: cmdModule.desc || 'Pas de description.'
            })
        })

        let listText = `📜 *CATALOGUE ELY-BOT*\n\n`

        for (const [cat, title] of Object.entries(categories)) {
            if (organized[cat]) {
                listText += `*--- [ ${title} ] ---*\n`
                organized[cat].sort((a, b) => a.name.localeCompare(b.name)).forEach(cmd => {
                    listText += `🔹 *.${cmd.name}* : _${cmd.desc}_\n`
                })
                listText += `\n`
            }
        }

        reply(listText.trim())
    }
}
