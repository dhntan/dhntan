const { MongoClient } = require('mongodb');

const uri = "mongodb+srv://dhntan_db_user:TGHjfpbbNVdLUUXZ@cluster0.h9h6cvs.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

module.exports = async (req, res) => {
    try {
        let aiResponse = { signal: "NEUTRAL", color: "#6b7280", reason: "Mode Cadangan: API Gemini Tidak Merespons" };
        
        try {
            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${GEMINI_API_KEY}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: "Analisis XAUUSD. Berikan format JSON saja: {\"signal\": \"BUY\", \"color\": \"#10b981\", \"reason\": \"analisis\"}" }] }]
                })
            });
            const data = await response.json();
            if (data.candidates && data.candidates[0]) {
                aiResponse = JSON.parse(data.candidates[0].content.parts[0].text.replace(/```json|```/g, "").trim());
            }
        } catch (e) {
            console.log("Gemini gagal, menggunakan data cadangan.");
        }

        const client = await new MongoClient(uri).connect();
        const db = client.db('doomsday_bot');
        await db.collection('signal_history_m15').insertOne({
            timestamp: Date.now(),
            ai_data: aiResponse
        });

        return res.status(200).json({ success: true, message: "DATA_TERSIMPAN_SUKSES", data: aiResponse });
    } catch (e) {
        return res.status(500).json({ success: false, error: e.message });
    }
};
