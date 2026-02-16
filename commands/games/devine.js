module.exports = {
    name: 'devine',
    run: async (sock, m, args, { reply, getGeminiClient }) => {
        const client = getGeminiClient()
        if (!client) return reply('⚠️ Erreur SDK.')

        try {
            reply('🧩 Génération d\'une devinette...')
            const result = await client.models.generateContent({
                model: 'gemini-1.5-flash',
                contents: "Génère une devinette courte en français. Donne la réponse à la fin cachée par ||."
            })
            reply(`🧩 *DEVINETTE*:\n\n${result.text}`)
        } catch (e) {
            console.error(e)
            reply('❌ Erreur devinette SDK.')
        }
    }
}
