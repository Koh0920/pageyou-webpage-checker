import { ScoringWeights } from '../types';
import { 
  DEFAULT_SCORING_WEIGHTS, 
  INDUSTRY_CONFIGS, 
  PRIORITY_THRESHOLDS,
  PAGEYOU_PLANS 
} from '../config/constants';

interface AnalysisResults {
  performance: { score: number };
  seo: { score: number };
  mobile: { score: number };
  conversion: { score: number };
  content: { score: number };
  isHttps: boolean;
}

export class ScoringEngine {
  private defaultWeights: ScoringWeights;

  constructor() {
    this.defaultWeights = DEFAULT_SCORING_WEIGHTS;
  }

  calculateScores(
    results: AnalysisResults,
    industry?: string
  ): {
    total: number;
    performance: number;
    mobile: number;
    seo: number;
    conversion: number;
    content: number;
  } {
    // 業種別の重み付けを取得
    const industryConfig = industry ? 
      INDUSTRY_CONFIGS[industry] || INDUSTRY_CONFIGS.default :
      INDUSTRY_CONFIGS.default;

    // 基本スコアを取得
    const baseScores = {
      performance: results.performance.score,
      mobile: results.mobile.score,
      seo: results.seo.score,
      conversion: results.conversion.score,
      content: results.content.score
    };

    // HTTPS対応による加点/減点
    if (!results.isHttps) {
      baseScores.performance = Math.max(0, baseScores.performance - 10);
      baseScores.seo = Math.max(0, baseScores.seo - 15);
    }

    // 業種別の重み付けを適用した個別スコア
    const adjustedScores = {
      performance: Math.round(baseScores.performance * industryConfig.weightMultipliers.performance),
      mobile: Math.round(baseScores.mobile * industryConfig.weightMultipliers.mobile),
      seo: Math.round(baseScores.seo * industryConfig.weightMultipliers.seo),
      conversion: Math.round(baseScores.conversion * industryConfig.weightMultipliers.conversion),
      content: Math.round(baseScores.content * industryConfig.weightMultipliers.content)
    };

    // 総合スコアの計算（重み付け平均）
    const totalScore = Math.round(
      (adjustedScores.performance * this.defaultWeights.performance +
       adjustedScores.mobile * this.defaultWeights.mobile +
       adjustedScores.seo * this.defaultWeights.seo +
       adjustedScores.conversion * this.defaultWeights.conversion +
       adjustedScores.content * this.defaultWeights.content) /
      (this.defaultWeights.performance +
       this.defaultWeights.mobile +
       this.defaultWeights.seo +
       this.defaultWeights.conversion +
       this.defaultWeights.content)
    );

    return {
      total: Math.min(100, Math.max(0, totalScore)),
      performance: Math.min(100, Math.max(0, adjustedScores.performance)),
      mobile: Math.min(100, Math.max(0, adjustedScores.mobile)),
      seo: Math.min(100, Math.max(0, adjustedScores.seo)),
      conversion: Math.min(100, Math.max(0, adjustedScores.conversion)),
      content: Math.min(100, Math.max(0, adjustedScores.content))
    };
  }

  recommendPlan(totalScore: number): 'Simple' | 'Standard' | 'Premium' {
    if (totalScore < 40) {
      return 'Premium';
    } else if (totalScore < 70) {
      return 'Standard';
    } else {
      return 'Simple';
    }
  }

  determinePriority(totalScore: number, estimatedMonthlyLoss: number): 'High' | 'Medium' | 'Low' {
    // スコアが低い、または月間損失が大きい場合は高優先度
    if (totalScore <= PRIORITY_THRESHOLDS.High.scoreMax || 
        estimatedMonthlyLoss >= PRIORITY_THRESHOLDS.High.monthlyLossMin) {
      return 'High';
    }
    
    // 中程度のスコア、または中程度の月間損失の場合は中優先度
    if (totalScore <= PRIORITY_THRESHOLDS.Medium.scoreMax || 
        estimatedMonthlyLoss >= PRIORITY_THRESHOLDS.Medium.monthlyLossMin) {
      return 'Medium';
    }
    
    // それ以外は低優先度
    return 'Low';
  }

  calculateImprovementPotential(currentScore: number, targetPlan: 'Simple' | 'Standard' | 'Premium'): number {
    const targetScore = PAGEYOU_PLANS[targetPlan].targetScore;
    return Math.max(0, targetScore - currentScore);
  }

  estimateROI(
    currentScore: number,
    targetPlan: 'Simple' | 'Standard' | 'Premium',
    industry?: string,
    currentMonthlyRevenue?: number
  ): {
    monthlyInvestment: number;
    estimatedMonthlyReturn: number;
    paybackPeriodMonths: number;
    threeYearROI: number;
  } {
    const plan = PAGEYOU_PLANS[targetPlan];
    const industryConfig = industry ? 
      INDUSTRY_CONFIGS[industry] || INDUSTRY_CONFIGS.default :
      INDUSTRY_CONFIGS.default;

    const improvementPotential = this.calculateImprovementPotential(currentScore, targetPlan);
    const revenueBase = currentMonthlyRevenue || industryConfig.averageMonthlyRevenue;

    // スコア改善による収益向上率を計算（1ポイント改善で約0.5%の収益向上と仮定）
    const revenueImprovementRate = improvementPotential * 0.005;
    const estimatedMonthlyReturn = revenueBase * revenueImprovementRate;

    // 投資回収期間の計算
    const paybackPeriodMonths = plan.monthlyPrice > 0 ? 
      Math.ceil(plan.monthlyPrice / Math.max(1, estimatedMonthlyReturn - plan.monthlyPrice)) : 
      0;

    // 3年間のROIを計算
    const totalInvestment = plan.monthlyPrice * 36;
    const totalReturn = estimatedMonthlyReturn * 36;
    const threeYearROI = totalInvestment > 0 ? 
      Math.round(((totalReturn - totalInvestment) / totalInvestment) * 100) : 
      0;

    return {
      monthlyInvestment: plan.monthlyPrice,
      estimatedMonthlyReturn,
      paybackPeriodMonths,
      threeYearROI
    };
  }

  getScoreInterpretation(score: number, category: string): string {
    if (score >= 90) {
      return `${category}は非常に優れています。現状を維持しつつ、さらなる向上を目指しましょう。`;
    } else if (score >= 70) {
      return `${category}は良好ですが、改善の余地があります。`;
    } else if (score >= 50) {
      return `${category}に改善が必要です。優先的に対策を行いましょう。`;
    } else if (score >= 30) {
      return `${category}に大きな問題があります。早急な対策が必要です。`;
    } else {
      return `${category}は深刻な状態です。全面的な見直しが必要です。`;
    }
  }

  generateScoreBreakdown(scores: {
    total: number;
    performance: number;
    mobile: number;
    seo: number;
    conversion: number;
    content: number;
  }): Array<{ category: string; score: number; weight: number; contribution: number }> {
    const weights = this.defaultWeights;
    const totalWeight = Object.values(weights).reduce((sum, w) => sum + w, 0);

    return [
      {
        category: 'パフォーマンス',
        score: scores.performance,
        weight: weights.performance,
        contribution: Math.round((scores.performance * weights.performance) / totalWeight)
      },
      {
        category: 'モバイル対応',
        score: scores.mobile,
        weight: weights.mobile,
        contribution: Math.round((scores.mobile * weights.mobile) / totalWeight)
      },
      {
        category: 'SEO',
        score: scores.seo,
        weight: weights.seo,
        contribution: Math.round((scores.seo * weights.seo) / totalWeight)
      },
      {
        category: 'コンバージョン',
        score: scores.conversion,
        weight: weights.conversion,
        contribution: Math.round((scores.conversion * weights.conversion) / totalWeight)
      },
      {
        category: 'コンテンツ',
        score: scores.content,
        weight: weights.content,
        contribution: Math.round((scores.content * weights.content) / totalWeight)
      }
    ];
  }
}