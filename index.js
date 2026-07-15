const express = require('express');
const { MongoClient } = require('mongodb');
const axios = require('axios');
const app = express();

const uri = "mongodb+srv://dhntan_db_user:TGHjfpbbNVdLUUXZ@cluster0.h9h6cvs.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";
const client = new MongoClient(uri);

// Fungsi bantu kalkulasi indikator di server
function calcEMA(data, period) {
    if(data.length === 0) return 0;
    let k = 2 / (period + 1);
    let ema = data[0];
    for (let i = 1; i < data.length; i++) { ema = data[i] * k + ema * (1 - k); }
    return ema;
}

function calcRSI(data, period = 14) {
    if (data.length < period + 1) return 50;
    let gains = 0, losses = 0;
    for (let i = data.length - period; i < data.length; i++) {
        let diff = data[i] - data[i - 1];
        if (diff > 0) gains += diff; else losses -= diff;
    }
    let rs = (gains / period) / ((losses / period) || 1);
    return 100 - (100 / (1 + rs));
}

function calcATR(prices, period = 14) {
    if(prices.length < 2) return 2.5;
    let trs = [];
    let start = Math.max(1, prices.length - period);
    for(let i = start; i < prices.length; i++){
        trs.push(Math.abs(prices[i] - prices[i-1]));
    }
    return trs.reduce((a,b)=>a+b, 0) / (trs.length || 1);
}

// 1. ENDPOINT CRON (Dijalankan otomatis oleh Vercel setiap 15 menit)
app.get('/api/cron', async (req, res) => {
    try {
        await client.connect();
        const db = client.db('doomsday_bot');
        const priceCol = db.collection('price_history_m15');
        const signalCol = db.collection('signal_history_m15');

        // Ambil harga terbaru dari Coinbase
        const response = await axios.get('https://api.coinbase.com/v2/prices/PAXG-USD/spot');
        if (!response.data || !response.data.data || !response.data.data.amount) {
            return res.status(500).send("Gagal mengambil harga");
        }
        const currentPrice = parseFloat(response.data.data.amount);

        // Simpan harga baru ke histori harga MongoDB
        const timeNow = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' }) + ' WIB';
        await priceCol.insertOne({ price: currentPrice, timestamp: new Date() });

        // Ambil 50 data harga terakhir untuk kalkulasi rumus
        const recentPricesDoc = await priceCol.find().sort({ timestamp: -1 }).limit(50).toArray();
        const priceSeries = recentPricesDoc.reverse().map(d => d.price);

        // Hitung Indikator Doomsday di Server
        const ema9 = calcEMA(priceSeries, 9);
        const ema21 = calcEMA(priceSeries, 21);
        const rsi14 = calcRSI(priceSeries, 14);
        const atr14 = calcATR(priceSeries, 14);

        const upperDoom = ema9 + (atr14 * 2);
        const lowerDoom = ema9 - (atr14 * 2);

        // Tentukan Sinyal
        let signal = 'NEUTRAL';
        let color = '#6b7280';

        if (ema9 > ema21 && rsi14 > 55 && currentPrice > ema9) {
            signal = 'BUY 🟢'; color = '#10b981';
        } else if (ema9 < ema21 && rsi14 < 45 && currentPrice < ema9) {
            signal = 'SELL 🔴'; color = '#ef4444';
        }

        if (currentPrice > upperDoom) {
            signal = 'DOOM SELL 🟠'; color = '#f97316';
        } else if (currentPrice < lowerDoom) {
            signal = 'DOOM BUY 🔵'; color = '#3b82f6';
        }

        // Simpan sinyal final beserta nilai metrik ke database MongoDB
        const logData = {
            time: timeNow,
            price: currentPrice.toFixed(2),
            signal: signal,
            color: color,
            ema9: ema9.toFixed(2),
            ema21: ema21.toFixed(2),
            rsi14: rsi14.toFixed(2),
            atr14: atr14.toFixed(2),
            upperDoom: upperDoom.toFixed(2),
            lowerDoom: lowerDoom.toFixed(2),
            timestamp: new Date()
        };
        await signalCol.insertOne(logData);

        // Batasi histori sinyal di database biar tidak bengkak (simpan 100 data terakhir)
        const totalSignals = await signalCol.countDocuments();
        if (totalSignals > 100) {
            const oldest = await signalCol.find().sort({ timestamp: 1 }).limit(totalSignals - 100).toArray();
            const idsToDelete = oldest.map(d => d._id);
            await signalCol.deleteMany({ _id: { $in: idsToDelete } });
        }

        res.json({ status: "success", logged: logData });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// 2. ENDPOINT API UNTUK HALAMAN DEPAN
app.get('/api/data', async (req, res) => {
    try {
        await client.connect();
        const db = client.db('doomsday_bot');
        const signalCol = db.collection('signal_history_m15');
        
        // Ambil harga live instan
        let livePrice = "0.00";
        try {
            const response = await axios.get('https://api.coinbase.com/v2/prices/PAXG-USD/spot');
            livePrice = parseFloat(response.data.data.amount).toFixed(2);
        } catch(err) { console.error(err); }

        // Ambil histori sinyal terakhir dari MongoDB
        const signals = await signalCol.find().sort({ timestamp: -1 }).limit(30).toArray();
        const latestSignal = signals[0] || {
            signal: 'WAITING M15...', color: '#6b7280', 
            ema9: '...', ema21: '...', rsi14: '...', atr14: '...',
            upperDoom: '...', lowerDoom: '...'
        };

        res.json({
            livePrice: livePrice,
            signals: signals,
            latest: latestSignal
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// 3. TAMPILAN DASHBOARD UTAMA (Hanya bertugas menampilkan data dari MongoDB)
app.get('/', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>XAUUSD Doomsday Engine M15 Cloud</title>
            <style>
                table { width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 13px; }
                th, td { padding: 8px; text-align: left; border-bottom: 1px solid #374151; }
                th { color: #f59e0b; font-weight: bold; }
            </style>
        </head>
        <body style="background-color: #0f172a; color: white; font-family: sans-serif; padding: 20px;">
            <div style="max-width: 500px; margin: 0 auto;">
                <h2 style="color: #f59e0b; text-align: center;">🧠 Doomsday Gold Engine v5 (M15-Cloud)</h2>
                
                <div style="background: #1e293b; padding: 20px; border-radius: 12px; margin-bottom: 15px; border: 1px solid #334155; text-align: center;">
                    <span style="color: #94a3b8; font-size: 14px; font-weight: bold;">XAUUSD / PAXG PRICE (LIVE)</span>
                    <div style="font-size: 32px; font-weight: bold; color: #f8fafc; margin: 5px 0;">$<span id="gold-price">...</span></div>
                    <div style="margin-top: 10px;">
                        <span id="ai-signal" style="padding: 6px 16px; border-radius: 20px; font-weight: bold; font-size: 16px; background: #6b7280; color: white; display: inline-block;">LOADING...</span>
                    </div>
                </div>
                
                <div style="background: #1e293b; padding: 15px; border-radius: 12px; font-size: 13px; margin-bottom: 25px; border: 1px solid #334155;">
                    <h4 style="margin-top: 0; color: #38bdf8; border-bottom: 1px solid #334155; padding-bottom: 8px; font-size: 14px;">📊 Live Database Indicator (M15 Candle Close):</h4>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; padding: 5px 0;">
                        <div>• EMA Fast (9): <strong id="ema-fast" style="color: #f43f5e;">...</strong></div>
                        <div>• EMA Slow (21): <strong id="ema-slow" style="color: #ec4899;">...</strong></div>
                        <div>• RSI (14): <strong id="rsi-val" style="color: #a855f7;">...</strong></div>
                        <div>• ATR (14): <strong id="atr-val" style="color: #eab308;">...</strong></div>
                    </div>
                    <div style="border-top: 1px dashed #334155; margin-top: 8px; padding-top: 8px;">
                        <p style="margin: 3px 0; color: #f97316;">🔥 Upper Doom Band: <strong id="upper-doom">...</strong></p>
                        <p style="margin: 3px 0; color: #3b82f6;">💧 Lower Doom Band: <strong id="lower-doom">...</strong></p>
                    </div>
                    <div style="border-top: 1px solid #334155; margin-top: 8px; padding-top: 8px; font-size: 11px; color: #64748b;">
                        Update Sinyal Terakhir: <span id="last-update-time">...</span> | Timer Menit: <span id="minutes-countdown" style="color: #eab308; font-weight: bold;">...</span>
                    </div>
                </div>

                <h3 style="color: #f59e0b; margin-bottom: 8px; font-size: 15px;">⚡ Live Sinyal Doomsday History (M15-MongoDB)</h3>
                <div style="background: #1e293b; padding: 10px; border-radius: 12px; max-height: 250px; overflow-y: auto; border: 1px solid #334155;">
                    <table>
                        <thead>
                            <tr>
                                <th>TIME</th>
                                <th>CLOSE PRICE (USD)</th>
                                <th>DOOM SIGNAL</th>
                            </tr>
                        </thead>
                        <tbody id="history-table-body"></tbody>
                    </table>
                </div>
            </div>

            <script>
                async function refreshDashboard() {
                    try {
                        const res = await fetch('/api/data');
                        const data = await res.json();

                        // Update Harga Live
                        document.getElementById('gold-price').innerText = data.livePrice;

                        // Update Data Indikator Terakhir dari Database
                        const latest = data.latest;
                        document.getElementById('ema-fast').innerText = latest.ema9 || '...';
                        document.getElementById('ema-slow').innerText = latest.ema21 || '...';
                        document.getElementById('rsi-val').innerText = latest.rsi14 || '...';
                        document.getElementById('atr-val').innerText = latest.atr14 || '...';
                        document.getElementById('upper-doom').innerText = latest.upperDoom || '...';
                        document.getElementById('lower-doom').innerText = latest.lowerDoom || '...';
                        document.getElementById('last-update-time').innerText = latest.time || '...';

                        const signalEl = document.getElementById('ai-signal');
                        signalEl.innerText = latest.signal || 'WAITING...';
                        signalEl.style.background = latest.color || '#6b7280';

                        // Render Tabel Sinyal dari Database
                        const tbody = document.getElementById('history-table-body');
                        tbody.innerHTML = '';
                        data.signals.forEach(item => {
                            const tr = document.createElement('tr');
                            tr.innerHTML = ' \
                                <td style="color: #64748b;">' + item.time + '</td> \
                                <td style="font-weight: bold; color: #e2e8f0;">$' + item.price + '</td> \
                                <td><span style="background: ' + item.color + '; padding: 2px 8px; border-radius: 12px; font-size: 11px; font-weight: bold; color: white;">' + item.signal + '</span></td> \
                            ';
                            tbody.appendChild(tr);
                        });

                        // Hitung mundur waktu ke menit kelipatan 15 berikutnya
                        const now = new Date();
                        const minutes = now.getMinutes();
                        const seconds = now.getSeconds();
                        const nextCloseMinutes = 15 - (minutes % 15);
                        document.getElementById('minutes-countdown').innerText = nextCloseMinutes + "m " + (60 - seconds) + "s";

                    } catch (e) { console.error(e); }
                }

                // Ambil data baru setiap 5 detik agar harga dan timer selalu update
                setInterval(refreshDashboard, 5000);
                refreshDashboard();
            </script>
        </body>
        </html>
    `);
});

module.exports = app;
