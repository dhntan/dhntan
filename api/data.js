const { MongoClient } = require('mongodb');

const uri = "mongodb+srv://dhntan_db_user:TGHjfpbbNVdLUUXZ@cluster0.h9h6cvs.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";
const client = new MongoClient(uri);

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');

    try {
        await client.connect();
        const db = client.db('doomsday_bot');
        const signalCol = db.collection('signal_history_m15');

        // Ambil 20 data terbaru, urutkan dari yang paling baru
        const historyData = await signalCol
            .find({})
            .sort({ timestamp: -1 })
            .limit(20)
            .toArray();

        // JURUS AMAN: Jika frontend minta array langsung, atau minta objek ber-property .data,
        // kita gabungkan formatnya dengan Object.assign supaya dua-duanya valid!
        const safeResponse = Object.assign([...historyData], {
            success: true,
            data: historyData
        });

        res.status(200).json(safeResponse);

    } catch (globalErr) {
        console.error("Error API Data:", globalErr.message);
        res.status(500).json({ success: false, error: globalErr.message });
    } finally {
        await client.close();
    }
};
