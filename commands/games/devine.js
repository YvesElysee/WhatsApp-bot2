const { demanderSuite, essaisPour, partieEnCours, difficulteDe } = require('../../lib/jeux')

// Nombre d'essais selon le niveau choisi (`.niveau`)
const ESSAIS = { facile: 4, moyen: 2, difficile: 1 }

module.exports = {
    name: 'devine',
    category: 'games',
    desc: 'Devinette générée par l\'IA : trouvez la réponse !',
    commands: ['devine', 'devinette', 'riddle'],
    run: async (sock, m, args, { reply, getAIResponse }) => {
        const from = m.key.remoteJid
        if (partieEnCours(from)) return reply('❌ Un jeu est déjà en cours ici ! Utilisez `.stopgame`.')

        const niveau = difficulteDe(from)

        // Demande une nouvelle devinette à l'IA (une par manche)
        const generer = async () => {
            const prompt =
                'Génère une devinette courte et amusante en français. ' +
                'Réponds UNIQUEMENT en JSON strict de cette forme : ' +
                '{"question":"...","reponse":"...","indice":"..."}'
            const res = await getAIResponse(prompt)
            const brut = res?.out || (typeof res === 'string' ? res : '')
            if (!brut) return null

            const propre = String(brut).replace(/```json|```/g, '').trim()
            const debut = propre.indexOf('{')
            const fin = propre.lastIndexOf('}')
            let data = null
            if (debut !== -1 && fin !== -1) {
                try { data = JSON.parse(propre.substring(debut, fin + 1)) } catch (e) { data = null }
            }
            if (!data?.question || !data?.reponse) return null
            return {
                question: String(data.question),
                reponse: String(data.reponse).trim(),
                indice: String(data.indice || '').trim() || 'Réfléchissez bien aux mots-clés de la question.'
            }
        }

        // Nouvelle manche (réutilisée par « on continue ? »)
        const lancerManche = async (repondre) => {
            await repondre(`🧩 Génération d'une devinette (${niveau.toUpperCase()})...`)
            const devinette = await generer()
            if (!devinette) {
                return repondre('❌ Erreur de génération de la devinette. Réessayez dans un instant.')
            }

            const { question, reponse, indice } = devinette
            let essais = essaisPour(from, ESSAIS)

            global.db.games[from] = {
                type: 'devine',
                reponse,
                listener: async (sock2, m2, { body, sender, reply: r }) => {
                    const partie = global.db.games[from]
                    if (!partie || partie.type !== 'devine') return
                    const essai = String(body || '').trim()
                    if (!essai) return

                    const normaliser = (s) => String(s).toLowerCase()
                        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
                        .replace(/[^a-z0-9]/g, '')

                    if (normaliser(essai) === normaliser(reponse)) {
                        const bilan = `🎉 @${global.jidToNumber(sender)} a trouvé la bonne réponse : *${reponse}* !`
                        delete global.db.games[from]
                        return demanderSuite(from, r, bilan, () => lancerManche(r), { mentions: [sender] })
                    }

                    // Faux : indice puis, à la fin des essais, la réponse
                    essais--
                    if (essais > 0) {
                        await r(`❌ Faux ! Voici un *indice* : _${indice}_\n❤️ Essais restants : *${essais}*`)
                    } else {
                        const bilan = `💤 Plus d'essais ! La bonne réponse était : *${reponse}*\n💡 _${indice}_`
                        delete global.db.games[from]
                        await demanderSuite(from, r, bilan, () => lancerManche(r))
                    }
                }
            }

            await repondre(
                `🧩 *DEVINETTE* 🧩\n\n${question}\n\n` +
                `🎚️ Niveau *${niveau.toUpperCase()}* — ${essais} essai(s), un indice à chaque erreur.\n` +
                `👉 *Proposez votre réponse directement dans le chat !*\n` +
                `_Pour abandonner, tapez_ \`.stopgame\``
            )
        }

        try {
            await lancerManche(reply)
        } catch (e) {
            console.error('[DEVINE]', e.message)
            reply('❌ Erreur de génération de la devinette. Réessayez dans un instant.')
        }
    }
}
