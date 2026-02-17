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
                contents: [{ role: 'user', parts: [{ text }] }]
            })

            // Extract text correctly from @google/genai response
            const responseText = result.candidates?.[0]?.content?.parts?.[0]?.text || result.text || 'Désolé, je n\'ai pas pu générer de réponse.'
            reply(`✨ *Ely AI*:\n\n${responseText}`)
        } catch (e) {
            console.error(e)
            // Fallback attempt with gemini-pro if flash fails
            try {
                const result = await client.models.generateContent({
                    model: 'gemini-pro',
                    contents: [{ role: 'user', parts: [{ text }] }]
                })
                const responseText = result.candidates?.[0]?.content?.parts?.[0]?.text || result.text || 'Désolé, je n\'ai pas pu générer de réponse.'
                reply(`✨ *Ely AI (Fallback)*:\n\n${responseText}`)
            } catch (err2) {
                console.error('Fallback failed:', err2)
                reply('❌ Erreur de l\'IA. Vérifiez vos clés API dans le fichier .env et assurez-vous qu\'elles sont valides pour Gemini 1.5 Flash.')
            }
        }
    }
}
