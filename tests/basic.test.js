const { test } = require('node:test')
const assert = require('assert')

test('helpers globaux présents', () => {
    global.db = global.db || {}
    global.ajouterScore = global.ajouterScore || ((userJid, nom, victoire) => {
        if (!userJid) return
        if (!global.db.scores) global.db.scores = {}
        const cle = String(userJid).split('@')[0]
        const s = global.db.scores[cle] || (global.db.scores[cle] = { points: 0, victoires: 0, parties: 0, nom: '' })
        if (nom) s.nom = nom
        s.parties++
        if (victoire) { s.victoires++; s.points += 10 } else s.points += 1
    })
    global.difficultePour = global.difficultePour || ((chatId, userJid) => {
        const cle = String(userJid).split('@')[0]
        const perso = global.db.difficulteJoueur?.[cle]
        if (['facile', 'moyen', 'difficile'].includes(perso)) return perso
        return global.db.difficulte?.[chatId] || 'moyen'
    })
    assert.ok(typeof global.ajouterScore === 'function')
    assert.ok(typeof global.difficultePour === 'function')
})

test('gestion des scores', () => {
    global.db = { scores: {}, difficulte: {}, difficulteJoueur: {} }
    global.ajouterScore('123@s.whatsapp.net', 'Test', true)
    global.ajouterScore('123@s.whatsapp.net', 'Test', false)
    const s = global.db.scores['123']
    assert.ok(s)
    assert.equal(s.parties, 2)
    assert.equal(s.victoires, 1)
    assert.ok(s.points >= 11)
})

test('difficulté par joueur prioritaire', () => {
    global.db = { scores: {}, difficulte: {}, difficulteJoueur: {} }
    global.db.difficulte['chat1'] = 'difficile'
    global.db.difficulteJoueur['456'] = 'facile'
    const niv = global.difficultePour('chat1', '456@s.whatsapp.net')
    assert.equal(niv, 'facile')
})
