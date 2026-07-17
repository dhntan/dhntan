const { MongoClient } = require('mongodb');
const axios = require('axios');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const uri = "mongodb+srv://dhntan_db_user:TGHjfpbbNVdLUUXZ@cluster0.h9h6cvs.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

module.exports = async (req, res) => {
    try {
        const client = await new MongoClient(uri).connect();
        const db = client.db('doomsday_bot');
        
        const cbRes = await axios.get('https://api.coinbase.com/v2/prices/PAXG-USD/spot');
        const livePrice = parseFloat(cbRes.data.data.amount).toFixed(2);

        const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
        
        // PENGGANTIAN UTAMA: Menggunakan versi spesifik 001
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-001" });
        
        const prompt = `Analisis XAUUSD harga ${livePrice}. Berikan JSON: {"signal": "BUY", "color": "#10b981", "reason": "alasan"}`;
        
        const result = await model.generateContent(prompt);
        const aiParsed = JSON.parse(result.response.text().replace(/```json|```/g, ""));

        await db.collection('signal_history_m15').insertOne({
            timestamp: Date.now(),
            timeStr: new Date().toLocaleTimeString('id-ID', { timeZone: 'Asia/Jakarta' }),
            closePrice: livePrice,
            ...aiParsed
        });

        res.status(200).json({ success: true, message: "Berhasil" });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
};
