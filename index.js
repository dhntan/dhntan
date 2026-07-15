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
                <h2 style="color: #f59e0b;">⚡ XAUUSD Live Tracker (Global)</h2>
                <table style="width: 100%; background: #1f2937; border-radius: 8px; border-collapse: collapse;">
                    <thead><tr style="color: #9ca3af; text-align: left;"><th style="padding: 12px;">TIME</th><th style="padding: 12px;">PRICE (USD)</th><th style="padding: 12px;">SIGNAL</th></tr></thead>
                    <tbody id="log-body"><tr><td colspan="3" style="padding: 20px; text-align: center;">Menghubungkan ke market global...</td></tr></tbody>
                </table>
            </div>

            <script>
                let lastPrice = 0;
                async function updatePrice() {
                    try {
                        // Menggunakan API publik alternatif yang aman dari blokir di Indonesia
                        const response = await fetch('https://api.coinbase.com/v2/prices/PAXG-USD/spot');
                        const data = await response.json();
                        const price = parseFloat(data.data.amount).toFixed(2);
                        const time = new Date().toLocaleTimeString('id-ID');
                        
                        let signal = 'NEUTRAL';
                        if (lastPrice !== 0) {
                            signal = price > lastPrice ? 'BUY' : (price < lastPrice ? 'SELL' : 'HOLD');
                        }
                        
                        const tbody = document.getElementById('log-body');
                        
                        // Hapus baris loading jika masih ada
                        if(tbody.rows[0] && tbody.rows[0].cells[0].colSpan === 3) {
                            tbody.innerHTML = '';
                        }

                        const newRow = \`<tr style="border-bottom: 1px solid #374151;">
                            <td style="padding: 12px; color: #aaa;">\${time}</td>
                            <td style="padding: 12px; font-weight: bold;">$\${price}</td>
                            <td style="padding: 12px;"><span style="background: \${signal === 'BUY' ? '#10b981' : (signal === 'SELL' ? '#ef4444' : '#6b7280')}; padding: 4px 8px; border-radius: 4px; font-size: 12px; color: white; font-weight: bold;">\${signal}</span></td>
                        </tr>\`;
                        tbody.insertAdjacentHTML('afterbegin', newRow);
                        if (tbody.rows.length > 10) tbody.deleteRow(10);
                        
                        lastPrice = price;
                    } catch (e) { 
                        console.error(e); 
                    }
                }
                setInterval(updatePrice, 5000);
                updatePrice();
            </script>
        </body>
        </html>
    `);
});

module.exports = app;
