module.exports = {
    name: 'ai',
    commands: ['ai', 'ely', 'gpt', 'gemini'],
    run: async (sock, m, args, { reply, text, getGeminiModel }) => {
        if (!text) return reply('🤖 Posez-moi une question !')

        const model = getGeminiModel()
        if (!model) return reply('⚠️ Clés Gemini manquantes sur Render (GEMINI_KEY_1/2/3).')

        try {
            const result = await model.generateContent(text)
            const response = await result.response
            reply(`✨ *Ely AI (Gemini SDK)*:\n\n${response.text()}`)
        } catch (e) {
            console.error(e)
            reply('❌ Erreur de l\'IA SDK. Vérifiez vos clés ou le quota.')
        }
    }
}
