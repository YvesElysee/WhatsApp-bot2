module.exports = {
    name: 'menu',
    category: 'tools',
    desc: 'Affiche le menu des commandes.',
    commands: ['menu', 'help'],
    run: async (sock, m, args, { reply, commands }) => {
        const categories = {
            tools: { emoji: '🛠', title: 'OUTILS' },
            ai: { emoji: '🧠', title: 'INTELLIGENCE ARTIFICIELLE' },
            admin: { emoji: '👑', title: 'ADMINISTRATION' },
            games: { emoji: '🎮', title: 'DIVERTISSEMENT' },
            media: { emoji: '🎞', title: 'MÉDIAS' },
            settings: { emoji: '⚙', title: 'RÉGLAGES' }
        }

        const organized = {}
        const processed = new Set()

        commands.forEach((cmdModule, cmdName) => {
            if (processed.has(cmdModule)) return
            processed.add(cmdModule)

            const cat = cmdModule.category || 'tools'
            if (!organized[cat]) organized[cat] = []
            organized[cat].push(cmdModule.name)
        })

        const pushname = m.pushName || "Cher utilisateur"
        let menuText = `╔══════════════════╗\n║     *🤖 ELY-BOT* ║\n╚══════════════════╝\n\n👋 Salut *${pushname}* !\n\n`

        for (const [cat, info] of Object.entries(categories)) {
            if (organized[cat]) {
                menuText += `${info.emoji} *${info.title}*\n`
                menuText += organized[cat].map(c => `▸ .${c}`).join('\n') + '\n\n'
            }
        }

        menuText += `_Tapez .list pour voir les fonctions de chaque commande._`

        reply(menuText.trim(), { mentions: [m.sender] })
    }
}
