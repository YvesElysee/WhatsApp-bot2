module.exports = {
    name: 'delmod',
    category: 'admin',
    desc: 'Retire un modérateur du bot.',
    run: async (sock, m, args, { reply, isOwner }) => {
        if (!isOwner) return reply('❌ Seul le propriétaire peut retirer des modérateurs.')

        const user = m.mentionedJid?.[0] || (m.quoted ? m.quoted.sender : null) || (args[0] ? args[0].replace(/[^0-9]/g, '') + '@s.whatsapp.net' : null)
        if (!user) return reply('❌ Mentionnez l\'utilisateur ou répondez à son message.')

        if (!global.db.mods.includes(user)) return reply('❌ Cet utilisateur n\'est pas modérateur.')

        global.db.mods = global.db.mods.filter(id => id !== user)
        reply(`✅ @${user.split('@')[0]} n'est plus modérateur du bot.`, { mentions: [user] })
    }
}
