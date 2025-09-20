// index.js
import express from "express";
import fetch from "node-fetch";

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;

// قراءة الـ API KEY من متغيرات Railway
const BINANCE_API_KEY = process.env.BINANCE_API_KEY;

// التحقق من وجود المفتاح
if (!BINANCE_API_KEY) {
  console.error("❌ Binance API Key is missing! Please set it in Railway Variables.");
  process.exit(1);
}

// Endpoint لاختبار التشغيل
app.get("/", (req, res) => {
  res.json({ status: "Server is running 🚀" });
});

// Endpoint لجلب رسوم السحب من Binance
app.post("/get-withdraw-fees", async (req, res) => {
  try {
    const { coin } = req.body;

    if (!coin) {
      return res.status(400).json({ error: "Coin is required (e.g., BTC, ETH, USDT)" });
    }

    const url = `https://api.binance.com/sapi/v1/capital/config/getall`;

    const response = await fetch(url, {
      method: "GET",
      headers: {
        "X-MBX-APIKEY": BINANCE_API_KEY
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Binance API error:", errorText);
      return res.status(500).json({ error: "Binance API error", details: errorText });
    }

    const data = await response.json();

    // تصفية البيانات للـ Coin المطلوب
    const coinData = data.find(c => c.coin === coin.toUpperCase());

    if (!coinData) {
      return res.status(404).json({ error: `Coin ${coin} not found in Binance API` });
    }

    res.json({
      coin: coinData.coin,
      networks: coinData.networkList.map(n => ({
        network: n.network,
        withdrawFee: n.withdrawFee,
        withdrawMin: n.withdrawMin
      }))
    });

  } catch (error) {
    console.error("Server error:", error);
    res.status(500).json({ error: "Something went wrong", details: error.message });
  }
});

// تشغيل السيرفر
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
