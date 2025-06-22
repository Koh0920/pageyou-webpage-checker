import { stringify } from 'csv-stringify/sync';
import { writeFileSync } from 'fs';
import { AnalysisResult } from '../types';
import { FILE_PATHS } from '../config/constants';

export class CSVReporter {
  async generate(results: AnalysisResult[]): Promise<void> {
    const sortedResults = this.sortResults(results);
    const csvData = this.formatForCSV(sortedResults);
    const csvContent = stringify(csvData, { header: true });
    
    writeFileSync(FILE_PATHS.CSV_REPORT, csvContent, 'utf-8');
  }

  private sortResults(results: AnalysisResult[]): AnalysisResult[] {
    // 優先度順（High → Medium → Low）、その後スコアの昇順
    return results.sort((a, b) => {
      const priorityOrder = { High: 1, Medium: 2, Low: 3 };
      const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
      
      if (priorityDiff !== 0) {
        return priorityDiff;
      }
      
      // 同じ優先度の場合はスコアの昇順（低いスコアほど改善の余地が大きい）
      return a.scores.total - b.scores.total;
    });
  }

  private formatForCSV(results: AnalysisResult[]): any[] {
    return results.map(result => {
      // 主な問題点を最大3つまで抽出
      const topIssues = result.issues
        .sort((a, b) => {
          const severityOrder = { Critical: 1, High: 2, Medium: 3, Low: 4 };
          return severityOrder[a.severity] - severityOrder[b.severity];
        })
        .slice(0, 3)
        .map(issue => `${issue.description}（${issue.severity}）`)
        .join('; ');

      // 改善による期待効果を計算
      const totalImprovement = result.opportunities
        .slice(0, 3)
        .reduce((sum, opp) => sum + opp.estimatedImprovement, 0);

      // 次のアクションを生成
      const nextAction = this.generateNextAction(result);

      return {
        'URL': result.url,
        '事業者名': result.businessInfo.businessName || '',
        '業種': result.businessInfo.industry || '',
        '地域': result.businessInfo.location || '',
        '総合スコア': result.scores.total,
        '優先度': result.priority,
        '推定月間損失額（円）': Math.round(result.estimatedMonthlyLoss),
        '推奨プラン': result.recommendedPlan,
        '主な問題点': topIssues,
        '改善による期待効果（%）': totalImprovement,
        '次のアクション': nextAction,
        'パフォーマンススコア': result.scores.performance,
        'モバイルスコア': result.scores.mobile,
        'SEOスコア': result.scores.seo,
        'コンバージョンスコア': result.scores.conversion,
        'コンテンツスコア': result.scores.content,
        '分析日時': new Date(result.analyzedAt).toLocaleString('ja-JP')
      };
    });
  }

  private generateNextAction(result: AnalysisResult): string {
    if (result.priority === 'High') {
      if (result.scores.total < 30) {
        return '緊急対応が必要です。すぐにご連絡ください。';
      } else {
        return '優先的に改善提案をお送りします。';
      }
    } else if (result.priority === 'Medium') {
      return '改善提案の準備をいたします。';
    } else {
      return '定期的な見直しをご提案します。';
    }
  }

  generateSummaryCSV(results: AnalysisResult[]): void {
    const summary = {
      '分析件数': results.length,
      '高優先度案件数': results.filter(r => r.priority === 'High').length,
      '中優先度案件数': results.filter(r => r.priority === 'Medium').length, 
      '低優先度案件数': results.filter(r => r.priority === 'Low').length,
      '平均スコア': Math.round(results.reduce((sum, r) => sum + r.scores.total, 0) / results.length),
      '推定月間損失額合計（円）': results.reduce((sum, r) => sum + r.estimatedMonthlyLoss, 0),
      'Premium推奨数': results.filter(r => r.recommendedPlan === 'Premium').length,
      'Standard推奨数': results.filter(r => r.recommendedPlan === 'Standard').length,
      'Simple推奨数': results.filter(r => r.recommendedPlan === 'Simple').length
    };

    const summaryData = Object.entries(summary).map(([key, value]) => ({ 項目: key, 値: value }));
    const summaryCSV = stringify(summaryData, { header: true });
    
    writeFileSync(FILE_PATHS.CSV_REPORT.replace('.csv', '_summary.csv'), summaryCSV, 'utf-8');
  }
}