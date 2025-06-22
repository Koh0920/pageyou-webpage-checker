import { parse } from 'csv-parse/sync';
import { readFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import * as dotenv from 'dotenv';
import { chromium, Browser, Page } from 'playwright';
import winston from 'winston';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

import { BusinessInfo, AnalysisResult } from './types';
import { PerformanceAnalyzer } from './analyzers/PerformanceAnalyzer';
import { SEOAnalyzer } from './analyzers/SEOAnalyzer';
import { MobileAnalyzer } from './analyzers/MobileAnalyzer';
import { ConversionAnalyzer } from './analyzers/ConversionAnalyzer';
import { ContentAnalyzer } from './analyzers/ContentAnalyzer';
import { ScoringEngine } from './scoring/ScoringEngine';
import { OpportunityCalculator } from './scoring/OpportunityCalculator';
import { CSVReporter } from './reporting/CSVReporter';
import { MarkdownReporter } from './reporting/MarkdownReporter';
import { DEFAULT_ANALYZER_CONFIG, SUCCESS_MESSAGES, FILE_PATHS } from './config/constants';

// 環境変数の読み込み
dotenv.config();

// ロガーの設定
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: FILE_PATHS.ERROR_LOG, level: 'error' }),
    new winston.transports.Console({
      format: winston.format.simple()
    })
  ]
});

class ProspectAnalyzer {
  private browser: Browser | null = null;
  private performanceAnalyzer: PerformanceAnalyzer;
  private seoAnalyzer: SEOAnalyzer;
  private mobileAnalyzer: MobileAnalyzer;
  private conversionAnalyzer: ConversionAnalyzer;
  private contentAnalyzer: ContentAnalyzer;
  private scoringEngine: ScoringEngine;
  private opportunityCalculator: OpportunityCalculator;
  private csvReporter: CSVReporter;
  private markdownReporter: MarkdownReporter;

  constructor() {
    this.performanceAnalyzer = new PerformanceAnalyzer();
    this.seoAnalyzer = new SEOAnalyzer();
    this.mobileAnalyzer = new MobileAnalyzer();
    this.conversionAnalyzer = new ConversionAnalyzer();
    this.contentAnalyzer = new ContentAnalyzer();
    this.scoringEngine = new ScoringEngine();
    this.opportunityCalculator = new OpportunityCalculator();
    this.csvReporter = new CSVReporter();
    this.markdownReporter = new MarkdownReporter();
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

  private readCSV(filePath: string): BusinessInfo[] {
    try {
      const fileContent = readFileSync(filePath, 'utf-8');
      const records = parse(fileContent, {
        columns: true,
        skip_empty_lines: true,
        trim: true
      });

      return records.map((record: any) => ({
        url: this.normalizeUrl(record.URL || record.url),
        businessName: record['事業者名'] || record.businessName,
        industry: record['業種'] || record.industry,
        location: record['地域'] || record.location
      }));
    } catch (error) {
      logger.error('CSV読み込みエラー:', error);
      throw new Error('CSVファイルの読み込みに失敗しました。');
    }
  }

  private normalizeUrl(url: string): string {
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      return `https://${url}`;
    }
    return url;
  }

  private async takeScreenshots(page: Page, url: string): Promise<{ desktop: string; mobile: string }> {
    const urlHash = Buffer.from(url).toString('base64').replace(/[/+=]/g, '');
    const desktopPath = join(FILE_PATHS.SCREENSHOTS_DIR, `${urlHash}_desktop.png`);
    const mobilePath = join(FILE_PATHS.SCREENSHOTS_DIR, `${urlHash}_mobile.png`);

    // デスクトップスクリーンショット
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.screenshot({ path: desktopPath, fullPage: true });

    // モバイルスクリーンショット
    await page.setViewportSize({ width: 375, height: 667 });
    await page.screenshot({ path: mobilePath, fullPage: true });

    return {
      desktop: desktopPath,
      mobile: mobilePath
    };
  }

  private async analyzeUrl(businessInfo: BusinessInfo): Promise<AnalysisResult | null> {
    let page: Page | null = null;

    try {
      page = await this.browser!.newPage();
      
      // タイムアウト設定
      page.setDefaultTimeout(DEFAULT_ANALYZER_CONFIG.screenshotTimeout);

      logger.info(`分析開始: ${businessInfo.url}`);
      
      // ページアクセス
      const response = await page.goto(businessInfo.url, {
        waitUntil: 'networkidle',
        timeout: DEFAULT_ANALYZER_CONFIG.screenshotTimeout
      });

      if (!response || response.status() >= 400) {
        throw new Error(`ページにアクセスできません: ${response?.status()}`);
      }

      // HTTPS チェック
      const isHttps = businessInfo.url.startsWith('https://');

      // 各種分析を並行実行
      const [
        performanceResult,
        seoResult,
        mobileResult,
        conversionResult,
        contentResult,
        screenshots
      ] = await Promise.all([
        this.performanceAnalyzer.analyze(businessInfo.url),
        this.seoAnalyzer.analyze(page),
        this.mobileAnalyzer.analyze(page),
        this.conversionAnalyzer.analyze(page),
        this.contentAnalyzer.analyze(page),
        this.takeScreenshots(page, businessInfo.url)
      ]);

      // スコアリング
      const scores = this.scoringEngine.calculateScores({
        performance: performanceResult,
        seo: seoResult,
        mobile: mobileResult,
        conversion: conversionResult,
        content: contentResult,
        isHttps
      }, businessInfo.industry);

      // 機会計算
      const opportunities = this.opportunityCalculator.calculate({
        scores,
        performanceResult,
        seoResult,
        mobileResult,
        conversionResult,
        contentResult
      }, businessInfo.industry);

      // 課題の集約
      const issues = [
        ...performanceResult.issues,
        ...seoResult.issues,
        ...mobileResult.issues,
        ...conversionResult.issues,
        ...contentResult.issues
      ];

      // 推定月間損失額の計算
      const estimatedMonthlyLoss = opportunities.reduce((sum, opp) => sum + opp.estimatedRevenueLift, 0);

      // プラン推奨
      const recommendedPlan = this.scoringEngine.recommendPlan(scores.total);

      // 優先度判定
      const priority = this.scoringEngine.determinePriority(scores.total, estimatedMonthlyLoss);

      const result: AnalysisResult = {
        url: businessInfo.url,
        businessInfo,
        scores,
        issues,
        opportunities,
        estimatedMonthlyLoss,
        recommendedPlan,
        priority,
        screenshots,
        analyzedAt: new Date()
      };

      logger.info(`分析完了: ${businessInfo.url} - スコア: ${scores.total}, 優先度: ${priority}`);
      
      return result;

    } catch (error) {
      logger.error(`分析エラー (${businessInfo.url}):`, error);
      return null;
    } finally {
      if (page) {
        await page.close();
      }
    }
  }

  public async analyze(csvPath: string): Promise<void> {
    try {
      // 出力ディレクトリの作成
      const dirs = [
        'output',
        'output/reports', 
        FILE_PATHS.SCREENSHOTS_DIR
      ];
      dirs.forEach(dir => {
        if (!existsSync(dir)) {
          mkdirSync(dir, { recursive: true });
        }
      });

      // CSV読み込み
      const businesses = this.readCSV(csvPath);
      logger.info(`${businesses.length}件のURLを分析します。`);

      // ブラウザ初期化
      await this.initBrowser();

      const results: AnalysisResult[] = [];

      // 順次分析（同時実行数制限あり）
      for (let i = 0; i < businesses.length; i++) {
        const business = businesses[i];
        logger.info(`[${i + 1}/${businesses.length}] ${business.url} を分析中...`);

        const result = await this.analyzeUrl(business);
        if (result) {
          results.push(result);
        }

        // 次のURLまで待機
        if (i < businesses.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }

        // 定期的にブラウザを再起動（メモリリーク対策）
        if ((i + 1) % 10 === 0) {
          await this.closeBrowser();
          await this.initBrowser();
        }
      }

      // レポート生成
      logger.info('レポートを生成しています...');
      await Promise.all([
        this.csvReporter.generate(results),
        this.markdownReporter.generate(results)
      ]);

      logger.info(SUCCESS_MESSAGES.ANALYSIS_COMPLETE);
      logger.info(`結果: ${results.length}件の分析完了`);
      logger.info(`高優先度: ${results.filter(r => r.priority === 'High').length}件`);
      logger.info(`レポート: ${FILE_PATHS.CSV_REPORT}, ${FILE_PATHS.MARKDOWN_REPORT}`);

    } catch (error) {
      logger.error('分析プロセスエラー:', error);
      throw error;
    } finally {
      await this.closeBrowser();
    }
  }
}

// CLIエントリーポイント
async function main() {
  const argv = await yargs(hideBin(process.argv))
    .usage('Usage: $0 <csv-file>')
    .positional('csv-file', {
      describe: '分析するURLリストのCSVファイル',
      type: 'string'
    })
    .option('config', {
      alias: 'c',
      describe: '設定ファイルのパス',
      type: 'string',
      default: 'config/collection-config.json'
    })
    .help()
    .alias('help', 'h')
    .parse();

  const csvPath = argv._[0] as string || process.argv[2];

  if (!csvPath) {
    console.error('エラー: CSVファイルのパスを指定してください。');
    process.exit(1);
  }

  if (!existsSync(csvPath)) {
    console.error(`エラー: ファイルが見つかりません: ${csvPath}`);
    process.exit(1);
  }

  const analyzer = new ProspectAnalyzer();
  
  try {
    await analyzer.analyze(csvPath);
    process.exit(0);
  } catch (error) {
    logger.error('実行エラー:', error);
    process.exit(1);
  }
}

// 直接実行された場合
if (require.main === module) {
  main().catch(error => {
    console.error('予期しないエラー:', error);
    process.exit(1);
  });
}

export { ProspectAnalyzer };