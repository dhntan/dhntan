const { MongoClient } = require('mongodb');
const axios = require('axios');

const uri = "mongodb+srv://dhntan_db_user:TGHjfpbbNVdLUUXZ@cluster0.h9h6cvs.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";
const client = new MongoClient(uri);

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

module.exports = async (req, res) => {
    try {
        await client.connect();
        const db = client.db('doomsday_bot');
        const priceCol = db.collection('price_history_m15');
        const signalCol = db.collection('signal_history_m15');
        const brainCol = db.collection('brain_weights');

        const response = await axios.get('https://api.coinbase.com/v2/prices/PAXG-USD/spot');
        if (!response.data || !response.data.data || !response.data.data.amount) {
            return res.status(500).send("Gagal mengambil harga");
        }
        const currentPrice = parseFloat(response.data.data.amount);
        const timeNow = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' }) + ' WIB';
        
        await priceCol.insertOne({ price: currentPrice, timestamp: new Date() });

        let brain = await brainCol.findOne({ id: "gold_brain" });
        if (!brain) {
            brain = { 
                id: "gold_brain", total_errors: 0, 
                ema_fast: 9, ema_slow: 21, rsi_period: 14, 
                rsi_buy_level: 55, rsi_sell_level: 45, doom_mult: 2.0 
            };
            await brainCol.insertOne(brain);
        }

        const lastSignalDoc = await signalCol.find().sort({ timestamp: -1 }).limit(1).toArray();
        let wasError = false;

        if (lastSignalDoc.length > 0) {
            const ls = lastSignalDoc[0];
            const oldPrice = parseFloat(ls.price);
            
            if (ls.signal.includes("BUY") && currentPrice < oldPrice) wasError = true;
            if (ls.signal.includes("SELL") && currentPrice > oldPrice) wasError = true;

            if (wasError) {
                brain.total_errors += 1;
                brain.ema_fast = Math.floor(Math.random() * (12 - 7 + 1)) + 7;
                brain.ema_slow = Math.floor(Math.random() * (30 - 18 + 1)) + 18;
                brain.rsi_period = Math.floor(Math.random() * (16 - 10 + 1)) + 10;
                brain.rsi_buy_level = Math.floor(Math.random() * (62 - 52 + 1)) + 52;
                brain.rsi_sell_level = Math.floor(Math.random() * (48 - 38 + 1)) + 38;
                brain.doom_mult = parseFloat((Math.random() * (2.5 - 1.8) + 1.8).toFixed(2));

                await brainCol.updateOne({ id: "gold_brain" }, { $set: brain });
            }
        }

        const recentPricesDoc = await priceCol.find().sort({ timestamp: -1 }).limit(50).toArray();
        const priceSeries = recentPricesDoc.reverse().map(d => d.price);

        const emaFastVal = calcEMA(priceSeries, brain.ema_fast);
        const emaSlowVal = calcEMA(priceSeries, brain.ema_slow);
        const rsiVal = calcRSI(priceSeries, brain.rsi_period);
        const atrVal = calcATR(priceSeries, brain.rsi_period);

        const upperDoom = emaFastVal + (atrVal * brain.doom_mult);
        const lowerDoom = emaFastVal - (atrVal * brain.doom_mult);

        let signal = 'NEUTRAL';
        let color = '#6b7280';

        if (emaFastVal > emaSlowVal && rsiVal > brain.rsi_buy_level && currentPrice > emaFastVal) {
            signal = 'BUY 🟢'; color = '#10b981';
        } else if (emaFastVal < emaSlowVal && rsiVal < brain.rsi_sell_level && currentPrice < emaFastVal) {
            signal = 'SELL 🔴'; color = '#ef4444';
        }

        if (currentPrice > upperDoom) {
            signal = 'DOOM SELL 🟠'; color = '#f97316';
        } else if (currentPrice < lowerDoom) {
            signal = 'DOOM BUY 🔵'; color = '#3b82f6';
        }

        const logData = {
            time: timeNow,
            price: currentPrice.toFixed(2),
            signal: signal,
            color: color,
            ema9: emaFastVal.toFixed(2),
            ema21: emaSlowVal.toFixed(2),
            rsi14: rsiVal.toFixed(2),
            atr14: atrVal.toFixed(2),
            upperDoom: upperDoom.toFixed(2),
            lowerDoom: lowerDoom.toFixed(2),
            iteration: brain.total_errors,
            timestamp: new Date()
        };
        await signalCol.insertOne(logData);

        const totalSignals = await signalCol.countDocuments();
        if (totalSignals > 100) {
            const oldest = await signalCol.find().sort({ timestamp: 1 }).limit(totalSignals - 100).toArray();
            await signalCol.deleteMany({ _id: { $in: oldest.map(d => d._id) } });
        }

        res.json({ status: "success", wasError, updatedBrain: brain });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
};
