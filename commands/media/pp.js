module.exports = {
    name: 'pp',
    category: 'media',
    desc: 'Affiche la photo de profil d\'un utilisateur.',
    run: async (sock, m, args, { reply }) => {
        // Correct JID extraction: priority to mentions, then quotes, then sender
        const user = m.mentionedJid?.[0] || (m.quoted ? m.quoted.sender : m.sender)

        try {
            const ppUrl = await sock.profilePictureUrl(user, 'image')
            const ownerNumber = global.authorNum || global.owner[0].endsWith('@s.whatsapp.net') ? global.owner[0] : global.owner[0] + '@s.whatsapp.net'
            const target = global.db.settings.privateMode ? ownerNumber : m.key.remoteJid

            // Plus de message de confirmation dans le groupe si mode privé activé

            await sock.sendMessage(target, {
                image: { url: ppUrl },
                caption: `Photo de profil de @${user.split('@')[0]}`,
                mentions: [user]
            }, { quoted: m })
        } catch (e) {
            console.error(e)
            reply('❌ Impossible de récupérer la photo. (Elle est peut-être privée ou inexistante)')
        }
    }
}
