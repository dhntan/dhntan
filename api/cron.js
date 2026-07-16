const { MongoClient } = require('mongodb');
const axios = require('axios');
const { GoogleGenAI } = require('@google/generative-ai');

// Koneksi ke database asli
const uri = "mongodb+srv://dhntan_db_user:TGHjfpbbNVdLUUXZ@cluster0.h9h6cvs.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";
let cachedClient = null;

async function connectToDatabase() {
    if (cachedClient) return cachedClient;
    const client = new MongoClient(uri);
    await client.connect();
    cachedClient = client;
    return client;
}

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Content-Type', 'application/json');

    try {
        const client = await connectToDatabase();
        const db = client.db('doomsday_bot');
        const signalCol = db.collection('signal_history_m15');

        // 1. Ambil Harga Live dari Coinbase
        let livePrice = "0.00";
        try {
            const cbRes = await axios.get('https://api.coinbase.com/v2/prices/PAXG-USD/spot');
            livePrice = parseFloat(cbRes.data.data.amount).toFixed(2);
        } catch (err) {
            console.error("Gagal ambil harga Coinbase:", err.message);
        }

        // 2. Format Jam WIB Jakarta
        const currentTimestamp = Date.now();
        const timeString = new Date(currentTimestamp).toLocaleTimeString('id-ID', { 
            timeZone: 'Asia/Jakarta', 
            hour: '2-digit', 
            minute: '2-digit' 
        }) + " WIB";

        // Nilai indikator database (Mode awal stabil)
        let ema9 = (parseFloat(livePrice) - 0.5).toFixed(2);
        let ema21 = (parseFloat(livePrice) + 4.0).toFixed(2);
        let rsi14 = "50.00";
        let atr14 = "3.50";
        let upperDoom = (parseFloat(livePrice) + 15).toFixed(2);
        let lowerDoom = (parseFloat(livePrice) - 15).toFixed(2);

        // 3. Proses Otak Gemini menggunakan inisialisasi constructor yang benar
        let aiSignal = "NEUTRAL";
        let aiColor = "#6b7280";
        let aiReason = "Menggunakan mode aman (Koneksi AI Terputus).";

        try {
            if (GEMINI_API_KEY) {
                // Inisialisasi standar: masukkan API KEY langsung ke constructor utama
                const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
                
                // Panggil model via getGenerativeModel
                const model = ai.getGenerativeModel({ model: 'gemini-1.5-flash' });
                
                const promptText = `Analisis market XAUUSD saat ini. Harga: $${livePrice}, RSI: ${rsi14}, EMA9: ${ema9}, EMA21: ${ema21}. Berikan respons DALAM FORMAT JSON SAJA seperti ini: {"signal": "BUY", "color": "#10b981", "reason": "alasan singkat"}. Jangan ketik teks lain selain objek JSON tersebut.`;
                
                const response = await model.generateContent(promptText);
                let rawText = response.text.trim();
                
                if (rawText.includes("```")) {
                    rawText = rawText.replace(/```json/gi, "").replace(/```/g, "").trim();
                }

                const parsedAi = JSON.parse(rawText);

                if (parsedAi.signal) aiSignal = parsedAi.signal.toUpperCase();
                if (parsedAi.color) aiColor = parsedAi.color;
                if (parsedAi.reason) aiReason = parsedAi.reason;
            }
        } catch (aiErr) {
            console.error("Gagal terhubung ke Otak AI Gemini:", aiErr.message);
            aiReason = "Gagal memproses Otak AI Gemini: " + aiErr.message;
        }

        // 4. Susun Objek Data Baru
        const newData = {
            timestamp: currentTimestamp,
            timeStr: timeString,
            closePrice: livePrice,
            signal: aiSignal,
            color: aiColor,
            reason: aiReason,
            ema9: ema9,
            ema21: ema21,
            rsi14: rsi14,
            atr14: atr14,
            upperDoom: upperDoom,
            lowerDoom: lowerDoom
        };

        await signalCol.insertOne(newData);
        res.status(200).json({ success: true, message: "Data AI berhasil masuk database!", data: newData });

    } catch (globalErr) {
        console.error("Error 500 Utama:", globalErr.message);
        res.status(500).json({ success: false, error: globalErr.message });
    }
};
