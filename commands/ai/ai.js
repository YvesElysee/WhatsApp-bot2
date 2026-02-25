module.exports = {
    name: 'ai',
    category: 'ai',
    desc: 'Discute avec l\'IA (Wisdom Gate / Gemini).',
    commands: ['ai', 'ely', 'gpt'],
    run: async (sock, m, args, { reply, text, isOwner, getAIResponse }) => {
        if (global.db.settings.aiOnly && !isOwner) return reply('❌ L\'accès à l\'IA est actuellement réservé au propriétaire du bot.')
        if (!text) return reply('🤖 Posez-moi une question !')

        try {
            const result = await getAIResponse(text)
            if (result.out) {
                reply(`✨ *Ely AI*:\n\n${result.out}`)
            } else {
                const ownerJid = global.owner[0].endsWith('@s.whatsapp.net') ? global.owner[0] : global.owner[0] + '@s.whatsapp.net'
                let errorMsg = '❌ Erreur inconnue'

                if (result.error === 'ALL_AI_FAILED') errorMsg = '⚠️ Tous les services IA sont actuellement saturés. Veuillez réessayer plus tard.'
                else errorMsg = `⚠️ Erreur IA : ${result.error}`

                // Send error to owner inbox
                await sock.sendMessage(ownerJid, { text: `[LOG-AI-ERROR]\nChat: ${m.key.remoteJid}\nExploitant: ${m.pushName || 'Inconnu'}\nQuestion: ${text}\nErreur: ${errorMsg}` })

                // Friendly message in the public chat
                reply('⚠️ Désolé, le service IA rencontre des difficultés techniques. Le propriétaire a été averti.')
            }
        } catch (e) {
            console.error(`AI Command Error:`, e.message)
            const ownerJid = global.owner[0].endsWith('@s.whatsapp.net') ? global.owner[0] : global.owner[0] + '@s.whatsapp.net'
            await sock.sendMessage(ownerJid, { text: `[CRITICAL-AI-ERROR]\n${e.message}` })
            reply('❌ Une erreur critique est survenue. Le propriétaire a été averti.')
        }
    }
}
