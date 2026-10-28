module.exports = {
    name: 'chatbot',
    category: 'settings',
    desc: 'Active/Désactive la réponse automatique de l\'IA quand vous êtes tagué.',
    commands: ['chatbot', 'autoai'],
    run: async (sock, m, args, { reply, isOwner }) => {
        if (!isOwner) return reply('❌ Cette commande est réservée au propriétaire.')
        if (!args[0]) return reply('Usage: .chatbot [on/off]')

        if (args[0] === 'on') {
            global.db.settings.chatbot = true
            // silencieux
        } else if (args[0] === 'off') {
            global.db.settings.chatbot = false
            // silencieux
        } else {
            reply('Usage: .chatbot [on/off]')
        }
    }
}
