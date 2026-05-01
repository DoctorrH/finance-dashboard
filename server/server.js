const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

// Mapping from API keys to Vietnamese display names
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

app.get('/api/gold/domestic', async (req, res) => {
  try {
    const response = await axios.get('https://giavang.now/api/prices', {
      timeout: 10000
    });

    if (response.data && response.data.success && response.data.prices) {
      const prices = response.data.prices;
      const domesticData = [];

      for (const [key, item] of Object.entries(prices)) {
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

      console.log(`[OK] Fetched ${domesticData.length} gold prices from giavang.now`);
      return res.json(domesticData);
    }

    throw new Error('Invalid response from giavang.now');
  } catch (err) {
    console.error('giavang.now API failed:', err.message);

    // Fallback mock data
    return res.json([
      { city: 'SJC', type: 'Vàng miếng SJC', buy: 163000000, sell: 166000000, change_buy: 0, change_sell: 0 },
      { city: 'SJC', type: 'Vàng nhẫn SJC 99,99', buy: 162500000, sell: 165500000, change_buy: 0, change_sell: 0 },
      { city: 'Bảo Tín Minh Châu', type: 'Vàng 9999', buy: 163000000, sell: 166000000, change_buy: 0, change_sell: 0 },
      { city: 'DOJI', type: 'Nhẫn Hưng Thịnh Vượng', buy: 163000000, sell: 166000000, change_buy: 0, change_sell: 0 },
      { city: 'PNJ', type: 'Vàng 24K', buy: 163000000, sell: 166000000, change_buy: 0, change_sell: 0 },
    ]);
  }
});

app.listen(PORT, () => {
  console.log(`Gold Backend Server running on http://localhost:${PORT}`);
});
