import { Page } from 'playwright';
import { MobileCheckResult, Issue, Opportunity } from '../types';

export class MobileAnalyzer {
  async analyze(page: Page): Promise<{ score: number; issues: Issue[]; opportunities: Opportunity[]; checkResult: MobileCheckResult }> {
    const checkResult = await this.performMobileChecks(page);
    const score = this.calculateMobileScore(checkResult);
    const issues = this.extractIssues(checkResult, score);
    const opportunities = this.extractOpportunities(checkResult);

    return {
      score,
      issues,
      opportunities,
      checkResult
    };
  }

  private async performMobileChecks(page: Page): Promise<MobileCheckResult> {
    const result: MobileCheckResult = {
      hasViewport: false,
      isMobileResponsive: false,
      touchTargetSize: false,
      textSizeReadable: false,
      horizontalScrolling: false,
      mobileScore: 0
    };

    // ビューポートメタタグの確認
    const viewport = await page.$eval(
      'meta[name="viewport"]',
      el => el.getAttribute('content')
    ).catch(() => null);
    
    result.hasViewport = !!viewport;
    result.viewportContent = viewport || undefined;

    // モバイルビューでの確認のため、一時的にビューポートを変更
    const originalViewport = page.viewportSize();
    await page.setViewportSize({ width: 375, height: 667 }); // iPhone SE サイズ

    // レスポンシブデザインの確認
    const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
    const viewportWidth = 375;
    result.isMobileResponsive = bodyWidth <= viewportWidth + 20; // 20pxの余裕を持たせる

    // 横スクロールの確認
    result.horizontalScrolling = bodyWidth > viewportWidth;

    // タッチターゲットサイズの確認
    const touchTargets = await page.$$('a, button, input, select, textarea');
    let adequateSizeCount = 0;
    let totalTargets = Math.min(touchTargets.length, 20); // 最大20個まで確認

    for (let i = 0; i < totalTargets; i++) {
      const target = touchTargets[i];
      const box = await target.boundingBox();
      if (box && box.width >= 44 && box.height >= 44) {
        adequateSizeCount++;
      }
    }
    
    result.touchTargetSize = totalTargets > 0 ? (adequateSizeCount / totalTargets) >= 0.8 : false;

    // テキストサイズの確認
    const textElements = await page.$$('p, span, div, li');
    let readableTextCount = 0;
    let totalTextElements = Math.min(textElements.length, 20); // 最大20個まで確認

    for (let i = 0; i < totalTextElements; i++) {
      const element = textElements[i];
      const fontSize = await element.evaluate(el => {
        const style = window.getComputedStyle(el);
        return parseFloat(style.fontSize);
      });
      
      if (fontSize >= 14) {
        readableTextCount++;
      }
    }

    result.textSizeReadable = totalTextElements > 0 ? (readableTextCount / totalTextElements) >= 0.8 : false;

    // モバイル特有の要素の確認
    // const hasMobileMenu = await page.$('button[aria-label*="menu"], button[class*="menu"], .hamburger, #mobile-menu') !== null;
    // const hasClickablePhone = await page.$('a[href^="tel:"]') !== null;
    // const hasNoFlash = await page.$('object[type*="flash"], embed[type*="flash"]') === null;

    // 元のビューポートに戻す
    if (originalViewport) {
      await page.setViewportSize(originalViewport);
    }

    // モバイルスコアの計算（内部用）
    let mobileScore = 0;
    if (result.hasViewport) mobileScore += 20;
    if (result.isMobileResponsive) mobileScore += 30;
    if (!result.horizontalScrolling) mobileScore += 20;
    if (result.touchTargetSize) mobileScore += 15;
    if (result.textSizeReadable) mobileScore += 15;
    
    result.mobileScore = mobileScore;

    return result;
  }

  private calculateMobileScore(result: MobileCheckResult): number {
    return result.mobileScore;
  }

  private extractIssues(result: MobileCheckResult, score: number): Issue[] {
    const issues: Issue[] = [];

    if (!result.hasViewport) {
      issues.push({
        category: 'Mobile',
        severity: 'Critical',
        description: 'ビューポートメタタグが設定されていません',
        impact: 'モバイルでの表示が最適化されず、使いづらいサイトに',
        solution: '<meta name="viewport" content="width=device-width, initial-scale=1">を追加'
      });
    }

    if (!result.isMobileResponsive || result.horizontalScrolling) {
      issues.push({
        category: 'Mobile',
        severity: 'Critical',
        description: 'レスポンシブデザインが実装されていません',
        impact: 'モバイルユーザーの80%以上が離脱する可能性',
        solution: 'レスポンシブWebデザインの実装またはモバイル専用サイトの構築'
      });
    }

    if (!result.touchTargetSize) {
      issues.push({
        category: 'Mobile',
        severity: 'High',
        description: 'タップターゲットが小さすぎます',
        impact: '誤タップによるユーザー体験の低下と離脱率上昇',
        solution: 'ボタンやリンクを最小44×44ピクセルに拡大'
      });
    }

    if (!result.textSizeReadable) {
      issues.push({
        category: 'Mobile',
        severity: 'Medium',
        description: 'モバイルでのテキストサイズが小さすぎます',
        impact: '読みづらさによる滞在時間の短縮',
        solution: '本文のフォントサイズを14px以上に設定'
      });
    }

    if (score < 30) {
      issues.push({
        category: 'Mobile',
        severity: 'Critical',
        description: 'モバイル対応が全体的に不十分です',
        impact: 'Google検索でのモバイル検索順位が大幅に低下',
        solution: 'モバイルファーストでの全面的なリニューアルを推奨'
      });
    }

    return issues;
  }

  private extractOpportunities(result: MobileCheckResult): Opportunity[] {
    const opportunities: Opportunity[] = [];

    if (!result.isMobileResponsive) {
      opportunities.push({
        title: 'レスポンシブWebデザインの実装',
        description: 'すべてのデバイスで最適な表示を実現し、モバイルユーザーを獲得',
        estimatedImprovement: 50,
        estimatedRevenueLift: 80000,
        effort: 'High',
        priority: 10
      });
    }

    if (!result.hasViewport) {
      opportunities.push({
        title: 'ビューポート設定の追加',
        description: '1行のコード追加でモバイル表示を大幅改善',
        estimatedImprovement: 20,
        estimatedRevenueLift: 30000,
        effort: 'Low',
        priority: 9
      });
    }

    if (!result.touchTargetSize) {
      opportunities.push({
        title: 'タッチUI の最適化',
        description: 'ボタンサイズの拡大でモバイルコンバージョン率30%向上',
        estimatedImprovement: 15,
        estimatedRevenueLift: 25000,
        effort: 'Medium',
        priority: 7
      });
    }

    if (result.mobileScore < 70) {
      opportunities.push({
        title: 'AMP（Accelerated Mobile Pages）の導入',
        description: '超高速モバイルページでユーザー体験を劇的に改善',
        estimatedImprovement: 30,
        estimatedRevenueLift: 40000,
        effort: 'Medium',
        priority: 6
      });
    }

    opportunities.push({
      title: 'PWA（Progressive Web App）化',
      description: 'アプリのような体験でエンゲージメント率を倍増',
      estimatedImprovement: 25,
      estimatedRevenueLift: 35000,
      effort: 'High',
      priority: 5
    });

    return opportunities;
  }
}