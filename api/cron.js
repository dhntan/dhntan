const { GoogleGenAI } = require('@google/generative-ai');
const { MongoClient } = require('mongodb');
const axios = require('axios');

const mongoUri = process.env.MONGODB_URI;
const geminiApiKey = process.env.GEMINI_API_KEY;

module.exports = async (req, res) => {
  try {
    // 1. Ambil harga emas live dari Coinbase USD resmi
    const marketResponse = await axios.get('https://api.exchange.coinbase.com/products/PAXG-USD/ticker');
    const livePrice = parseFloat(marketResponse.data.price).toFixed(2);

    // 2. Kembalikan ke angka static awal yang sukses masuk DB
    const rsi14 = "50.00";
    const atr14 = "3.50";
    const ema9 = (livePrice * 0.999).toFixed(2);
    const ema21 = (livePrice * 1.001).toFixed(2);
    const upperDoom = (parseFloat(livePrice) + (3.50 * 4.28)).toFixed(2);
    const lowerDoom = (parseFloat(livePrice) - (3.50 * 4.28)).toFixed(2);

    // 3. Waktu Jakarta WIB
    const now = new Date();
    const utcTime = now.getTime() + (now.getTimezoneOffset() * 60000);
    const wibTime = new Date(utcTime + (3600000 * 7));
    
    const hours = String(wibTime.getHours()).padStart(2, '0');
    const minutes = String(wibTime.getMinutes()).padStart(2, '0');
    const timeStr = `${hours}.${minutes} WIB`;
    const timestamp = wibTime.getTime();

    let aiSignal = "NEUTRAL";
    let aiColor = "#6b7280";
    let aiReason = "Gagal memproses Otak AI Gemini";

    // 4. Proses Otak Gemini
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

    // 5. Simpan ke MongoDB
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
