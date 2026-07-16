const { MongoClient } = require('mongodb');

const uri = "mongodb+srv://dhntan_db_user:TGHjfpbbNVdLUUXZ@cluster0.h9h6cvs.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

module.exports = async (req, res) => {
    try {
        const client = await new MongoClient(uri).connect();
        const db = client.db('doomsday_bot');
        
        // Menggunakan Fetch API langsung tanpa GoogleGenAI SDK untuk menghindari conflict
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: "Analisis XAUUSD, berikan JSON: {signal, color, reason}" }] }]
            })
        });

        const data = await response.json();
        const aiResponse = JSON.parse(data.candidates[0].content.parts[0].text.replace(/```json|```/g, ""));

        await db.collection('signal_history_m15').insertOne({
            timestamp: Date.now(),
            ai_data: aiResponse
        });

        return res.status(200).json({ success: true, message: "KONEKSI_BARU_DOOMSDAY_SUKSES", data: aiResponse });
    } catch (e) {
        return res.status(500).json({ success: false, error: e.message });
    }
};
