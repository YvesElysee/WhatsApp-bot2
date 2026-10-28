module.exports = {
    name: 'top',
    category: 'games',
    desc: 'Classement des meilleurs joueurs.',
    commands: ['top', 'classement', 'leaderboard'],
    run: async (sock, m, args, { reply }) => {
        const scores = global.db.scores || {}
        const liste = Object.entries(scores).map(([cle, s]) => ({
            cle,
            nom: s.nom || cle,
            points: s.points || 0,
            victoires: s.victoires || 0,
            parties: s.parties || 0
        }))
        if (liste.length === 0) return reply('🏆 *Classement*\n\nAucun score enregistré pour le moment.')
        liste.sort((a, b) => b.points - a.points)
        const top = liste.slice(0, 10)
        let txt = '🏆 *TOP 10 - CLASSEMENT*\n\n'
        top.forEach((p, i) => {
            const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`
            txt += `${medal} ${p.nom} — *${p.points} pts* (${p.victoires}V/${p.parties}P)\n`
        })
        reply(txt)
    }
}
