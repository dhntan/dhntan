const { MongoClient } = require('mongodb');

const uri = "mongodb+srv://dhntan_db_user:TGHjfpbbNVdLUUXZ@cluster0.h9h6cvs.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";
const client = new MongoClient(uri);

module.exports = async (req, res) => {
    // Header pengaman & anti-cache
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');

    try {
        await client.connect();
        const db = client.db('doomsday_bot');
        const signalCol = db.collection('signal_history_m15');

        // Ambil 20 data terakhir dari database, urutkan dari yang paling baru
        const historyData = await signalCol
            .find({})
            .sort({ timestamp: -1 })
            .limit(20)
            .toArray();

        // KUNCI COCOK: Bungkus data sesuai struktur yang diminta oleh index.js Bapak
        const latestRecord = historyData[0] || {};
        const livePriceData = latestRecord.closePrice || '...';

        res.status(200).json({
            success: true,
            livePrice: livePriceData,
            latest: latestRecord,
            signals: historyData
        });

    } catch (globalErr) {
        console.error("Error API Data:", globalErr.message);
        res.status(500).json({ success: false, error: globalErr.message });
    } finally {
        await client.close();
    }
};
