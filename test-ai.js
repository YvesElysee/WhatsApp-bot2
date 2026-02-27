require('dotenv').config()
const { GoogleGenerativeAI } = require('@google/generative-ai')

async function testGemini() {
    console.log('--- FINAL DEBUG GEMINI ---')
    const key = process.env.GEMINI_KEY_1
    if (!key) return console.log('No GEMINI_KEY_1 found')

    const genAI = new GoogleGenerativeAI(key)
    const models = [
        'gemini-2.0-flash',
        'gemini-2.0-flash-lite-preview-02-05',
        'gemini-1.5-flash',
        'gemini-pro'
    ]

    for (const mName of models) {
        try {
            console.log(`Testing model: ${mName}`)
            const model = genAI.getGenerativeModel({ model: mName })

            // Testing with role-based structure which is more robust
            const result = await model.generateContent({
                contents: [{ role: 'user', parts: [{ text: "Bonjour, comment vas-tu ?" }] }]
            })
            const response = await result.response
            console.log(`Success with ${mName}:`, response.text())
            return
        } catch (e) {
            console.error(`Failed ${mName}:`, e.message)
        }
    }
}

testGemini()
