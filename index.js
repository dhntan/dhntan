const express = require('express');
const { MongoClient } = require('mongodb');
const axios = require('axios');
const app = express();

const uri = "mongodb+srv://dhntan_db_user:TGHjfpbbNVdLUUXZ@cluster0.h9h6cvs.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";
const client = new MongoClient(uri);

async function getBrainData() {
    try {
        await client.connect();
        const db = client.db('doomsday_bot');
        const collection = db.collection('brain_weights');
        
        let brain = await collection.findOne({ id: "gold_brain" });
        if (!brain) {
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

// Endpoint API internal untuk dipanggil oleh browser secara berkala
app.get('/api/update', async (req, res) => {
    let currentPrice = 0;
    let signal = 'NEUTRAL';
    let brain = await getBrainData();

    try {
        const response = await axios.get('https://api.coinbase.com/v2/prices/PAXG-USD/spot');
        if (response.data && response.data.data && response.data.data.amount) {
            currentPrice = parseFloat(response.data.data.amount);
        }
    } catch (e) { console.error(e.message); }

    if (isNaN(currentPrice) || currentPrice === 0) { currentPrice = 2400.00; }

    let prediction = currentPrice * brain.trend_weight; 
    if (prediction > currentPrice) {
        signal = 'BUY';
        brain.trend_weight += 0.005;
    } else {
        signal = 'SELL';
        brain.momentum_weight += 0.005;
    }

    await updateBrainData({
        trend_weight: brain.trend_weight,
        momentum_weight: brain.momentum_weight,
        total_errors: brain.total_errors + 1
    });

    const timeNow = new Date().toLocaleTimeString('id-ID', { timeZone: 'Asia/Jakarta' });

    res.json({
        price: currentPrice.toFixed(2),
        signal: signal,
        time: timeNow,
        trend: brain.trend_weight.toFixed(4),
        momentum: brain.momentum_weight.toFixed(4),
        iteration: brain.total_errors + 1
    });
});

// Tampilan utama Web
app.get('/', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>XAUUSD Doomsday Tracker</title>
        </head>
        <body style="background-color: #111827; color: white; font-family: sans-serif; padding: 20px;">
            <div style="max-width: 500px; margin: 0 auto;">
                <h2 style="color: #f59e0b;">🧠 Doomsday Intelligence Tracker</h2>
                <div style="background: #1f2937; padding: 15px; border-radius: 8px; margin-bottom: 15px;">
                    <p style="margin: 5px 0; font-size: 16px;">💰 Harga Emas: $<strong id="gold-price">...</strong></p>
                    <p style="margin: 5px 0; font-size: 16px;">🤖 Sinyal AI: <span id="ai-signal" style="padding: 4px 8px; border-radius: 4px; font-weight: bold; background: #6b7280;">LOADING</span></p>
                </div>
                
                <div style="background: #374151; padding: 15px; border-radius: 8px; font-size: 13px;">
                    <h4 style="margin-top: 0; color: #f59e0b; border-bottom: 1px solid #555; padding-bottom: 5px;">📊 Log Evaluasi Otak Robot:</h4>
                    <p>• Jam Log: <span id="log-time">...</span> WIB</p>
                    <p>• Trend Weight: <strong id="trend-w">...</strong></p>
                    <p>• Momentum Weight: <strong id="momentum-w">...</strong></p>
                    <p style="color: #6ee7b7;">• Total Iterasi Belajar: Ke-<span id="total-iter">...</span> kali</p>
                </div>
                <p style="font-size: 11px; color: #9ca3af; text-align: center; margin-top: 20px;">Data otomatis diperbarui dan dipelajari browser setiap 5 detik.</p>
            </div>

            <script>
                async function fetchNewData() {
                    try {
                        const res = await fetch('/api/update');
                        const data = await res.json();
                        
                        document.getElementById('gold-price').innerText = data.price;
                        document.getElementById('log-time').innerText = data.time;
                        document.getElementById('trend-w').innerText = data.trend;
                        document.getElementById('momentum-w').innerText = data.momentum;
                        document.getElementById('total-iter').innerText = data.iteration;
                        
                        const signalEl = document.getElementById('ai-signal');
                        signalEl.innerText = data.signal;
                        signalEl.style.background = data.signal === 'BUY' ? '#10b981' : '#ef4444';
                    } catch (e) { console.error(e); }
                }
                // Pemicu otomatis dari browser HP setiap 5 detik
                setInterval(fetchNewData, 5000);
                fetchNewData();
            </script>
        </body>
        </html>
    `);
});

module.exports = app;
