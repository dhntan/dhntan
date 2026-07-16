module.exports = (req, res) => {
    res.setHeader('Content-Type', 'text/html');
    res.send(`
<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Doomsday Gold Engine v5</title>
    <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-slate-900 text-white min-h-screen p-4 font-sans">

    <div class="max-w-md mx-auto space-y-6">
        <!-- Header Utama -->
        <div class="text-center py-4">
            <h1 class="text-2xl font-bold text-amber-500">🧠 Doomsday Gold Engine v5 (M15-Cloud)</h1>
        </div>

        <!-- Box Harga Live & Sinyal Utama -->
        <div class="bg-slate-800 p-6 rounded-2xl shadow-xl border border-slate-700 text-center space-y-4">
            <p class="text-xs font-semibold tracking-wider text-slate-400 uppercase">XAUUSD / PAXG PRICE (LIVE)</p>
            <h2 id="live-price" class="text-4xl font-black text-white">$...</h2>
            <div class="flex justify-center">
                <span id="main-signal" class="px-6 py-1.5 bg-gray-500 text-sm font-bold rounded-full tracking-wide shadow-md transition-colors duration-300">
                    LOADING...
                </span>
            </div>
            <!-- Alasan Analisis Otak AI -->
            <p id="ai-reason" class="text-xs text-amber-400 italic font-light px-2"></p>
        </div>

        <!-- Box Live Database Indicator -->
        <div class="bg-slate-800 p-5 rounded-2xl shadow-xl border border-slate-700 space-y-4">
            <h3 class="text-sm font-bold text-sky-400 border-b border-slate-700 pb-2 flex items-center gap-1">
                📊 Live Database Indicator (M15 Candle Close):
            </h3>
            <div class="grid grid-cols-2 gap-3 text-xs text-slate-300">
                <div>• EMA Fast (9): <span id="ema-fast" class="font-bold text-white">...</span></div>
                <div>• EMA Slow (21): <span id="ema-slow" class="font-bold text-white">...</span></div>
                <div>• RSI (14): <span id="rsi-val" class="font-bold text-white">...</span></div>
                <div>• ATR (14): <span id="atr-val" class="font-bold text-white">...</span></div>
            </div>
            <div class="pt-2 border-t border-dashed border-slate-700 grid grid-cols-2 gap-3 text-xs">
                <div class="text-amber-500">🔥 Upper Doom Band: <span id="upper-doom" class="font-bold text-white">...</span></div>
                <div class="text-cyan-400">💧 Lower Doom Band: <span id="lower-doom" class="font-bold text-white">...</span></div>
            </div>
        </div>

        <!-- Box Histori Sinyal MongoDB -->
        <div class="bg-slate-800 p-5 rounded-2xl shadow-xl border border-slate-700 space-y-3">
            <h3 class="text-sm font-bold text-amber-500 flex items-center gap-1">
                ⚡ Live Sinyal Doomsday History (M15-MongoDB)
            </h3>
            
            <div class="overflow-y-auto max-h-72 rounded-xl border border-slate-700 bg-slate-850">
                <table class="w-full text-left text-xs text-slate-300">
                    <thead class="bg-slate-750 text-slate-400 uppercase tracking-wider sticky top-0 border-b border-slate-700">
                        <tr>
                            <th class="p-3">TIME</th>
                            <th class="p-3">CLOSE PRICE (USD)</th>
                            <th class="p-3">DOOM SIGNAL</th>
                        </tr>
                    </thead>
                    <tbody id="signal-table-body" class="divide-y divide-slate-700/50">
                        <!-- Data rows injected by JS -->
                    </tbody>
                </table>
            </div>
        </div>
    </div>

    <!-- Script Pembaruan Otomatis Dashboard -->
    <script>
        async function updateDashboard() {
            try {
                const res = await fetch('/api/data');
                const data = await res.json();

                // 1. Update Harga Utama & Alasan AI
                if (data.livePrice) {
                    document.getElementById('live-price').innerText = '$' + data.livePrice;
                }

                // 2. Update Indikator dan Badge Sinyal Teratas
                if (data.latest) {
                    document.getElementById('ema-fast').innerText = data.latest.ema9 || '...';
                    document.getElementById('ema-slow').innerText = data.latest.ema21 || '...';
                    
                    // Mewarnai teks RSI berdasarkan kondisi ekstrim
                    const rsiEl = document.getElementById('rsi-val');
                    rsiEl.innerText = data.latest.rsi14 || '...';
                    if(data.latest.rsi14 && data.latest.rsi14 !== '...') {
                        const rVal = parseFloat(data.latest.rsi14);
                        if(rVal >= 70) rsiEl.className = "font-bold text-red-400";
                        else if(rVal <= 30) rsiEl.className = "font-bold text-green-400";
                        else rsiEl.className = "font-bold text-white";
                    }

                    document.getElementById('atr-val').innerText = data.latest.atr14 || '...';
                    document.getElementById('upper-doom').innerText = data.latest.upperDoom || '...';
                    document.getElementById('lower-doom').innerText = data.latest.lowerDoom || '...';
                    
                    // Update Sinyal Utama
                    const mainSignalBadge = document.getElementById('main-signal');
                    mainSignalBadge.innerText = data.latest.signal || 'NEUTRAL';
                    mainSignalBadge.style.backgroundColor = data.latest.color || '#6b7280';

                    // Tampilkan Alasan Berpikir Otak AI
                    document.getElementById('ai-reason').innerText = data.latest.reason ? "AI: " + data.latest.reason : "";
                }

                // 3. Update Tabel Sejarah Tanpa Terjadi Undefined
                const tableBody = document.getElementById('signal-table-body');
                if (tableBody && data.signals) {
                    tableBody.innerHTML = ''; 
                    
                    data.signals.forEach(row => {
                        const tr = document.createElement('tr');
                        tr.className = "hover:bg-slate-700/30 transition-colors";
                        tr.innerHTML = \`
                            <td class="p-3 text-slate-400">\${row.timeStr || '...'}</td>
                            <td class="p-3 font-bold text-white">\$\${row.closePrice || '...'}</td>
                            <td class="p-3">
                                <span style="background-color: \${row.color};" class="text-white px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wide">
                                    \${row.signal}
                                </span>
                            </td>
                        \`;
                        tableBody.appendChild(tr);
                    });
                }
            } catch (err) {
                console.error("Gagal sinkronisasi data:", err);
            }
        }

        // Interval refresh cepat tiap 5 detik
        setInterval(updateDashboard, 5000);
        window.onload = updateDashboard;
    </script>

</body>
</html>
    `);
};
