const { translate } = require('google-translate-api-x')

module.exports = {
    name: 'translate',
    category: 'ai',
    desc: 'Traduit un texte dans une langue spécifiée.',
    run: async (sock, m, args, { reply, text }) => {
        if (!text) return reply('Usage: .translate [lang] [text]. Exemple: .translate fr Hello')
        const lang = args[0]
        const data = args.slice(1).join(' ')
        if (!data) return reply('❌ Texte manquant.')

        try {
            const res = await translate(data, { to: lang })
            reply(`*Traduction (${lang}):*\n${res.text}`)
        } catch (e) {
            reply('❌ Erreur traduction.')
        }
    }
}
