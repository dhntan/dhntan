const express = require('express');
const { MongoClient } = require('mongodb');
const axios = require('axios');
const app = express();

// Link koneksi resmi MongoDB milik Pak Dhany
const uri = "mongodb+srv://dhntan_db_user:TGHjfpbbNVdLUUXZ@cluster0.h9h6cvs.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";
const client = new MongoClient(uri);

async function getBrainData() {
    try {
        await client.connect();
        const db = client.db('doomsday_bot');
        const collection = db.collection('brain_weights');
        
        let brain = await collection.findOne({ id: "gold_brain" });
        if (!brain) {
            // Modal awal kecerdasan bot jika database masih kosong
            brain = { id: "gold_brain", trend_weight: 0.5, momentum_weight: 0.5, total_errors: 0 };
            await collection.insertOne(brain);
        }
        return brain;
    } catch (e) {
        console.error("Gagal konek database:", e);
        return { trend_weight: 0.5, momentum_weight: 0.5, total_errors: 0 };
    }
}

async function updateBrainData(newWeights) {
    try {
        const db = client.db('doomsday_bot');
        await db.collection('brain_weights').updateOne(
            { id: "gold_brain" },
            { $set: newWeights }
        );
    } catch (e) { console.error("Gagal simpan ingatan:", e); }
}

app.get('/', async (req, res) => {
    let currentPrice = 0;
    let signal = 'NEUTRAL';

    // 1. Ambil Ingatan Lama dari Database MongoDB
    let brain = await getBrainData();

    try {
        // 2. Ambil harga emas terbaru via Coinbase
        const response = await axios.get('https://api.coinbase.com/v2/prices/PAXG-USD/spot');
        currentPrice = parseFloat(response.data.amount);
    } catch (e) { console.error("Gagal ambil harga emas:", e.message); }

    // 3. PROSES BELAJAR (Feedback Loop)
    let prediction = currentPrice * brain.trend_weight; 
    
    if (prediction > currentPrice) {
        signal = 'BUY';
        brain.trend_weight += 0.005; // Menyesuaikan bobot otomatis
    } else {
        signal = 'SELL';
        brain.momentum_weight += 0.005; // Menyesuaikan bobot otomatis
    }

    // 4. Simpan tingkat kecerdasan baru ke database agar tidak amnesia
    await updateBrainData({
        trend_weight: brain.trend_weight,
        momentum_weight: brain.momentum_weight,
        total_errors: brain.total_errors + 1
    });

    const timeNow = new Date().toLocaleTimeString('id-ID', { timeZone: 'Asia/Jakarta' });

    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>XAUUSD Smart Tracker</title>
        </head>
        <body style="background-color: #111827; color: white; font-family: sans-serif; padding: 20px;">
            <div style="max-width: 500px; margin: 0 auto;">
                <h2 style="color: #f59e0b;">🧠 Doomsday Intelligence Tracker</h2>
                <div style="background: #1f2937; padding: 15px; border-radius: 8px; margin-bottom: 15px;">
                    <p style="margin: 5px 0; font-size: 16px;">💰 Harga Emas: <strong>$${currentPrice.toFixed(2)}</strong></p>
                    <p style="margin: 5px 0; font-size: 16px;">🤖 Sinyal AI: <span style="background: ${signal === 'BUY' ? '#10b981' : '#ef4444'}; padding: 4px 8px; border-radius: 4px; font-weight: bold;">${signal}</span></p>
                </div>
                
                <div style="background: #374151; padding: 15px; border-radius: 8px; font-size: 13px;">
                    <h4 style="margin-top: 0; color: #f59e0b; border-bottom: 1px solid #555; padding-bottom: 5px;">📊 Log Evaluasi Otak Robot:</h4>
                    <p>• Jam Log: ${timeNow} WIB</p>
                    <p>• Trend Weight: <strong>${brain.trend_weight.toFixed(4)}</strong></p>
                    <p>• Momentum Weight: <strong>${brain.momentum_weight.toFixed(4)}</strong></p>
                    <p style="color: #6ee7b7;">• Total Iterasi Belajar: Ke-${brain.total_errors} kali</p>
                </div>
                <p style="font-size: 11px; color: #9ca3af; text-align: center; margin-top: 20px;">Kecerdasan meningkat setiap kali halaman ini dipicu oleh UptimeRobot.</p>
            </div>
        </body>
        </html>
    `);
});

module.exports = app;
