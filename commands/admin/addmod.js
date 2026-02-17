module.exports = {
    name: 'addmod',
    category: 'admin',
    desc: 'Ajoute un modérateur au bot.',
    run: async (sock, m, args, { reply, isOwner }) => {
        if (!isOwner) return reply('❌ Seul le propriétaire peut ajouter des modérateurs.')

        const user = m.mentionedJid?.[0] || (m.quoted ? m.quoted.sender : null) || (args[0] ? args[0].replace(/[^0-9]/g, '') + '@s.whatsapp.net' : null)
        if (!user) return reply('❌ Mentionnez l\'utilisateur ou répondez à son message.')

        if (global.db.mods.includes(user)) return reply('❌ Cet utilisateur est déjà modérateur.')

        global.db.mods.push(user)
        reply(`✅ @${user.split('@')[0]} est maintenant modérateur du bot.`, { mentions: [user] })
    }
}
