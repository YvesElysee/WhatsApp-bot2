module.exports = {
    name: 'info',
    category: 'tools',
    desc: 'Affiche des informations sur l\'utilisateur mentionné.',
    run: async (sock, m, args, { reply, text }) => {
        const googleIt = require('google-it')
        const user = m.mentionedJid?.[0] || (m.quoted ? m.quoted.sender : null) || (args[0] ? args[0].replace(/[^0-9]/g, '') + '@s.whatsapp.net' : null)

        if (!user && !text) return reply('❌ Mentionnez un utilisateur, donnez son numéro ou tapez un nom à rechercher sur Google.')

        const query = text || user.split('@')[0]
        reply(`🔍 Recherche Google pour : *${query}*...`)

        try {
            const results = await googleIt({ 'query': query, 'limit': 5, 'disable-console': true })

            if (!results || results.length === 0) return reply('❌ Aucun résultat trouvé sur Google.')

            let response = `🔎 *RÉSULTATS RECHERCHE GOOGLE* 🔎\n\n`
            results.forEach((res, i) => {
                response += `${i + 1}. *${res.title}*\n🔗 ${res.link}\n📝 _${res.snippet}_\n\n`
            })

            reply(response.trim())
        } catch (e) {
            console.error('[GOOGLE-IT ERROR]', e)
            reply('❌ Erreur lors de la recherche Google. Le service est peut-être temporairement indisponible.')
        }
    }
}
