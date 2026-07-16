const { MongoClient } = require('mongodb');
const axios = require('axios');

const uri = "mongodb+srv://dhntan_db_user:TGHjfpbbNVdLUUXZ@cluster0.h9h6cvs.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";
const client = new MongoClient(uri);

module.exports = async (req, res) => {
    try {
        await client.connect();
        const db = client.db('doomsday_bot');
        const signalCol = db.collection('signal_history_m15');
        
        let livePrice = "0.00";
        try {
            const response = await axios.get('https://api.coinbase.com/v2/prices/PAXG-USD/spot');
            livePrice = parseFloat(response.data.data.amount).toFixed(2);
        } catch(err) { 
            console.error(err); 
        }

        // Ambil 30 data dari MongoDB
        const signals = await signalCol.find().sort({ timestamp: -1 }).limit(30).toArray();
        
        // SINKRONISASI TOTAL: Memaksa format data agar aman dibaca frontend index.js
        const formattedSignals = signals.map(s => {
            let waktu = "...";
            if (s.timeStr) {
                waktu = s.timeStr;
            } else if (s.timestamp) {
                waktu = new Date(s.timestamp).toLocaleTimeString('id-ID', { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit' }) + " WIB";
            }

            let harga = livePrice;
            if (s.closePrice) {
                harga = s.closePrice;
            } else if (s.price) {
                harga = parseFloat(s.price).toFixed(2);
            }

            return {
                timeStr: waktu,
                closePrice: harga,
                signal: s.signal || "NEUTRAL",
                color: s.color || "#6b7280",
                reason: s.reason || ""
            };
        });

        // Pastikan objek latest tidak kosong
        const latestSignal = formattedSignals[0] || {
            signal: 'NEUTRAL', color: '#6b7280', reason: 'Mengumpulkan data...',
            ema9: '...', ema21: '...', rsi14: '...', atr14: '...',
            upperDoom: '...', lowerDoom: '...'
        };

        // Jika data latest asli ada indikatornya, ambil nilainya
        if (signals[0]) {
            latestSignal.ema9 = signals[0].ema9 || '...';
            latestSignal.ema21 = signals[0].ema21 || '...';
            latestSignal.rsi14 = signals[0].rsi14 || '...';
            latestSignal.atr14 = signals[0].atr14 || '...';
            latestSignal.upperDoom = signals[0].upperDoom || '...';
            latestSignal.lowerDoom = signals[0].lowerDoom || '...';
        }

        res.setHeader('Access-Control-Allow-Origin', '*');
        res.json({ 
            livePrice, 
            signals: formattedSignals, 
            latest: latestSignal 
        });
    } catch (e) { 
        res.status(500).json({ error: e.message }); 
    }
};
