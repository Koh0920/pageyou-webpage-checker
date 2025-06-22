import { IndustryConfig, ScoringWeights, AnalyzerConfig } from '../types';

export const INDUSTRY_CONFIGS: Record<string, IndustryConfig> = {
  restaurant: {
    keywords: ['メニュー', '営業時間', '予約', 'アクセス', 'ランチ', 'ディナー', 'テイクアウト'],
    weightMultipliers: {
      performance: 1.0,
      mobile: 1.2,
      seo: 0.9,
      conversion: 1.3,
      content: 0.8
    },
    criticalElements: ['menu', 'hours', 'reservation', 'location'],
    averageMonthlyRevenue: 3000000 // 300万円
  },
  beauty: {
    keywords: ['料金', 'スタッフ', '予約', 'カット', 'カラー', 'パーマ', 'トリートメント'],
    weightMultipliers: {
      performance: 0.9,
      mobile: 1.3,
      seo: 1.0,
      conversion: 1.2,
      content: 1.0
    },
    criticalElements: ['pricing', 'staff', 'reservation', 'gallery'],
    averageMonthlyRevenue: 2000000 // 200万円
  },
  clinic: {
    keywords: ['診療時間', '診療科目', '予約', 'アクセス', '医師', '設備', '保険'],
    weightMultipliers: {
      performance: 1.1,
      mobile: 1.1,
      seo: 1.2,
      conversion: 1.0,
      content: 1.1
    },
    criticalElements: ['hours', 'departments', 'doctors', 'access'],
    averageMonthlyRevenue: 5000000 // 500万円
  },
  retail: {
    keywords: ['営業時間', '商品', 'アクセス', '在庫', 'セール', '新着', 'ブランド'],
    weightMultipliers: {
      performance: 1.2,
      mobile: 1.0,
      seo: 1.1,
      conversion: 0.9,
      content: 1.0
    },
    criticalElements: ['products', 'hours', 'location', 'contact'],
    averageMonthlyRevenue: 4000000 // 400万円
  },
  legal: {
    keywords: ['相談', '料金', '実績', '弁護士', '営業時間', 'アクセス', '専門分野'],
    weightMultipliers: {
      performance: 0.8,
      mobile: 0.9,
      seo: 1.3,
      conversion: 1.1,
      content: 1.3
    },
    criticalElements: ['consultation', 'lawyers', 'expertise', 'contact'],
    averageMonthlyRevenue: 3500000 // 350万円
  },
  default: {
    keywords: ['営業時間', 'アクセス', '料金', 'サービス', '会社概要'],
    weightMultipliers: {
      performance: 1.0,
      mobile: 1.0,
      seo: 1.0,
      conversion: 1.0,
      content: 1.0
    },
    criticalElements: ['contact', 'about', 'services'],
    averageMonthlyRevenue: 2500000 // 250万円
  }
};

export const DEFAULT_SCORING_WEIGHTS: ScoringWeights = {
  performance: 0.25,
  mobile: 0.20,
  seo: 0.20,
  conversion: 0.20,
  content: 0.15
};

export const DEFAULT_ANALYZER_CONFIG: AnalyzerConfig = {
  performanceThreshold: 50,
  mobileThreshold: 70,
  seoThreshold: 60,
  conversionThreshold: 50,
  contentThreshold: 40,
  screenshotTimeout: 30000, // 30 seconds
  maxConcurrentAnalyses: 3,
  retryAttempts: 3,
  retryDelay: 2000 // 2 seconds
};

export const PAGEYOU_PLANS = {
  Simple: {
    name: 'Simpleプラン',
    features: [
      '基本的なSEO対策',
      'モバイル対応',
      '表示速度改善',
      '月1回の更新サポート'
    ],
    targetScore: 60,
    monthlyPrice: 30000
  },
  Standard: {
    name: 'Standardプラン',
    features: [
      'Simpleプランの全機能',
      '高度なSEO対策',
      'コンバージョン最適化',
      '月2回の更新サポート',
      'アクセス解析レポート'
    ],
    targetScore: 75,
    monthlyPrice: 50000
  },
  Premium: {
    name: 'Premiumプラン',
    features: [
      'Standardプランの全機能',
      'カスタムデザイン',
      'A/Bテスト実施',
      '週次更新サポート',
      '専任コンサルタント'
    ],
    targetScore: 90,
    monthlyPrice: 100000
  }
};

export const PRIORITY_THRESHOLDS = {
  High: {
    scoreMax: 40,
    monthlyLossMin: 100000 // 10万円以上の機会損失
  },
  Medium: {
    scoreMax: 60,
    monthlyLossMin: 50000 // 5万円以上の機会損失
  },
  Low: {
    scoreMax: 100,
    monthlyLossMin: 0
  }
};

export const API_ENDPOINTS = {
  pageSpeed: 'https://www.googleapis.com/pagespeedonline/v5/runPagespeed',
  googlePlaces: 'https://maps.googleapis.com/maps/api/place/nearbysearch/json'
};

export const ERROR_MESSAGES = {
  NETWORK_ERROR: 'ネットワークエラーが発生しました。インターネット接続を確認してください。',
  TIMEOUT_ERROR: 'タイムアウトしました。後でもう一度お試しください。',
  INVALID_URL: '無効なURLです。HTTPSまたはHTTPで始まる正しいURLを入力してください。',
  API_KEY_MISSING: 'APIキーが設定されていません。.envファイルを確認してください。',
  ANALYSIS_FAILED: '分析に失敗しました。URLが正しいか確認してください。'
};

export const SUCCESS_MESSAGES = {
  ANALYSIS_COMPLETE: '分析が完了しました！',
  REPORT_GENERATED: 'レポートを生成しました。',
  SCREENSHOT_CAPTURED: 'スクリーンショットを保存しました。'
};

export const FILE_PATHS = {
  CSV_REPORT: 'output/reports/analysis_report.csv',
  MARKDOWN_REPORT: 'output/reports/analysis_report.md',
  SCREENSHOTS_DIR: 'output/screenshots/',
  ERROR_LOG: 'output/error.log'
};