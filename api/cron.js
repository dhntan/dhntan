const { MongoClient } = require('mongodb');
const axios = require('axios');

// Konfigurasi MongoDB & Gemini API
const uri = "mongodb+srv://dhntan_db_user:TGHjfpbbNVdLUUXZ@cluster0.h9h6cvs.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";
const GEMINI_API_KEY = "AQ.Ab8RN6LVPwYyy_NwI_km2Mi8VxvI_dWWnbVgt7bwInkYygqRUg" // <-- PASTIKAN MASUKKAN API KEY GEMINI BAPAK DI SINI

const client = new MongoClient(uri);

// Fungsi Indikator Matematika Dasar
function calcEMA(data, period) {
    if (data.length < period) return NaN;
    const k = 2 / (period + 1);
    let ema = data[0];
    for (let i = 1; i < data.length; i++) {
        ema = data[i] * k + ema * (1 - k);
    }
    return ema;
}

function calcRSI(data, period = 14) {
    if (data.length < period + 1) return NaN;
    let gains = 0, losses = 0;
    for (let i = 1; i <= period; i++) {
        const diff = data[i] - data[i - 1];
        if (diff > 0) gains += diff;
        else losses -= Math.abs(diff);
    }
    let avgGain = gains / period;
    let avgLoss = losses / period;
    for (let i = period + 1; i < data.length; i++) {
        const diff = data[i] - data[i - 1];
        if (diff > 0) {
            avgGain = (avgGain * 13 + diff) / 14;
            avgLoss = (avgLoss * 13) / 14;
        } else {
            avgGain = (avgGain * 13) / 14;
            avgLoss = (avgLoss * 13 + Math.abs(diff)) / 14;
        }
    }
    if (avgLoss === 0) return 100;
    const rs = avgGain / avgLoss;
    return 100 - (100 / (1 + rs));
}

function calcATR(highs, lows, closes, period = 14) {
    if (closes.length < period + 1) return NaN;
    let trs = [];
    for (let i = 1; i < closes.length; i++) {
        const h_l = highs[i] - lows[i];
        const h_pc = Math.abs(highs[i] - closes[i - 1]);
        const l_pc = Math.abs(lows[i] - closes[i - 1]);
        trs.push(Math.max(h_l, h_pc, l_pc));
    }
    let atr = trs.slice(0, period).reduce((a, b) => a + b, 0) / period;
    for (let i = period; i < trs.length; i++) {
        atr = (atr * (period - 1) + trs[i]) / period;
    }
    return atr;
}

module.exports = async (req, res) => {
    try {
        await client.connect();
        const db = client.db('doomsday_bot');
        const priceCol = db.collection('price_history_m15');
        const signalCol = db.collection('signal_history_m15');

        // 1. Ambil harga Live PAXG/USD dari Coinbase
        const response = await axios.get('https://api.coinbase.com/v2/prices/PAXG-USD/spot');
        const currentPrice = parseFloat(response.data.data.amount);

        // Simulasi High/Low sederhana untuk kebutuhan ATR dasar
        const highPrice = currentPrice * 1.0005;
        const lowPrice = currentPrice * 0.9995;
        const timestamp = new Date();

        // 2. Simpan harga baru ke riwayat database
        await priceCol.insertOne({ 
            price: currentPrice, 
            high: highPrice, 
            low: lowPrice, 
            timestamp 
        });

        // 3. Tarik data riwayat untuk kalkulasi indikator
        const history = await priceCol.find().sort({ timestamp: 1 }).toArray();
        const closes = history.map(h => h.price);
        const highs = history.map(h => h.high);
        const lows = history.map(h => h.low);

        // Hitung nilai teknikal dasar
        const ema9 = calcEMA(closes, 9);
        const ema21 = calcEMA(closes, 21);
        const rsi14 = calcRSI(closes, 14);
        const atr14 = calcATR(highs, lows, closes, 14);

        let upperDoom = NaN;
        let lowerDoom = NaN;
        if (!isNaN(ema21) && !isNaN(atr14)) {
            upperDoom = ema21 + (atr14 * 1.5);
            lowerDoom = ema21 - (atr14 * 1.5);
        }

        // Ambil 5 riwayat harga terakhir untuk referensi visual AI
        const recentPrices = closes.slice(-5).join(', ');

        // DEFAULT awal jika AI gagal merespons atau data masih NaN
        let aiSignal = "NEUTRAL";
        let aiColor = "#6b7280"; 
        let aiReason = "Mengumpulkan data awal market.";

        // 4. OTAK AI GEMINI PROMPT (Hanya bekerja jika data indikator sudah valid/bukan NaN)
        if (!isNaN(ema9) && !isNaN(ema21) && !isNaN(rsi14)) {
            const promptText = `
            Anda adalah Otak AI Pro Trading Khusus Emas (XAUUSD).
            Analisis data teknikal saat ini:
            - Harga Saat Ini: $${currentPrice}
            - 5 Harga Terakhir: [${recentPrices}]
            - EMA Fast (9): ${ema9.toFixed(2)}
            - EMA Slow (21): ${ema21.toFixed(2)}
            - RSI (14): ${rsi14.toFixed(2)}
            - ATR (14): ${atr14.toFixed(2)}

            Aturan Analisis Singkat:
            1. Periksa keselarasan Tren (EMA9 vs EMA21) dan Momentum (RSI).
            2. Jika kondisi market sedang tidak jelas, terjadi pembalikan arah yang meragukan, volume rendah (ATR menyempit), atau RSI berada di area netral (45-55), Anda HARUS mengeluarkan sinyal "NEUTRAL". Jangan memaksakan Buy atau Sell jika tingkat keyakinan Anda di bawah 80%.
            3. Tanggapan Anda WAJIB berupa JSON mentah dengan format tepat seperti ini:
            {"signal": "BUY" atau "SELL" redundancy atau "NEUTRAL", "color": "#22c55e" untuk buy / "#ef4444" untuk sell / "#6b7280" untuk neutral, "reason": "Alasan analisis singkat maksimum 15 kata"}
            `;

            try {
                const geminiRes = await axios.post(
                    `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${GEMINI_API_KEY}`,
                    { contents: [{ parts: [{ text: promptText }] }] }
                );
                
                const responseText = geminiRes.data.candidates[0].content.parts[0].text.trim();
                // Bersihkan pembungkus markdown json jika ada
                const cleanJson = responseText.replace(/```json|```/g, '');
                const aiResult = JSON.parse(cleanJson);
                
                aiSignal = aiResult.signal || "NEUTRAL";
                aiColor = aiResult.color || "#6b7280";
                aiReason = aiResult.reason || "Analisis AI selesai.";
            } catch (aiErr) {
                console.error("Gagal memanggil Otak AI Gemini:", aiErr.message);
                aiReason = "Koneksi AI terputus. Menggunakan mode aman (NEUTRAL).";
            }
        }

        // Formatisasi Jam WIB untuk tampilan tabel dashboard
        const opsiWaktu = { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit' };
        const jamWIB = timestamp.toLocaleTimeString('id-ID', opsiWaktu) + " WIB";

        // 5. Simpan Hasil Analisis Otak AI ke database Sinyal
        const newSignal = {
            timestamp,
            timeStr: jamWIB,
            closePrice: currentPrice.toFixed(2),
            signal: aiSignal,
            color: aiColor,
            ema9: isNaN(ema9) ? "..." : ema9.toFixed(2),
            ema21: isNaN(ema21) ? "..." : ema21.toFixed(2),
            rsi14: isNaN(rsi14) ? "..." : rsi14.toFixed(2),
            atr14: isNaN(atr14) ? "..." : atr14.toFixed(2),
            upperDoom: isNaN(upperDoom) ? "..." : upperDoom.toFixed(2),
            lowerDoom: isNaN(lowerDoom) ? "..." : lowerDoom.toFixed(2),
            reason: aiReason
        };

        await signalCol.insertOne(newSignal);

        res.setHeader('Access-Control-Allow-Origin', '*');
        res.json({ status: "success", wasError: false, updatedBrain: newSignal });
    } catch (e) {
        res.status(500).json({ status: "error", wasError: true, msg: e.message });
    }
};
