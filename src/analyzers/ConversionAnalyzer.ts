import { Page } from 'playwright';
import { ConversionCheckResult, Issue, Opportunity } from '../types';

export class ConversionAnalyzer {
  async analyze(page: Page): Promise<{ score: number; issues: Issue[]; opportunities: Opportunity[]; checkResult: ConversionCheckResult }> {
    const checkResult = await this.performConversionChecks(page);
    const score = this.calculateConversionScore(checkResult);
    const issues = this.extractIssues(checkResult, score);
    const opportunities = this.extractOpportunities(checkResult);

    return {
      score,
      issues,
      opportunities,
      checkResult
    };
  }

  private async performConversionChecks(page: Page): Promise<ConversionCheckResult> {
    const result: ConversionCheckResult = {
      hasPhoneNumber: false,
      isPhoneClickable: false,
      hasContactForm: false,
      hasReservationButton: false,
      hasBusinessHours: false,
      hasAccessInfo: false,
      hasMap: false,
      hasSNSLinks: false,
      ctaElements: []
    };

    // 電話番号の検出
    const phoneRegex = /0\d{1,4}-?\d{1,4}-?\d{4}/g;
    const pageText = await page.textContent('body') || '';
    const phoneMatches = pageText.match(phoneRegex);
    
    if (phoneMatches && phoneMatches.length > 0) {
      result.hasPhoneNumber = true;
      result.phoneNumbers = [...new Set(phoneMatches)]; // 重複を除去

      // クリッカブルな電話番号の確認
      const telLinks = await page.$$('a[href^="tel:"]');
      result.isPhoneClickable = telLinks.length > 0;
    }

    // 問い合わせフォームの検出
    const forms = await page.$$('form');
    for (const form of forms) {
      const formText = await form.textContent() || '';
      if (formText.includes('問い合わせ') || formText.includes('お問合せ') || 
          formText.includes('contact') || formText.includes('Contact')) {
        result.hasContactForm = true;
        const inputs = await form.$$('input[type="text"], input[type="email"], textarea');
        result.formFieldCount = inputs.length;
        break;
      }
    }

    // 予約ボタンの検出
    const reservationKeywords = ['予約', '予約する', 'ご予約', 'booking', 'reserve', 'appointment'];
    for (const keyword of reservationKeywords) {
      const elements = await page.$$(`button:has-text("${keyword}"), a:has-text("${keyword}")`);
      if (elements.length > 0) {
        result.hasReservationButton = true;
        break;
      }
    }

    // 営業時間の検出
    const businessHoursKeywords = ['営業時間', '営業日', '受付時間', '診療時間', 'hours', 'open'];
    for (const keyword of businessHoursKeywords) {
      const elements = await page.$$(`*:has-text("${keyword}")`);
      if (elements.length > 0) {
        result.hasBusinessHours = true;
        const parent = elements[0];
        const text = await parent.textContent();
        if (text && text.length < 200) {
          result.businessHours = text.trim();
        }
        break;
      }
    }

    // アクセス情報の検出
    const accessKeywords = ['アクセス', '所在地', '住所', 'access', 'location', 'address'];
    for (const keyword of accessKeywords) {
      const elements = await page.$$(`*:has-text("${keyword}")`);
      if (elements.length > 0) {
        result.hasAccessInfo = true;
        break;
      }
    }

    // 地図の検出
    const mapSelectors = [
      'iframe[src*="google.com/maps"]',
      'iframe[src*="maps.google"]',
      '.gmap',
      '#map',
      '[class*="map"]'
    ];
    for (const selector of mapSelectors) {
      const maps = await page.$$(selector);
      if (maps.length > 0) {
        result.hasMap = true;
        break;
      }
    }

    // SNSリンクの検出
    const snsPatterns = [
      'facebook.com',
      'twitter.com',
      'instagram.com',
      'youtube.com',
      'line.me',
      'linkedin.com'
    ];
    const snsLinks: string[] = [];
    for (const pattern of snsPatterns) {
      const links = await page.$$(`a[href*="${pattern}"]`);
      if (links.length > 0) {
        snsLinks.push(pattern.replace('.com', '').replace('.me', ''));
      }
    }
    result.hasSNSLinks = snsLinks.length > 0;
    result.snsLinks = snsLinks;

    // CTAボタンの検出
    const ctaSelectors = [
      'button',
      'a.button',
      'a.btn',
      '[class*="cta"]',
      '[class*="button"]'
    ];
    
    for (const selector of ctaSelectors) {
      const elements = await page.$$(selector);
      for (const element of elements.slice(0, 10)) { // 最大10個まで
        const text = await element.textContent();
        const isVisible = await element.isVisible();
        
        if (text && isVisible && text.trim().length > 0 && text.trim().length < 30) {
          const computedStyle = await element.evaluate(el => {
            const style = window.getComputedStyle(el);
            return {
              fontSize: style.fontSize,
              backgroundColor: style.backgroundColor,
              color: style.color,
              padding: style.padding
            };
          });

          const isProminent = 
            parseFloat(computedStyle.fontSize) >= 16 ||
            computedStyle.backgroundColor !== 'rgba(0, 0, 0, 0)';

          const tagName = await element.evaluate(el => el.tagName);
          result.ctaElements.push({
            text: text.trim(),
            type: tagName === 'BUTTON' ? 'button' : 'link',
            isProminent
          });
        }
      }
    }

    return result;
  }

  private calculateConversionScore(result: ConversionCheckResult): number {
    let score = 0;
    let maxScore = 0;

    // 電話番号（20点）
    maxScore += 20;
    if (result.hasPhoneNumber) {
      score += 10;
      if (result.isPhoneClickable) {
        score += 10;
      }
    }

    // 問い合わせフォーム（15点）
    maxScore += 15;
    if (result.hasContactForm) {
      score += 10;
      if (result.formFieldCount && result.formFieldCount <= 5) {
        score += 5; // フォームが簡潔
      }
    }

    // 予約システム（15点）
    maxScore += 15;
    if (result.hasReservationButton) {
      score += 15;
    }

    // 営業時間（10点）
    maxScore += 10;
    if (result.hasBusinessHours) {
      score += 10;
    }

    // アクセス情報（10点）
    maxScore += 10;
    if (result.hasAccessInfo) {
      score += 10;
    }

    // 地図（10点）
    maxScore += 10;
    if (result.hasMap) {
      score += 10;
    }

    // SNSリンク（5点）
    maxScore += 5;
    if (result.hasSNSLinks) {
      score += 5;
    }

    // CTAボタン（15点）
    maxScore += 15;
    const prominentCTAs = result.ctaElements.filter(cta => cta.isProminent).length;
    if (prominentCTAs > 0) {
      score += Math.min(15, prominentCTAs * 5);
    }

    return Math.round((score / maxScore) * 100);
  }

  private extractIssues(result: ConversionCheckResult, _score: number): Issue[] {
    const issues: Issue[] = [];

    if (!result.hasPhoneNumber) {
      issues.push({
        category: 'Conversion',
        severity: 'Critical',
        description: '電話番号が掲載されていません',
        impact: '電話での問い合わせ機会を100%失っています',
        solution: 'ヘッダーまたはフッターに電話番号を目立つように配置'
      });
    } else if (!result.isPhoneClickable) {
      issues.push({
        category: 'Conversion',
        severity: 'High',
        description: '電話番号がクリックできません（tel:リンクなし）',
        impact: 'スマートフォンからの電話問い合わせが50%減少',
        solution: 'tel:リンクを設定してワンタップで電話できるように'
      });
    }

    if (!result.hasContactForm && !result.hasReservationButton) {
      issues.push({
        category: 'Conversion',
        severity: 'Critical',
        description: '問い合わせフォームも予約ボタンもありません',
        impact: 'オンラインでの問い合わせ・予約ができず機会損失',
        solution: '簡単な問い合わせフォームまたは予約システムを導入'
      });
    } else if (result.hasContactForm && result.formFieldCount && result.formFieldCount > 7) {
      issues.push({
        category: 'Conversion',
        severity: 'Medium',
        description: `問い合わせフォームの項目が多すぎます（${result.formFieldCount}項目）`,
        impact: 'フォーム離脱率が高くなり、問い合わせが減少',
        solution: '必須項目を3-5個に絞り、任意項目は最小限に'
      });
    }

    if (!result.hasBusinessHours) {
      issues.push({
        category: 'Conversion',
        severity: 'High',
        description: '営業時間が記載されていません',
        impact: '来店・来院のタイミングが分からず機会損失',
        solution: '営業時間を目立つ場所に明記'
      });
    }

    if (!result.hasAccessInfo && !result.hasMap) {
      issues.push({
        category: 'Conversion',
        severity: 'High',
        description: 'アクセス情報や地図がありません',
        impact: '来店・来院を諦める顧客が発生',
        solution: 'Google Mapsの埋め込みと詳細なアクセス方法を追加'
      });
    }

    if (result.ctaElements.filter(cta => cta.isProminent).length === 0) {
      issues.push({
        category: 'Conversion',
        severity: 'Medium',
        description: '目立つCTAボタンがありません',
        impact: 'ユーザーの次のアクションが不明確でコンバージョン率低下',
        solution: '「予約する」「問い合わせる」などの明確なCTAボタンを配置'
      });
    }

    return issues;
  }

  private extractOpportunities(result: ConversionCheckResult): Opportunity[] {
    const opportunities: Opportunity[] = [];

    if (!result.isPhoneClickable && result.hasPhoneNumber) {
      opportunities.push({
        title: '電話番号のクリック対応',
        description: 'tel:リンクの設定でモバイルからの電話問い合わせを倍増',
        estimatedImprovement: 30,
        estimatedRevenueLift: 40000,
        effort: 'Low',
        priority: 10
      });
    }

    if (!result.hasReservationButton) {
      opportunities.push({
        title: 'オンライン予約システムの導入',
        description: '24時間予約受付で営業時間外の機会も獲得',
        estimatedImprovement: 40,
        estimatedRevenueLift: 60000,
        effort: 'Medium',
        priority: 9
      });
    }

    if (!result.hasMap) {
      opportunities.push({
        title: 'Google Maps の埋め込み',
        description: '視覚的なアクセス情報で来店率向上',
        estimatedImprovement: 15,
        estimatedRevenueLift: 20000,
        effort: 'Low',
        priority: 7
      });
    }

    if (!result.hasSNSLinks) {
      opportunities.push({
        title: 'SNS連携の追加',
        description: 'SNSでの情報発信でリピート率向上',
        estimatedImprovement: 10,
        estimatedRevenueLift: 15000,
        effort: 'Low',
        priority: 5
      });
    }

    if (result.ctaElements.length < 3) {
      opportunities.push({
        title: 'CTAボタンの最適化',
        description: '各セクションに明確なアクションボタンを配置',
        estimatedImprovement: 20,
        estimatedRevenueLift: 30000,
        effort: 'Medium',
        priority: 8
      });
    }

    return opportunities;
  }
}