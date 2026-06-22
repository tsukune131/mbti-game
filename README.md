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
index.html             入力 → 進行 → 結果の画面
style.css              スタイル
game.js                ゲームロジック（タイプ→ステ / ダンジョン生成 / 戦闘 / 鑑定）
main.js                UI制御（画面遷移・ログ演出・結果カード描画・シェア）
lib/verdict.mjs        Verdict単一ソース（相性ロジック＋決めゼリフ・決定論）
lib/pair-page.mjs      SEOページHTMLの単一ソース（静的生成と動的APIで共有）
lib/og-card.mjs        OG画像(決めゼリフカード)の単一ソース（同上）
scripts/build-static.mjs  静的サイトビルド（dist/ にSEO256枚＋OG256枚）→ npm run build
api/reading.js         ライブ鑑定API（任意・広告/課金ゲート用）。普段は呼ばない
api/pair.js / api/og.js  動的ホスティング用の薄いラッパー（静的なら不要）
```

> 既定の鑑定は `game.js` の `templateReading`（LLM不使用・$0）。決めゼリフ・スコアは
> 型ペアで固定（Verdict）、鑑定文は選択（relStyle）で変化する設計。

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

### 推奨：静的ビルド → Cloudflare Pages（無料・商用OK・サーバーレス不要）

`npm run build` で `dist/` に「完全ホスト可搬」な成果物を書き出す。
- SEOページ256枚 `dist/type/A-B.html`（`/type/A-B` で配信）
- OG画像256枚＋既定 `dist/og/A-B.png`（フォントは全文字を一括取得して再利用）
- フロント一式（`index.html` / `*.js` / `style.css`）

ローカル動作確認：
```bash
SITE_URL=https://example.com npm run build   # SITE_URL は公開URL（OGの絶対URLに焼き込む）
# SKIP_OG=1 npm run build                     # OG画像生成を省略したいとき
npx serve dist                               # → 表示されたURLで /type/INFP-ENFJ などを確認
```

> ⚠ **SITE_URL は「最終的に公開するURL」と一致**させる必要がある（OG画像の絶対URLに焼き込まれるため）。
> 独自ドメインを使うなら最初からそれを指定。`*.pages.dev` を使う場合は URL が
> **初回デプロイ後に確定する**ので、後述のとおり「一度デプロイ → URL確定 → SITE_URL設定 → 再デプロイ」する。

---

#### 方法A：CLI（wrangler）で手元からデプロイ ― 初回はこちらが確実

ローカルでビルド済みの `dist/` をそのまま上げる。GitHub不要。CFのビルド環境を使わないので
`@vercel/og` のビルド失敗を気にしなくてよい（手元のビルドは検証済み）。

1. **Cloudflareアカウントを作る**（無料）: https://dash.cloudflare.com/sign-up

2. **wrangler でログイン**（ブラウザが開いて許可するだけ）:
   ```bash
   npx wrangler login
   ```

3. **まず仮ビルド＆初回デプロイ**（プロジェクトを作成し、`*.pages.dev` のURLを確定させる）:
   ```bash
   npm run build                       # SITE_URL未指定でもOK（OGは相対パスで一旦出る）
   npx wrangler pages deploy dist --project-name=aisho-dungeon
   ```
   - 初回は「Create a new project?」と聞かれるので Yes。プロジェクト名がURLになる
     → `https://aisho-dungeon.pages.dev`（名前が使われ済みなら別名になる。出力されたURLを控える）。

4. **確定したURLで本ビルド＆再デプロイ**（OGの絶対URLを焼き直す）:
   ```bash
   SITE_URL=https://aisho-dungeon.pages.dev npm run build
   npx wrangler pages deploy dist --project-name=aisho-dungeon
   ```

5. 完了。以後は手元で `4.` を実行するたびに本番更新される。

#### 方法B：GitHub連携で自動デプロイ ― 以後の運用が楽

`git push` するたびに自動ビルド＆公開。先に GitHub にリポジトリを push しておくこと。

1. **GitHubにpush**（未作成なら）:
   ```bash
   gh repo create aisho-dungeon --private --source=. --push
   # gh が無ければ GitHub でリポジトリを作り、git remote add origin ... && git push -u origin main
   ```

2. Cloudflare ダッシュボード → 左メニュー **Workers & Pages** → **Create** →
   **Pages** タブ → **Connect to Git** → 対象リポジトリを選択。

3. **Build settings（ビルド設定）** を入力:
   | 項目 | 値 |
   |---|---|
   | Framework preset | `None` |
   | Build command | `npm run build` |
   | Build output directory | `dist` |

4. **Environment variables（環境変数）** に以下を追加:
   | 変数名 | 値 |
   |---|---|
   | `SITE_URL` | 公開URL（例 `https://aisho-dungeon.pages.dev`／独自ドメイン） |
   | `NODE_VERSION` | `20`（`@vercel/og` のため18以上を明示） |

   ※ `SITE_URL` は初回デプロイ後に確定する `*.pages.dev` URL に合わせ、保存して
     **Deployments → Retry deployment** で焼き直す（独自ドメインなら最初からそれを入れる）。

5. **Save and Deploy**。以後は `main` への push で自動デプロイ。

#### 独自ドメインを使う場合（任意）
Pages プロジェクト → **Custom domains** → **Set up a domain** → ドメイン入力 → 表示される
DNS設定に従う。設定後、`SITE_URL` をそのドメインにして再ビルド／再デプロイする。

#### デプロイ後の確認
- `https://<公開URL>/` がトップ表示される
- `https://<公開URL>/type/INFP-ENFJ` が相性ページ表示（拡張子 `.html` なしでOK）
- `https://<公開URL>/og/INFP-ENFJ.png` が画像で開く
- 公開URLを https://cards-dev.twitter.com/validator や Slack/Discord に貼り、OG画像が展開される

> ランニングコストはドメイン代＋ほぼ¥0（Cloudflare無料枠）。鑑定は既定でテンプレ（LLM不使用）
> なので、プレイごとのGemini課金は発生しない（ライブ鑑定は `generateDetailedReading()` を
> 広告/課金ゲートの後ろから呼ぶ設計）。

### 代替：Vercel（動的・関数あり）

```bash
vercel            # 初回はプロジェクト連携
vercel deploy --prod
```

- `api/pair.js`（SEOページ）/ `api/og.js`（OG画像）/ `api/reading.js`（ライブ鑑定）が
  サーバーレスで動く。`/type/:pair` の rewrite は `vercel.json` 参照。
- ライブ鑑定を使うなら **Project Settings → Environment Variables** に `GEMINI_API_KEY` を登録。
- 商用（広告）利用は Vercel Hobby 不可。Pro（$20/月）が必要。

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
