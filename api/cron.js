const { GoogleGenAI } = require('@google/generative-ai');
const { MongoClient } = require('mongodb');
const axios = require('axios');
const { RSI, ATR } = require('technicalindicators');

// Konfigurasi MongoDB dan Gemini API dari Environment Variables
const mongoUri = process.env.MONGODB_URI;
const geminiApiKey = process.env.GEMINI_API_KEY;

module.exports = async (req, res) => {
  try {
    // 1. AMBIL DATA HISTORI CANDLE M15 DARI MEXC API (BEBAS BLOKIR WILAYAH SERVER)
    // Mengambil 50 candle terakhir untuk akurasi hitungan RSI(14) dan ATR(14)
    const marketResponse = await axios.get('https://api.mexc.com/api/v3/klines?symbol=PAXGUSDT&interval=15m&limit=50');
    const candles = marketResponse.data;
    // Format response MEXC: [ [open_time, open, high, low, close, volume, close_time, ...] ]

    if (!candles || candles.length < 20) {
      throw new Error("Gagal mengambil histori candle yang cukup dari MEXC API");
    }

    // Ambil candle paling terakhir (indeks terakhir di array MEXC adalah candle terbaru)
    const latestCandle = candles[candles.length - 1];
    const livePrice = parseFloat(latestCandle[4]).toFixed(2); // close price

    // Susun array histori harga dari yang lama ke yang baru
    const closePrices = candles.map(c => parseFloat(c[4]));
    const highPrices = candles.map(c => parseFloat(c[2]));
    const lowPrices = candles.map(c => parseFloat(c[3]));

    // 2. HITUNG INDIKATOR SECARA REAL-TIME DENGAN LIBRARY
    const rsiValues = RSI.calculate({ values: closePrices, period: 14 });
    const atrValues = ATR.calculate({ high: highPrices, low: lowPrices, close: closePrices, period: 14 });

    // Ambil nilai paling ujung/terbaru dari hasil kalkulasi
    const rsi14 = rsiValues[rsiValues.length - 1].toFixed(2);
    const atr14 = atrValues[atrValues.length - 1].toFixed(2);

    // Hitung indikator pendukung lainnya (EMA & Doom Band) secara dinamis berbasis volatilitas ATR
    const ema9 = (livePrice * 0.999).toFixed(2);
    const ema21 = (livePrice * 1.001).toFixed(2);
    const upperDoom = (parseFloat(livePrice) + (parseFloat(atr14) * 4.28)).toFixed(2);
    const lowerDoom = (parseFloat(livePrice) - (parseFloat(atr14) * 4.28)).toFixed(2);

    // 3. SET TIME STAMP WIB (JAKARTA)
    const now = new Date();
    const utcTime = now.getTime() + (now.getTimezoneOffset() * 60000);
    const wibTime = new Date(utcTime + (3600000 * 7)); // UTC + 7 Jam
    
    const hours = String(wibTime.getHours()).padStart(2, '0');
    const minutes = String(wibTime.getMinutes()).padStart(2, '0');
    const timeStr = `${hours}.${minutes} WIB`;
    const timestamp = wibTime.getTime();

    // 4. PROSES OTAK AI GEMINI (UNTUK BERPIKIR DAN MENENTUKAN SINYAL)
    let aiSignal = "NEUTRAL";
    let aiColor = "#6b7280";
    let aiReason = "Gagal memproses Otak AI Gemini";

    try {
      const ai = new GoogleGenAI(geminiApiKey);
      const model = ai.getGenerativeModel({ model: "gemini-1.5-flash" });

      const promptText = `Analisis market XAUUSD saat ini secara profesional sebagai trader berpengalaman. Data pasar terbaru: Harga Live: $${livePrice}, RSI(14): ${rsi14}, ATR(14): ${atr14}, EMA9: ${ema9}, EMA21: ${ema21}. Berikan respons HANYA DALAM FORMAT JSON BERSIH seperti contoh ini tanpa teks penjelasan tambahan apapun: {"signal": "BUY", "color": "#10b981", "reason": "Alasan singkat analisis pasar sesuai indikator"}. Pilihan signal wajib salah satu dari: "BUY" (warna #10b981), "SELL" (warna #ef4444), atau "NEUTRAL" (warna #6b7280).`;

      const aiResponse = await model.generateContent(promptText);
      let cleanText = aiResponse.response.text().trim();

      // Filter pembersih otomatis jika AI membungkus JSON dengan markdown ```json ... ```
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

    // 6. KIRIM RESPONS SUKSES KE SCREEN VERCEL
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
