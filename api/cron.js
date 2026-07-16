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

        let livePrice = "4020.09"; 
        
        // Menggunakan model 'gemini-pro' yang lebih universal
        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${GEMINI_API_KEY}`;
        
        let aiSignal = "NEUTRAL";
        let aiColor = "#6b7280";
        let aiReason = "Analisis tertunda.";

        try {
            const promptText = `Analisis market XAUUSD, harga: ${livePrice}. Berikan JSON: {"signal": "BUY/SELL/NEUTRAL", "color": "#10b981", "reason": "alasan"}`;
            
            const response = await fetch(geminiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: promptText }] }]
                })
            });

            const resData = await response.json();
            
            if (resData.candidates) {
                let rawText = resData.candidates[0].content.parts[0].text.replace(/```json|```/g, "").trim();
                const parsedAi = JSON.parse(rawText);
                aiSignal = parsedAi.signal;
                aiColor = parsedAi.color;
                aiReason = parsedAi.reason;
            }
        } catch (aiErr) {
            aiReason = "Gagal AI: " + aiErr.message;
        }

        const newData = {
            timestamp: Date.now(),
            timeStr: "14.10 WIB",
            closePrice: livePrice,
            signal: aiSignal,
            color: aiColor,
            reason: aiReason
        };

        await signalCol.insertOne(newData);
        return res.status(200).json({ success: true, message: "FIXED_GEMINI_PRO", data: newData });

    } catch (globalErr) {
        return res.status(500).json({ success: false, error: globalErr.message });
    }
};
