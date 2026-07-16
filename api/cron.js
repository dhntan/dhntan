// FORCE_PRODUCTION_UPGRADE_V4: true
const { MongoClient } = require('mongodb');

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

        // 1. Ambil Harga Live dari Coinbase via global fetch (Bawaan Node.js)
        let livePrice = "4021.09"; 
        try {
            const cbRes = await fetch('https://api.coinbase.com/v2/prices/PAXG-USD/spot');
            const cbData = await cbRes.json();
            if (cbData && cbData.data && cbData.data.amount) {
                livePrice = parseFloat(cbData.data.amount).toFixed(2);
            }
        } catch (err) {
            console.error("Gagal ambil harga Coinbase:", err.message);
        }

        const currentTimestamp = Date.now();
        const timeString = new Date(currentTimestamp).toLocaleTimeString('id-ID', { 
            timeZone: 'Asia/Jakarta', 
            hour: '2-digit', 
            minute: '2-digit' 
        }) + " WIB";

        let ema9 = (parseFloat(livePrice) - 0.5).toFixed(2);
        let ema21 = (parseFloat(livePrice) + 4.0).toFixed(2);
        let rsi14 = "50.00";
        let atr14 = "3.50";
        let upperDoom = (parseFloat(livePrice) + 15).toFixed(2);
        let lowerDoom = (parseFloat(livePrice) - 15).toFixed(2);

        // 2. Tembak Gemini API via Native Fetch (Bypass total semua library)
        let aiSignal = "NEUTRAL";
        let aiColor = "#6b7280";
        let aiReason = "Menggunakan mode cadangan HTTP Fetch.";

        try {
            if (GEMINI_API_KEY) {
                const promptText = `Analisis market XAUUSD saat ini. Harga: $${livePrice}, RSI: ${rsi14}, EMA9: ${ema9}, EMA21: ${ema21}. Berikan respons DALAM FORMAT JSON SAJA seperti ini: {"signal": "BUY", "color": "#10b981", "reason": "alasan singkat"}. Jangan ketik teks lain selain objek JSON tersebut.`;
                
                const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;
                
                const response = await fetch(geminiUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: [{ parts: [{ text: promptText }] }]
                    })
                });

                const resData = await response.json();
                let rawText = resData.candidates[0].content.parts[0].text.trim();
                
                if (rawText.includes("```")) {
                    rawText = rawText.replace(/```json/gi, "").replace(/```/g, "").trim();
                }

                const parsedAi = JSON.parse(rawText);
                if (parsedAi.signal) aiSignal = parsedAi.signal.toUpperCase();
                if (parsedAi.color) aiColor = parsedAi.color;
                if (parsedAi.reason) aiReason = parsedAi.reason;
            } else {
                aiReason = "Kunci GEMINI_API_KEY tidak terdeteksi di server.";
            }
        } catch (aiErr) {
            aiReason = "Error Fetch Gemini: " + aiErr.message;
        }

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
        
        // Pembeda teks untuk memastikan Vercel benar-benar memperbarui kodenya
        return res.status(200).json({ 
            success: true, 
            message: "PRODUKSI DIREMANJAKAN: Sukses Terkoneksi Resmi!", 
            data: newData 
        });

    } catch (globalErr) {
        return res.status(500).json({ success: false, error: globalErr.message });
    }
};
