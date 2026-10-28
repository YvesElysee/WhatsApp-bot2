module.exports = {
    name: 'difficultejoueur',
    category: 'games',
    desc: 'Définit la difficulté personnelle pour les jeux.',
    commands: ['difficultejoueur', 'difperso', 'myniveau'],
    run: async (sock, m, args, { reply, isOwner }) => {
        if (!isOwner) return reply('❌ Cette commande est réservée au propriétaire du bot.')
        if (!args[0]) return reply('🎮 Utilisation : `.difficultejoueur facile|moyen|difficile`')
        const niv = args[0].toLowerCase()
        if (!['facile', 'moyen', 'difficile'].includes(niv)) return reply('🎮 Valeurs autorisées : `facile`, `moyen`, `difficile`')
        const cle = (global.jidToNumber ? global.jidToNumber(m.sender) : m.sender) || m.sender
        if (!global.db.difficulteJoueur) global.db.difficulteJoueur = {}
        global.db.difficulteJoueur[cle] = niv
        reply(`✅ Ta difficulté personnelle est définie sur *${niv}*.`)
    }
}
