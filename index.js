// index.js
import express from "express";
import fetch from "node-fetch"; // لو هتستخدم fetch
import crypto from "crypto";

const app = express();
app.use(express.json());

// شبكات مسموحة مسبقًا
const ALLOWED_NETWORKS = ["TRC20", "TRX", "ERC20", "BEP20"];

// مثال على API Key و Secret (يُفضل استخدام Environment Variables)
const BINANCE_API_KEY = process.env.BINANCE_API_KEY;
const BINANCE_API_SECRET = process.env.BINANCE_API_SECRET;

// دالة للحصول على رسوم السحب
async function getWithdrawFees(coin) {
  const url = `https://api.binance.com/sapi/v1/capital/config/getall`;
  const response = await fetch(url, {
    headers: {
      "X-MBX-APIKEY": BINANCE_API_KEY
    }
  });
  const data = await response.json();

  // البحث عن العملة المطلوبة
  const coinData = data.find(c => c.coin === coin);
  if (!coinData) return [];

  // فلترة الشبكات المسموحة
  const networks = coinData.networkList
    .filter(n => ALLOWED_NETWORKS.includes(n.network))
    .map(n => ({
      network: n.network,
      withdrawFee: n.withdrawFee,
      minWithdrawAmount: n.minWithdrawAmt
    }));

  // ترتيب حسب withdrawFee
  networks.sort((a, b) => a.withdrawFee - b.withdrawFee);

  return networks;
}

// endpoint
app.post("/get-withdraw-fees", async (req, res) => {
  const { coin } = req.body;
  if (!coin) return res.status(400).json({ error: "coin is required" });

  try {
    const fees = await getWithdrawFees(coin);
    if (fees.length === 0) {
      return res.json({ message: "No allowed networks found for this coin", networks: [] });
    }
    res.json({ coin, networks: fees });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch withdraw fees" });
  }
});

// تشغيل السيرفر
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
