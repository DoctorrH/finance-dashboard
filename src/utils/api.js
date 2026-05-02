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

function calculateMA(data, period = 50) {
  if (data.length < period) return 0;
  const subset = data.slice(-period);
  const sum = subset.reduce((acc, curr) => acc + curr.close, 0);
  return Number((sum / period).toFixed(2));
}

function calculateVolMA(data, period = 20) {
  if (data.length < period) return 0;
  const subset = data.slice(-period);
  const sum = subset.reduce((acc, curr) => acc + curr.volume, 0);
  return Number((sum / period).toFixed(0));
}

function calculateMFI(data, period = 14) {
  if (data.length < period + 1) return 50;

  const typicalPrices = data.map(d => (d.high + d.low + d.close) / 3);
  const moneyFlows = typicalPrices.map((tp, i) => tp * data[i].volume);

  let posFlow = 0;
  let negFlow = 0;

  for (let i = data.length - period; i < data.length; i++) {
    if (typicalPrices[i] > typicalPrices[i - 1]) {
      posFlow += moneyFlows[i];
    } else if (typicalPrices[i] < typicalPrices[i - 1]) {
      negFlow += moneyFlows[i];
    }
  }

  if (negFlow === 0) return 100;
  const mfr = posFlow / negFlow;
  return Number((100 - (100 / (1 + mfr))).toFixed(2));
}

export function getRecommendation(tickerData, holding = null) {
  const { rsi, mfi, volRatio, price, changePercent, ma50, ma20 } = tickerData;
  const plPercent = holding ? ((price - holding.buyPrice) / holding.buyPrice) * 100 : 0;
  
  let action = 'HOLD';
  let strength = 'Normal';
  let reason = '';

  // 1. Tín hiệu MUA MẠNH
  if (rsi < 30 && mfi < 20 && volRatio > 1.2) {
    action = 'BUY';
    strength = 'Strong';
    reason = `TÍN HIỆU CỰC MẠNH: RSI (${rsi}) và MFI (${mfi}) đều quá bán, kèm theo Volume đột biến (Vol Ratio: ${volRatio.toFixed(2)}). Dòng tiền lớn đang bắt đáy quyết liệt.`;
    return { action, strength, reason };
  }

  // 2. Tín hiệu BÁN QUYẾT LIỆT / CẮT LỖ
  if (holding) {
    if (plPercent <= -7) {
      if (rsi < 30) {
        action = 'WATCH';
        strength = 'Warning';
        reason = `Vi phạm cắt lỗ (${plPercent.toFixed(2)}%) nhưng RSI đang quá bán cực độ (${rsi}). Khuyên bạn tạm giữ, chờ nhịp hồi kỹ thuật để bán được giá tốt hơn.`;
      } else {
        action = 'SELL';
        strength = 'Strong';
        reason = `BÁN QUYẾT LIỆT: Lỗ ${Math.abs(plPercent).toFixed(2)}%, vi phạm kỷ luật cắt lỗ (> 7%). Hãy thoát vị thế ngay để bảo vệ vốn.`;
      }
      return { action, strength, reason };
    }
  }

  if (rsi > 70 && mfi > 80 && volRatio < 0.8) {
    action = 'SELL';
    strength = 'Strong';
    reason = `CẢNH BÁO ĐẢO CHIỀU: RSI (${rsi}) và MFI (${mfi}) quá mua nhưng Volume đang đuối sức (Vol Ratio: ${volRatio.toFixed(2)}). Rủi ro sập mạnh rất cao.`;
    return { action, strength, reason };
  }

  // 3. Cảnh báo Bull Trap
  if (changePercent > 2 && volRatio < 0.7) {
    action = 'WATCH';
    strength = 'Warning';
    reason = `CẢNH BÁO BULL TRAP: Giá tăng mạnh (${changePercent}%) nhưng khối lượng rất thấp (Vol Ratio: ${volRatio.toFixed(2)}). Nhịp tăng thiếu bền vững.`;
    return { action, strength, reason };
  }

  // 4. Gồng lãi thông minh
  if (holding && plPercent >= 10) {
    if (mfi < 70 && rsi < 65) {
      action = 'HOLD';
      strength = 'Strong';
      reason = `GỒNG LÃI THÔNG MINH: Lợi nhuận ${plPercent.toFixed(2)}% nhưng Dòng tiền (MFI: ${mfi}) và RSI (${rsi}) vẫn đang hướng lên. Tiếp tục nắm giữ để tối ưu lợi nhuận.`;
    } else {
      action = 'SELL';
      strength = 'Normal';
      reason = `Lợi nhuận tốt (${plPercent.toFixed(2)}%) và các chỉ số đã tiệm cận vùng quá mua. Nên xem xét chốt lời từng phần.`;
    }
    return { action, strength, reason };
  }

  // 5. Mặc định
  if (rsi < 30 && price > ma50) {
    action = 'BUY';
    strength = 'Normal';
    reason = `Bắt đáy trong xu hướng tăng: RSI quá bán (${rsi}) khi giá vẫn giữ được MA50. Cơ hội giải ngân an toàn.`;
  } else if (rsi > 70) {
    action = 'SELL';
    strength = 'Normal';
    reason = `RSI quá mua (${rsi}). Thị trường đang nóng, nên hạ tỷ trọng.`;
  } else {
    action = 'HOLD';
    strength = 'Normal';
    reason = `Thị trường đang tích lũy. RSI (${rsi}) và MFI (${mfi}) ổn định. Tiếp tục nắm giữ và quan sát.`;
  }

  return { action, strength, reason };
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
      const mfi = calculateMFI(history);
      const ma50 = calculateMA(history, 50);
      const ma20 = calculateMA(history, 20);
      const volMA20 = calculateVolMA(history, 20);
      const volRatio = volMA20 > 0 ? latest.volume / volMA20 : 1;
      
      const analysis = getRecommendation({
        rsi, mfi, volRatio, ma50, ma20,
        price: latest.close,
        changePercent: Number(changePercent.toFixed(2))
      });

      return {
        ...ticker,
        price: latest.close,
        change: Number(change.toFixed(2)),
        changePercent: Number(changePercent.toFixed(2)),
        volume: latest.volume,
        rsi,
        mfi,
        ma50,
        ma20,
        volMA20,
        volRatio,
        prediction: analysis.action,
        strength: analysis.strength,
        reason: analysis.reason,
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
