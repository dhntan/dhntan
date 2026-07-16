const { MongoClient } = require('mongodb');

const uri = "mongodb+srv://dhntan_db_user:TGHjfpbbNVdLUUXZ@cluster0.h9h6cvs.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";
const client = new MongoClient(uri);

module.exports = async (req, res) => {
    // Pengaman header agar bisa diakses dashboard dan kebal cache browser
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'no-shadow, no-cache, must-revalidate, proxy-revalidate');

    try {
        await client.connect();
        const db = client.db('doomsday_bot');
        const signalCol = db.collection('signal_history_m15');

        // Ambil 20 data terakhir, diurutkan dari yang paling BARU (timestamp: -1)
        const historyData = await signalCol
            .find({})
            .sort({ timestamp: -1 })
            .limit(20)
            .toArray();

        // Kirim data ke dashboard
        res.status(200).json(historyData);

    } catch (globalErr) {
        console.error("Error API Data:", globalErr.message);
        res.status(500).json({ success: false, error: globalErr.message });
    } finally {
        await client.close();
    }
};
