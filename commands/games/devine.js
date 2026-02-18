module.exports = {
    name: 'devine',
    category: 'games',
    desc: 'Jeu de devinette de nombre.',
    run: async (sock, m, args, { reply, getDeepSeekResponse }) => {
        try {
            reply('🧩 Génération d\'une devinette...')
            const result = await getDeepSeekResponse("Génère une devinette courte en français. Donne la réponse à la fin cachée par ||.")
            if (!result) throw new Error('Réponse IA vide')
            reply(`🧩 *DEVINETTE*:\n\n${result}`)
        } catch (e) {
            console.error(e)
            reply('❌ Erreur de génération de devinette.')
        }
    }
}
