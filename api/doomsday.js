const { GoogleGenerativeAI } = require("@google/generative-ai");
const { MongoClient } = require('mongodb');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const uri = "mongodb+srv://dhntan_db_user:TGHjfpbbNVdLUUXZ@cluster0.h9h6cvs.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";

module.exports = async (req, res) => {
    try {
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const result = await model.generateContent("Analisis XAUUSD, berikan JSON: {signal, color, reason}");
        const response = await result.response;
        const text = response.text();

        const client = await new MongoClient(uri).connect();
        const db = client.db('doomsday_bot');
        await db.collection('signal_history_m15').insertOne({
            timestamp: Date.now(),
            ai_data: JSON.parse(text.replace(/```json|```/g, ""))
        });

        return res.status(200).json({ success: true, message: "KODE_STABIL_KEMBALI" });
    } catch (e) {
        return res.status(500).json({ success: false, error: e.message });
    }
};
