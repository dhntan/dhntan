const { MongoClient } = require('mongodb');

const uri = "mongodb+srv://dhntan_db_user:TGHjfpbbNVdLUUXZ@cluster0.h9h6cvs.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";
let cachedClient = null;

async function connectToDatabase() {
    if (cachedClient) {
        return cachedClient;
    }
    const client = new MongoClient(uri);
    await client.connect();
    cachedClient = client;
    return client;
}

module.exports = async (req, res) => {
    // Header anti-cache ketat agar data selalu fresh
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    try {
        const client = await connectToDatabase();
        const db = client.db('doomsday_bot');
        const signalCol = db.collection('signal_history_m15');

        // PERBAIKAN UTAMA: Urutkan berdasarkan _id: -1 (Pasti mengambil data paling BARU masuk ke database)
        const historyData = await signalCol
            .find({})
            .sort({ _id: -1 })
            .limit(20)
            .toArray();

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
    }
};
