module.exports = {
    name: 'devine',
    category: 'games',
    desc: 'Devinette générée par l\'IA : trouvez la réponse !',
    commands: ['devine', 'devinette', 'riddle'],
    run: async (sock, m, args, { reply, getAIResponse }) => {
        const from = m.key.remoteJid
        if (global.db.games[from]) return reply('❌ Un jeu est déjà en cours dans ce chat ! Utilisez `.stopgame`.')

        await reply('🧩 *Génération d\'une devinette...*')

        try {
            const prompt =
                'Génère une devinette courte et amusante en français. ' +
                'Réponds UNIQUEMENT en JSON strict de cette forme : ' +
                '{"question":"...","reponse":"..."}'
            const res = await getAIResponse(prompt)
            const brut = res?.out || (typeof res === 'string' ? res : '')
            if (!brut) throw new Error('Réponse IA vide')

            const propre = String(brut).replace(/```json|```/g, '').trim()
            const debut = propre.indexOf('{')
            const fin = propre.lastIndexOf('}')
            let data
            if (debut !== -1 && fin !== -1) {
                try { data = JSON.parse(propre.substring(debut, fin + 1)) } catch (e) { data = null }
            }
            if (!data?.question || !data?.reponse) {
                // Repli : la réponse complète est affichée telle quelle
                return reply(`🧩 *DEVINETTE*\n\n${propre}`)
            }

            const reponse = String(data.reponse).trim()
            global.db.games[from] = {
                type: 'devine',
                reponse,
                listener: async (sock2, m2, { body, sender, reply: r }) => {
                    const essai = String(body || '').trim()
                    if (!essai) return
                    const normaliser = (s) => String(s).toLowerCase()
                        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
                        .replace(/[^a-z0-9]/g, '')
                    if (normaliser(essai) === normaliser(reponse)) {
                        await r(`🎉 @${global.jidToNumber(sender)} a trouvé la bonne réponse : *${reponse}* !`, { mentions: [sender] })
                        delete global.db.games[from]
                    }
                }
            }

            let msg = `🧩 *DEVINETTE* 🧩\n\n${data.question}\n\n`
            msg += `👉 *Proposez votre réponse directement dans le chat !*\n`
            msg += `_Pour abandonner, tapez_ \`.stopgame\``
            reply(msg)
        } catch (e) {
            console.error('[DEVINE]', e.message)
            reply('❌ Erreur de génération de la devinette. Réessayez dans un instant.')
        }
    }
}
