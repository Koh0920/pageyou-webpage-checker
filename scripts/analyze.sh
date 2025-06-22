#!/bin/bash

echo "===================================="
echo "PageYou 見込み顧客分析ツール"
echo "===================================="
echo

# Docker インストール確認
if ! command -v docker &> /dev/null; then
    echo "[エラー] Dockerがインストールされていません。"
    echo "Dockerをインストールしてください: https://www.docker.com/products/docker-desktop"
    exit 1
fi

# Docker起動確認
if ! docker info &> /dev/null; then
    echo "[エラー] Docker Desktopが起動していません。"
    echo "Docker Desktopを起動してから再度実行してください。"
    exit 1
fi

# スクリプトのディレクトリを取得
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

# プロジェクトディレクトリに移動
cd "$PROJECT_DIR"

# .envファイル確認
if [ ! -f ".env" ]; then
    if [ -f ".env.example" ]; then
        echo "[警告] .envファイルが見つかりません。"
        echo ".env.exampleを.envにコピーし、APIキーを設定してください。"
        cp .env.example .env
        echo
        echo ".envファイルを作成しました。APIキーを設定後、再度実行してください。"
        exit 1
    else
        echo "[エラー] .envファイルが見つかりません。"
        exit 1
    fi
fi

# 入力ファイル確認
if [ ! -f "input/urls.csv" ]; then
    echo "[エラー] input/urls.csvファイルが見つかりません。"
    echo "input/urls.csv.exampleを参考に、分析したいURLリストを作成してください。"
    
    if [ -f "input/urls.csv.example" ]; then
        echo
        read -p "サンプルファイルをコピーしますか？ (y/n): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            cp input/urls.csv.example input/urls.csv
            echo "サンプルファイルをコピーしました。"
        fi
    fi
    exit 1
fi

echo "分析を開始します..."
echo "これには数分かかる場合があります。"
echo

# Docker Composeの実行
docker-compose up --build

if [ $? -eq 0 ]; then
    echo
    echo "===================================="
    echo "分析が完了しました！"
    echo "===================================="
    echo
    echo "結果は output フォルダに保存されています。"
    echo
    
    # OSに応じてoutputフォルダを開く
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        open output
    elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
        # Linux
        if command -v xdg-open &> /dev/null; then
            xdg-open output
        fi
    fi
else
    echo
    echo "[エラー] 分析中にエラーが発生しました。"
    echo "ログを確認してください。"
    exit 1
fi