const axios = require('axios')

module.exports = {
    name: 'ai',
    category: 'ai',
    desc: 'Discute avec l\'IA (Gemini 2.0 Flash).',
    commands: ['ai', 'ely', 'gpt', 'gemini'],
    run: async (sock, m, args, { reply, text, isOwner }) => {
        if (global.db.settings.aiOnly && !isOwner) return reply('❌ L\'accès à l\'IA est actuellement réservé au propriétaire du bot.')
        if (!text) return reply('🤖 Posez-moi une question !')

        // Rotation logic for 3 keys
        const keys = [
            process.env.GEMINI_KEY_1,
            process.env.GEMINI_KEY_2,
            process.env.GEMINI_KEY_3
        ].filter(k => k && k.length > 10)

        const key = keys.length > 0 ? keys[global.db.geminiIndex % keys.length] : process.env.GEMINI_API_KEY
        if (!key) return reply('⚠️ Clé Gemini manquante (.env : GEMINI_KEY_1/2/3).')

        global.db.geminiIndex++

        // Based on diagnostics, the keys support gemini-2.0-flash and gemini-flash-latest
        const tryModel = async (modelId) => {
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${key}`
            return await axios.post(url, {
                contents: [{ parts: [{ text: text }] }]
            }, { timeout: 30000 })
        }

        try {
            // Priority 1: gemini-2.0-flash (Newest stable)
            const response = await tryModel('gemini-2.0-flash')
            const responseText = response.data.candidates?.[0]?.content?.parts?.[0]?.text
            if (!responseText) throw new Error('No content')
            reply(`✨ *Ely AI (2.0)*:\n\n${responseText}`)
        } catch (e) {
            console.error(`Gemini 2.0 Error:`, e.response?.data || e.message)

            try {
                // Priority 2: gemini-flash-latest (Alias)
                const response = await tryModel('gemini-flash-latest')
                const responseText = response.data.candidates?.[0]?.content?.parts?.[0]?.text
                if (!responseText) throw new Error('No content')
                reply(`✨ *Ely AI (Flash)*:\n\n${responseText}`)
            } catch (err2) {
                console.error(`Gemini Latest Error:`, err2.response?.data || err2.message)

                try {
                    // Priority 3: gemini-pro-latest
                    const response = await tryModel('gemini-pro-latest')
                    const responseText = response.data.candidates?.[0]?.content?.parts?.[0]?.text
                    reply(`✨ *Ely AI (Pro)*:\n\n${responseText}`)
                } catch (err3) {
                    const errMsg = err3.response?.data?.error?.message || err3.message
                    reply(`❌ Erreur IA: ${errMsg}\n\nNote: Tes clés semblent supporter les modèles 2.0+. Assure-toi qu'elles sont bien configurées dans Google AI Studio.`)
                }
            }
        }
    }
}
