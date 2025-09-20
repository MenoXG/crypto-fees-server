// ✅ Endpoint لعملة واحدة (معدل)
app.post("/get-withdraw-fees", async (req, res) => {
  const { coin } = req.body;
  if (!coin) return res.status(400).json({ error: "coin is required" });

  if (!process.env.BINANCE_API_KEY || !process.env.BINANCE_API_SECRET) {
    return res.json({ warning: "API Key/Secret not set", coin, networks: [] });
  }

  // الشبكات المسموح بها
  const allowedNetworks = ["ERC20", "BSC", "TRC20", "OMNI", "POLYGON", "ARBITRUM", "BTC", "SEGWITBTC", "LIGHTNING", "SOL", "XRP", "TRX"];

  try {
    const timestamp = Date.now();
    const queryString = `timestamp=${timestamp}`;
    const signature = signQuery(queryString);

    const url = `https://api.binance.com/sapi/v1/capital/config/getall?${queryString}&signature=${signature}`;

    const response = await fetch(url, {
      method: "GET",
      headers: { "X-MBX-APIKEY": process.env.BINANCE_API_KEY },
    });

    if (!response.ok) {
      const text = await response.text();
      return res.status(500).json({ error: "Binance API error", details: text });
    }

    const data = await response.json();
    const coinInfo = data.find((c) => c.coin === coin.toUpperCase());

    if (!coinInfo) return res.status(404).json({ error: "Coin not found" });

    // تصفية الشبكات: مفعلة ومسموح بها فقط
    const networks = (coinInfo.networkList || [])
      .filter((n) => n.withdrawEnable && allowedNetworks.includes(n.network))
      .map((n) => ({
        network: n.network,
        withdrawFee: n.withdrawFee,
        minWithdrawAmount: n.withdrawMin,
        depositEnable: n.depositEnable,
        withdrawEnable: n.withdrawEnable,
      }))
      .sort((a, b) => parseFloat(a.withdrawFee) - parseFloat(b.withdrawFee)); // ترتيب حسب أقل رسوم

    res.json({ coin: coinInfo.coin, name: coinInfo.name || "", networks });

  } catch (err) {
    console.error("🔥 Unexpected error:", err);
    res.status(500).json({ error: "Something went wrong", details: err.message });
  }
});
