## PageYou 見込み顧客判別システム - Claude Code 実装用設計書

### 1. プロジェクト初期化プロンプト

```markdown
# PageYou 見込み顧客判別システムの実装

営業チームが使用する見込み顧客判別システムを作成してください。

## プロジェクト構造
```

pageyou-prospect-analyzer/
├── docker-compose.yml
├── Dockerfile
├── .env.example
├── package.json
├── tsconfig.json
├── README.md
├── scripts/
│ ├── analyze.sh
│ └── analyze.bat
├── input/
│ └── urls.csv.example
├── output/
│ ├── reports/
│ └── screenshots/
├── src/
│ ├── index.ts
│ ├── analyzers/
│ │ ├── PerformanceAnalyzer.ts
│ │ ├── SEOAnalyzer.ts
│ │ ├── MobileAnalyzer.ts
│ │ ├── ConversionAnalyzer.ts
│ │ └── ContentAnalyzer.ts
│ ├── collectors/
│ │ ├── GoogleMapsCollector.ts
│ │ └── URLEnricher.ts
│ ├── scoring/
│ │ ├── ScoringEngine.ts
│ │ └── OpportunityCalculator.ts
│ ├── reporting/
│ │ ├── CSVReporter.ts
│ │ └── MarkdownReporter.ts
│ ├── types/
│ │ └── index.ts
│ └── config/
│ └── constants.ts
└── config/
└── collection-config.json

```

## 技術要件
- Node.js 18+ / TypeScript
- Playwright (ブラウザ自動化)
- Docker対応（営業チームがNode.js未インストールでも実行可能）
- 入力: CSV形式のURLリスト
- 出力: 優先順位付き営業リスト、詳細分析レポート、スクリーンショット

## 主要機能
1. Webサイトの自動分析（パフォーマンス、SEO、モバイル対応等）
2. 業種別の月間機会損失額算出
3. High/Medium/Low の営業優先度判定
4. PageYouプラン（Simple/Standard/Premium）の自動推奨
```

### 2. Docker 環境構築プロンプト

```markdown
# Docker 環境の実装

営業チームが Docker のみで実行できる環境を構築してください。

## Dockerfile 要件

- ベースイメージ: node:18-slim
- Playwright のブラウザバイナリを含む
- 日本語フォントインストール（Noto Sans CJK JP）
- タイムゾーン: Asia/Tokyo
- 非 root ユーザーで実行

## docker-compose.yml 要件

- サービス名: analyzer
- 環境変数: PAGESPEED_API_KEY を.env から読み込み
- ボリューム:
  - ./input:/app/input:ro (読み取り専用)
  - ./output:/app/output
- 実行コマンド: npm run analyze /app/input/urls.csv

## 実行スクリプト

1. analyze.bat (Windows 用)

   - Docker Desktop 起動確認
   - docker-compose up 実行
   - 完了後 output フォルダを開く

2. analyze.sh (Mac/Linux 用)
   - 実行権限自動付与
   - 同様の機能

## エラーハンドリング

- Docker 未インストール時のメッセージ
- API キー未設定時の警告
- 入力ファイル不在時の指示
```

### 3. メイン分析エンジン実装プロンプト

````markdown
# メイン分析エンジンの実装

src/index.ts にメインの分析フローを実装してください。

## 処理フロー

1. CSV ファイルから BusinessInfo を読み込み
   - URL 必須、業種・地域・事業者名はオプション
2. 各 URL に対して以下の分析を順次実行:
   - 基本チェック（HTTPS、アクセシビリティ）
   - パフォーマンス分析（PageSpeed API）
   - モバイル対応分析
   - SEO 分析
   - コンバージョン要素分析
   - コンテンツ品質分析
3. スコアリングと優先度判定
4. レポート生成（CSV + Markdown）

## 型定義 (src/types/index.ts)

```typescript
interface BusinessInfo {
  url: string;
  businessName?: string;
  industry?: string;
  location?: string;
}

interface AnalysisResult {
  url: string;
  businessInfo: BusinessInfo;
  scores: {
    total: number;
    performance: number;
    mobile: number;
    seo: number;
    conversion: number;
    content: number;
  };
  issues: Issue[];
  opportunities: Opportunity[];
  estimatedMonthlyLoss: number;
  recommendedPlan: "Simple" | "Standard" | "Premium";
  priority: "High" | "Medium" | "Low";
  screenshots: {
    desktop: string;
    mobile: string;
  };
}

interface Issue {
  category: "Performance" | "SEO" | "Mobile" | "Conversion" | "Content";
  severity: "Critical" | "High" | "Medium" | "Low";
  description: string;
  impact: string;
  solution: string;
}
```
````

## 実行時の考慮事項

- 各 URL 間に 2 秒の待機時間
- タイムアウト: 30 秒/URL
- エラー時も継続実行
- 進捗表示

````

### 4. パフォーマンス分析実装プロンプト

```markdown
# パフォーマンス分析モジュールの実装

src/analyzers/PerformanceAnalyzer.ts を実装してください。

## 機能要件
1. Google PageSpeed Insights API連携
   - 環境変数からAPIキー取得
   - Performance、SEO、Accessibilityカテゴリを取得
   - Core Web Vitals (LCP, CLS, FID) の解析

2. スコアリングロジック
   - パフォーマンススコア < 50: Critical issue
   - LCP > 2.5秒: High issue
   - モバイル/デスクトップ両方を測定

3. 改善提案の生成
   - 具体的な問題点の特定
   - PageYouでの解決方法の提示
   - 想定される改善効果（%）

## エラーハンドリング
- API制限時のフォールバック
- ネットワークエラー時の再試行（最大3回）
- API未設定時の簡易測定モード

## 出力形式
```typescript
{
  score: number;
  issues: Issue[];
  opportunities: Opportunity[];
  metrics: {
    lcp: number;
    cls: number;
    fid: number;
    ttfb: number;
  };
}
````

````

### 5. SEO・コンバージョン分析実装プロンプト

```markdown
# SEO・コンバージョン分析モジュールの実装

## SEOAnalyzer.ts の実装
Playwrightを使用してSEO要素を分析:

### チェック項目
- titleタグ（存在、長さ、キーワード含有）
- meta description（存在、長さ、魅力度）
- h1タグ（存在、数、内容）
- 構造化データ（JSON-LD）
- canonical URL
- OGP対応
- robots.txt / sitemap.xml

### 業種別重要キーワード
```typescript
const industryKeywords = {
  restaurant: ['メニュー', '営業時間', '予約', 'アクセス'],
  beauty: ['料金', 'スタッフ', '予約', 'カット'],
  clinic: ['診療時間', '診療科目', '予約', 'アクセス'],
  retail: ['営業時間', '商品', 'アクセス', '在庫']
};
````

## ConversionAnalyzer.ts の実装

### 検出項目

- 電話番号（クリッカブルか確認）
- 問い合わせフォーム
- 予約ボタン/リンク
- 営業時間表示
- アクセス情報/地図
- SNS リンク

### コンバージョン阻害要因

- CTA ボタンの不足
- フォームの項目数過多
- エラーメッセージの不親切さ
- モバイルでのタップしづらさ

### スコアリング

各要素の有無と品質を評価し、0-100 のスコアを算出

````

### 6. URL収集モジュール実装プロンプト

```markdown
# URL収集モジュールの実装

src/collectors/GoogleMapsCollector.ts を実装してください。

## Google Maps Places API連携

### 検索パラメータ
```typescript
interface SearchParams {
  location: string;  // "渋谷区" or "35.6762,139.6503"
  radius: number;    // メートル単位
  types: string[];   // ["restaurant", "beauty_salon", etc.]
  language: 'ja';
  maxResults: number;
}
````

### 収集データ

- 事業者名
- Web サイト URL
- 住所
- 電話番号
- 営業時間
- レビュー評価
- 業種カテゴリ

### フィルタリング

- Web サイト URL が存在する事業者のみ
- チェーン店除外オプション
- 評価 3.5 以上オプション

## URLEnricher.ts の実装

収集した URL に対して追加情報を付与:

- 技術スタック検出（Wappalyzer 方式）
- 最終更新日推定
- SNS プレゼンス確認
- 従業員数推定（会社概要ページから）

## 出力形式

CSV 形式で以下を出力:

- URL
- 事業者名
- 業種
- 住所
- スコア（後続の分析で使用）

````

### 7. レポート生成実装プロンプト

```markdown
# レポート生成モジュールの実装

## CSVReporter.ts
営業チーム向けのCSVレポートを生成:

### 必須カラム
- URL
- 事業者名
- 業種
- 総合スコア（0-100）
- 優先度（High/Medium/Low）
- 推定月間損失額
- 推奨プラン
- 主な問題点（最大3つ）
- 改善による期待効果
- 次のアクション

### ソート順
優先度（High→Low）、その後総合スコアの昇順

## MarkdownReporter.ts
詳細な分析レポートを生成:

### 構成
1. エグゼクティブサマリー
   - 分析件数
   - 高優先度案件数
   - 推定機会損失合計

2. 高優先度案件詳細（上位10件）
   - スクリーンショット埋め込み
   - 主な問題点と影響
   - 具体的な改善提案
   - ROI予測

3. 業種別分析
   - 業種ごとの平均スコア
   - 共通する問題点
   - 業種特有の改善機会

### 営業向けの表現
- 技術用語を避ける
- ビジネスインパクトを強調
- 数値は分かりやすく（万円単位等）
````

### 8. 設定ファイルとドキュメント作成プロンプト

```markdown
# 設定ファイルとドキュメントの作成

## .env.example
```

PAGESPEED_API_KEY=your_pagespeed_api_key_here
GOOGLE_MAPS_API_KEY=your_google_maps_api_key_here

````

## config/collection-config.json
```json
{
  "targets": [
    {
      "area": "渋谷区",
      "categories": ["レストラン", "カフェ"],
      "radius": 2000,
      "limit": 100
    }
  ],
  "analysis": {
    "performanceThreshold": 50,
    "mobileThreshold": 70,
    "seoThreshold": 60
  },
  "scoring": {
    "weights": {
      "performance": 0.25,
      "mobile": 0.20,
      "seo": 0.20,
      "conversion": 0.20,
      "content": 0.15
    }
  }
}
````

## README.md

営業チーム向けの使い方ガイド:

### 内容

1. 事前準備

   - Docker Desktop インストール方法（画像付き）
   - API キーの取得方法

2. 使い方

   - ファイルの配置
   - 実行方法（3 ステップ）
   - 結果の見方

3. トラブルシューティング

   - よくあるエラーと対処法
   - 問い合わせ先

4. 活用方法
   - 優先度の読み方
   - 効果的なアプローチ方法
   - 成功事例

````

### 9. テストデータ作成プロンプト

```markdown
# テスト用データとサンプルの作成

## input/urls.csv.example
```csv
URL,業種,地域,事業者名
https://example-restaurant.com,restaurant,渋谷区,レストラン山田
https://example-beauty.com,beauty,新宿区,ビューティーサロン花
https://example-clinic.jp,clinic,世田谷区,〇〇クリニック
https://example-law.jp,legal,千代田区,△△法律事務所
https://example-retail.com,retail,港区,セレクトショップ□□
````

## テスト実行スクリプト

```bash
#!/bin/bash
# test-run.sh
echo "テストデータで動作確認を行います..."
cp input/urls.csv.example input/urls.csv
docker-compose up
echo "テスト完了。output/フォルダを確認してください。"
```

## 期待される出力例

- 高優先度: パフォーマンス 30 点、HTTPS 未対応のサイト
- 中優先度: モバイル対応不十分、SEO 基本項目欠落
- 低優先度: 軽微な改善点のみ

````

### 10. 実装時の注意事項プロンプト

```markdown
# 実装時の重要な注意事項

## パフォーマンス考慮
- Playwrightのブラウザインスタンスは使い回す
- 並列実行は3プロセスまでに制限
- メモリリーク防止のため、定期的にブラウザを再起動

## エラーハンドリング
- 個別URLのエラーで全体が止まらないように
- ネットワークエラーは3回までリトライ
- すべてのエラーをログに記録

## セキュリティ
- APIキーは環境変数経由のみ
- 収集したデータは6ヶ月で自動削除
- robots.txtを尊重

## ユーザビリティ
- 進捗表示は必須（現在何件目/全何件）
- 推定残り時間の表示
- 完了時に音で通知（オプション）

## 拡張性
- 新しいAnalyzerを追加しやすい設計
- 設定ファイルで挙動を変更可能
- プラグイン形式での機能追加を想定
````

これらの設計書とプロンプトを使用して Claude Code に投入することで、営業チーム向けの見込み顧客判別システムを効率的に実装できます。段階的に各モジュールを実装し、最終的に統合してください。
