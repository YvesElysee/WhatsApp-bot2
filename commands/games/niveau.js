const { NIVEAUX } = require('../../lib/jeux')

const LIBELLES = {
    facile: '🟢 FACILE',
    moyen: '🟡 MOYEN',
    difficile: '🔴 DIFFICILE'
}

module.exports = {
    name: 'niveau',
    category: 'games',
    desc: 'Règle le niveau de difficulté des jeux (facile/moyen/difficule).',
    commands: ['niveau', 'difficulte', 'difficulty', 'level'],
    run: async (sock, m, args, { reply, isAdmins, isOwner, isGroup }) => {
        const from = m.key.remoteJid
        const actuel = global.db.difficulte?.[from] || 'moyen'

        // En groupe, seuls les admins / le propriétaire peuvent régler le niveau
        if (isGroup && !isAdmins && !isOwner) {
            return reply(
                `🎚️ Niveau actuel de ce groupe : *${LIBELLES[actuel] || actuel}*\n` +
                '_Seuls les admins peuvent le modifier._'
            )
        }

        const choix = String(args[0] || '').toLowerCase()
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '')

        if (!choix) {
            return reply(
                `🎚️ *NIVEAU DE DIFFICULTÉ*\n\n` +
                `Niveau actuel : *${LIBELLES[actuel] || actuel}*\n\n` +
                `Choisissez un niveau :\n` +
                `• \`.niveau facile\` — plus d'essais, plus d'indices\n` +
                `• \`.niveau moyen\` — équilibré (défaut)\n` +
                `• \`.niveau difficile\` — moins d'essais, questions corsées\n\n` +
                `_Le niveau s'applique aux jeux : devine, guess, motgame, pendu, quiz._`
            )
        }

        // Accepte aussi les saisies sans accents / abrégées
        const aliases = { facil: 'facile', easy: 'facile', moyen: 'moyen', normal: 'moyen', medium: 'moyen', dur: 'difficile', hard: 'difficile', difficile: 'difficile' }
        const niveau = NIVEAUX.includes(choix) ? choix : aliases[choix]

        if (!niveau) {
            return reply('❌ Niveau inconnu. Choisissez : *facile*, *moyen* ou *difficile*.')
        }

        if (!global.db.difficulte) global.db.difficulte = {}
        global.db.difficulte[from] = niveau

        reply(`🎚️ Niveau de difficulté réglé sur *${LIBELLES[niveau]}* pour ce chat.\n_Les prochaines parties en tiendront compte._`)
    }
}
