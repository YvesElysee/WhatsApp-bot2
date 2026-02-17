module.exports = {
    name: 'ai',
    commands: ['ai', 'ely', 'gpt', 'gemini'],
    run: async (sock, m, args, { reply, text, getGeminiClient }) => {
        if (!text) return reply('🤖 Posez-moi une question !')

        const client = getGeminiClient()
        if (!client) return reply('⚠️ Clés Gemini manquantes sur Render (GEMINI_KEY_1/2/3).')

        try {
            const result = await client.models.generateContent({
                model: 'gemini-1.5-flash',
                contents: text
            })
            reply(`✨ *Ely AI (SDK Officiel)*:\n\n${result.text}`)
        } catch (e) {
            console.error(e)
            reply('❌ Erreur de l\'IA (SDK @google/genai). Vérifiez vos clés sur Render.')
        }
    }
}
