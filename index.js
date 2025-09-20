import express from "express";
import axios from "axios";

const app = express();
app.use(express.json());

const BINANCE_API_KEY = process.env.BINANCE_API_KEY;
const BINANCE_SECRET_KEY = process.env.BINANCE_SECRET_KEY;

// Endpoint رئيسي للتأكد إن السيرفر شغال
app.get("/", (req, res) => {
  res.json({ status: "ok", message: "Binance Fees API is running 🚀" });
});

// Endpoint للحصول على رسوم السحب
app.post("/get-withdraw-fees", async (req, res) => {
  try {
    const { coin } = req.body;
    if (!coin) {
      return res.status(400).json({ status: "error", message: "coin is required" });
    }

    const response = await axios.get("https://api.binance.com/sapi/v1/capital/config/getall", {
      headers: {
        "X-MBX-APIKEY": BINANCE_API_KEY,
      },
    });

    const coinInfo = response.data.find((c) => c.coin === coin.toUpperCase());

    if (!coinInfo) {
      return res.status(404).json({ status: "error", message: `Coin ${coin} not found` });
    }

    res.json({
      status: "success",
      coin: coinInfo.coin,
      withdrawFee: coinInfo.networkList.map((n) => ({
        network: n.network,
        fee: n.withdrawFee,
        minWithdraw: n.withdrawMin,
      })),
    });
  } catch (err) {
    console.error("Error fetching Binance fees:", err.message);
    res.status(500).json({ status: "error", message: "Failed to fetch Binance fees" });
  }
});

// ✅ أهم حاجة هنا: Railway بيوفر متغير PORT
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
