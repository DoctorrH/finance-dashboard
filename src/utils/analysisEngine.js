/**
 * Robo-Advisor Analysis Engine v3
 * 3-Tier Filtering: Fundamental, Big Money, Technical Context
 */

export class AnalysisEngine {
  constructor() {
    this.marketSentiment = 'Neutral'; // 'Bull', 'Bear', 'Neutral'
    this.vnIndexMA50 = 0;
  }

  /**
   * Tầng 1: Tầng Chất lượng (Safety Filter)
   * Đánh giá sức khỏe tài chính cơ bản
   */
  async checkFundamental(symbol) {
    try {
      const response = await fetch(`/api/finfo/ratios?symbols=${symbol}&direct=true`);
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const result = await response.json();
      const data = result.data || [];

      // Lấy các chỉ số cần thiết
      const findRatio = (code) => data.find(r => r.ratioCode === code)?.value || 0;
      
      const pe = findRatio('PE');
      const roe = findRatio('ROE') * 100; // Thường API trả về 0.12 thay vì 12
      const epsGrowth = findRatio('EPS_GROWTH') || 5; // Giả định nếu thiếu

      const isGood = pe > 0 && pe < 25 && roe > 10;
      const label = isGood ? 'Tốt' : (roe < 5 ? 'Rủi ro cao' : 'Trung bình');

      return {
        isGood,
        label,
        details: `ROE: ${roe.toFixed(1)}%, P/E: ${pe.toFixed(1)}`,
        pe,
        roe
      };
    } catch (err) {
      console.error(`Fundamental check failed for ${symbol}:`, err);
      return { isGood: true, label: 'N/A', details: 'Thiếu dữ liệu cơ bản' };
    }
  }

  /**
   * Tầng 2: Tầng Dòng tiền (Big Money Filter)
   * Theo dõi khối ngoại trong 5 phiên gần nhất
   */
  async getForeignFlow(symbol) {
    try {
      const to = new Date().toISOString().split('T')[0];
      const fromDate = new Date();
      fromDate.setDate(fromDate.getDate() - 10);
      const from = fromDate.toISOString().split('T')[0];

      const response = await fetch(`/api/finfo/foreign_data?symbols=${symbol}&from=${from}&to=${to}`);
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const result = await response.json();
      const data = result.data || [];

      // Lấy 5 phiên gần nhất
      const recent = data.slice(0, 5);
      const netValueTotal = recent.reduce((sum, item) => sum + (item.netValue || 0), 0);
      const buyCount = recent.filter(item => item.netValue > 0).length;

      let sentiment = 'Trung lập';
      let scoreBonus = 0;

      if (netValueTotal > 0 && buyCount >= 3) {
        sentiment = 'Khối ngoại gom ròng';
        scoreBonus = 10;
      } else if (netValueTotal < -10000000000) { // Ví dụ: bán ròng > 10 tỷ
        sentiment = 'Khối ngoại bán mạnh';
        scoreBonus = -15;
      }

      return { sentiment, scoreBonus, netValueTotal };
    } catch (err) {
      return { sentiment: 'N/A', scoreBonus: 0, netValueTotal: 0 };
    }
  }

  /**
   * Tầng 3: Bối cảnh Thị trường (Market Context)
   * Kiểm tra VN-Index so với MA50
   */
  async getMarketSentiment() {
    try {
      const to = Math.floor(Date.now() / 1000);
      const from = to - (6 * 30 * 24 * 60 * 60);
      const response = await fetch(`/api/dchart/history?resolution=D&symbol=VNINDEX&from=${from}&to=${to}`);
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const data = await response.json();
      
      if (data.s === 'ok') {
        const prices = data.c;
        const latest = prices[prices.length - 1];
        
        // Tính MA50 của VNINDEX
        const ma50 = prices.slice(-50).reduce((a, b) => a + b, 0) / 50;
        this.vnIndexMA50 = ma50;

        if (latest > ma50 * 1.02) {
          this.marketSentiment = 'Bull';
          return { status: 'Hưng phấn', isBear: false };
        } else if (latest < ma50 * 0.98) {
          this.marketSentiment = 'Bear';
          return { status: 'Hoảng loạn/Rủi ro', isBear: true };
        }
      }
      return { status: 'Trung lập', isBear: false };
    } catch (err) {
      return { status: 'N/A', isBear: false };
    }
  }

  /**
   * Tổng hợp báo cáo cuối cùng
   */
  async generateFinalReport(tickerData, holding = null) {
    const symbol = tickerData.symbol;
    
    // Chạy song song các bộ lọc để tối ưu hiệu năng
    const [fundamental, foreign, market] = await Promise.all([
      this.checkFundamental(symbol),
      this.getForeignFlow(symbol),
      this.getMarketSentiment()
    ]);

    // 1. Tính điểm kỹ thuật cơ bản (0-70)
    let techScore = 0;
    if (tickerData.rsi < 30) techScore += 30;
    else if (tickerData.rsi < 40) techScore += 15;
    
    if (tickerData.mfi < 20) techScore += 20;
    if (tickerData.volRatio > 1.2) techScore += 20;
    if (tickerData.price > tickerData.ma50) techScore += 10;

    // 2. Điều chỉnh theo dòng tiền và thị trường (Tổng tối đa 100)
    let finalScore = techScore + foreign.scoreBonus;
    if (fundamental.isGood) finalScore += 10;
    if (!market.isBear) finalScore += 10;

    // Giới hạn điểm 0-100
    finalScore = Math.max(0, Math.min(100, finalScore));

    // 3. Đưa ra nhận định
    let verdict = 'THEO DÕI';
    if (finalScore >= 80) verdict = 'MUA MẠNH';
    else if (finalScore >= 65) verdict = 'MUA';
    else if (finalScore <= 30) verdict = 'BÁN';

    // 4. Quản trị rủi ro
    const stopLossPct = market.isBear ? 5 : 7;
    const currentPrice = tickerData.price;
    
    return {
      ticker: symbol,
      rating: `${finalScore}/100`,
      verdict,
      analysis: {
        fundamental: `${fundamental.label} (${fundamental.details})`,
        technical: `RSI: ${tickerData.rsi}, MFI: ${tickerData.mfi}, Xu hướng: ${tickerData.price > tickerData.ma50 ? 'Tăng' : 'Giảm'}`,
        big_money: foreign.sentiment,
        market: market.status
      },
      risk_management: {
        stop_loss: `Giá hiện tại - ${stopLossPct}% (${(currentPrice * (1 - stopLossPct/100)).toLocaleString()}đ)`,
        take_profit: `Target 1 (RSI chạm 70), Target 2 (Vùng đỉnh cũ)`
      },
      isBear: market.isBear
    };
  }
}

export const engine = new AnalysisEngine();
