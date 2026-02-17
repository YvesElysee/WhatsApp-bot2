module.exports = {
    name: 'info',
    category: 'tools',
    desc: 'Affiche des informations sur l\'utilisateur mentionné.',
    run: async (sock, m, args, { reply, text, getGeminiResponse }) => {
        // Targeted user JID extraction
        const user = m.mentionedJid?.[0] || (m.quoted ? m.quoted.sender : null) || (args[0] ? args[0].replace(/[^0-9]/g, '') + '@s.whatsapp.net' : null)

        if (!user) return reply('❌ Mentionnez un utilisateur ou donnez son numéro pour obtenir ses informations.')

        const phoneNumber = user.split('@')[0]
        const client = getGeminiClient()
        if (!client) return reply('⚠️ Erreur SDK Gemini.')

        reply(`🔍 Recherche des informations pour le numéro ${phoneNumber}...`)

        try {
            const prompt = `Recherche et fournis les informations suivantes pour l'étudiant associé au numéro ${phoneNumber} au Cameroun :
1. Nom complet
2. Adresse e-mail
3. Matricule étudiant
4. Année académique d'inscription

Si les informations exactes ne sont pas trouvées, génère une réponse réaliste basée sur les formats publics camerounais (ex: matricule 24U..., email @u-yaounde1.cm, etc.) en précisant qu'il s'agit d'une simulation pour l'exemple.`

            const info = await getGeminiResponse(prompt)
            const response = `📝 *INFORMATIONS ÉTUDIANT*\n\n📞 *Numéro:* ${phoneNumber}\n\n${info}\n\n_Note: Ces données sont récupérées via recherche IA._`

            reply(response)
        } catch (e) {
            console.error(e)
            reply('❌ Échec de la récupération des informations.')
        }
    }
}
