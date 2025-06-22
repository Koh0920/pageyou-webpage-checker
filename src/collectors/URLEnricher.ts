import { Page, chromium, Browser } from 'playwright';
import { BusinessInfo } from '../types';
import winston from 'winston';

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.simple(),
  transports: [new winston.transports.Console()]
});

interface EnrichedBusinessInfo extends BusinessInfo {
  technologies?: string[];
  lastUpdated?: Date;
  hasSNS?: boolean;
  snsLinks?: string[];
  employeeCount?: string;
  establishedYear?: string;
}

export class URLEnricher {
  private browser: Browser | null = null;

  async enrichBusinessInfo(businesses: BusinessInfo[]): Promise<EnrichedBusinessInfo[]> {
    await this.initBrowser();
    const enrichedBusinesses: EnrichedBusinessInfo[] = [];

    for (const business of businesses) {
      try {
        logger.info(`情報収集中: ${business.url}`);
        const enrichedInfo = await this.enrichSingleBusiness(business);
        enrichedBusinesses.push(enrichedInfo);
        
        // レート制限
        await new Promise(resolve => setTimeout(resolve, 2000));
      } catch (error) {
        logger.error(`エンリッチメントエラー (${business.url}):`, error);
        enrichedBusinesses.push(business); // エラーの場合は元の情報をそのまま使用
      }
    }

    await this.closeBrowser();
    return enrichedBusinesses;
  }

  private async initBrowser(): Promise<void> {
    if (!this.browser) {
      this.browser = await chromium.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });
    }
  }

  private async closeBrowser(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  private async enrichSingleBusiness(business: BusinessInfo): Promise<EnrichedBusinessInfo> {
    const page = await this.browser!.newPage();
    const enriched: EnrichedBusinessInfo = { ...business };

    try {
      await page.goto(business.url, {
        waitUntil: 'networkidle',
        timeout: 30000
      });

      // 技術スタックの検出
      enriched.technologies = await this.detectTechnologies(page);

      // 最終更新日の推定
      enriched.lastUpdated = await this.estimateLastUpdate(page);

      // SNSプレゼンスの確認
      const snsInfo = await this.checkSNSPresence(page);
      enriched.hasSNS = snsInfo.hasSNS;
      enriched.snsLinks = snsInfo.links;

      // 従業員数の推定
      enriched.employeeCount = await this.estimateEmployeeCount(page);

      // 設立年の取得
      enriched.establishedYear = await this.findEstablishedYear(page);

    } catch (error) {
      logger.warn(`ページ分析エラー (${business.url}):`, error);
    } finally {
      await page.close();
    }

    return enriched;
  }

  private async detectTechnologies(page: Page): Promise<string[]> {
    const technologies: string[] = [];

    try {
      // メタタグから検出
      const generator = await page.$eval(
        'meta[name="generator"]',
        el => el.getAttribute('content')
      ).catch(() => null);
      
      if (generator) {
        technologies.push(generator);
      }

      // JavaScript フレームワークの検出
      const hasReact = await page.evaluate(() => {
        return !!(window as any).React || !!(window as any).__REACT_DEVTOOLS_GLOBAL_HOOK__;
      });
      if (hasReact) technologies.push('React');

      const hasVue = await page.evaluate(() => {
        return !!(window as any).Vue || document.querySelector('[data-v-]') !== null;
      });
      if (hasVue) technologies.push('Vue.js');

      const hasAngular = await page.evaluate(() => {
        return !!(window as any).ng || document.querySelector('[ng-version]') !== null;
      });
      if (hasAngular) technologies.push('Angular');

      // CMS の検出
      const hasWordPress = await page.evaluate(() => {
        return document.querySelector('meta[content*="WordPress"]') !== null ||
               document.querySelector('link[href*="wp-content"]') !== null;
      });
      if (hasWordPress) technologies.push('WordPress');

      // Eコマースプラットフォームの検出
      const hasShopify = await page.evaluate(() => {
        return !!(window as any).Shopify || document.querySelector('meta[content*="Shopify"]') !== null;
      });
      if (hasShopify) technologies.push('Shopify');

    } catch (error) {
      logger.debug('技術スタック検出エラー:', error);
    }

    return technologies;
  }

  private async estimateLastUpdate(page: Page): Promise<Date | undefined> {
    try {
      // メタタグから最終更新日を取得
      const lastModified = await page.$eval(
        'meta[name="last-modified"], meta[property="article:modified_time"], meta[name="DC.date.modified"]',
        el => el.getAttribute('content')
      ).catch(() => null);

      if (lastModified) {
        return new Date(lastModified);
      }

      // フッターから年号を探す
      const footerText = await page.textContent('footer') || '';
      const currentYear = new Date().getFullYear();
      const yearRegex = new RegExp(`20[0-9]{2}|${currentYear}`);
      const yearMatch = footerText.match(yearRegex);
      
      if (yearMatch) {
        return new Date(`${yearMatch[0]}-01-01`);
      }

      // ニュースや更新情報から推定
      const newsText = await page.textContent('[class*="news"], [class*="update"], [id*="news"]') || '';
      const dateMatch = newsText.match(/20\d{2}[年\/\-]\d{1,2}[月\/\-]\d{1,2}/);
      
      if (dateMatch) {
        return new Date(dateMatch[0].replace(/[年月]/g, '-').replace(/日/, ''));
      }

    } catch (error) {
      logger.debug('最終更新日推定エラー:', error);
    }

    return undefined;
  }

  private async checkSNSPresence(page: Page): Promise<{ hasSNS: boolean; links: string[] }> {
    const snsPatterns = [
      { platform: 'Facebook', pattern: 'facebook.com' },
      { platform: 'Twitter', pattern: 'twitter.com' },
      { platform: 'Instagram', pattern: 'instagram.com' },
      { platform: 'YouTube', pattern: 'youtube.com' },
      { platform: 'LINE', pattern: 'line.me' },
      { platform: 'LinkedIn', pattern: 'linkedin.com' }
    ];

    const foundLinks: string[] = [];

    for (const sns of snsPatterns) {
      try {
        const links = await page.$$(`a[href*="${sns.pattern}"]`);
        if (links.length > 0) {
          foundLinks.push(sns.platform);
        }
      } catch (error) {
        // エラーは無視
      }
    }

    return {
      hasSNS: foundLinks.length > 0,
      links: foundLinks
    };
  }

  private async estimateEmployeeCount(page: Page): Promise<string | undefined> {
    try {
      // 会社概要ページを探す
      const aboutLinks = await page.$$('a[href*="about"], a[href*="company"], a:has-text("会社概要"), a:has-text("企業情報")');
      
      if (aboutLinks.length > 0) {
        // 最初のリンクをクリック
        await aboutLinks[0].click();
        await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
      }

      // 従業員数を含むテキストを探す
      const patterns = [
        /従業員[\s：:]*([0-9,]+[\s]*[名人])/,
        /社員数[\s：:]*([0-9,]+[\s]*[名人])/,
        /スタッフ[\s：:]*([0-9,]+[\s]*[名人])/
      ];

      const bodyText = await page.textContent('body') || '';
      
      for (const pattern of patterns) {
        const match = bodyText.match(pattern);
        if (match) {
          return match[1];
        }
      }

    } catch (error) {
      logger.debug('従業員数推定エラー:', error);
    }

    return undefined;
  }

  private async findEstablishedYear(page: Page): Promise<string | undefined> {
    try {
      const patterns = [
        /設立[\s：:]*([0-9]{4}年)/,
        /創業[\s：:]*([0-9]{4}年)/,
        /創立[\s：:]*([0-9]{4}年)/,
        /[^0-9]([0-9]{4}年)[\s]*設立/,
        /[^0-9]([0-9]{4}年)[\s]*創業/
      ];

      const bodyText = await page.textContent('body') || '';
      
      for (const pattern of patterns) {
        const match = bodyText.match(pattern);
        if (match) {
          return match[1];
        }
      }

    } catch (error) {
      logger.debug('設立年取得エラー:', error);
    }

    return undefined;
  }

  generateEnrichedReport(businesses: EnrichedBusinessInfo[]): any[] {
    return businesses.map(business => ({
      URL: business.url,
      事業者名: business.businessName,
      業種: business.industry,
      地域: business.location,
      技術スタック: business.technologies?.join(', ') || '',
      最終更新: business.lastUpdated?.toLocaleDateString('ja-JP') || '不明',
      SNS: business.hasSNS ? '有り' : '無し',
      SNSリンク: business.snsLinks?.join(', ') || '',
      従業員数: business.employeeCount || '不明',
      設立年: business.establishedYear || '不明'
    }));
  }
}