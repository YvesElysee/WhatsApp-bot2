module.exports = {
    name: 'blockgroup',
    category: 'owner',
    desc: 'Bloque/Débloque le bot dans un groupe. Si bloqué, il répond en privé.',
    commands: ['blockgroup', 'bg', 'grouplock', 'lockgroup'],
    run: async (sock, m, args, { reply, isOwner }) => {
        if (!isOwner) return reply('❌ Seul le propriétaire.')
        const from = m.key.remoteJid
        if (!from.endsWith('@g.us')) return reply('Utilisable uniquement dans un groupe.')

        if (!args[0]) {
            global.db.blockedGroups = global.db.blockedGroups || {}
            const etat = global.db.blockedGroups[from] ? 'BLOQUÉ (réponses en PV)' : 'ACTIF'
            return reply(`État: ${etat}\n\nUsage: .blockgroup on/off`)
        }

        global.db.blockedGroups = global.db.blockedGroups || {}
        if (args[0] === 'on') {
            global.db.blockedGroups[from] = true
            // silencieux
        } else if (args[0] === 'off') {
            delete global.db.blockedGroups[from]
            // silencieux
        }
    }
}
