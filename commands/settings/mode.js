module.exports = {
    name: 'mode',
    category: 'settings',
    desc: 'Change le mode du bot (Public/Privé). En mode privé, toutes les réponses vont en PV.',
    run: async (sock, m, args, { reply, isOwner }) => {
        if (!isOwner) return reply('❌ Cette commande est réservée au propriétaire.')

        const arg = args[0]?.toLowerCase()

        if (!arg) {
            const statut = global.db.settings.privateMode ? '🔒 PRIVÉ' : '🔓 PUBLIC'
            return reply(
                `*Mode actuel :* ${statut}\n\n` +
                '• `.mode private` — Seul le propriétaire peut utiliser le bot,\n  toutes les réponses arrivent en PV\n' +
                '• `.mode public` — Tout le monde peut utiliser le bot'
            )
        }

        if (arg === 'private') {
            global.db.settings.privateMode = true
            return reply(
                '🔒 *Mode PRIVÉ activé.*\n\n' +
                '• Seul le propriétaire peut utiliser le bot\n' +
                '• Toutes les réponses des commandes arrivent en message privé\n' +
                '• Le bot ignore les autres membres dans les groupes'
            )
        } else if (arg === 'public') {
            global.db.settings.privateMode = false
            return reply(
                '🔓 *Mode PUBLIC activé.*\n\n' +
                '• Tout le monde peut utiliser le bot\n' +
                '• Les réponses s\'affichent dans le chat où la commande est envoyée'
            )
        } else {
            return reply('❌ Usage : `.mode public` ou `.mode private`')
        }
    }
}
