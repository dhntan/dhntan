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

app.get('/api/update', async (req, res) => {
    let currentPrice = 0;
    let brain = await getBrainData();
    await incrementIteration();

    try {
        const response = await axios.get('https://api.coinbase.com/v2/prices/PAXG-USD/spot');
        if (response.data && response.data.data && response.data.data.amount) {
            currentPrice = parseFloat(response.data.data.amount);
        }
    } catch (e) { 
        console.error(e.message); 
    }

    const timeNow = new Date().toLocaleTimeString('id-ID', { timeZone: 'Asia/Jakarta' });

    res.json({
        price: currentPrice > 0 ? currentPrice.toFixed(2) : "0.00",
        time: timeNow,
        iteration: brain.total_errors + 1
    });
});

app.get('/', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>XAUUSD Doomsday Engine M15</title>
            <style>
                table { width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 13px; }
                th, td { padding: 8px; text-align: left; border-bottom: 1px solid #374151; }
                th { color: #f59e0b; font-weight: bold; }
            </style>
        </head>
        <body style="background-color: #0f172a; color: white; font-family: sans-serif; padding: 20px;">
            <div style="max-width: 500px; margin: 0 auto;">
                <h2 style="color: #f59e0b; text-align: center;">🧠 Doomsday Gold Engine v5 (M15)</h2>
                
                <div style="background: #1e293b; padding: 20px; border-radius: 12px; margin-bottom: 15px; border: 1px solid #334155; text-align: center;">
                    <span style="color: #94a3b8; font-size: 14px; font-weight: bold;">XAUUSD / PAXG PRICE (LIVE)</span>
                    <div style="font-size: 32px; font-weight: bold; color: #f8fafc; margin: 5px 0;">$<span id="gold-price">...</span></div>
                    <div style="margin-top: 10px;">
                        <span id="ai-signal" style="padding: 6px 16px; border-radius: 20px; font-weight: bold; font-size: 16px; background: #6b7280; color: white; display: inline-block;">WAITING M15 CANDLE...</span>
                    </div>
                </div>
                
                <div style="background: #1e293b; padding: 15px; border-radius: 12px; font-size: 13px; margin-bottom: 25px; border: 1px solid #334155;">
                    <h4 style="margin-top: 0; color: #38bdf8; border-bottom: 1px solid #334155; padding-bottom: 8px; font-size: 14px;">📊 Indicator Data (M15 Candle Close):</h4>
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
                        Jam Log Pasar: <span id="log-time">...</span> WIB | Cloud Iter: <span id="total-iter">...</span> | Timer Menit: <span id="minutes-countdown" style="color: #eab308; font-weight: bold;">...</span>
                    </div>
                </div>

                <h3 style="color: #f59e0b; margin-bottom: 8px; font-size: 15px;">⚡ Live Sinyal Doomsday History (M15)</h3>
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
                // Penyimpanan history candle M15 lokal
                let priceHistory = JSON.parse(localStorage.getItem('gold_price_series_m15')) || [];
                let signalLog = JSON.parse(localStorage.getItem('gold_doom_history_m15')) || [];
                
                // Penampung harga sementera di dalam rentang 15 menit
                let tempPricesThis15Min = [];

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

                function renderTable() {
                    const tbody = document.getElementById('history-table-body');
                    tbody.innerHTML = '';
                    signalLog.slice().reverse().forEach(item => {
                        const tr = document.createElement('tr');
                        tr.innerHTML = \`
                            <td style="color: #64748b;">\053{item.time}</td>
                            <td style="font-weight: bold; color: #e2e8f0;">$\053{item.price}</td>
                            <td><span style="background: \053{item.color}; padding: 2px 8px; border-radius: 12px; font-size: 11px; font-weight: bold; color: white;">\053{item.signal}</span></td>
                        \`;
                        tbody.appendChild(tr);
                    });
                }

                async function fetchNewData() {
                    try {
                        const res = await fetch('/api/update');
                        const data = await res.json();
                        
                        if (!data.price || data.price === "0.00") return;

                        let currentPrice = parseFloat(data.price);
                        document.getElementById('gold-price').innerText = data.price;
                        document.getElementById('log-time').innerText = data.time;
                        document.getElementById('total-iter').innerText = data.iteration;

                        // Baca waktu lokal untuk mendeteksi penutupan M15
                        const now = new Date();
                        const minutes = now.getMinutes();
                        const seconds = now.getSeconds();

                        // Hitung mundur sisa menit ke candle berikutnya
                        const nextCloseMinutes = 15 - (minutes % 15);
                        document.getElementById('minutes-countdown').innerText = nextCloseMinutes + "m " + (60 - seconds) + "s";

                        // Tabung harga live saat ini
                        tempPricesThis15Min.push(currentPrice);

                        // Trigger penutupan candle setiap menit kelipatan 15 (00, 15, 30, 45) di bawah 10 detik awal
                        if (minutes % 15 === 0 && minutes !== parseInt(localStorage.getItem('last_processed_minute')) && tempPricesThis15Min.length > 5) {
                            
                            // Ambil harga close (detik terakhir sebelum menit kelipatan 15)
                            let closePrice = tempPricesThis15Min[tempPricesThis15Min.length - 1];
                            tempPricesThis15Min = []; // reset penampung harga
                            
                            // Kunci menit ini agar tidak dieksekusi berulang kali pada detik berikutnya
                            localStorage.setItem('last_processed_minute', minutes.toString());

                            // Masukkan ke history data M15
                            priceHistory.push(closePrice);
                            if(priceHistory.length > 50) priceHistory.shift();
                            localStorage.setItem('gold_price_series_m15', JSON.stringify(priceHistory));

                            // Jalankan Kalkulasi Indikator Doomsday
                            let ema9 = calcEMA(priceHistory, 9);
                            let ema21 = calcEMA(priceHistory, 21);
                            let rsi14 = calcRSI(priceHistory, 14);
                            let atr14 = calcATR(priceHistory, 14);

                            let upperDoom = ema9 + (atr14 * 2);
                            let lowerDoom = ema9 - (atr14 * 2);

                            // Perbarui Telemetri Layar
                            document.getElementById('ema-fast').innerText = ema9.toFixed(2);
                            document.getElementById('ema-slow').innerText = ema21.toFixed(2);
                            document.getElementById('rsi-val').innerText = rsi14.toFixed(2);
                            document.getElementById('atr-val').innerText = atr14.toFixed(2);
                            document.getElementById('upper-doom').innerText = upperDoom.toFixed(2);
                            document.getElementById('lower-doom').innerText = lowerDoom.toFixed(2);

                            // Penentuan Sinyal Final Doomsday
                            let signal = 'NEUTRAL';
                            let color = '#6b7280';

                            if (ema9 > ema21 && rsi14 > 55 && closePrice > ema9) {
                                signal = 'BUY 🟢'; color = '#10b981';
                            } else if (ema9 < ema21 && rsi14 < 45 && closePrice < ema9) {
                                signal = 'SELL 🔴'; color = '#ef4444';
                            }

                            if (closePrice > upperDoom) {
                                signal = 'DOOM SELL 🟠'; color = '#f97316';
                            } else if (closePrice < lowerDoom) {
                                signal = 'DOOM BUY 🔵'; color = '#3b82f6';
                            }

                            const signalEl = document.getElementById('ai-signal');
                            signalEl.innerText = signal;
                            signalEl.style.background = color;

                            // Update Tabel Histori
                            const timeLabel = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' }) + ' WIB';
                            signalLog.push({ time: timeLabel, price: closePrice.toFixed(2), signal: signal, color: color });
                            if (signalLog.length > 30) signalLog.shift();
                            localStorage.setItem('gold_doom_history_m15', JSON.stringify(signalLog));
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

                        document.getElementById('upper-doom').innerText = upperDoom.toFixed(2);
                        document.getElementById('lower-doom').innerText = lowerDoom.toFixed(2);

                        // Jalankan Logika Eksekusi Sinyal Doomsday Bapak
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

                        const signalEl = document.getElementById('ai-signal');
                        signalEl.innerText = signal;
                        signalEl.style.background = color;

                        // Simpan ke tabel histori bawah
                        signalLog.push({ time: data.time, price: data.price, signal: signal, color: color });
                        if (signalLog.length > 30) signalLog.shift();
                        localStorage.setItem('gold_doom_history', JSON.stringify(signalLog));
                        renderTable();

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
