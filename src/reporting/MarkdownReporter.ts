import { writeFileSync } from 'fs';
import { AnalysisResult } from '../types';
import { FILE_PATHS, PAGEYOU_PLANS } from '../config/constants';

export class MarkdownReporter {
  async generate(results: AnalysisResult[]): Promise<void> {
    const markdown = this.generateMarkdown(results);
    writeFileSync(FILE_PATHS.MARKDOWN_REPORT, markdown, 'utf-8');
  }

  private generateMarkdown(results: AnalysisResult[]): string {
    const sections = [
      this.generateHeader(),
      this.generateExecutiveSummary(results),
      this.generateHighPriorityDetails(results),
      this.generateIndustryAnalysis(results),
      this.generateRecommendations(results),
      this.generateAppendix()
    ];

    return sections.join('\n\n');
  }

  private generateHeader(): string {
    return `# PageYou 見込み顧客分析レポート

**生成日時**: ${new Date().toLocaleString('ja-JP')}  
**分析ツール**: PageYou Prospect Analyzer v1.0

---`;
  }

  private generateExecutiveSummary(results: AnalysisResult[]): string {
    const highPriority = results.filter(r => r.priority === 'High');
    const totalLoss = results.reduce((sum, r) => sum + r.estimatedMonthlyLoss, 0);
    const avgScore = Math.round(results.reduce((sum, r) => sum + r.scores.total, 0) / results.length);

    return `## 1. エグゼクティブサマリー

### 📊 分析結果概要

- **分析件数**: ${results.length}件
- **高優先度案件**: ${highPriority.length}件
- **平均スコア**: ${avgScore}点
- **推定機会損失合計**: ¥${totalLoss.toLocaleString()}/月

### 🎯 重要な発見

${this.generateKeyFindings(results)}

### 💰 期待される成果

高優先度案件（${highPriority.length}件）への対応により、**月間¥${highPriority.reduce((sum, r) => sum + r.estimatedMonthlyLoss, 0).toLocaleString()}**の売上向上が期待できます。`;
  }

  private generateKeyFindings(results: AnalysisResult[]): string {
    const findings = [];

    // パフォーマンスの問題
    const poorPerformance = results.filter(r => r.scores.performance < 50);
    if (poorPerformance.length > 0) {
      findings.push(`- **${poorPerformance.length}件**のサイトで深刻な表示速度の問題を検出`);
    }

    // モバイル対応の問題
    const poorMobile = results.filter(r => r.scores.mobile < 50);
    if (poorMobile.length > 0) {
      findings.push(`- **${poorMobile.length}件**のサイトがモバイル対応不十分`);
    }

    // コンバージョンの問題
    const poorConversion = results.filter(r => r.scores.conversion < 50);
    if (poorConversion.length > 0) {
      findings.push(`- **${poorConversion.length}件**のサイトで問い合わせ導線に問題`);
    }

    return findings.join('\n');
  }

  private generateHighPriorityDetails(results: AnalysisResult[]): string {
    const highPriority = results
      .filter(r => r.priority === 'High')
      .sort((a, b) => b.estimatedMonthlyLoss - a.estimatedMonthlyLoss)
      .slice(0, 10);

    if (highPriority.length === 0) {
      return '## 2. 高優先度案件詳細\n\n高優先度案件はありません。';
    }

    let content = `## 2. 高優先度案件詳細（上位${highPriority.length}件）\n\n`;

    highPriority.forEach((result, index) => {
      content += this.generateDetailedAnalysis(result, index + 1);
      content += '\n---\n\n';
    });

    return content;
  }

  private generateDetailedAnalysis(result: AnalysisResult, rank: number): string {
    const topIssues = result.issues
      .sort((a, b) => {
        const severityOrder = { Critical: 1, High: 2, Medium: 3, Low: 4 };
        return severityOrder[a.severity] - severityOrder[b.severity];
      })
      .slice(0, 5);

    const topOpportunities = result.opportunities
      .sort((a, b) => b.priority - a.priority)
      .slice(0, 3);

    return `### ${rank}. ${result.businessInfo.businessName || result.url}

**URL**: ${result.url}  
**業種**: ${result.businessInfo.industry || '未分類'}  
**総合スコア**: ${result.scores.total}点  
**推定月間損失**: ¥${result.estimatedMonthlyLoss.toLocaleString()}

#### 📈 スコア内訳

| カテゴリ | スコア | 評価 |
|---------|--------|------|
| パフォーマンス | ${result.scores.performance} | ${this.getScoreEmoji(result.scores.performance)} |
| モバイル対応 | ${result.scores.mobile} | ${this.getScoreEmoji(result.scores.mobile)} |
| SEO | ${result.scores.seo} | ${this.getScoreEmoji(result.scores.seo)} |
| コンバージョン | ${result.scores.conversion} | ${this.getScoreEmoji(result.scores.conversion)} |
| コンテンツ | ${result.scores.content} | ${this.getScoreEmoji(result.scores.content)} |

#### 🚨 主な問題点

${topIssues.map(issue => `- **[${issue.severity}]** ${issue.description}\n  - 影響: ${issue.impact}`).join('\n')}

#### 💡 改善提案

${topOpportunities.map(opp => `- **${opp.title}**\n  - ${opp.description}\n  - 期待効果: ${opp.estimatedImprovement}%向上、¥${opp.estimatedRevenueLift.toLocaleString()}/月`).join('\n')}

#### 🎯 推奨アクション

**推奨プラン**: ${result.recommendedPlan}プラン（${PAGEYOU_PLANS[result.recommendedPlan].monthlyPrice.toLocaleString()}円/月）

${this.generateROIEstimate(result)}`;
  }

  private getScoreEmoji(score: number): string {
    if (score >= 80) return '🟢 優秀';
    if (score >= 60) return '🟡 良好';
    if (score >= 40) return '🟠 要改善';
    return '🔴 緊急';
  }

  private generateROIEstimate(result: AnalysisResult): string {
    const plan = PAGEYOU_PLANS[result.recommendedPlan];
    const monthlyReturn = result.estimatedMonthlyLoss * 0.7; // 70%の改善を想定
    const roi = Math.round(((monthlyReturn - plan.monthlyPrice) / plan.monthlyPrice) * 100);

    return `投資対効果（ROI）: **${roi}%** （3ヶ月で投資回収見込み）`;
  }

  private generateIndustryAnalysis(results: AnalysisResult[]): string {
    const byIndustry = new Map<string, AnalysisResult[]>();
    
    results.forEach(result => {
      const industry = result.businessInfo.industry || '未分類';
      if (!byIndustry.has(industry)) {
        byIndustry.set(industry, []);
      }
      byIndustry.get(industry)!.push(result);
    });

    let content = '## 3. 業種別分析\n\n';

    byIndustry.forEach((industryResults, industry) => {
      const avgScore = Math.round(
        industryResults.reduce((sum, r) => sum + r.scores.total, 0) / industryResults.length
      );

      content += `### ${industry}（${industryResults.length}件）\n\n`;
      content += `- 平均スコア: ${avgScore}点\n`;
      content += `- 高優先度: ${industryResults.filter(r => r.priority === 'High').length}件\n`;
      content += this.generateCommonIssues(industryResults);
      content += '\n\n';
    });

    return content;
  }

  private generateCommonIssues(results: AnalysisResult[]): string {
    const issueCount = new Map<string, number>();
    
    results.forEach(result => {
      result.issues.forEach(issue => {
        const key = `${issue.category}: ${issue.description}`;
        issueCount.set(key, (issueCount.get(key) || 0) + 1);
      });
    });

    const commonIssues = Array.from(issueCount.entries())
      .filter(([_, count]) => count >= results.length * 0.5)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);

    if (commonIssues.length === 0) {
      return '';
    }

    return `\n**共通する問題点:**\n${commonIssues.map(([issue, count]) => 
      `- ${issue}（${Math.round(count / results.length * 100)}%で発生）`
    ).join('\n')}`;
  }

  private generateRecommendations(results: AnalysisResult[]): string {
    const highPriority = results.filter(r => r.priority === 'High');
    const totalMonthlyLoss = highPriority.reduce((sum, r) => sum + r.estimatedMonthlyLoss, 0);

    return `## 4. 営業戦略の推奨事項

### 🎯 優先順位付け

1. **最優先対応（今週中）**
   - 高優先度かつ月間損失10万円以上の案件
   - ${highPriority.filter(r => r.estimatedMonthlyLoss >= 100000).length}件該当

2. **優先対応（今月中）**
   - その他の高優先度案件
   - ${highPriority.filter(r => r.estimatedMonthlyLoss < 100000).length}件該当

3. **定期フォロー（四半期ごと）**
   - 中・低優先度案件
   - ${results.filter(r => r.priority !== 'High').length}件該当

### 📞 アプローチ方法

#### 高優先度案件への提案スクリプト

> 「現在のWebサイトを分析させていただいたところ、月間約○○万円の機会損失が発生している可能性があります。
> 特に${this.getTopIssueCategories(highPriority)}の改善により、大幅な売上向上が期待できます。
> 詳細な改善提案書をお送りしてもよろしいでしょうか？」

### 💰 期待成果

- 高優先度案件の30%が成約した場合: **月間¥${Math.round(totalMonthlyLoss * 0.3).toLocaleString()}**の新規売上
- 年間換算: **¥${Math.round(totalMonthlyLoss * 0.3 * 12).toLocaleString()}**の売上増加`;
  }

  private getTopIssueCategories(results: AnalysisResult[]): string {
    const categories = new Map<string, number>();
    
    results.forEach(result => {
      result.issues.forEach(issue => {
        categories.set(issue.category, (categories.get(issue.category) || 0) + 1);
      });
    });

    return Array.from(categories.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 2)
      .map(([cat]) => {
        const categoryNames = {
          Performance: 'サイト表示速度',
          Mobile: 'モバイル対応',
          SEO: 'SEO対策',
          Conversion: 'お問い合わせ導線',
          Content: 'コンテンツ品質'
        };
        return categoryNames[cat as keyof typeof categoryNames] || cat;
      })
      .join('と');
  }

  private generateAppendix(): string {
    return `## 5. 付録

### 📖 用語説明

- **総合スコア**: Webサイトの総合的な品質を0-100で評価
- **推定月間損失**: 現在のサイト状態により失っている潜在的な売上
- **優先度**: High（緊急対応）、Medium（要対応）、Low（経過観察）

### 🔧 PageYouプランの詳細

| プラン | 月額費用 | 主な機能 |
|--------|----------|----------|
| Simple | ¥30,000 | 基本的なSEO対策、モバイル対応、表示速度改善 |
| Standard | ¥50,000 | Simpleプラン＋高度なSEO、コンバージョン最適化 |
| Premium | ¥100,000 | Standardプラン＋カスタムデザイン、専任コンサルタント |

### 📞 お問い合わせ

PageYou営業チーム  
Email: sales@pageyou.com  
Tel: 03-XXXX-XXXX

---

*このレポートは自動生成されています。詳細な分析や個別のご相談はお気軽にお問い合わせください。*`;
  }
}