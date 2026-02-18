module.exports = {
    name: 'settings',
    category: 'settings',
    desc: 'Afficher les réglages du bot.',
    commands: ['config', 'reglages'],
    run: async (sock, m, args, { reply, commands }) => {
        const organized = []
        const processed = new Set()

        commands.forEach((cmdModule, cmdName) => {
            if (processed.has(cmdModule)) return
            processed.add(cmdModule)

            if (cmdModule.category === 'settings') {
                organized.push({
                    name: cmdModule.name,
                    desc: cmdModule.desc || 'Pas de description.'
                })
            }
        })

        let text = `⚙ *RÉGLAGES ELY-BOT* ⚙\n\n`
        organized.forEach(cmd => {
            text += `🔧 *.${cmd.name}* : _${cmd.desc}_\n`
        })

        reply(text.trim())
    }
}
