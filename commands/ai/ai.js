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

        await reply(`${emoji} *Réflexion...*`)

        try {
            // Mémoire : l'IA relit les derniers échanges de ce chat
            const from = m.key.remoteJid
            const historique = global.getHistorique(from)
            const resultat = await getAIResponse(text, fournisseur, null, historique)

            // On retient l'échange pour la suite de la discussion
            if (resultat.out) {
                global.ajouterHistorique(from, 'user', text)
                global.ajouterHistorique(from, 'bot', resultat.out)
            }

            if (resultat.out) {
                await reply(resultat.out)
            } else {
                reply('⚠️ Erreur temporaire.')
            }
        } catch (e) {
            console.error(`[ERREUR-CMD-IA] :`, e.message)
            reply('❌ Erreur.')
        }
    }
}
