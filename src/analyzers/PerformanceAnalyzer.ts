import axios from 'axios';
import { PageSpeedResult, Issue, Opportunity } from '../types';
import { API_ENDPOINTS, DEFAULT_ANALYZER_CONFIG } from '../config/constants';
import winston from 'winston';

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.simple(),
  transports: [new winston.transports.Console()]
});

export class PerformanceAnalyzer {
  private apiKey: string | undefined;
  private retryAttempts: number;
  private retryDelay: number;

  constructor() {
    this.apiKey = process.env.PAGESPEED_API_KEY;
    this.retryAttempts = DEFAULT_ANALYZER_CONFIG.retryAttempts;
    this.retryDelay = DEFAULT_ANALYZER_CONFIG.retryDelay;
  }

  async analyze(url: string): Promise<{ score: number; issues: Issue[]; opportunities: Opportunity[]; metrics: any }> {
    if (!this.apiKey) {
      logger.warn('PageSpeed APIキーが設定されていません。簡易測定モードで実行します。');
      return this.fallbackAnalyze(url);
    }

    for (let attempt = 1; attempt <= this.retryAttempts; attempt++) {
      try {
        const [mobileResult, desktopResult] = await Promise.all([
          this.fetchPageSpeedData(url, 'mobile'),
          this.fetchPageSpeedData(url, 'desktop')
        ]);

        // モバイルスコアを重視（7:3の比率）
        const combinedScore = Math.round(mobileResult.score * 0.7 + desktopResult.score * 0.3);
        
        // メトリクスはモバイルを使用
        const metrics = mobileResult.metrics;
        
        // 課題の抽出
        const issues = this.extractIssues(mobileResult, desktopResult, combinedScore);
        
        // 改善機会の抽出
        const opportunities = this.extractOpportunities(mobileResult, desktopResult);

        return {
          score: combinedScore,
          issues,
          opportunities,
          metrics
        };

      } catch (error: any) {
        logger.warn(`PageSpeed API呼び出しエラー (試行 ${attempt}/${this.retryAttempts}):`, error.message);
        
        if (attempt < this.retryAttempts) {
          await new Promise(resolve => setTimeout(resolve, this.retryDelay));
        }
      }
    }

    logger.error('PageSpeed API呼び出しが失敗しました。簡易測定モードにフォールバックします。');
    return this.fallbackAnalyze(url);
  }

  private async fetchPageSpeedData(url: string, strategy: 'mobile' | 'desktop'): Promise<PageSpeedResult> {
    const params = {
      url,
      key: this.apiKey,
      strategy,
      category: ['performance', 'accessibility', 'seo'],
      locale: 'ja'
    };

    const response = await axios.get(API_ENDPOINTS.pageSpeed, {
      params,
      timeout: 30000
    });

    const data = response.data;
    const lighthouse = data.lighthouseResult;

    // Core Web Vitalsの抽出
    const metrics = {
      lcp: lighthouse.audits['largest-contentful-paint']?.numericValue / 1000 || 0,
      cls: lighthouse.audits['cumulative-layout-shift']?.numericValue || 0,
      fid: lighthouse.audits['max-potential-fid']?.numericValue || 0,
      ttfb: lighthouse.audits['server-response-time']?.numericValue / 1000 || 0,
      fcp: lighthouse.audits['first-contentful-paint']?.numericValue / 1000 || 0,
      tbt: lighthouse.audits['total-blocking-time']?.numericValue || 0
    };

    // 改善提案の抽出
    const opportunities = Object.entries(lighthouse.audits)
      .filter(([_, audit]: [string, any]) => 
        audit.score !== null && 
        audit.score < 0.9 && 
        audit.details?.type === 'opportunity'
      )
      .map(([id, audit]: [string, any]) => ({
        id,
        title: audit.title,
        description: audit.description,
        scoreImpact: Math.round((1 - audit.score) * 100),
        displayValue: audit.displayValue
      }));

    return {
      score: Math.round(lighthouse.categories.performance.score * 100),
      metrics,
      opportunities
    };
  }

  private extractIssues(mobileResult: PageSpeedResult, desktopResult: PageSpeedResult, combinedScore: number): Issue[] {
    const issues: Issue[] = [];

    // パフォーマンススコアによる課題
    if (combinedScore < 30) {
      issues.push({
        category: 'Performance',
        severity: 'Critical',
        description: 'ページの読み込み速度が極めて遅い',
        impact: '訪問者の70%以上が離脱する可能性があります',
        solution: 'PageYouのPremiumプランで高速化対応を実施'
      });
    } else if (combinedScore < 50) {
      issues.push({
        category: 'Performance',
        severity: 'High',
        description: 'ページの読み込み速度が遅い',
        impact: '訪問者の50%が離脱する可能性があります',
        solution: 'PageYouのStandardプランで改善可能'
      });
    }

    // Core Web Vitalsによる課題
    if (mobileResult.metrics.lcp > 4) {
      issues.push({
        category: 'Performance',
        severity: 'Critical',
        description: 'LCP（最大コンテンツの描画）が4秒以上',
        impact: 'Googleの検索順位が大幅に低下します',
        solution: '画像の最適化とCDN導入で改善'
      });
    } else if (mobileResult.metrics.lcp > 2.5) {
      issues.push({
        category: 'Performance',
        severity: 'High',
        description: 'LCP（最大コンテンツの描画）が遅い',
        impact: 'ユーザー体験の低下とSEOへの悪影響',
        solution: '画像の遅延読み込みと圧縮で改善'
      });
    }

    if (mobileResult.metrics.cls > 0.25) {
      issues.push({
        category: 'Performance',
        severity: 'High',
        description: 'CLS（レイアウトのずれ）が大きい',
        impact: '誤クリックによるユーザー離脱の増加',
        solution: '画像・広告のサイズ指定で改善'
      });
    }

    if (mobileResult.metrics.fid > 300) {
      issues.push({
        category: 'Performance',
        severity: 'Medium',
        description: 'FID（初回入力遅延）が300ms以上',
        impact: 'ボタンクリックの反応が遅い',
        solution: 'JavaScriptの最適化で改善'
      });
    }

    // モバイルとデスクトップの差が大きい場合
    if (Math.abs(mobileResult.score - desktopResult.score) > 30) {
      issues.push({
        category: 'Performance',
        severity: 'Medium',
        description: 'モバイルとデスクトップでパフォーマンスの差が大きい',
        impact: 'モバイルユーザーの体験が特に悪い',
        solution: 'レスポンシブ最適化とモバイル専用の軽量化'
      });
    }

    return issues;
  }

  private extractOpportunities(mobileResult: PageSpeedResult, _desktopResult: PageSpeedResult): Opportunity[] {
    const opportunities: Opportunity[] = [];

    // PageSpeed Insightsの改善提案を変換
    mobileResult.opportunities.forEach(opp => {
      let effort: 'Low' | 'Medium' | 'High' = 'Medium';
      let estimatedRevenueLift = 0;

      // 影響度に応じて努力レベルと収益影響を設定
      if (opp.scoreImpact > 30) {
        effort = 'High';
        estimatedRevenueLift = 50000; // 5万円/月
      } else if (opp.scoreImpact > 15) {
        effort = 'Medium';
        estimatedRevenueLift = 30000; // 3万円/月
      } else {
        effort = 'Low';
        estimatedRevenueLift = 10000; // 1万円/月
      }

      opportunities.push({
        title: opp.title,
        description: opp.description + (opp.displayValue ? ` (${opp.displayValue})` : ''),
        estimatedImprovement: opp.scoreImpact,
        estimatedRevenueLift,
        effort,
        priority: Math.round(opp.scoreImpact / 10)
      });
    });

    // 追加の改善機会
    if (mobileResult.score < 50) {
      opportunities.push({
        title: 'CDN（コンテンツ配信ネットワーク）の導入',
        description: '世界中のサーバーから高速配信することで、読み込み時間を50%削減',
        estimatedImprovement: 30,
        estimatedRevenueLift: 40000,
        effort: 'Low',
        priority: 8
      });
    }

    if (mobileResult.metrics.lcp > 2.5) {
      opportunities.push({
        title: '画像の次世代フォーマット化',
        description: 'WebPやAVIF形式への変換で、画像サイズを30-50%削減',
        estimatedImprovement: 20,
        estimatedRevenueLift: 25000,
        effort: 'Low',
        priority: 7
      });
    }

    // 優先度でソート
    opportunities.sort((a, b) => b.priority - a.priority);

    return opportunities;
  }

  private async fallbackAnalyze(_url: string): Promise<{ score: number; issues: Issue[]; opportunities: Opportunity[]; metrics: any }> {
    // 簡易的な分析（APIキーがない場合）
    const metrics = {
      lcp: 3.5,
      cls: 0.15,
      fid: 200,
      ttfb: 1.5,
      fcp: 2.5,
      tbt: 300
    };

    const issues: Issue[] = [{
      category: 'Performance',
      severity: 'Medium',
      description: 'パフォーマンス測定はAPIキーなしの簡易モードで実行されました',
      impact: '正確な測定結果を得るにはPageSpeed APIキーが必要です',
      solution: '.envファイルにPAGESPEED_API_KEYを設定してください'
    }];

    const opportunities: Opportunity[] = [{
      title: 'PageSpeed API キーの設定',
      description: '正確なパフォーマンス測定のためAPIキーを設定してください',
      estimatedImprovement: 0,
      estimatedRevenueLift: 0,
      effort: 'Low',
      priority: 10
    }];

    return {
      score: 50, // デフォルトスコア
      issues,
      opportunities,
      metrics
    };
  }
}