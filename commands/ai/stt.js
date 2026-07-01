const { getBaileys } = require('../../lib/baileys')

module.exports = {
    name: 'stt',
    category: 'ai',
    desc: 'Retranscrit un message vocal en texte. Répondez à un audio.',
    commands: ['stt', 'transcribe', 'vocal'],
    run: async (sock, m, args, { reply }) => {

        // ── Trouver le message audio : dans le quoted OU dans le message lui-même ──
        let audioMsg = null
        let mimeType = ''

        if (m.quoted) {
            // Cas 1 : l'utilisateur répond à un audio
            const qType = m.quoted.mtype
            if (qType === 'audioMessage' || qType === 'pttMessage') {
                audioMsg = m.quoted.msg
                mimeType = audioMsg?.mimetype || 'audio/ogg; codecs=opus'
            } else if (m.quoted.msg?.mimetype && /audio/.test(m.quoted.msg.mimetype)) {
                audioMsg = m.quoted.msg
                mimeType = audioMsg.mimetype
            }
        }

        // Cas 2 : le message lui-même est un audio (sans quoted)
        if (!audioMsg) {
            const unwrapped = m.unwrapped || {}
            if (unwrapped.type === 'audioMessage' || unwrapped.type === 'pttMessage') {
                audioMsg = unwrapped.msg
                mimeType = audioMsg?.mimetype || 'audio/ogg; codecs=opus'
            }
        }

        if (!audioMsg) {
            return reply(
                '❌ *Aucun audio trouvé !*\n\n' +
                'Répondez à un message vocal avec `.stt`\n' +
                '_ou_ envoyez un audio et tapez `.stt`'
            )
        }

        reply('🎙️ *Transcription en cours...*\n_Veuillez patienter quelques secondes._')

        try {
            // Téléchargement de l'audio via Baileys
            const { downloadContentFromMessage } = await getBaileys().then(b => b)
            const msgPourDownload = m.quoted ? m.quoted.msg : m.unwrapped.msg

            // Déterminer le type pour downloadContentFromMessage
            const dlType = mimeType.includes('ogg') ? 'audio' : 'audio'

            const stream = await downloadContentFromMessage(msgPourDownload, dlType)
            let buffer = Buffer.from([])
            for await (const chunk of stream) {
                buffer = Buffer.concat([buffer, chunk])
            }

            if (buffer.length === 0) throw new Error('Buffer audio vide — téléchargement échoué')

            console.log(`[STT] Audio téléchargé: ${buffer.length} octets, mime: ${mimeType}`)

            // ── Clé Gemini pour la transcription multimodale ──
            const clean = (k) => (typeof k === 'string') ? k.trim() : ''
            const keys = [
                clean(process.env.GEMINI_KEY_1),
                clean(process.env.GEMINI_KEY_2),
                clean(process.env.GEMINI_KEY_3),
                clean(process.env.GEMINI_KEY_4)
            ].filter(k => k.length > 10 && k.startsWith('AIza'))

            if (keys.length === 0) {
                return reply('❌ Aucune clé Gemini configurée pour la transcription.\nAjoutez GEMINI_KEY_1 dans votre fichier .env')
            }

            const key = keys[global.db.geminiIndex % keys.length]

            // Normaliser le MIME type pour Gemini
            const mimeNormalise = mimeType.includes('ogg') ? 'audio/ogg' :
                mimeType.includes('mp4') ? 'audio/mp4' :
                mimeType.includes('mpeg') || mimeType.includes('mp3') ? 'audio/mpeg' :
                mimeType.includes('webm') ? 'audio/webm' :
                'audio/ogg'

            const axios = require('axios')

            // Essayer plusieurs modèles Gemini
            const modeles = ['gemini-1.5-flash', 'gemini-2.0-flash', 'gemini-2.5-flash']
            let texteFinal = null

            for (const modele of modeles) {
                try {
                    const result = await axios.post(
                        `https://generativelanguage.googleapis.com/v1beta/models/${modele}:generateContent?key=${key}`,
                        {
                            contents: [{
                                parts: [
                                    {
                                        text: 'Transcris exactement ce message audio en texte. ' +
                                              'Si c\'est en français, retourne le texte en français. ' +
                                              'Si c\'est dans une autre langue, retourne-le dans cette langue. ' +
                                              'Ne renvoie QUE le texte transcrit, sans commentaires ni explication.'
                                    },
                                    {
                                        inlineData: {
                                            mimeType: mimeNormalise,
                                            data: buffer.toString('base64')
                                        }
                                    }
                                ]
                            }]
                        },
                        { timeout: 30000 }
                    )

                    const texte = result.data?.candidates?.[0]?.content?.parts?.[0]?.text
                    if (texte && texte.trim().length > 0) {
                        texteFinal = texte.trim()
                        console.log(`[STT] Transcription réussie avec ${modele}`)
                        break
                    }
                } catch (errModele) {
                    console.error(`[STT] Modèle ${modele} échoué:`, errModele.message)
                }
            }

            if (!texteFinal) throw new Error('Tous les modèles ont échoué ou retourné un résultat vide')

            reply(`📝 *TRANSCRIPTION VOCALE*\n${'─'.repeat(25)}\n\n${texteFinal}`)

        } catch (e) {
            console.error('[STT-ERREUR]', e.message)
            if (e.response?.data) console.error('[STT-API]', JSON.stringify(e.response.data).substring(0, 300))
            reply('❌ Échec de la transcription.\n_Vérifiez que votre clé Gemini est valide._')
        }
    }
}
