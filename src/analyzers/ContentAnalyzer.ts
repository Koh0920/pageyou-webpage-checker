import { Page } from 'playwright';
import { ContentCheckResult, Issue, Opportunity } from '../types';

export class ContentAnalyzer {
  async analyze(page: Page): Promise<{ score: number; issues: Issue[]; opportunities: Opportunity[]; checkResult: ContentCheckResult }> {
    const checkResult = await this.performContentChecks(page);
    const score = this.calculateContentScore(checkResult);
    const issues = this.extractIssues(checkResult, score);
    const opportunities = this.extractOpportunities(checkResult);

    return {
      score,
      issues,
      opportunities,
      checkResult
    };
  }

  private async performContentChecks(page: Page): Promise<ContentCheckResult> {
    const result: ContentCheckResult = {
      totalWords: 0,
      hasImages: false,
      imageCount: 0,
      imagesWithAlt: 0,
      readabilityScore: 0,
      hasVideoContent: false,
      hasFAQ: false,
      hasTestimonials: false,
      contentQualityScore: 0
    };

    // テキストコンテンツの分析
    const textContent = await page.textContent('body') || '';
    const cleanText = textContent
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    
    // 単語数のカウント（日本語と英語の両方に対応）
    const japaneseChars = (cleanText.match(/[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/g) || []).length;
    const englishWords = (cleanText.match(/\b[a-zA-Z]+\b/g) || []).length;
    result.totalWords = Math.round(japaneseChars * 0.5 + englishWords); // 日本語は2文字で1単語として計算

    // 画像の分析
    const images = await page.$$('img');
    result.hasImages = images.length > 0;
    result.imageCount = images.length;
    
    let imagesWithAltCount = 0;
    for (const img of images) {
      const alt = await img.getAttribute('alt');
      if (alt && alt.trim().length > 0) {
        imagesWithAltCount++;
      }
    }
    result.imagesWithAlt = imagesWithAltCount;

    // 動画コンテンツの確認
    const videos = await page.$$('video, iframe[src*="youtube"], iframe[src*="vimeo"]');
    result.hasVideoContent = videos.length > 0;

    // FAQセクションの確認
    const faqKeywords = ['よくある質問', 'FAQ', 'Q&A', '質問', 'お問い合わせ'];
    for (const keyword of faqKeywords) {
      const elements = await page.$$(`*:has-text("${keyword}")`);
      if (elements.length > 0) {
        result.hasFAQ = true;
        break;
      }
    }

    // お客様の声・レビューの確認
    const testimonialKeywords = ['お客様の声', 'レビュー', '口コミ', '評価', 'testimonial', 'review'];
    for (const keyword of testimonialKeywords) {
      const elements = await page.$$(`*:has-text("${keyword}")`);
      if (elements.length > 0) {
        result.hasTestimonials = true;
        break;
      }
    }

    // 最終更新日の推定（metaタグまたはフッターから）
    const lastModified = await page.$eval(
      'meta[name="last-modified"], meta[property="article:modified_time"]',
      el => el.getAttribute('content')
    ).catch(() => null);
    
    if (lastModified) {
      result.lastUpdated = new Date(lastModified);
    } else {
      // フッターから年号を探す
      const footerText = await page.textContent('footer') || '';
      const yearMatch = footerText.match(/20\d{2}/);
      if (yearMatch) {
        result.lastUpdated = new Date(`${yearMatch[0]}-01-01`);
      }
    }

    // 読みやすさスコアの計算
    result.readabilityScore = this.calculateReadabilityScore(cleanText, result);

    // コンテンツ品質スコアの計算
    result.contentQualityScore = this.calculateQualityScore(result);

    return result;
  }

  private calculateReadabilityScore(text: string, result: ContentCheckResult): number {
    let score = 50; // 基準スコア

    // 適切な文章量
    if (result.totalWords >= 300 && result.totalWords <= 2000) {
      score += 20;
    } else if (result.totalWords >= 200 || result.totalWords <= 3000) {
      score += 10;
    }

    // 見出しの使用（h2, h3など）
    // この情報は実際にはページから取得する必要があるが、簡略化
    score += 10;

    // 画像の適切な使用
    if (result.hasImages && result.imageCount > 0) {
      const imageRatio = result.imageCount / (result.totalWords / 100);
      if (imageRatio >= 0.5 && imageRatio <= 2) {
        score += 10;
      }
    }

    // 段落の適切な分割（推定）
    const paragraphCount = (text.match(/\n\n/g) || []).length + 1;
    if (paragraphCount > 3) {
      score += 10;
    }

    return Math.min(100, score);
  }

  private calculateQualityScore(result: ContentCheckResult): number {
    let score = 0;
    let factors = 0;

    // 文章量
    if (result.totalWords >= 500) {
      score += 20;
    } else if (result.totalWords >= 300) {
      score += 10;
    }
    factors++;

    // 画像の最適化
    if (result.hasImages && result.imagesWithAlt > 0) {
      const altRatio = result.imagesWithAlt / result.imageCount;
      score += Math.round(altRatio * 20);
    }
    factors++;

    // マルチメディアコンテンツ
    if (result.hasVideoContent) {
      score += 15;
    }
    factors++;

    // FAQ
    if (result.hasFAQ) {
      score += 15;
    }
    factors++;

    // レビュー・お客様の声
    if (result.hasTestimonials) {
      score += 15;
    }
    factors++;

    // 読みやすさ
    score += Math.round(result.readabilityScore * 0.15);
    factors++;

    return Math.round(score);
  }

  private calculateContentScore(result: ContentCheckResult): number {
    return result.contentQualityScore;
  }

  private extractIssues(result: ContentCheckResult, _score: number): Issue[] {
    const issues: Issue[] = [];

    if (result.totalWords < 200) {
      issues.push({
        category: 'Content',
        severity: 'High',
        description: 'コンテンツ量が極端に少ない',
        impact: 'SEO評価が低く、ユーザーに十分な情報を提供できていない',
        solution: '各ページに300文字以上の有益なコンテンツを追加'
      });
    }

    if (result.hasImages && result.imagesWithAlt === 0) {
      issues.push({
        category: 'Content',
        severity: 'Medium',
        description: '画像にalt属性が設定されていない',
        impact: 'SEO評価の低下とアクセシビリティの問題',
        solution: 'すべての画像に説明的なalt属性を追加'
      });
    } else if (result.hasImages && result.imagesWithAlt < result.imageCount * 0.8) {
      issues.push({
        category: 'Content',
        severity: 'Low',
        description: `一部の画像にalt属性がない（${result.imageCount - result.imagesWithAlt}個）`,
        impact: 'SEO評価とアクセシビリティの部分的な低下',
        solution: 'すべての画像にalt属性を追加'
      });
    }

    if (!result.hasFAQ && !result.hasTestimonials) {
      issues.push({
        category: 'Content',
        severity: 'Medium',
        description: '信頼性を高めるコンテンツが不足',
        impact: 'ユーザーの信頼獲得が困難でコンバージョン率低下',
        solution: 'FAQセクションやお客様の声を追加'
      });
    }

    if (result.lastUpdated) {
      const monthsOld = (Date.now() - result.lastUpdated.getTime()) / (1000 * 60 * 60 * 24 * 30);
      if (monthsOld > 12) {
        issues.push({
          category: 'Content',
          severity: 'Medium',
          description: 'コンテンツが1年以上更新されていない',
          impact: 'SEO評価の低下と情報の陳腐化',
          solution: '定期的なコンテンツ更新と新規コンテンツの追加'
        });
      }
    }

    if (result.readabilityScore < 50) {
      issues.push({
        category: 'Content',
        severity: 'Medium',
        description: 'コンテンツの読みやすさに問題がある',
        impact: '滞在時間の短縮と直帰率の上昇',
        solution: '見出しの追加、段落の整理、画像の適切な配置'
      });
    }

    return issues;
  }

  private extractOpportunities(result: ContentCheckResult): Opportunity[] {
    const opportunities: Opportunity[] = [];

    if (!result.hasVideoContent) {
      opportunities.push({
        title: '動画コンテンツの追加',
        description: '商品・サービスの紹介動画で滞在時間とコンバージョン率向上',
        estimatedImprovement: 25,
        estimatedRevenueLift: 35000,
        effort: 'Medium',
        priority: 7
      });
    }

    if (!result.hasFAQ) {
      opportunities.push({
        title: 'FAQセクションの作成',
        description: 'よくある質問への回答で問い合わせ対応工数削減とSEO向上',
        estimatedImprovement: 15,
        estimatedRevenueLift: 20000,
        effort: 'Low',
        priority: 8
      });
    }

    if (!result.hasTestimonials) {
      opportunities.push({
        title: 'お客様の声・レビューの掲載',
        description: '社会的証明でコンバージョン率を30%向上',
        estimatedImprovement: 20,
        estimatedRevenueLift: 30000,
        effort: 'Low',
        priority: 9
      });
    }

    if (result.totalWords < 500) {
      opportunities.push({
        title: 'コンテンツの充実',
        description: '詳細な説明と有益な情報でSEO評価とユーザー満足度向上',
        estimatedImprovement: 30,
        estimatedRevenueLift: 40000,
        effort: 'Medium',
        priority: 8
      });
    }

    opportunities.push({
      title: 'ブログ・お役立ち情報の定期更新',
      description: '継続的なコンテンツ更新でSEO評価向上とリピート訪問促進',
      estimatedImprovement: 35,
      estimatedRevenueLift: 50000,
      effort: 'High',
      priority: 6
    });

    return opportunities;
  }
}