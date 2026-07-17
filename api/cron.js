const { MongoClient } = require('mongodb');
const axios = require('axios');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const uri = "mongodb+srv://dhntan_db_user:TGHjfpbbNVdLUUXZ@cluster0.h9h6cvs.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

module.exports = async (req, res) => {
    try {
        const client = await new MongoClient(uri).connect();
        const db = client.db('doomsday_bot');
        
        // 1. Ambil harga live
        const cbRes = await axios.get('https://api.coinbase.com/v2/prices/PAXG-USD/spot');
        const livePrice = parseFloat(cbRes.data.data.amount).toFixed(2);

        // 2. Inisialisasi Gemini dengan model standar yang umum didukung
        const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
        // Menggunakan "gemini-pro" yang lebih stabil untuk banyak tipe API Key
        const model = genAI.getGenerativeModel({ model: "gemini-pro" }); 
        
        const prompt = `Analisis XAUUSD harga ${livePrice}. Berikan JSON saja: {"signal": "BUY", "color": "#10b981", "reason": "alasan"}`;
        const result = await model.generateContent(prompt);
        const text = result.response.text().replace(/```json|```/g, "");
        const aiParsed = JSON.parse(text);

        // 3. Simpan ke DB
        await db.collection('signal_history_m15').insertOne({
            timestamp: Date.now(),
            timeStr: new Date().toLocaleTimeString('id-ID', { timeZone: 'Asia/Jakarta' }),
            closePrice: livePrice,
            ...aiParsed
        });

        res.status(200).json({ success: true, message: "Data tersimpan sukses", data: aiParsed });
    } catch (err) {
        console.error("Error Cron:", err.message);
        res.status(500).json({ success: false, error: err.message });
    }
};
