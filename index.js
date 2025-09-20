import express from "express";
import fetch from "node-fetch";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// ✅ GET networks and fees for a specific coin
app.get("/api/networks/:coin", async (req, res) => {
  try {
    const coin = req.params.coin.toUpperCase();

    const response = await fetch(
      `https://api.binance.com/sapi/v1/capital/config/getall`,
      {
        method: "GET",
        headers: {
          "X-MBX-APIKEY": process.env.BINANCE_API_KEY, // ✅ المفتاح الصح
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      return res
        .status(response.status)
        .json({ error: "Binance API error", details: errorText });
    }

    const data = await response.json();

    // تصفية بيانات العملة المطلوبة فقط
    const coinData = data.find((item) => item.coin === coin);

    if (!coinData) {
      return res.status(404).json({ error: "Coin not found" });
    }

    res.json({
      coin: coinData.coin,
      name: coinData.name,
      networks: coinData.networkList.map((n) => ({
        network: n.network,
        withdrawFee: n.withdrawFee,
        minWithdrawAmount: n.minWithdrawAmount,
        depositEnable: n.depositEnable,
        withdrawEnable: n.withdrawEnable,
      })),
    });
  } catch (error) {
    console.error("Error fetching Binance API:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ✅ Root endpoint (اختياري للتجربة)
app.get("/", (req, res) => {
  res.send("🚀 Binance Proxy API is running...");
});

// ✅ تشغيل السيرفر
app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
});
