
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

        const signals = await signalCol.find().sort({ timestamp: -1 }).limit(30).toArray();
        const latestSignal = signals[0] || {
            signal: 'WAITING M15...', color: '#6b7280', iteration: 0,
            ema9: '...', ema21: '...', rsi14: '...', atr14: '...',
            upperDoom: '...', lowerDoom: '...'
        };

        // Mengizinkan browser mengakses API ini dari folder luar
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.json({ livePrice, signals, latest: latestSignal });
    } catch (e) { 
        res.status(500).json({ error: e.message }); 
    }
};
