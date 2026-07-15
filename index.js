const express = require('express');
const axios = require('axios');
const app = express();
const PORT = process.env.PORT || 3000;

// Variabel database mini di memori server
let goldDataLog = [];
let currentWeight = { trend: 0.5, momentum: 0.5 };

// Fungsi simulasi ambil data emas (Silakan ganti URL API dengan yang Bapak gunakan jika ada)
async function fetchGoldPrice() {
    try {
        // Contoh mengambil data harga emas acuan publik
        const response = await axios.get('https://api.binance.com/api/v3/ticker/price?symbol=XAUUSDT');
        const price = parseFloat(response.data.price).toFixed(2);
        const timeNow = new Date().toLocaleTimeString('id-ID', { timeZone: 'Asia/Jakarta' });
        
        // Logika evaluasi mandiri sederhana (Feedback Loop)
        let signal = 'NEUTRAL';
        if (goldDataLog.length > 0) {
            const lastPrice = goldDataLog[0].price;
            if (parseFloat(price) > parseFloat(lastPrice)) {
                signal = 'BUY';
                currentWeight.trend += 0.01; // Belajar memperkuat bobot trend naik
            } else if (parseFloat(price) < parseFloat(lastPrice)) {
                signal = 'SELL';
                currentWeight.momentum += 0.01; // Belajar memperkuat bobot momentum turun
            }
        }

        // Catat ke log teratas
        goldDataLog.unshift({ time: timeNow, price: `$${price}`, signal: signal });
        
        // Batasi log maksimal 20 data saja agar memori hemat
        if (goldDataLog.length > 20) goldDataLog.pop();
        
        console.log(`[${timeNow}] Berhasil update harga: $${price} | Sinyal: ${signal}`);
    } catch (error) {
        console.error('Gagal mengambil harga emas:', error.message);
    }
}

// Jalankan otomatis setiap 5 menit (300.000 milidetik)
setInterval(fetchGoldPrice, 300000);
// Jalankan sekali di awal saat server pertama aktif
fetchGoldPrice();

// Tampilan Dasbor HTML untuk dipantau di HP Pak Dhany
app.get('/', (req, res) => {
    let rows = goldDataLog.map(d => `
        <tr style="border-bottom: 1px solid #444;">
            <td style="padding: 12px; color: #aaa;">${d.time}</td>
            <td style="padding: 12px; font-weight: bold; color: #fff;">${d.price}</td>
            <td style="padding: 12px;">
                <span style="background: ${d.signal === 'BUY' ? '#10b981' : d.signal === 'SELL' ? '#ef4444' : '#6b7280'}; color: white; padding: 4px 8px; border-radius: 4px; font-weight: bold; font-size: 12px;">
                    ${d.signal}
                </span>
            </td>
        </tr>
    `).join('');

    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>XAUUSD Doomsday Tracker</title>
        </head>
        <body style="background-color: #111827; color: white; font-family: sans-serif; margin: 0; padding: 20px;">
            <div style="max-width: 500px; margin: 0 auto;">
                <h2 style="color: #f59e0b; border-bottom: 2px solid #f59e0b; padding-bottom: 10px;">⚡ XAUUSD Gold Tracker</h2>
                <p style="font-size: 14px; color: #9ca3af;">Status Server: <span style="color: #10b981; font-weight: bold;">ONLINE (24 Jam)</span></p>
                
                <h3 style="margin-top: 20px; color: #e5e7eb;">📋 Signal Log (Per 5 Menit)</h3>
                <table style="width: 100%; border-collapse: collapse; background: #1f2937; border-radius: 8px; overflow: hidden;">
                    <thead>
                        <tr style="background: #374151; color: #d1d5db; text-align: left;">
                            <th style="padding: 12px;">TIME</th>
                            <th style="padding: 12px;">PRICE</th>
                            <th style="padding: 12px;">SIGNAL</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rows || '<tr><td colspan="3" style="padding: 20px; text-align: center; color: #9ca3af;">Menunggu data perdana (5 menit)...</td></tr>'}
                    </tbody>
                </table>
            </div>
        </body>
        </html>
    `);
});

app.listen(PORT, () => {
    console.log(`Server Doomsday aktif di port ${PORT}`);
});
