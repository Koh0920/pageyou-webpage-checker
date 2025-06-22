@echo off
setlocal enabledelayedexpansion

echo ====================================
echo PageYou 見込み顧客分析ツール
echo ====================================
echo.

REM Docker Desktopの起動確認
docker --version >nul 2>&1
if errorlevel 1 (
    echo [エラー] Docker Desktopがインストールされていません。
    echo Docker Desktopをインストールしてください: https://www.docker.com/products/docker-desktop
    pause
    exit /b 1
)

REM Docker起動確認
docker info >nul 2>&1
if errorlevel 1 (
    echo [エラー] Docker Desktopが起動していません。
    echo Docker Desktopを起動してから再度実行してください。
    pause
    exit /b 1
)

REM .envファイル確認
if not exist ".env" (
    if exist ".env.example" (
        echo [警告] .envファイルが見つかりません。
        echo .env.exampleを.envにコピーし、APIキーを設定してください。
        copy .env.example .env
        echo.
        echo .envファイルを作成しました。APIキーを設定後、再度実行してください。
        pause
        exit /b 1
    ) else (
        echo [エラー] .envファイルが見つかりません。
        pause
        exit /b 1
    )
)

REM 入力ファイル確認
if not exist "input\urls.csv" (
    echo [エラー] input\urls.csvファイルが見つかりません。
    echo input\urls.csv.exampleを参考に、分析したいURLリストを作成してください。
    if exist "input\urls.csv.example" (
        echo.
        echo サンプルファイルをコピーしますか？ (Y/N)
        set /p COPY_SAMPLE=
        if /i "!COPY_SAMPLE!"=="Y" (
            copy input\urls.csv.example input\urls.csv
            echo サンプルファイルをコピーしました。
        )
    )
    pause
    exit /b 1
)

echo 分析を開始します...
echo これには数分かかる場合があります。
echo.

REM Docker Composeの実行
docker-compose up --build

if errorlevel 0 (
    echo.
    echo ====================================
    echo 分析が完了しました！
    echo ====================================
    echo.
    echo 結果は output フォルダに保存されています。
    echo.
    
    REM outputフォルダを開く
    start "" "output"
    
    echo Enterキーを押すと終了します。
    pause >nul
) else (
    echo.
    echo [エラー] 分析中にエラーが発生しました。
    echo ログを確認してください。
    pause
)

endlocal