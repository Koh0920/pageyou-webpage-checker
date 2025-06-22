import { Page } from 'playwright';
import { SEOCheckResult, Issue, Opportunity } from '../types';

export class SEOAnalyzer {
  async analyze(page: Page): Promise<{ score: number; issues: Issue[]; opportunities: Opportunity[]; checkResult: SEOCheckResult }> {
    const checkResult = await this.performSEOChecks(page);
    const score = this.calculateSEOScore(checkResult);
    const issues = this.extractIssues(checkResult, score);
    const opportunities = this.extractOpportunities(checkResult);

    return {
      score,
      issues,
      opportunities,
      checkResult
    };
  }

  private async performSEOChecks(page: Page): Promise<SEOCheckResult> {
    const result: SEOCheckResult = {
      hasTitle: false,
      titleLength: 0,
      hasMetaDescription: false,
      metaDescriptionLength: 0,
      hasH1: false,
      h1Count: 0,
      hasStructuredData: false,
      hasCanonical: false,
      hasOGP: false,
      hasRobotsTxt: false,
      hasSitemap: false
    };

    // タイトルタグ
    const title = await page.title();
    result.hasTitle = !!title;
    result.titleLength = title?.length || 0;
    result.titleContent = title;

    // メタディスクリプション
    const metaDescription = await page.$eval(
      'meta[name="description"]',
      el => el.getAttribute('content')
    ).catch(() => null);
    result.hasMetaDescription = !!metaDescription;
    result.metaDescriptionLength = metaDescription?.length || 0;
    result.metaDescriptionContent = metaDescription || undefined;

    // H1タグ
    const h1Elements = await page.$$('h1');
    result.hasH1 = h1Elements.length > 0;
    result.h1Count = h1Elements.length;
    if (h1Elements.length > 0) {
      result.h1Content = await Promise.all(
        h1Elements.slice(0, 3).map(el => el.textContent())
      ).then(contents => contents.filter(c => c) as string[]);
    }

    // 構造化データ
    const structuredDataScripts = await page.$$('script[type="application/ld+json"]');
    result.hasStructuredData = structuredDataScripts.length > 0;
    if (result.hasStructuredData) {
      const types = new Set<string>();
      for (const script of structuredDataScripts) {
        try {
          const content = await script.textContent();
          if (content) {
            const data = JSON.parse(content);
            if (data['@type']) {
              types.add(data['@type']);
            }
          }
        } catch (e) {
          // JSONパースエラーは無視
        }
      }
      result.structuredDataTypes = Array.from(types);
    }

    // Canonical URL
    const canonical = await page.$eval(
      'link[rel="canonical"]',
      el => el.getAttribute('href')
    ).catch(() => null);
    result.hasCanonical = !!canonical;
    result.canonicalUrl = canonical || undefined;

    // OGP
    const ogpMetas = await page.$$('meta[property^="og:"]');
    result.hasOGP = ogpMetas.length > 0;
    if (result.hasOGP) {
      result.ogpProperties = {};
      for (const meta of ogpMetas) {
        const property = await meta.getAttribute('property');
        const content = await meta.getAttribute('content');
        if (property && content) {
          result.ogpProperties[property] = content;
        }
      }
    }

    // robots.txt と sitemap.xml のチェック
    const url = page.url();
    const baseUrl = new URL(url).origin;
    
    try {
      const robotsResponse = await page.context().request.get(`${baseUrl}/robots.txt`);
      result.hasRobotsTxt = robotsResponse.status() === 200;
    } catch (e) {
      result.hasRobotsTxt = false;
    }

    try {
      const sitemapResponse = await page.context().request.get(`${baseUrl}/sitemap.xml`);
      result.hasSitemap = sitemapResponse.status() === 200;
    } catch (e) {
      result.hasSitemap = false;
    }

    // キーワード抽出（本文から）
    const bodyText = await page.textContent('body') || '';
    result.keywords = this.extractKeywords(bodyText);

    return result;
  }

  private calculateSEOScore(result: SEOCheckResult): number {
    let score = 100;

    // タイトル関連の減点
    if (!result.hasTitle) {
      score -= 20;
    } else if (result.titleLength < 20 || result.titleLength > 60) {
      score -= 10;
    }

    // メタディスクリプション関連の減点
    if (!result.hasMetaDescription) {
      score -= 15;
    } else if (result.metaDescriptionLength < 80 || result.metaDescriptionLength > 160) {
      score -= 7;
    }

    // H1タグ関連の減点
    if (!result.hasH1) {
      score -= 15;
    } else if (result.h1Count > 1) {
      score -= 5;
    }

    // 構造化データ
    if (!result.hasStructuredData) {
      score -= 10;
    }

    // Canonical URL
    if (!result.hasCanonical) {
      score -= 5;
    }

    // OGP
    if (!result.hasOGP) {
      score -= 5;
    }

    // robots.txt と sitemap.xml
    if (!result.hasRobotsTxt) {
      score -= 5;
    }
    if (!result.hasSitemap) {
      score -= 5;
    }

    return Math.max(0, score);
  }

  private extractIssues(result: SEOCheckResult, _score: number): Issue[] {
    const issues: Issue[] = [];

    if (!result.hasTitle) {
      issues.push({
        category: 'SEO',
        severity: 'Critical',
        description: 'タイトルタグが設定されていません',
        impact: '検索結果に表示されず、クリック率が大幅に低下します',
        solution: '各ページに固有の魅力的なタイトル（30-60文字）を設定'
      });
    } else if (result.titleLength < 20) {
      issues.push({
        category: 'SEO',
        severity: 'High',
        description: 'タイトルが短すぎます（20文字未満）',
        impact: 'SEOの機会損失とクリック率の低下',
        solution: 'キーワードを含む30-60文字のタイトルに変更'
      });
    } else if (result.titleLength > 60) {
      issues.push({
        category: 'SEO',
        severity: 'Medium',
        description: 'タイトルが長すぎます（60文字超）',
        impact: '検索結果で切れて表示される',
        solution: '重要な情報を前半に配置し、60文字以内に収める'
      });
    }

    if (!result.hasMetaDescription) {
      issues.push({
        category: 'SEO',
        severity: 'High',
        description: 'メタディスクリプションが設定されていません',
        impact: '検索結果での説明文が自動生成され、クリック率が低下',
        solution: '各ページの内容を要約した80-160文字の説明文を設定'
      });
    }

    if (!result.hasH1) {
      issues.push({
        category: 'SEO',
        severity: 'High',
        description: 'H1タグが存在しません',
        impact: 'ページの主題が検索エンジンに伝わりにくい',
        solution: 'ページのメインキーワードを含むH1タグを追加'
      });
    } else if (result.h1Count > 1) {
      issues.push({
        category: 'SEO',
        severity: 'Medium',
        description: `H1タグが複数存在します（${result.h1Count}個）`,
        impact: '検索エンジンがページの主題を判断しづらくなる',
        solution: 'H1タグは1ページに1つだけ使用し、他は H2-H6 を使用'
      });
    }

    if (!result.hasStructuredData) {
      issues.push({
        category: 'SEO',
        severity: 'Medium',
        description: '構造化データが実装されていません',
        impact: 'リッチスニペットが表示されず、クリック率向上の機会損失',
        solution: '業種に応じた構造化データ（JSON-LD）を実装'
      });
    }

    if (!result.hasOGP) {
      issues.push({
        category: 'SEO',
        severity: 'Medium',
        description: 'OGPタグが設定されていません',
        impact: 'SNSでシェアされた際の表示が最適化されない',
        solution: 'og:title, og:description, og:image等のOGPタグを設定'
      });
    }

    if (!result.hasSitemap) {
      issues.push({
        category: 'SEO',
        severity: 'Medium',
        description: 'サイトマップ（sitemap.xml）が存在しません',
        impact: '検索エンジンのクロールが非効率になる',
        solution: 'XMLサイトマップを作成し、Search Consoleに登録'
      });
    }

    return issues;
  }

  private extractOpportunities(result: SEOCheckResult): Opportunity[] {
    const opportunities: Opportunity[] = [];

    if (!result.hasStructuredData) {
      opportunities.push({
        title: '構造化データの実装',
        description: '業種別の構造化データでリッチスニペット表示を実現',
        estimatedImprovement: 20,
        estimatedRevenueLift: 30000,
        effort: 'Medium',
        priority: 8
      });
    }

    if (!result.hasTitle || result.titleLength < 30) {
      opportunities.push({
        title: 'タイトルタグの最適化',
        description: '検索キーワードを含む魅力的なタイトルでクリック率向上',
        estimatedImprovement: 15,
        estimatedRevenueLift: 25000,
        effort: 'Low',
        priority: 9
      });
    }

    if (!result.hasMetaDescription) {
      opportunities.push({
        title: 'メタディスクリプションの設定',
        description: '説明文の最適化でクリック率を20%向上',
        estimatedImprovement: 10,
        estimatedRevenueLift: 20000,
        effort: 'Low',
        priority: 7
      });
    }

    if (result.keywords && result.keywords.length < 5) {
      opportunities.push({
        title: 'コンテンツSEOの強化',
        description: '業種関連キーワードを含むコンテンツ追加で検索流入増加',
        estimatedImprovement: 25,
        estimatedRevenueLift: 40000,
        effort: 'High',
        priority: 6
      });
    }

    return opportunities;
  }

  private extractKeywords(text: string): string[] {
    // 簡易的なキーワード抽出（頻出単語）
    const words = text
      .replace(/[。、！？\n\r\t]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 2)
      .map(word => word.toLowerCase());

    const wordCount = new Map<string, number>();
    words.forEach(word => {
      wordCount.set(word, (wordCount.get(word) || 0) + 1);
    });

    return Array.from(wordCount.entries())
      .filter(([_word, count]) => count > 3)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([word]) => word);
  }
}