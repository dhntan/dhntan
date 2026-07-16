const { MongoClient } = require('mongodb');

const uri = "mongodb+srv://dhntan_db_user:TGHjfpbbNVdLUUXZ@cluster0.h9h6cvs.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

module.exports = async (req, res) => {
    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: "Analisis XAUUSD. Berikan format JSON saja: {\"signal\": \"BUY/SELL/NEUTRAL\", \"color\": \"#10b981\", \"reason\": \"alasan\"}" }] }]
            })
        });

        const data = await response.json();
        
        // Cek log respons untuk debug jika masih error
        if (!data.candidates || !data.candidates[0]) {
            return res.status(500).json({ success: false, debug: data });
        }

        const rawText = data.candidates[0].content.parts[0].text.replace(/```json|```/g, "").trim();
        const aiResponse = JSON.parse(rawText);

        const client = await new MongoClient(uri).connect();
        const db = client.db('doomsday_bot');
        await db.collection('signal_history_m15').insertOne({
            timestamp: Date.now(),
            ai_data: aiResponse
        });

        return res.status(200).json({ success: true, message: "SUKSES", data: aiResponse });
    } catch (e) {
        return res.status(500).json({ success: false, error: e.message });
    }
};
