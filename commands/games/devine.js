module.exports = {
    name: 'devine',
    run: async (sock, m, args, { reply, getGeminiModel }) => {
        const model = getGeminiModel()
        if (!model) return reply('⚠️ Erreur SDK.')

        try {
            reply('🧩 Génération d\'une devinette...')
            const result = await model.generateContent("Génère une devinette courte en français. Donne la réponse à la fin cachée par ||.")
            reply(`🧩 *DEVINETTE*:\n\n${result.response.text()}`)
        } catch (e) {
            reply('❌ Erreur devinette SDK.')
        }
    }
}
