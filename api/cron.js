const { MongoClient } = require('mongodb');
const axios = require('axios');

// Konfigurasi koneksi database
const uri = process.env.MONGODB_URI; // Pastikan ini sudah terisi di Vercel Env
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

module.exports = async (req, res) => {
    // Hanya izinkan metode GET untuk cron job
    if (req.method !== 'GET') {
        return res.status(405).json({ error: "Method not allowed" });
    }

    let client;
    try {
        // 1. Ambil harga live XAUUSD
        const cbRes = await axios.get('https://api.coinbase.com/v2/prices/PAXG-USD/spot');
        const livePrice = parseFloat(cbRes.data.data.amount).toFixed(2);

        // 2. Kirim prompt ke OpenRouter (Model Gemini 1.5 Flash)
        const aiResponse = await axios.post("https://openrouter.ai/api/v1/chat/completions", {
           "model": "google/gemini-1.5-flash",
            "messages": [{ 
                "role": "user", 
                "content": `Analisis XAUUSD harga ${livePrice}. Berikan jawaban dalam format JSON murni saja: {"signal": "BUY/SELL/HOLD", "color": "#10b981", "reason": "alasan singkat"}` 
            }]
        }, {
            headers: {
                "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
                "HTTP-Referer": "https://vercel.com/", 
                "X-Title": "Bot Emas Dhany"
            }
        });

        // 3. Parsing JSON dari jawaban AI
        const rawContent = aiResponse.data.choices[0].message.content;
        const aiParsed = JSON.parse(rawContent.replace(/```json|```/g, ""));

        // 4. Simpan ke MongoDB
        client = await new MongoClient(uri).connect();
        const db = client.db('doomsday_bot');
        await db.collection('signal_history_m15').insertOne({
            timestamp: new Date(),
            price: livePrice,
            ...aiParsed
        });

        res.status(200).json({ success: true, data: aiParsed });

    } catch (err) {
        console.error("Error Detail:", err.response ? err.response.data : err.message);
        res.status(500).json({ 
            success: false, 
            error: err.message,
            details: err.response ? err.response.data : "No extra info" 
        });
    } finally {
        if (client) await client.close();
    }
};
