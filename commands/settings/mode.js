module.exports = {
    name: 'mode',
    category: 'settings',
    desc: 'Change le mode du bot (Public / Privé / PV).',
    commands: ['mode', 'mod'],
    run: async (sock, m, args, { reply, isOwner }) => {
        if (!isOwner) return reply('❌ Cette commande est réservée au propriétaire.')

        const arg = args[0]?.toLowerCase()

        if (!arg) {
            const statut = global.db.settings.privateMode ? '🔒 PRIVÉ' : '🔓 PUBLIC'
            const destination = global.db.settings.replyInPv ? 'en message privé' : 'dans le chat'
            return reply(
                `*Mode actuel :* ${statut}\n*Réponses :* ${destination}\n\n` +
                '• `.mode private` — Seul le propriétaire utilise le bot,\n  les réponses restent affichées dans le groupe\n' +
                '• `.mode pv` — Seul le propriétaire utilise le bot,\n  les réponses partent en message privé\n' +
                '• `.mode public` — Tout le monde peut utiliser le bot'
            )
        }

        if (arg === 'private' || arg === 'prive' || arg === 'privé') {
            global.db.settings.privateMode = true
            global.db.settings.replyInPv = false
            return reply(
                '🔒 *Mode PRIVÉ activé.*\n\n' +
                '• Seul le propriétaire peut utiliser les commandes\n' +
                '• Les autres membres sont ignorés par le bot\n' +
                '• Les réponses restent visibles dans le groupe\n\n' +
                '_`.mode pv` pour recevoir les réponses en privé._'
            )
        } else if (arg === 'pv' || arg === 'privepv' || arg === 'mp') {
            global.db.settings.privateMode = true
            global.db.settings.replyInPv = true
            return reply(
                '🤫 *Mode PRIVÉ + réponses en PV activé.*\n\n' +
                '• Seul le propriétaire utilise le bot\n' +
                '• Les réponses partent en message privé'
            )
        } else if (arg === 'public' || arg === 'publique') {
            global.db.settings.privateMode = false
            global.db.settings.replyInPv = false
            return reply(
                '🔓 *Mode PUBLIC activé.*\n\n' +
                '• Tout le monde peut utiliser le bot\n' +
                '• Les réponses s\'affichent dans le chat d\'origine'
            )
        } else {
            return reply('❌ Usage : `.mode private`, `.mode pv` ou `.mode public`')
        }
    }
}
