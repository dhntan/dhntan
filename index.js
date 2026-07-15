const express = require('express');
const app = express();

app.get('/', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>XAUUSD Live Tracker</title>
        </head>
        <body style="background-color: #111827; color: white; font-family: sans-serif; padding: 20px;">
            <div style="max-width: 500px; margin: 0 auto;">
                <h2 style="color: #f59e0b;">⚡ XAUUSD Live Tracker</h2>
                <table style="width: 100%; background: #1f2937; border-radius: 8px; border-collapse: collapse;">
                    <thead><tr style="color: #9ca3af; text-align: left;"><th style="padding: 12px;">TIME</th><th style="padding: 12px;">PRICE</th><th style="padding: 12px;">SIGNAL</th></tr></thead>
                    <tbody id="log-body"><tr><td colspan="3" style="padding: 20px; text-align: center;">Menghubungkan ke market...</td></tr></tbody>
                </table>
            </div>

            <script>
                let lastPrice = 0;
                async function updatePrice() {
                    try {
                        const response = await fetch('https://api.binance.com/api/v3/ticker/price?symbol=XAUUSDT');
                        const data = await response.json();
                        const price = parseFloat(data.price).toFixed(2);
                        const time = new Date().toLocaleTimeString('id-ID');
                        
                        let signal = 'NEUTRAL';
                        if (lastPrice !== 0) {
                            signal = price > lastPrice ? 'BUY' : (price < lastPrice ? 'SELL' : 'HOLD');
                        }
                        lastPrice = price;

                        const tbody = document.getElementById('log-body');
                        const newRow = \`<tr>
                            <td style="padding: 12px; color: #aaa;">\${time}</td>
                            <td style="padding: 12px; font-weight: bold;">$\${price}</td>
                            <td style="padding: 12px;"><span style="background: \${signal === 'BUY' ? '#10b981' : '#ef4444'}; padding: 4px 8px; border-radius: 4px; font-size: 12px;">\${signal}</span></td>
                        </tr>\`;
                        tbody.insertAdjacentHTML('afterbegin', newRow);
                        if (tbody.rows.length > 10) tbody.deleteRow(10);
                    } catch (e) { console.error(e); }
                }
                setInterval(updatePrice, 5000);
                updatePrice();
            </script>
        </body>
        </html>
    `);
});

module.exports = app;
