module.exports = {
    name: 'iaonlygroup',
    category: 'owner',
    desc: 'Dans ce groupe, seul l\'IA est utilisable. Autres commandes bloquées.',
    commands: ['iaonlygroup', 'aigrouponly', 'onlyai'],
    run: async (sock, m, args, { reply, isOwner }) => {
        if (!isOwner) return reply('❌ Seul le propriétaire.')
        const from = m.key.remoteJid
        if (!from.endsWith('@g.us')) return reply('Utilisable uniquement dans un groupe.')

        if (!args[0]) {
            global.db.iaOnlyGroups = global.db.iaOnlyGroups || {}
            const etat = global.db.iaOnlyGroups[from] ? 'ACTIVÉ (seul IA)' : 'DÉSACTIVÉ'
            return reply(`État: ${etat}\n\nUsage: .iaonlygroup on/off`)
        }

        global.db.iaOnlyGroups = global.db.iaOnlyGroups || {}
        if (args[0] === 'on') {
            global.db.iaOnlyGroups[from] = true
            // silencieux
        } else if (args[0] === 'off') {
            delete global.db.iaOnlyGroups[from]
            // silencieux
        }
    }
}
