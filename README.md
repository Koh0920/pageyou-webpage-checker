# PageYou 見込み顧客分析ツール

営業チームのための見込み顧客自動分析システムです。  
Web サイトの問題点を自動で発見し、営業優先度と改善提案を生成します。

## 🚀 3 ステップで分析開始

### ステップ 1: 事前準備

#### Docker Desktop のインストール

1. 以下の URL から Docker Desktop をダウンロード

   - Windows: https://www.docker.com/products/docker-desktop
   - Mac: https://www.docker.com/products/docker-desktop

2. ダウンロードしたファイルを実行してインストール

3. Docker Desktop を起動（デスクトップアイコンから起動）

#### API キーの取得（任意）

より正確な分析のため、以下の API キーの取得を推奨します：

**PageSpeed API キー**

1. https://developers.google.com/speed/docs/insights/v5/get-started にアクセス
2. 「Get a Key」をクリック
3. プロジェクトを作成または選択
4. 表示された API キーをメモ

### ステップ 2: 初回設定

1. このフォルダ内の `.env.example` を `.env` にコピー
2. `.env` ファイルを開き、取得した API キーを設定

   ```
   PAGESPEED_API_KEY=取得したAPIキー
   ```

3. `input/urls.csv.example` を `input/urls.csv` にコピー
4. 分析したい URL リストを `input/urls.csv` に記入

### ステップ 3: 分析実行

**Windows の場合:**

1. `scripts/analyze.bat` をダブルクリック
2. 分析が完了するまで待機（1URL あたり約 30 秒）
3. 完了後、自動的に結果フォルダが開きます

**Mac の場合:**

1. ターミナルを開く
2. このフォルダに移動して以下を実行:
   ```bash
   ./scripts/analyze.sh
   ```

## 📊 結果の見方

分析完了後、`output` フォルダに以下のファイルが生成されます：

### 1. analysis_report.csv

営業リスト用の CSV ファイル。以下の情報を含みます：

- URL、事業者名、業種、地域
- 総合スコア（0-100 点）
- 優先度（High/Medium/Low）
- 推定月間損失額
- 推奨プラン
- 主な問題点と改善効果

**活用方法:**

- 優先度「High」から順番にアプローチ
- 推定月間損失額が大きい順でソートして営業

### 2. analysis_report.md

詳細分析レポート（Markdown ファイル）。以下を含みます：

- エグゼクティブサマリー
- 高優先度案件の詳細分析
- 業種別の傾向分析
- 営業戦略の推奨事項

### 3. screenshots フォルダ

各サイトのデスクトップ/モバイル表示のスクリーンショット
