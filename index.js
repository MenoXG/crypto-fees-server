// index.js
import express from "express";
import fetch from "node-fetch"; // أو يمكنك استخدام axios لو تحب
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(express.json());

// متغيرات البيئة الخاصة بالـ Binance API
const BINANCE_API_KEY = process.env.BINANCE_API_KEY;
const BINANCE_API_SECRET = process.env.BINANCE_API_SECRET;

// مثال endpoint لاسترجاع رسوم السحب لشبكات عملة معينة
app.post("/get-withdraw-fees", async (req, res) => {
  try {
    const { coin } = req.body;
    if (!coin) return res.status(400).json({ error: "Missing coin" });

    // استدعاء الـ Binance API الرسمي
    const url = `https://api.binance.com/sapi/v1/capital/config/getall`;
    const response = await fetch(url, {
      headers: { "X-MBX-APIKEY": BINANCE_API_KEY },
    });

    if (!response.ok) throw new Error("Failed to fetch from Binance API");

    const data = await response.json();

    // البحث عن العملة المطلوبة
    const coinData = data.find(c => c.coin === coin.toUpperCase());
    if (!coinData) return res.status(404).json({ error: "Coin not found" });

    // إرجاع الشبكات المتاحة، رسومها والحد الأدنى للسحب
    const networks = coinData.networkList.map(n => ({
      network: n.network,
      withdrawFee: n.withdrawFee,
      minWithdraw: n.withdrawMin,
    }));

    res.json({ coin: coin.toUpperCase(), networks });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// مثال endpoint لاستقبال Webhook من SendPulse
app.post("/webhook", (req, res) => {
  const data = req.body;
  console.log("Received SendPulse Webhook:", data);
  res.sendStatus(200);
});

// تشغيل السيرفر
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Visit: http://localhost:${PORT}`);
});
