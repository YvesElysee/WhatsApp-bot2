module.exports = {
    name: 'coinflip',
    category: 'games',
    desc: 'Pile ou Face — lance la pièce.',
    commands: ['coinflip', 'pileface', 'pf', 'coin'],
    run: async (sock, m, args, { reply }) => {
        const from = m.key.remoteJid

        await sock.sendMessage(from, { text: '🪙 *Lancement de la pièce…*' }, { quoted: m })

        setTimeout(async () => {
            const resultat = Math.random() > 0.5 ? 'Pile 🪙' : 'Face 🪙'
            await sock.sendMessage(from, { text: `🎉 *Résultat :* ${resultat}` }, { quoted: m })
        }, 1500)
    }
}
