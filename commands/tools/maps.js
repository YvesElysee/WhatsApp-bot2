const axios = require('axios')

module.exports = {
    name: 'maps',
    category: 'tools',
    desc: 'Cherche des informations sur Google via SerpApi avec itinéraire et aperçu.',
    commands: ['maps', 'googlemaps', 'lieu', 'search'],
    run: async (sock, m, args, { reply, text }) => {
        const apiKey = process.env.SERP_API_KEY
        if (!apiKey || apiKey === 'votre_cle_serpapi_ici') {
            return reply('⚠️ La clé SERP_API_KEY n\'est pas configurée dans le fichier .env.')
        }

        if (!text) return reply('🔍 Veuillez indiquer un lieu ou une recherche. Exemple: `.maps Cafe aux Austin`')

        try {
            // SerpApi Google Search endpoint
            const url = `https://serpapi.com/search.json`
            const response = await axios.get(url, {
                params: {
                    engine: "google",
                    q: text,
                    google_domain: "google.com",
                    hl: "fr",
                    gl: "fr",
                    api_key: apiKey
                }
            })

            const data = response.data

            if (data.error) return reply(`❌ Erreur SerpApi: ${data.error}`)

            let infoText = `🔍 *RÉSULTATS DE RECHERCHE* 🔍\n\n`
            let thumbnail = null
            let itineraryLink = null

            // 1. Check for Local Results (Maps) - Highest Priority for Itinerary
            if (data.local_results?.[0]) {
                const place = data.local_results[0]
                infoText += `🏢 *Lieu principal* : ${place.title}\n`
                if (place.address) infoText += `📍 *Adresse* : ${place.address}\n`
                if (place.rating) infoText += `⭐ *Note* : ${place.rating} (${place.reviews} avis)\n`
                if (place.phone) infoText += `📞 *Tel* : ${place.phone}\n`

                thumbnail = place.thumbnail

                // Build itinerary link
                if (place.gps_coordinates) {
                    const { latitude, longitude } = place.gps_coordinates
                    itineraryLink = `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`
                } else if (place.address) {
                    itineraryLink = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(place.address)}`
                }
            }
            // 2. Check for Knowledge Graph
            else if (data.knowledge_graph) {
                const kg = data.knowledge_graph
                infoText += `📖 *Sujet* : ${kg.title} (${kg.type || ''})\n`
                if (kg.description) infoText += `📝 *Description* : ${kg.description.slice(0, 300)}...\n`
                if (kg.header_images?.[0]?.image) thumbnail = kg.header_images[0].image
                else if (kg.image) thumbnail = kg.image

                itineraryLink = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(kg.title)}`
            }
            // 3. Check for Answer Box
            else if (data.answer_box) {
                infoText += `💡 *Réponse* : ${data.answer_box.answer || data.answer_box.snippet}\n`
                if (data.answer_box.thumbnail) thumbnail = data.answer_box.thumbnail
            }
            // 4. Fallback to organic results
            else if (data.organic_results?.[0]) {
                const result = data.organic_results[0]
                infoText += `🌐 *Lien* : ${result.title}\n`
                infoText += `🔗 ${result.link}\n`
                if (result.snippet) infoText += `📝 *Snippet* : ${result.snippet}\n`
                if (result.thumbnail) thumbnail = result.thumbnail
            } else {
                return reply('❌ Aucun résultat significatif trouvé pour cette recherche.')
            }

            // Final touch: add links
            if (itineraryLink) {
                infoText += `\n🚗 *Itinéraire* : ${itineraryLink}`
            }
            if (data.search_metadata?.google_url) {
                infoText += `\n🔗 *Voir sur Google* : ${data.search_metadata.google_url}`
            }

            // Send with image if thumbnail exists
            if (thumbnail) {
                await sock.sendMessage(m.key.remoteJid, {
                    image: { url: thumbnail },
                    caption: infoText.trim()
                }, { quoted: m })
            } else {
                reply(infoText.trim())
            }

        } catch (e) {
            console.error('SerpApi Error:', e.message)
            reply(`❌ Erreur lors de la recherche: ${e.message}`)
        }
    }
}
