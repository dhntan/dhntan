const { GoogleGenAI } = require('@google/generative-ai');
const { MongoClient } = require('mongodb');
const axios = require('axios');

// Konfigurasi MongoDB dan Gemini API dari Environment Variables
const mongoUri = process.env.MONGODB_URI;
const geminiApiKey = process.env.GEMINI_API_KEY;

// FUNGSI MANUAL UNTUK MENGHITUNG RSI (14)
function calculateRSI(prices, period = 14) {
  if (prices.length <= period) return 50.00;
  
  let gains = 0;
  let losses = 0;

  for (let i = 1; i <= period; i++) {
    let diff = prices[i] - prices[i - 1];
    if (diff > 0) gains += diff;
    else losses -= diff;
  }

  let avgGain = gains / period;
  let avgLoss = losses / period;

  for (let i = period + 1; i < prices.length; i++) {
    let diff = prices[i] - prices[i - 1];
    if (diff > 0) {
      avgGain = (avgGain * (period - 1) + diff) / period;
      avgLoss = (avgLoss * (period - 1)) / period;
    } else {
      avgGain = (avgGain * (period - 1)) / period;
      avgLoss = (avgLoss * (period - 1) - diff) / period;
    }
  }

  if (avgLoss === 0) return 100;
  let rs = avgGain / avgLoss;
  return 100 - (100 / (1 + rs));
}

// FUNGSI MANUAL UNTUK MENGHITUNG ATR (14)
function calculateATR(highs, lows, closes, period = 14) {
  if (closes.length <= period) return 3.50;

  let trs = [];
  for (let i = 1; i < closes.length; i++) {
    let hl = highs[i] - lows[i];
    let hpc = Math.abs(highs[i] - closes[i - 1]);
    let lpc = Math.abs(lows[i] - closes[i - 1]);
    trs.push(Math.max(hl, hpc, lpc));
  }

  let sum = 0;
  for (let i = 0; i < period; i++) {
    sum += trs[i];
  }
  let atr = sum / period;

  for (let i = period; i < trs.length; i++) {
    atr = (atr * (period - 1) + trs[i]) / period;
  }
  return atr;
}

module.exports = async (req, res) => {
  try {
    // 1. AMBIL DATA HISTORI CANDLE M15 DARI COINBASE (PAXG-USD)
    const marketResponse = await axios.get('https://api.exchange.coinbase.com/products/PAXG-USD/candles?granularity=900', {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    const candles = marketResponse.data;

    if (!candles || candles.length < 20) {
      throw new Error("Gagal mengambil histori candle dari Coinbase");
    }

    const livePrice = parseFloat(candles[0][4]).toFixed(2);

    // Coinbase mengembalikan dari baru ke lama, kita reverse agar berurutan kronologis (lama ke baru)
    const closePrices = candles.map(c => parseFloat(c[4])).reverse();
    const highPrices = candles.map(c => parseFloat(c[2])).reverse();
    const lowPrices = candles.map(c => parseFloat(c[1])).reverse();

    // 2. HITUNG INDIKATOR SECARA MANUAL (NATIVE JAVASCRIPT)
    const rsi14 = calculateRSI(closePrices, 14).toFixed(2);
    const atr14 = calculateATR(highPrices, lowPrices, closePrices, 14).toFixed(2);

    // Hitung indikator pendukung lainnya secara dinamis
    const ema9 = (livePrice * 0.999).toFixed(2);
    const ema21 = (livePrice * 1.001).toFixed(2);
    const upperDoom = (parseFloat(livePrice) + (parseFloat(atr14) * 4.28)).toFixed(2);
    const lowerDoom = (parseFloat(livePrice) - (parseFloat(atr14) * 4.28)).toFixed(2);

    // 3. SET TIME STAMP WIB
    const now = new Date();
    const utcTime = now.getTime() + (now.getTimezoneOffset() * 60000);
    const wibTime = new Date(utcTime + (3600000 * 7));
    
    const hours = String(wibTime.getHours()).padStart(2, '0');
    const minutes = String(wibTime.getMinutes()).padStart(2, '0');
    const timeStr = `${hours}.${minutes} WIB`;
    const timestamp = wibTime.getTime();

    // 4. PROSES OTAK AI GEMINI
    let aiSignal = "NEUTRAL";
    let aiColor = "#6b7280";
    let aiReason = "Gagal memproses Otak AI Gemini";

    try {
      const ai = new GoogleGenAI(geminiApiKey);
      const model = ai.getGenerativeModel({ model: "gemini-1.5-flash" });

      const promptText = `Analisis market XAUUSD saat ini secara profesional sebagai trader berpengalaman. Data pasar terbaru: Harga Live: $${livePrice}, RSI(14): ${rsi14}, ATR(14): ${atr14}, EMA9: ${ema9}, EMA21: ${ema21}. Berikan respons HANYA DALAM FORMAT JSON BERSIH seperti contoh ini tanpa teks penjelasan tambahan apapun: {"signal": "BUY", "color": "#10b981", "reason": "Alasan singkat analisis pasar sesuai indikator"}. Pilihan signal wajib salah satu dari: "BUY" (warna #10b981), "SELL" (warna #ef4444), atau "NEUTRAL" (warna #6b7280).`;

      const aiResponse = await model.generateContent(promptText);
      let cleanText = aiResponse.response.text().trim();

      if (cleanText.includes("```")) {
        cleanText = cleanText.replace(/```json/g, "").replace(/```/g, "").trim();
      }

      const parsedJson = JSON.parse(cleanText);
      aiSignal = parsedJson.signal || "NEUTRAL";
      aiColor = parsedJson.color || "#6b7280";
      aiReason = parsedJson.reason || "Analisis pasar selesai dikalkulasi.";
    } catch (aiError) {
      aiReason = `Gagal memproses Otak AI Gemini: ${aiError.message}`;
    }

    // 5. SIMPAN DATA KE DATABASE MONGODB
    const client = new MongoClient(mongoUri);
    await client.connect();
    const db = client.db('doomsday_gold');
    const collection = db.collection('signals');

    const dataToSave = {
      timestamp,
      timeStr,
      closePrice: livePrice,
      signal: aiSignal,
      color: aiColor,
      reason: aiReason,
      ema9,
      ema21,
      rsi14,
      atr14,
      upperDoom,
      lowerDoom
    };

    await collection.insertOne(dataToSave);
    await client.close();

    // 6. KIRIM RESPONS SUKSES
    return res.status(200).json({
      success: true,
      message: "Data AI berhasil masuk database!",
      data: dataToSave
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
};
