module.exports = {
    name: 'ai',
    category: 'ai',
    desc: 'Discute avec l\'IA (Meta Llama-3 / Gemini / WisdomGate).',
    // .meta et .llama ciblent spécifiquement Meta AI via OpenRouter
    commands: ['ai', 'ely', 'gpt', 'llama', 'meta'],
    run: async (sock, m, args, { reply, text, isOwner, getAIResponse }) => {
        // Vérification du mode réservé au propriétaire
        if (global.db.settings.aiOnly && !isOwner) {
            return reply('❌ L\'accès à l\'IA est actuellement réservé au propriétaire du bot.')
        }

        if (!text) return reply(
            '🤖 *Posez-moi une question !*\n\n' +
            '_Exemples :_\n' +
            '• `.ai Explique-moi le machine learning`\n' +
            '• `.meta Quelle est la capitale du Cameroun ?`\n' +
            '• `.llama Aide-moi à écrire un email professionnel`'
        )

        // Mapper chaque alias vers le bon fournisseur IA
        const correspondanceFournisseur = {
            ai: 'auto', ely: 'auto', gpt: 'auto',
            llama: 'meta', meta: 'meta'
        }
        const commande = m.text.slice(1).trim().split(/ +/).shift().toLowerCase()
        const fournisseur = correspondanceFournisseur[commande] || 'auto'

        // Emoji de chargement selon le fournisseur
        const emojisChargement = { auto: '🤖', meta: '🦙', gemini: '✨', wisdom: '🧠' }
        const emoji = emojisChargement[fournisseur] || '🤖'

        await reply(`${emoji} *Ely AI réfléchit...*`)

        try {
            // Appel au système multi-IA avec le fournisseur sélectionné
            const resultat = await getAIResponse(text, fournisseur)

            if (resultat.out) {
                // Étiquettes lisibles pour chaque fournisseur IA
                const nomsProviders = {
                    'meta-llama': '🦙 Meta Llama-3',
                    'gemini': '✨ Google Gemini',
                    'wisdomgate': '🧠 WisdomGate'
                }
                const etiquette = nomsProviders[resultat.provider] || '🤖 Ely AI'
                await reply(`${etiquette} :\n\n${resultat.out}`)
            } else {
                // En cas d'échec de tous les fournisseurs, notifier le propriétaire
                const jidProprietaire = global.owner[0].endsWith('@s.whatsapp.net')
                    ? global.owner[0] : global.owner[0] + '@s.whatsapp.net'

                await sock.sendMessage(jidProprietaire, {
                    text: `[LOG-ERREUR-IA]\nChat: ${m.key.remoteJid}\nUtilisateur: ${m.pushName || 'Inconnu'}\nQuestion: ${text}\nErreur: ${resultat.error}`
                })

                reply('⚠️ *Service IA momentanément indisponible.*\n\nTous nos serveurs IA sont saturés. Réessayez dans quelques instants.\n\n_Le propriétaire a été averti._')
            }
        } catch (e) {
            console.error(`[ERREUR-CMD-IA] :`, e.message)
            const jidProprietaire = global.owner[0].endsWith('@s.whatsapp.net')
                ? global.owner[0] : global.owner[0] + '@s.whatsapp.net'
            await sock.sendMessage(jidProprietaire, { text: `[ERREUR-IA-CRITIQUE]\n${e.message}` })
            reply('❌ Une erreur critique est survenue. Le propriétaire a été averti.')
        }
    }
}
