import { Opportunity } from '../types';
import { INDUSTRY_CONFIGS } from '../config/constants';

interface AnalysisData {
  scores: {
    total: number;
    performance: number;
    mobile: number;
    seo: number;
    conversion: number;
    content: number;
  };
  performanceResult: { opportunities: Opportunity[] };
  seoResult: { opportunities: Opportunity[] };
  mobileResult: { opportunities: Opportunity[] };
  conversionResult: { opportunities: Opportunity[] };
  contentResult: { opportunities: Opportunity[] };
}

export class OpportunityCalculator {
  calculate(data: AnalysisData, industry?: string): Opportunity[] {
    const industryConfig = industry ? 
      INDUSTRY_CONFIGS[industry] || INDUSTRY_CONFIGS.default :
      INDUSTRY_CONFIGS.default;

    // 各分析結果から機会を収集
    const allOpportunities: Opportunity[] = [
      ...data.performanceResult.opportunities,
      ...data.seoResult.opportunities,
      ...data.mobileResult.opportunities,
      ...data.conversionResult.opportunities,
      ...data.contentResult.opportunities
    ];

    // 業種別の調整
    const adjustedOpportunities = allOpportunities.map(opp => {
      // 業種に応じて収益影響を調整
      const adjustedRevenueLift = this.adjustRevenueByIndustry(
        opp.estimatedRevenueLift,
        industryConfig.averageMonthlyRevenue
      );

      return {
        ...opp,
        estimatedRevenueLift: adjustedRevenueLift
      };
    });

    // 追加の統合的な機会を生成
    const syntheticOpportunities = this.generateSyntheticOpportunities(data, industryConfig);
    
    // すべての機会を統合
    const combinedOpportunities = [...adjustedOpportunities, ...syntheticOpportunities];

    // 重複を除去し、優先度でソート
    const uniqueOpportunities = this.deduplicateOpportunities(combinedOpportunities);
    
    // 優先度を再計算
    const prioritizedOpportunities = this.recalculatePriorities(uniqueOpportunities, data.scores);

    // 上位10個に絞る
    return prioritizedOpportunities.slice(0, 10);
  }

  private adjustRevenueByIndustry(baseRevenue: number, industryAverage: number): number {
    // 業種平均に基づいて収益影響を調整
    const adjustmentFactor = industryAverage / 2500000; // デフォルト業種の平均を基準
    return Math.round(baseRevenue * adjustmentFactor);
  }

  private generateSyntheticOpportunities(data: AnalysisData, industryConfig: any): Opportunity[] {
    const opportunities: Opportunity[] = [];

    // 総合スコアが低い場合の全面リニューアル提案
    if (data.scores.total < 30) {
      opportunities.push({
        title: 'Webサイトの全面リニューアル',
        description: '現代的なデザインと機能で競合他社に差をつける',
        estimatedImprovement: 60,
        estimatedRevenueLift: industryConfig.averageMonthlyRevenue * 0.1, // 10%の収益向上
        effort: 'High',
        priority: 10
      });
    }

    // パフォーマンスとモバイルの両方が低い場合
    if (data.scores.performance < 50 && data.scores.mobile < 50) {
      opportunities.push({
        title: 'モバイルファースト設計への移行',
        description: 'スマートフォンユーザーを最優先した高速サイトの構築',
        estimatedImprovement: 40,
        estimatedRevenueLift: industryConfig.averageMonthlyRevenue * 0.08,
        effort: 'High',
        priority: 9
      });
    }

    // SEOとコンテンツの両方が低い場合
    if (data.scores.seo < 50 && data.scores.content < 50) {
      opportunities.push({
        title: 'コンテンツマーケティング戦略の導入',
        description: 'SEOに強い有益なコンテンツで集客力を強化',
        estimatedImprovement: 35,
        estimatedRevenueLift: industryConfig.averageMonthlyRevenue * 0.06,
        effort: 'Medium',
        priority: 8
      });
    }

    // コンバージョンが特に低い場合
    if (data.scores.conversion < 40) {
      opportunities.push({
        title: 'コンバージョン最適化（CRO）プログラム',
        description: 'A/Bテストとユーザー行動分析で成約率を倍増',
        estimatedImprovement: 30,
        estimatedRevenueLift: industryConfig.averageMonthlyRevenue * 0.12,
        effort: 'Medium',
        priority: 9
      });
    }

    return opportunities;
  }

  private deduplicateOpportunities(opportunities: Opportunity[]): Opportunity[] {
    const seen = new Map<string, Opportunity>();
    
    opportunities.forEach(opp => {
      const key = opp.title.toLowerCase();
      const existing = seen.get(key);
      
      if (!existing || opp.priority > existing.priority) {
        seen.set(key, opp);
      }
    });

    return Array.from(seen.values());
  }

  private recalculatePriorities(opportunities: Opportunity[], scores: any): Opportunity[] {
    return opportunities.map(opp => {
      let priorityBoost = 0;

      // スコアが低い分野に関連する機会の優先度を上げる
      if (opp.title.includes('パフォーマンス') && scores.performance < 50) {
        priorityBoost += 2;
      }
      if (opp.title.includes('モバイル') && scores.mobile < 50) {
        priorityBoost += 2;
      }
      if (opp.title.includes('SEO') && scores.seo < 50) {
        priorityBoost += 2;
      }
      if (opp.title.includes('コンバージョン') && scores.conversion < 50) {
        priorityBoost += 2;
      }

      // 努力レベルが低く、影響が大きい機会を優先
      if (opp.effort === 'Low' && opp.estimatedImprovement > 20) {
        priorityBoost += 3;
      }

      // 収益影響が大きい機会を優先
      if (opp.estimatedRevenueLift > 50000) {
        priorityBoost += 2;
      }

      return {
        ...opp,
        priority: Math.min(10, opp.priority + priorityBoost)
      };
    }).sort((a, b) => {
      // 優先度で降順ソート、同じ場合は収益影響で降順ソート
      if (b.priority !== a.priority) {
        return b.priority - a.priority;
      }
      return b.estimatedRevenueLift - a.estimatedRevenueLift;
    });
  }

  calculateTotalOpportunityValue(opportunities: Opportunity[]): {
    totalMonthlyRevenueLift: number;
    totalImprovement: number;
    quickWins: Opportunity[];
    highImpact: Opportunity[];
  } {
    const totalMonthlyRevenueLift = opportunities.reduce(
      (sum, opp) => sum + opp.estimatedRevenueLift, 
      0
    );

    const totalImprovement = opportunities.reduce(
      (sum, opp) => sum + opp.estimatedImprovement, 
      0
    );

    const quickWins = opportunities.filter(
      opp => opp.effort === 'Low' && opp.estimatedImprovement >= 10
    );

    const highImpact = opportunities.filter(
      opp => opp.estimatedRevenueLift >= 30000 || opp.estimatedImprovement >= 25
    );

    return {
      totalMonthlyRevenueLift,
      totalImprovement,
      quickWins,
      highImpact
    };
  }
}