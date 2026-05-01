const TICKERS = [
  // VN30
  { symbol: 'ACB', name: 'Asia Commercial Bank' },
  { symbol: 'BCM', name: 'Becamex IDC' },
  { symbol: 'BID', name: 'BIDV' },
  { symbol: 'BVH', name: 'Bao Viet Holdings' },
  { symbol: 'CTG', name: 'VietinBank' },
  { symbol: 'FPT', name: 'FPT Corporation' },
  { symbol: 'GAS', name: 'Petrovietnam Gas' },
  { symbol: 'GVR', name: 'Vietnam Rubber Group' },
  { symbol: 'HDB', name: 'HDBank' },
  { symbol: 'HPG', name: 'Hoa Phat Group' },
  { symbol: 'MBB', name: 'MB Bank' },
  { symbol: 'MSN', name: 'Masan Group' },
  { symbol: 'MWG', name: 'Mobile World' },
  { symbol: 'PLX', name: 'Petrolimex' },
  { symbol: 'POW', name: 'PV Power' },
  { symbol: 'SAB', name: 'Sabeco' },
  { symbol: 'SHB', name: 'SHB Bank' },
  { symbol: 'SSB', name: 'SeABank' },
  { symbol: 'SSI', name: 'SSI Securities' },
  { symbol: 'STB', name: 'Sacombank' },
  { symbol: 'TCB', name: 'Techcombank' },
  { symbol: 'TPB', name: 'TPBank' },
  { symbol: 'VCB', name: 'Vietcombank' },
  { symbol: 'VHM', name: 'Vinhomes' },
  { symbol: 'VIB', name: 'VIB Bank' },
  { symbol: 'VIC', name: 'Vingroup' },
  { symbol: 'VJC', name: 'Vietjet Air' },
  { symbol: 'VNM', name: 'Vinamilk' },
  { symbol: 'VPB', name: 'VPBank' },
  { symbol: 'VRE', name: 'Vincom Retail' },
  
  // Hot Midcaps & Others
  { symbol: 'VND', name: 'VNDirect' },
  { symbol: 'VIX', name: 'VIX Securities' },
  { symbol: 'HSG', name: 'Hoa Sen Group' },
  { symbol: 'NKG', name: 'Nam Kim Steel' },
  { symbol: 'DIG', name: 'DIC Corp' },
  { symbol: 'DXG', name: 'Dat Xanh Group' },
  { symbol: 'PVD', name: 'PV Drilling' },
  { symbol: 'PVS', name: 'PTSC' },
  { symbol: 'KBC', name: 'Kinh Bac City' },
  { symbol: 'VCG', name: 'Vinaconex' },
  { symbol: 'LPB', name: 'LienVietPostBank' },
  { symbol: 'EIB', name: 'Eximbank' },
  { symbol: 'NVL', name: 'Novaland' },
  { symbol: 'PDR', name: 'Phat Dat Real Estate' },
];

function calculateRSI(data, period = 14) {
  if (data.length < period + 1) return 50;

  let gains = 0;
  let losses = 0;

  for (let i = 1; i <= period; i++) {
    const change = data[i].close - data[i - 1].close;
    if (change > 0) gains += change;
    else losses -= change;
  }

  let avgGain = gains / period;
  let avgLoss = losses / period;

  for (let i = period + 1; i < data.length; i++) {
    const change = data[i].close - data[i - 1].close;
    let gain = change > 0 ? change : 0;
    let loss = change < 0 ? -change : 0;

    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
  }

  if (avgLoss === 0) return 100;
  
  const rs = avgGain / avgLoss;
  const rsi = 100 - (100 / (1 + rs));
  
  return Number(rsi.toFixed(2));
}

export async function fetchStockData() {
  const to = Math.floor(Date.now() / 1000);
  const from = to - (6 * 30 * 24 * 60 * 60); // 6 months ago

  const fetchPromises = TICKERS.map(async (ticker) => {
    try {
      const response = await fetch(`/api/dchart/history?resolution=D&symbol=${ticker.symbol}&from=${from}&to=${to}`);
      if (!response.ok) throw new Error('Network response was not ok');
      const data = await response.json();
      
      if (data.s !== 'ok' || !data.t || data.t.length === 0) {
        throw new Error(`Invalid data for ${ticker.symbol}`);
      }

      // Map to lightweight-charts format
      const history = data.t.map((timestamp, index) => {
        // Convert timestamp to YYYY-MM-DD local time string
        const date = new Date(timestamp * 1000);
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        
        return {
          time: `${year}-${month}-${day}`,
          open: data.o[index],
          high: data.h[index],
          low: data.l[index],
          close: data.c[index],
          volume: data.v[index]
        };
      });

      const latest = history[history.length - 1];
      const prev = history.length > 1 ? history[history.length - 2] : latest;
      
      const change = latest.close - prev.close;
      const changePercent = prev.close !== 0 ? (change / prev.close) * 100 : 0;
      
      const rsi = calculateRSI(history);
      
      let prediction = 'HOLD';
      let reason = `Chỉ số RSI hiện tại là ${rsi}, nằm ở vùng trung lập (30 - 70). Cổ phiếu đang trong giai đoạn tích lũy hoặc xu hướng chưa rõ ràng. Khuyến nghị GIỮ và quan sát thêm.`;

      if (rsi < 30) {
        prediction = 'BUY';
        reason = `Chỉ số RSI là ${rsi} (< 30), cho thấy cổ phiếu đang rơi vào vùng QUÁ BÁN (Oversold). Áp lực bán có thể đã cạn kiệt và xác suất cao sẽ có nhịp hồi phục giá. Khuyến nghị MUA thăm dò.`;
      }
      else if (rsi > 70) {
        prediction = 'SELL';
        reason = `Chỉ số RSI là ${rsi} (> 70), cho thấy cổ phiếu đang rơi vào vùng QUÁ MUA (Overbought). Đà tăng có thể đã bị rướn quá mức và rủi ro điều chỉnh giảm giá là rất cao. Khuyến nghị BÁN chốt lời.`;
      } else if (rsi < 40) {
        prediction = 'BUY';
        reason = `Chỉ số RSI là ${rsi} (tiệm cận vùng 30), cho thấy cổ phiếu đang chịu áp lực điều chỉnh nhưng lực bán đang yếu dần. Có thể cân nhắc giải ngân một phần (MUA) đón sóng hồi.`;
      } else if (rsi > 60) {
        prediction = 'SELL';
        reason = `Chỉ số RSI là ${rsi} (tiệm cận vùng 70), cổ phiếu đang tăng khá nóng. Rủi ro điều chỉnh đang tăng dần, cân nhắc hạ tỷ trọng (BÁN) để bảo toàn lợi nhuận.`;
      }

      return {
        ...ticker,
        price: latest.close,
        change: Number(change.toFixed(2)),
        changePercent: Number(changePercent.toFixed(2)),
        volume: latest.volume,
        rsi,
        prediction,
        reason,
        history
      };
    } catch (error) {
      console.error(`Failed to fetch ${ticker.symbol}:`, error);
      return null;
    }
  });

  const results = await Promise.all(fetchPromises);
  // Filter out any failed requests
  return results.filter(r => r !== null);
}
