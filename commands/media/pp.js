module.exports = {
    name: 'pp',
    run: async (sock, m, args, { reply }) => {
        // Correct JID extraction: priority to mentions, then quotes, then sender
        const user = m.mentionedJid[0] || (m.quoted ? m.quoted.sender : m.sender)

        try {
            const ppUrl = await sock.profilePictureUrl(user, 'image')
            await sock.sendMessage(m.key.remoteJid, {
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
