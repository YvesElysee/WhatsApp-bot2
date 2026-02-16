module.exports = {
    name: 'pp',
    run: async (sock, m, args, { reply }) => {
        const user = m.mentionedJid[0] || (m.quoted ? m.quoted.sender : m.sender)
        try {
            const ppUrl = await sock.profilePictureUrl(user, 'image')
            sock.sendMessage(m.key.remoteJid, { image: { url: ppUrl }, caption: `Photo de @${user.split('@')[0]}`, mentions: [user] }, { quoted: m })
        } catch {
            reply('❌ Aucune photo de profil trouvée ou accès refusé.')
        }
    }
}
