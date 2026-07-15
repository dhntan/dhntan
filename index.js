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

app.get('/api/update', async (req, res) => {
    let currentPrice = 0;
    let signal = 'NEUTRAL';
    let signalColor = '#6b7280'; // Abu-abu default
    let brain = await getBrainData();

    try {
        // Kembali ke penarikan harga Coinbase awal yang sudah sukses
        const response = await axios.get('https://api.coinbase.com/v2/prices/PAXG-USD/spot');
        if (response.data && response.data.data && response.data.data.amount) {
            currentPrice = parseFloat(response.data.data.amount);
        }
    } catch (e) { console.error(e.message); }

    if (isNaN(currentPrice) || currentPrice === 0) { currentPrice = 2400.00; }

    // === RUMUS DOOMSDAY UTAMA YANG DISESUAIKAN ===
    // Menggunakan variabel kontrol database Bapak untuk menentukan ambang batas sinyal
    let upperDoom = currentPrice * (1 + (brain.momentum_weight - 0.5)); 
    let lowerDoom = currentPrice * (1 - (brain.trend_weight - 0.5));

    // Eksekusi logika berdasarkan indikator Doomsday Bapak
    if (currentPrice > upperDoom) {
        signal = 'DOOM SELL 🟠';
        signalColor = '#f97316'; // Orange
        brain.momentum_weight += 0.005; // Menyesuaikan bobot otomatis
    } else if (currentPrice < lowerDoom) {
        signal = 'DOOM BUY 🔵';
        signalColor = '#3b82f6'; // Blue
        brain.trend_weight += 0.005; // Menyesuaikan bobot otomatis
    } else {
        // Sinyal tren standar berdasar kalkulasi bobot saat ini
        if (brain.trend_weight > brain.momentum_weight) {
            signal = 'BUY 🟢';
            signalColor = '#10b981'; // Hijau
        } else {
            signal = 'SELL 🔴';
            signalColor = '#ef4444'; // Merah
        }
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
        color: signalColor,
        time: timeNow,
        trend: brain.trend_weight.toFixed(4),
        momentum: brain.momentum_weight.toFixed(4),
        iteration: brain.total_errors + 1
    });
});

app.get('/', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>XAUUSD Doomsday Tracker</title>
            <style>
                table { width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 13px; }
                th, td { padding: 8px; text-align: left; border-bottom: 1px solid #374151; }
                th { color: #f59e0b; font-weight: bold; }
            </style>
        </head>
        <body style="background-color: #111827; color: white; font-family: sans-serif; padding: 20px;">
            <div style="max-width: 500px; margin: 0 auto;">
                <h2 style="color: #f59e0b;">🧠 Doomsday Intelligence Tracker</h2>
                
                <div style="background: #1f2937; padding: 15px; border-radius: 8px; margin-bottom: 15px;">
                    <p style="margin: 5px 0; font-size: 16px;">💰 Harga Emas: $<strong id="gold-price">...</strong></p>
                    <p style="margin: 5px 0; font-size: 16px;">🤖 Sinyal AI: <span id="ai-signal" style="padding: 4px 8px; border-radius: 4px; font-weight: bold; background: #6b7280; color: white;">LOADING</span></p>
                </div>
                
                <div style="background: #374151; padding: 15px; border-radius: 8px; font-size: 13px; margin-bottom: 25px;">
                    <h4 style="margin-top: 0; color: #f59e0b; border-bottom: 1px solid #555; padding-bottom: 5px;">📊 Log Evaluasi Otak Robot:</h4>
                    <p>• Jam Log: <span id="log-time">...</span> WIB</p>
                    <p>• Trend Weight: <strong id="trend-w">...</strong></p>
                    <p>• Momentum Weight: <strong id="momentum-w">...</strong></p>
                    <p style="color: #6ee7b7;">• Total Iterasi Belajar: Ke-<span id="total-iter">...</span> kali</p>
                </div>

                <h3 style="color: #f59e0b; margin-bottom: 5px;">⚡ Live Tracker History</h3>
                <div style="background: #1f2937; padding: 10px; border-radius: 8px; max-height: 300px; overflow-y: auto;">
                    <table>
                        <thead>
                            <tr>
                                <th>TIME</th>
                                <th>PRICE (USD)</th>
                                <th>SIGNAL</th>
                            </tr>
                        </thead>
                        <tbody id="history-table-body"></tbody>
                    </table>
                </div>
                
                <p style="font-size: 11px; color: #9ca3af; text-align: center; margin-top: 20px;">Data otomatis diperbarui dan dipelajari browser setiap 5 detik.</p>
            </div>

            <script>
                let localLog = JSON.parse(localStorage.getItem('gold_log_history')) || [];

                function renderTable() {
                    const tbody = document.getElementById('history-table-body');
                    tbody.innerHTML = '';
                    localLog.slice().reverse().forEach(item => {
                        const tr = document.createElement('tr');
                        tr.innerHTML = \`
                            <td style="color: #9ca3af;">\${item.time}</td>
                            <td style="font-weight: bold;">$\${item.price}</td>
                            <td><span style="background: \${item.color}; padding: 2px 6px; border-radius: 4px; font-size: 11px; font-weight: bold; color: white;">\${item.signal}</span></td>
                        \`;
                        tbody.appendChild(tr);
                    });
                }

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
                        signalEl.style.background = data.color;

                        if (data.price) {
                            localLog.push({ time: data.time, price: data.price, signal: data.signal, color: data.color });
                            if (localLog.length > 50) localLog.shift();
                            localStorage.setItem('gold_log_history', JSON.stringify(localLog));
                            renderTable();
                        }
                    } catch (e) { console.error(e); }
                }

                renderTable();
                setInterval(fetchNewData, 5000);
                fetchNewData();
            </script>
        </body>
        </html>
    `);
});

module.exports = app;
