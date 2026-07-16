const { MongoClient } = require('mongodb');

// Menggunakan koneksi langsung tanpa dependensi rumit
const uri = "mongodb+srv://dhntan_db_user:TGHjfpbbNVdLUUXZ@cluster0.h9h6cvs.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";

export default async function handler(req, res) {
    try {
        const client = await new MongoClient(uri).connect();
        const db = client.db('doomsday_bot');
        
        // Pembeda agar tahu ini kode baru
        return res.status(200).json({ 
            success: true, 
            message: "SISTEM_BERHASIL_RESET_KE_PAGES", 
            timestamp: Date.now() 
        });
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
}
