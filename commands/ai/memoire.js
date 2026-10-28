module.exports = {
    name: 'memoire',
    category: 'ai',
    desc: 'Gère la mémoire du bot sur les membres (notes personnelles).',
    commands: ['memoire', 'memory'],
    run: async (sock, m, args, { reply, isOwner, text }) => {
        if (!isOwner) return reply('❌ Cette commande est réservée au propriétaire du bot.')
        const from = m.key.remoteJid
        const cible = m.mentionedJid?.[0] || (m.quoted ? m.quoted.sender : null)
        if (!cible) return reply('🤖 Utilisation : `.memoire @membre <note>` ou `.memoire clear @membre`')

        if (!global.db.memoire) global.db.memoire = {}
        if (!global.db.memoire[from]) global.db.memoire[from] = {}
        const cle = (global.jidToNumber ? global.jidToNumber(cible) : cible) || cible

        if (args[0] === 'clear') {
            if (global.db.memoire[from][cle]) {
                delete global.db.memoire[from][cle]
                return reply('✅ Mémoire du membre effacée.')
            }
            return reply('❌ Aucune mémoire trouvée pour ce membre.')
        }

        const note = text.replace(/^\.memoire\s+/i, '').replace(new RegExp('@\\S+'), '').trim()
        if (!note) return reply('❌ Ajoute une note : `.memoire @membre aime le café`')
        
        if (!global.db.memoire[from][cle]) global.db.memoire[from][cle] = { nom: '', notes: [], derniers: [], vus: 0 }
        global.db.memoire[from][cle].notes.push(note)
        global.db.memoire[from][cle].nom = m.mentionedJid?.[0] ? note.split(' ')[0] : (global.db.memoire[from][cle].nom || '')
        reply(`✅ Note ajoutée pour @${cle.split('@')[0]} : ${note}`)
    }
}
