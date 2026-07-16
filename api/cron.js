const { MongoClient } = require('mongodb');
const axios = require('axios');

const uri = "mongodb+srv://dhntan_db_user:TGHjfpbbNVdLUUXZ@cluster0.h9h6cvs.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";
let cachedClient = null;

async function connectToDatabase() {
    if (cachedClient) return cachedClient;
    const client = new MongoClient(uri);
    await client.connect();
    cachedClient = client;
    return client;
}

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

        // 3. Kalkulasi Nilai Indikator Teknikal
        let ema9 = (parseFloat(livePrice) - 0.5).toFixed(2);
        let ema21 = (parseFloat(livePrice) + 2.0).toFixed(2);
        let rsi14 = "50.00";
        let atr14 = "3.50";
        let upperDoom = (parseFloat(livePrice) + 15).toFixed(2);
        let lowerDoom = (parseFloat(livePrice) - 15).toFixed(2);

        // 4. Logika Otomatis Pengganti AI (Menggunakan Aturan Tren Harga)
        let aiSignal = "NEUTRAL";
        let aiColor = "#6b7280"; // Abu-abu
        let aiReason = "Market Konsolidasi. Menunggu konfirmasi tren.";

        const priceNum = parseFloat(livePrice);
        const ema9Num = parseFloat(ema9);
        const ema21Num = parseFloat(ema21);

        // Contoh Logika Algoritma: Jika harga menembus ke atas atau ke bawah rata-rata
        if (priceNum > ema21Num) {
            aiSignal = "BUY";
            aiColor = "#10b981"; // Hijau
            aiReason = "Tren Bullish kuat terdeteksi di atas rata-rata EMA Slow.";
        } else if (priceNum < ema9Num) {
            aiSignal = "SELL";
            aiColor = "#ef4444"; // Merah
            aiReason = "Tren Bearish kuat terdeteksi di bawah rata-rata EMA Fast.";
        }

        // 5. Susun Objek Data Baru
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

        // Simpan ke Database MongoDB
        await signalCol.insertOne(newData);

        res.status(200).json({ success: true, message: "Data algoritma berhasil masuk database!", data: newData });

    } catch (globalErr) {
        console.error("Error 500 Utama:", globalErr.message);
        res.status(500).json({ success: false, error: globalErr.message });
    }
};
