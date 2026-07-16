const { MongoClient } = require('mongodb');

const uri = "mongodb+srv://dhntan_db_user:TGHjfpbbNVdLUUXZ@cluster0.h9h6cvs.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

module.exports = async (req, res) => {
    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${GEMINI_API_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: "Analisis XAUUSD. Berikan format JSON saja: {\"signal\": \"BUY\", \"color\": \"#10b981\", \"reason\": \"test\"}" }] }]
            })
        });

        const data = await response.json();
        
        // JIKA RESPONS TIDAK ADA CANDIDATES, KITA TAMPILKAN ISINYA
        if (!data.candidates) {
            return res.status(500).json({ 
                success: false, 
                message: "API GAGAL MEMBERIKAN DATA", 
                raw_response: data // INI AKAN MENUNJUKKAN KENAPA GEMINI MENOLAK
            });
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
