const fs = require('fs')
const path = require('path')

module.exports = {
    name: 'logout',
    category: 'owner',
    desc: 'Déconnecte le bot et efface la session actuelle.',
    commands: ['logout', 'deconnecter', 'déconnecter', 'signout', 'sessionlogout'],
    run: async (sock, m, args, { reply, isOwner }) => {
        if (!isOwner) return reply('❌ Cette commande est réservée au propriétaire du bot.')

        try {
            await reply('🔒 *Déconnexion en cours...*\n\nLa session sera supprimée. Au prochain démarrage, un QR/Code de jumelage sera nécessaire.')
            
            global._skipHistorySync = true
            try {
                if (typeof sock.logout === 'function') {
                    await sock.logout()
                }
            } catch (e) {
                console.log('[LOGOUT] sock.logout() ignoré :', e.message)
            }

            const dossierSession = path.join(__dirname, '../../session')
            try {
                if (fs.existsSync(dossierSession)) {
                    fs.rmSync(dossierSession, { recursive: true, force: true })
                    fs.mkdirSync(dossierSession, { recursive: true })
                }
            } catch (e) {
                console.error('[LOGOUT] Erreur purge session :', e.message)
            }

            setTimeout(() => {
                process.exit(0)
            }, 1500)
        } catch (e) {
            console.error('[LOGOUT] Erreur :', e.message)
            reply('❌ Erreur lors de la déconnexion.')
        }
    }
}
