module.exports = {
    name: 'ai',
    category: 'ai',
    desc: 'Discute avec l\'IA (Meta Llama-3 / Gemini / WisdomGate).',
    commands: ['ai', 'ely', 'gpt', 'llama', 'meta'],
    run: async (sock, m, args, { reply, text, isOwner, getAIResponse }) => {
        if (global.db.settings.aiOnly && !isOwner) return reply('❌ L\'accès à l\'IA est actuellement réservé au propriétaire du bot.')
        if (!text) return reply(
            '🤖 *Posez-moi une question !*\n\n' +
            '_Exemples :_\n' +
            '• `.ai Explique-moi le machine learning`\n' +
            '• `.meta Quelle est la capitale du Cameroun ?`\n' +
            '• `.llama Aide-moi à écrire un email professionnel`'
        )

        const providerMap = {
            ai: 'auto', ely: 'auto', gpt: 'auto',
            llama: 'meta', meta: 'meta'
        }
        const command = m.text.slice(1).trim().split(/ +/).shift().toLowerCase()
        const provider = providerMap[command] || 'auto'

        const loadingEmojis = { auto: '🤖', meta: '🦙', gemini: '✨', wisdom: '🧠' }
        const emoji = loadingEmojis[provider] || '🤖'

        await reply(`${emoji} *Ely AI réfléchit...*`)

        try {
            const result = await getAIResponse(text, provider)

            if (result.out) {
                const providerNames = {
                    'meta-llama': '🦙 Meta Llama-3',
                    gemini: '✨ Google Gemini',
                    wisdomgate: '🧠 WisdomGate'
                }
                const providerLabel = providerNames[result.provider] || '🤖 Ely AI'
                await reply(`${providerLabel} :\n\n${result.out}`)
            } else {
                const ownerJid = global.owner[0].endsWith('@s.whatsapp.net')
                    ? global.owner[0]
                    : global.owner[0] + '@s.whatsapp.net'

                await sock.sendMessage(ownerJid, {
                    text: `[LOG-AI-ERROR]\nChat: ${m.key.remoteJid}\nUser: ${m.pushName || 'Inconnu'}\nQuestion: ${text}\nErreur: ${result.error}`
                })

                reply('⚠️ *Service IA momentanément indisponible.*\n\nTous nos serveurs IA sont saturés. Réessayez dans quelques instants.\n\n_Le propriétaire a été averti._')
            }
        } catch (e) {
            console.error(`[AI-CMD-ERROR]:`, e.message)
            const ownerJid = global.owner[0].endsWith('@s.whatsapp.net')
                ? global.owner[0]
                : global.owner[0] + '@s.whatsapp.net'
            await sock.sendMessage(ownerJid, { text: `[CRITICAL-AI-ERROR]\n${e.message}` })
            reply('❌ Une erreur critique est survenue. Le propriétaire a été averti.')
        }
    }
}
