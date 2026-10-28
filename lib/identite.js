module.exports = {
    getIdentite: (userJid) => {
        if (!global.db.identites) global.db.identites = {}
        const cle = (global.jidToNumber ? global.jidToNumber(userJid) : userJid)
        return global.db.identites[cle]
    },
    enregistrerIdentite: (userJid, nom) => {
        if (!global.db.identites) global.db.identites = {}
        const cle = (global.jidToNumber ? global.jidToNumber(userJid) : userJid)
        if (!global.db.identites[cle]) {
            global.db.identites[cle] = { nom: nom.trim(), connu: true, ts: Date.now() }
            return true
        }
        return false
    }
}
