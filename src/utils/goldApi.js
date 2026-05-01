// src/utils/goldApi.js

// Hàm hỗ trợ tính toán RSI
function calculateRSI(closes, period = 14) {
  if (closes.length <= period) return 50;
  
  let gains = 0;
  let losses = 0;
  
  for (let i = 1; i <= period; i++) {
    const diff = closes[closes.length - 1 - period + i] - closes[closes.length - 1 - period + i - 1];
    if (diff >= 0) gains += diff;
    else losses -= diff;
  }
  
  let avgGain = gains / period;
  let avgLoss = losses / period;
  
  if (avgLoss === 0) return 100;
  let rs = avgGain / avgLoss;
  let rsi = 100 - (100 / (1 + rs));
  
  // Smoothing for the rest
  for (let i = closes.length - period; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    const gain = diff >= 0 ? diff : 0;
    const loss = diff < 0 ? -diff : 0;
    
    avgGain = (avgGain * 13 + gain) / 14;
    avgLoss = (avgLoss * 13 + loss) / 14;
    
    if (avgLoss === 0) rsi = 100;
    else {
      rs = avgGain / avgLoss;
      rsi = 100 - (100 / (1 + rs));
    }
  }
  
  return Math.round(rsi);
}

function generateReason(rsi) {
  if (rsi > 70) {
    return {
      prediction: 'SELL',
      reason: `Vàng Thế Giới đang ở vùng Quá Mua (RSI = ${rsi}). Áp lực chốt lời gia tăng, rủi ro điều chỉnh rất cao. Hạn chế mua đuổi, cân nhắc chốt lời một phần.`
    };
  } else if (rsi < 30) {
    return {
      prediction: 'BUY',
      reason: `Vàng Thế Giới đang ở vùng Quá Bán sâu (RSI = ${rsi}). Lực xả đã cạn kiệt, xác suất xuất hiện nhịp phục hồi kỹ thuật là rất lớn. Cơ hội tốt để gom dần.`
    };
  } else if (rsi >= 50) {
    return {
      prediction: 'HOLD',
      reason: `Giá Vàng Thế Giới đang duy trì đà tăng nhẹ (RSI = ${rsi}). Lực cầu ổn định, tiếp tục NẮM GIỮ và theo dõi các mốc kháng cự phía trên.`
    };
  } else {
    return {
      prediction: 'HOLD',
      reason: `Vàng Thế Giới đang trong pha điều chỉnh tích lũy (RSI = ${rsi}). Xu hướng chưa rõ ràng, NẮM GIỮ quan sát thêm, hạn chế mở mới vị thế.`
    };
  }
}

// Mapping from API keys to Vietnamese display names (moved from backend)
const NAME_MAP = {
  'BTSJC':       'Bảo Tín SJC',
  'BT9999NTT':   'Bảo Tín Minh Châu 9999',
  'SJL1L10':     'SJC Vàng miếng 9999',
  'SJ9999':      'SJC Nhẫn tròn 9999',
  'VNGSJC':      'VN Gold SJC',
  'VIETTINMSJC': 'Viettin SJC',
  'PQHN24NTT':   'PNJ 24K',
  'PQHNVM':      'PNJ Hà Nội',
  'DOJINHTV':    'DOJI Nhẫn Hưng Thịnh Vượng',
  'DOHCML':      'DOJI Hồ Chí Minh',
  'DOHNL':       'DOJI Hà Nội',
  'XAUUSD':      'Vàng Thế Giới (XAU/USD)'
};

export async function fetchDomesticGold() {
  try {
    const res = await fetch('/api/giavang-now/api/prices');
    if (!res.ok) throw new Error('giavang.now API failed');
    const data = await res.json();

    if (data && data.success && data.prices) {
      const domesticData = [];

      for (const [key, item] of Object.entries(data.prices)) {
        // Skip world gold - only domestic
        if (key === 'XAUUSD') continue;

        domesticData.push({
          city: NAME_MAP[key] || item.name,
          type: item.name,
          buy: item.buy,
          sell: item.sell,
          change_buy: item.change_buy || 0,
          change_sell: item.change_sell || 0
        });
      }

      return domesticData;
    }

    throw new Error('Invalid response from giavang.now');
  } catch (err) {
    console.error('Failed to fetch domestic gold prices:', err);
    // Fallback mock data
    return [
      { city: 'SJC', type: 'Vàng miếng SJC', buy: 163000000, sell: 166000000, change_buy: 0, change_sell: 0 },
      { city: 'SJC', type: 'Vàng nhẫn SJC 99,99', buy: 162500000, sell: 165500000, change_buy: 0, change_sell: 0 },
      { city: 'Bảo Tín Minh Châu', type: 'Vàng 9999', buy: 163000000, sell: 166000000, change_buy: 0, change_sell: 0 },
      { city: 'DOJI', type: 'Nhẫn Hưng Thịnh Vượng', buy: 163000000, sell: 166000000, change_buy: 0, change_sell: 0 },
      { city: 'PNJ', type: 'Vàng 24K', buy: 163000000, sell: 166000000, change_buy: 0, change_sell: 0 },
    ];
  }
}

export async function fetchWorldGold() {
  try {
    const res = await fetch('/api/yahoo/v8/finance/chart/GC=F?interval=1d&range=6mo');
    if (!res.ok) throw new Error('Yahoo proxy failed');
    const data = await res.json();
    
    const result = data.chart.result[0];
    const timestamps = result.timestamp;
    const quotes = result.indicators.quote[0];
    
    const history = [];
    for (let i = 0; i < timestamps.length; i++) {
      if (quotes.open[i] !== null && quotes.close[i] !== null) {
        const dateStr = new Date(timestamps[i] * 1000).toISOString().split('T')[0];
        history.push({
          time: dateStr,
          open: quotes.open[i],
          high: quotes.high[i],
          low: quotes.low[i],
          close: quotes.close[i],
          volume: quotes.volume[i] || 0
        });
      }
    }
    
    history.sort((a, b) => new Date(a.time) - new Date(b.time));
    
    if (history.length === 0) throw new Error('No historical data found');

    const closes = history.map(h => h.close);
    const rsi = calculateRSI(closes);
    const { prediction, reason } = generateReason(rsi);
    
    const currentPrice = closes[closes.length - 1];
    const previousPrice = closes.length > 1 ? closes[closes.length - 2] : currentPrice;
    const change = currentPrice - previousPrice;
    const changePercent = (change / previousPrice) * 100;
    
    return {
      symbol: 'XAU/USD',
      name: 'Vàng Thế Giới (Gold Futures)',
      price: currentPrice,
      change: change,
      changePercent: changePercent,
      volume: history[history.length - 1].volume,
      rsi: rsi,
      prediction: prediction,
      reason: reason,
      history: history
    };

  } catch(err) {
    console.error('Failed to fetch World Gold', err);
    throw err;
  }
}
