require('dotenv').config()
const axios = require('axios')

async function testAllKeys() {
    const keys = [
        process.env.GEMINI_KEY_1,
        process.env.GEMINI_KEY_2,
        process.env.GEMINI_KEY_3,
        process.env.GEMINI_KEY_4
    ].filter(k => k)

    for (let i = 0; i < keys.length; i++) {
        const key = keys[i]
        console.log(`\n--- TESTING KEY ${i + 1} ---`)
        try {
            const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${key}`
            const res = await axios.get(url)
            console.log(`Key ${i + 1} is VALID. Available models:`)
            const models = res.data.models.map(m => m.name.replace('models/', ''))
            console.log(models.slice(0, 10)) // Show first 10

            if (models.includes('gemini-1.5-flash')) {
                console.log('Testing gemini-1.5-flash...')
                const genUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${key}`
                const genRes = await axios.post(genUrl, {
                    contents: [{ parts: [{ text: "Hello" }] }]
                })
                console.log('Gemini Response success!')
            }
        } catch (e) {
            console.error(`Key ${i + 1} FAILED: ${e.response?.status} ${e.response?.statusText}`)
            console.error('Error info:', e.response?.data?.error?.message || e.message)
        }
    }
}

testAllKeys()
