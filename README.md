# 相性ダンジョン（MBTI × ローグライク 相性占い）

あなたと、気になるあの人。2人の性格タイプでパーティを組み、ダンジョンを攻略する。
**「2人でクリアできるか？」がそのまま相性占いの答え**になるゲームです。

- **認知機能(Cognitive Functions)理論** で相性を算出（ネットのMBTI相性記事の元ネタ）
- 各タイプは N/S/T/F を1機能ずつ持つ → 2人を照合して 補完/共鳴/支え合い/死角 に分類
- 関係アーキタイプ（デュアル / ツインソウル / 凸凹コンビ / 似たもの同士の死角 / ミックス）を自動判定
- 2人が共に弱い機能 = 乗り越える「関係の壁」= ボス
- 冒険の全ログ＋機能照合データ → Gemini が"解読"して一点物の鑑定文に

## 構成

```
index.html      入力 → 進行 → 結果の画面
style.css       スタイル
game.js         ゲームロジック（タイプ→ステ / ダンジョン生成 / 戦闘 / 鑑定呼び出し）
main.js         UI制御（画面遷移・ログ演出・結果カード描画・シェア）
api/reading.js  Gemini鑑定API（サーバーレス関数。APIキーを隠す）
```

## セットアップ

1. 依存をインストール
   ```bash
   npm install
   ```
2. Vercel CLI を入れる（未導入なら）
   ```bash
   npm i -g vercel
   ```
3. APIキーを設定（ローカル）
   - `.env.example` を `.env` にコピーし、`GEMINI_API_KEY` に
     [Google AI Studio](https://aistudio.google.com/) のキーを貼る。

## ローカルで動かす

**まず疎通チェック**（モデルID＋キーが有効か5秒で確認）:
```bash
node scripts/check-gemini.mjs
```
`✓ 成功` が出ればOK。`✗ 失敗` ならキーか、`api/reading.js` / `scripts/check-gemini.mjs` の
`MODEL` 定数（モデルID）を見直す。

つづいてアプリ起動:
```bash
vercel dev
```
→ 表示される `http://localhost:3000` を開く。
`/api/reading` も同時に立ち上がるので、Gemini鑑定込みで動きます。

> SDKは新しい統合版 **`@google/genai`** を使用（旧 `@google/generative-ai` は非推奨）。

> APIキーが無い／`/api` を立てない場合でも、フロントは**簡易鑑定（テンプレ）**に
> 自動フォールバックするので、`index.html` を直接開くだけでもゲームは遊べます。

## 公開（デプロイ）

```bash
vercel            # 初回はプロジェクト連携
vercel deploy --prod
```

- Vercel の **Project Settings → Environment Variables** に
  `GEMINI_API_KEY` を登録してから本番デプロイしてください。

## カスタマイズの勘どころ

- **モデルID**: `api/reading.js` 先頭の `MODEL` 定数だけ。
- **鑑定の文体**: `api/reading.js` の `buildPrompt()`。
- **相性ロジック**: `game.js` の `STACKS`（機能スタック）と `analyzeSynergy()`（照合・スコア・アーキタイプ・難易度）。
- **敵＝関係の壁**: `game.js` の `ENEMIES`（N/S/T/F の家族ごと）。
- **イベント部屋の選択肢**: `game.js` の `EVENTS`。
- **絆アイテム**: `game.js` の `BONDS`。

## 今後の拡張アイデア

- イベント部屋の選択を「自動」から「プレイヤーが選ぶ」に（ローグライク性UP）
- 「本格鑑定（詳細版）」をリワード広告／課金で上位モデルに切替
- 育成要素（毎日プレイで絆が貯まる）で継続率を上げる
