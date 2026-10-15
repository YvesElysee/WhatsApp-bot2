module.exports = {
    name: 'oublier',
    category: 'ai',
    desc: 'Efface la mémoire de conversation de l\'IA dans ce chat.',
    commands: ['oublier', 'forget', 'resetia', 'iareset'],
    run: async (sock, m, args, { reply }) => {
        const from = m.key.remoteJid
        const nb = (global.getHistorique(from) || []).length

        if (nb === 0) {
            return reply('🧠 L\'IA n\'a aucun souvenir de ce chat pour le moment.')
        }

        global.effacerHistorique(from)
        reply(`🧠 *Mémoire effacée.* (${nb} échange(s) oublié(s))\nL'IA repart de zéro dans ce chat.`)
    }
}
