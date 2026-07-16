const { MongoClient } = require('mongodb');
const axios = require('axios');

const uri = "mongodb+srv://dhntan_db_user:TGHjfpbbNVdLUUXZ@cluster0.h9h6cvs.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";
const client = new MongoClient(uri);

// GANTI DENGAN API KEY GEMINI BAPAK YANG ASLI (Jangan masukkan teks URL kodenya)
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

module.exports = async (req, res) => {
    // Pengaman header untuk serverless function
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Content-Type', 'application/json');

    try {
        await client.connect();
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

        // Nilai default untuk indikator database
        let ema9 = (parseFloat(livePrice) - 0.5).toFixed(2);
        let ema21 = (parseFloat(livePrice) + 4.0).toFixed(2);
        let rsi14 = "50.00";
        let atr14 = "3.50";
        let upperDoom = (parseFloat(livePrice) + 15).toFixed(2);
        let lowerDoom = (parseFloat(livePrice) - 15).toFixed(2);

        // 3. Tembak Gemini API (Menggunakan Model 1.5-Flash yang Lebih Stabil)
        let aiSignal = "NEUTRAL";
        let aiColor = "#6b7280";
        let aiReason = "Menggunakan mode aman (Koneksi AI Terputus).";

        try {
            if (GEMINI_API_KEY && GEMINI_API_KEY !== "MASUKKAN_API_KEY_GEMINI_DI_SINI") {
                const promptText = `Analisis market XAUUSD saat ini. Harga: $${livePrice}, RSI: ${rsi14}, EMA9: ${ema9}, EMA21: ${ema21}. Berikan respons dalam format JSON mentah murni tanpa markdown: {"signal": "BUY"/"SELL"/"NEUTRAL", "color": "warna_hex", "reason": "alasan singkat maksimal 15 kata"}`;
                
                const geminiRes = await axios.post(
                    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`,
                    {
                        contents: [{ parts: [{ text: promptText }] }]
                    },
                    { timeout: 7000 } // Batasi waktu tunggu 7 detik agar tidak timeout global
                );

                const rawText = geminiRes.data.candidates[0].content.parts[0].text;
                const cleanJson = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
                const parsedAi = JSON.parse(cleanJson);

                if (parsedAi.signal) aiSignal = parsedAi.signal;
                if (parsedAi.color) aiColor = parsedAi.color;
                if (parsedAi.reason) aiReason = parsedAi.reason;
            }
        } catch (aiErr) {
            console.error("Gagal terhubung ke Otak AI Gemini:", aiErr.message);
            // Tetap lanjut agar data indikator & harga di bawah ini tetap tersimpan ke MongoDB
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

        // Simpan ke Database
        await signalCol.insertOne(newData);

        // Kirim response sukses ke browser / UptimeRobot
        res.status(200).json({ success: true, message: "Data baru berhasil masuk database!", data: newData });

    } catch (globalErr) {
        console.error("Error 500 Utama:", globalErr.message);
        res.status(500).json({ success: false, error: globalErr.message });
    } finally {
        // Tutup koneksi agar resource MongoDB tidak menggantung
        await client.close();
    }
};
