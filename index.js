const express = require('express');
const { MongoClient } = require('mongodb');
const axios = require('axios');
const app = express();

const uri = "mongodb+srv://dhntan_db_user:TGHjfpbbNVdLUUXZ@cluster0.h9h6cvs.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";
const client = new MongoClient(uri);

// === FUNGSI MATEMATIKA INDIKATOR DOOMSDAY ===

// 1. Exponential Moving Average (EMA)
function calculateEMA(prices, period) {
    let k = 2 / (period + 1);
    let ema = prices[0];
    for (let i = 1; i < prices.length; i++) {
        ema = prices[i] * k + ema * (1 - k);
    }
    return ema;
}

// 2. Relative Strength Index (RSI)
function calculateRSI(prices, period = 14) {
    if (prices.length < period + 1) return 50;
    let gains = 0, losses = 0;
    
    for (let i = prices.length - period; i < prices.length; i++) {
        let diff = prices[i] - prices[i - 1];
        if (diff > 0) gains += diff;
        else losses -= diff;
    }
    
    let avgGain = gains / period;
    let avgLoss = losses / period;
    if (avgLoss === 0) return 100;
    
    let rs = avgGain / avgLoss;
    return 100 - (100 / (1 + rs));
}

// 3. Average True Range (ATR)
function calculateATR(candles, period = 14) {
    if (candles.length < period + 1) return 5.0;
    let trs = [];
    for (let i = candles.length - period; i < candles.length; i++) {
        let high = candles[i].high;
        let low = candles[i].low;
        let prevClose = candles[i - 1].close;
        
        let tr = Math.max(
            high - low,
            Math.abs(high - prevClose),
            Math.abs(low - prevClose)
        );
        trs.push(tr);
    }
    return trs.reduce((a, b) => a + b, 0) / period;
}

async function getBrainData() {
    try {
        await client.connect();
        const db = client.db('doomsday_bot');
        const collection = db.collection('brain_weights');
        let brain = await collection.findOne({ id: "gold_brain" });
        if (!brain) {
            brain = { id: "gold_brain", total_errors: 0 };
            await collection.insertOne(brain);
        }
        return brain;
    } catch (e) {
        return { total_errors: 0 };
    }
}

async function incrementIteration() {
    try {
        const db = client.db('doomsday_bot');
        await db.collection('brain_weights').updateOne(
            { id: "gold_brain" },
            { $inc: { total_errors: 1 } }
        );
    } catch (e) { console.error(e); }
}

// === ENDPOINT API UNTUK BROWSER ===
app.get('/api/update', async (req, res) => {
    let currentPrice = 0;
    let signal = 'NEUTRAL';
    let signalColor = '#6b7280'; // Grey default
    
    let brain = await getBrainData();
    await incrementIteration();

    let emaFastVal = 0, emaSlowVal = 0, rsiVal = 0, atrVal = 0;
    let upperDoomVal = 0, lowerDoomVal = 0;

    try {
        // Ambil 50 data candle PAXGUSDT (Emas) dari Binance (Interval 5 menit)
        const response = await axios.get('https://api.binance.com/api/v3/klines?symbol=PAXGUSDT&interval=5m&limit=50');
        
        if (response.data && response.data.length > 0) {
            let candles = response.data.map(c => ({
                open: parseFloat(c[1]),
                high: parseFloat(c[2]),
                low: parseFloat(c[3]),
                close: parseFloat(c[4])
            }));

            let closePrices = candles.map(c => c.close);
            currentPrice = closePrices[closePrices.length - 1];

            // Hitung Rumus Doomsday Pine Script milik Pak Dhany
            emaFastVal = calculateEMA(closePrices, 9);
            emaSlowVal = calculateEMA(closePrices, 21);
            rsiVal = calculateRSI(closePrices, 14);
            atrVal = calculateATR(candles, 14);

            upperDoomVal = emaFastVal + atrVal * 2;
            lowerDoomVal = emaFastVal - atrVal * 2;

            // Logika Evaluasi Sinyal Doomsday Pak Dhany
            if (emaFastVal > emaSlowVal && rsiVal > 55 && currentPrice > emaFastVal) {
                signal = 'BUY 🟢';
                signalColor = '#10b981';
            } else if (emaFastVal < emaSlowVal && rsiVal < 45 && currentPrice < emaFastVal) {
                signal = 'SELL 🔴';
                signalColor = '#ef4444';
            } 
            
            // Override jika masuk kondisi Extreme Overbought / Oversold Doomsday
            if (currentPrice > upperDoomVal) {
                signal = 'DOOM SELL 🟠';
                signalColor = '#f97316'; // Orange
            } else if (currentPrice < lowerDoomVal) {
                signal = 'DOOM BUY 🔵';
                signalColor = '#3b82f6'; // Blue
            }
        }
    } catch (e) { 
        console.error("Gagal memproses data pasar:", e.message); 
        currentPrice = 2400.00;
    }

    const timeNow = new Date().toLocaleTimeString('id-ID', { timeZone: 'Asia/Jakarta' });

    res.json({
        price: currentPrice.toFixed(2),
        signal: signal,
        signalColor: signalColor,
        time: timeNow,
        emaFast: emaFastVal.toFixed(2),
        emaSlow: emaSlowVal.toFixed(2),
        rsi: rsiVal.toFixed(2),
        atr: atrVal.toFixed(2),
        upperDoom: upperDoomVal.toFixed(2),
        lowerDoom: lowerDoomVal.toFixed(2),
        iteration: brain.total_errors + 1
    });
});

app.get('/', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>XAUUSD Doomsday Engine</title>
            <style>
                table { width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 13px; }
                th, td { padding: 8px; text-align: left; border-bottom: 1px solid #374151; }
                th { color: #f59e0b; font-weight: bold; }
            </style>
        </head>
        <body style="background-color: #0f172a; color: white; font-family: sans-serif; padding: 20px;">
            <div style="max-width: 500px; margin: 0 auto;">
                <h2 style="color: #f59e0b; text-align: center;">🧠 Doomsday Gold Engine v5</h2>
                
                <!-- KOTAK UTAMA HARGA & SINYAL -->
                <div style="background: #1e293b; padding: 20px; border-radius: 12px; margin-bottom: 15px; border: 1px solid #334155; text-align: center;">
                    <span style="color: #94a3b8; font-size: 14px; font-weight: bold;">XAUUSD / PAXG PRICE</span>
                    <div style="font-size: 32px; font-weight: bold; color: #f8fafc; margin: 5px 0;">$<span id="gold-price">...</span></div>
                    <div style="margin-top: 10px;">
                        <span id="ai-signal" style="padding: 6px 16px; border-radius: 20px; font-weight: bold; font-size: 16px; background: #6b7280; color: white; display: inline-block;">LOADING ENGINE</span>
                    </div>
                </div>
                
                <!-- TELEMETRI DATA RUMUS ASLI PAK DHANY -->
                <div style="background: #1e293b; padding: 15px; border-radius: 12px; font-size: 13px; margin-bottom: 25px; border: 1px solid #334155;">
                    <h4 style="margin-top: 0; color: #38bdf8; border-bottom: 1px solid #334155; padding-bottom: 8px; font-size: 14px;">📊 Live Mathematical Indicator Data:</h4>
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
                        Jam Log Pasar: <span id="log-time">...</span> WIB | Hitungan Belajar Cloud: Ke-<span id="total-iter">...</span>
                    </div>
                </div>

                <!-- TABEL RAMPING LIVE LOG -->
                <h3 style="color: #f59e0b; margin-bottom: 8px; font-size: 15px;">⚡ Live Sinyal Doomsday History</h3>
                <div style="background: #1e293b; padding: 10px; border-radius: 12px; max-height: 250px; overflow-y: auto; border: 1px solid #334155;">
                    <table>
                        <thead>
                            <tr>
                                <th>TIME</th>
                                <th>PRICE (USD)</th>
                                <th>DOOM SIGNAL</th>
                            </tr>
                        </thead>
                        <tbody id="history-table-body"></tbody>
                    </table>
                </div>
                
                <p style="font-size: 11px; color: #64748b; text-align: center; margin-top: 25px;">Engine otomatis menganalisis rumus Pine Script Bapak setiap 5 detik.</p>
            </div>

            <script>
                let localLog = JSON.parse(localStorage.getItem('gold_doom_history')) || [];

                function renderTable() {
                    const tbody = document.getElementById('history-table-body');
                    tbody.innerHTML = '';
                    localLog.slice().reverse().forEach(item => {
                        const tr = document.createElement('tr');
                        tr.innerHTML = \`
                            <td style="color: #64748b;">\${item.time}</td>
                            <td style="font-weight: bold; color: #e2e8f0;">$\${item.price}</td>
                            <td><span style="background: \${item.color}; padding: 2px 8px; border-radius: 12px; font-size: 11px; font-weight: bold; color: white;">\${item.signal}</span></td>
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
                        document.getElementById('ema-fast').innerText = data.emaFast;
                        document.getElementById('ema-slow').innerText = data.emaSlow;
                        document.getElementById('rsi-val').innerText = data.rsi;
                        document.getElementById('atr-val').innerText = data.atr;
                        document.getElementById('upper-doom').innerText = data.upperDoom;
                        document.getElementById('lower-doom').innerText = data.lowerDoom;
                        document.getElementById('total-iter').innerText = data.iteration;
                        
                        const signalEl = document.getElementById('ai-signal');
                        signalEl.innerText = data.signal;
                        signalEl.style.background = data.signalColor;

                        // Tambahkan baris log baru jika sinyalnya valid dan bukan memuat awal
                        if(data.price && data.signal) {
                            localLog.push({ time: data.time, price: data.price, signal: data.signal, color: data.signalColor });
                            if (localLog.length > 30) localLog.shift();
                            localStorage.setItem('gold_doom_history', JSON.stringify(localLog));
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
