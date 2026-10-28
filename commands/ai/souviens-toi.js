module.exports = {
    name: 'souviens-toi',
    category: 'ai',
    desc: 'Se souvenir de quelque chose dans ce chat.',
    commands: ['souviens-toi', 'remember'],
    run: async (sock, m, args, { reply, isOwner, text }) => {
        if (!isOwner) return reply('❌ Cette commande est réservée au propriétaire du bot.')
        const from = m.key.remoteJid
        const contenu = text.replace(/^\.souviens-toi\s+/i, '').replace(/^\.remember\s+/i, '').trim()
        if (!contenu) return reply('🤖 Utilisation : `.souviens-toi <information importante>`')
        if (!global.db.resumes) global.db.resumes = {}
        const ancien = global.db.resumes[from] || ''
        global.db.resumes[from] = ((ancien ? ancien + ' | ' : '') + contenu).slice(-800)
        reply('✅ Je m\'en souviendrai.')
    }
}
