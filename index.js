const express = require('express');
const axios = require('axios');
const app = express();

let goldDataLog = [];

async function fetchGoldPrice() {
    try {
        const response = await axios.get('https://api.binance.com/api/v3/ticker/price?symbol=XAUUSDT');
        const price = parseFloat(response.data.price).toFixed(2);
        const timeNow = new Date().toLocaleTimeString('id-ID', { timeZone: 'Asia/Jakarta' });

        let signal = 'NEUTRAL';
        if (goldDataLog.length > 0) {
            const lastPrice = goldDataLog[0].price;
            if (parseFloat(price) > parseFloat(lastPrice)) signal = 'BUY';
            else if (parseFloat(price) < parseFloat(lastPrice)) signal = 'SELL';
        }

        goldDataLog.unshift({ time: timeNow, price: `$${price}`, signal: signal });
        if (goldDataLog.length > 20) goldDataLog.pop();
    } catch (error) {
        console.error('Gagal mengambil harga:', error.message);
    }
}

// Pemicu awal
fetchGoldPrice();

app.get('/', async (req, res) => {
    // Setiap kali di-ping/diakses, server otomatis update data terbaru
    await fetchGoldPrice();

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
                <p style="font-size: 14px; color: #9ca3af;">Status Server: <span style="color: #10b981; font-weight: bold;">ONLINE (Vercel)</span></p>
                <table style="width: 100%; border-collapse: collapse; background: #1f2937; border-radius: 8px; overflow: hidden;">
                    <thead>
                        <tr style="background: #374151; color: #d1d5db; text-align: left;">
                            <th style="padding: 12px;">TIME</th>
                            <th style="padding: 12px;">PRICE</th>
                            <th style="padding: 12px;">SIGNAL</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rows || '<tr><td colspan="3" style="padding: 20px; text-align: center;">Menghubungkan...</td></tr>'}
                    </tbody>
                </table>
            </div>
        </body>
        </html>
    `);
});

module.exports = app;
