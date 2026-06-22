// ===========================================================================
//  Vercel サーバーレス関数: POST /api/reading
//  ランの要約を受け取り、Gemini で「2人の相性鑑定文」を生成して返す。
//  APIキーはサーバー側の環境変数 GEMINI_API_KEY に置く（フロントには出さない）。
// ===========================================================================
import { GoogleGenAI } from "@google/genai";

// ★ モデルIDはここだけ。変えたいときはこの1行を書き換える。
const MODEL = "gemini-3.1-flash-lite";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "POSTのみ対応" });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    // キー未設定でもフロントはテンプレ鑑定にフォールバックする
    return res.status(500).json({ error: "GEMINI_API_KEY が未設定です" });
  }

  try {
    const { self, partner, run } = req.body || {};
    if (!self || !partner || !run) {
      return res.status(400).json({ error: "self / partner / run が必要です" });
    }

    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: MODEL,
      contents: buildPrompt(self, partner, run),
      config: { temperature: 1.0, maxOutputTokens: 800 },
    });

    const raw = (response.text || "").trim()
      .replace(/^```json\s*/i, "").replace(/\s*```$/, ""); // コードブロック除去
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      // JSONパースに失敗した場合は全文をsummaryに
      parsed = { summary: raw, work: "", romance: "", friends: "" };
    }
    if (!parsed.summary) return res.status(502).json({ error: "空の応答" });

    return res.status(200).json(parsed);
  } catch (e) {
    console.error("reading error:", e);
    return res.status(500).json({ error: String(e?.message || e) });
  }
}

// --- プロンプト ------------------------------------------------------------
// 認知機能構造 + ゲーム行動プロファイルを渡して精密診断させる
function buildPrompt(self, partner, run) {
  const funcLines = run.functions
    .map((f) => `  - ${f.theme}: ${self.name}=${f.you} / ${partner.name}=${f.them} → ${f.relation}`)
    .join("\n");

  const relStyleBlock = run.relStyle
    ? `\n# ゲームが示した「2人の関係スタイル」（MBTIより行動を直接反映）
- スタイル名: 「${run.relStyle.label}」
- 選択の傾向: ${run.behaviorHighlights || "データなし"}
- 解釈ヒント: ${run.relStyle.desc || ""}
※ このスタイルは2人がゲーム中に実際に行った選択から導出したものです。
  MBTIの構造的な相性（上記の関係タイプ）と組み合わせることで、
  「似たもの同士でも良い相性になれるか」「補完関係でも実は苦手な部分があるか」
  がより精密にわかります。鑑定文にはこのスタイルを必ず織り込んでください。`
    : "";

  return `あなたは認知機能(MBTIのCognitive Functions)に精通した、温かくも鋭い相性占い師です。
2人の機能スタックの照合結果と、2人が「相性ダンジョン」に挑んだ選択の記録をもとに、
当たっている感のある相性鑑定文を書いてください。

# 2人と機能スタック（dominant→inferior）
- 主人公: ${self.name}（${self.type}）= ${self.stack.join(" / ")}
- 連れ: ${partner.name}（${partner.type}）= ${partner.stack.join(" / ")}

# 関係タイプ（MBTIの構造から判定）
- ${run.archetype.name}：${run.archetype.desc}
- 統合スコア（MBTI構造×ゲーム行動 50:50）: ${run.score}/100
${relStyleBlock}
# 機能ごとの噛み合い（解読の材料）
${funcLines}
  ※ 補完=正反対の角度で補い合う / 共鳴=似て分かり合う / 支え合い=強み弱みが噛み合う / 共通の死角=2人とも手薄

# 冒険のログ
- 結果: ${run.cleared ? "ダンジョン踏破に成功" : `${run.reachedFloor}階「${run.fellTo}」で挑戦終了`}
- 2人が最も手薄なテーマ（最終ボス=越えるべき壁）: ${run.wallTheme}
- 道中の出来事:
${run.timeline.map((t) => "  - " + t).join("\n")}
- 分かち合った絆: ${run.bonds.length ? run.bonds.join("、") : "なし"}

# 絶対に使ってはいけない表現
Ni / Ne / Si / Se / Ti / Te / Fi / Fe などの認知機能の略語は一切使わないこと。
代わりに以下の**日常語**に必ず置き換えること：
- Ni → 「先を読む直感」「未来を見通す力」
- Ne → 「アイデアが広がる発想力」「可能性を探る感覚」
- Si → 「積み重ねた経験」「安心・安定へのこだわり」
- Se → 「今この瞬間への反応」「行動力・瞬発力」
- Ti → 「自分の中の論理」「一貫性を大切にする思考」
- Te → 「結果を出す力」「効率を重視する判断力」
- Fi → 「自分だけの価値観」「感情に正直な心」
- Fe → 「場の空気を読む力」「相手に寄り添う共感力」

# 出力形式（厳守）
以下のJSONをそのまま出力すること。コードブロック(\`\`\`)・見出し・余計な説明は一切不要。生のJSONのみ。

{
  "summary": "シェア用の一言鑑定。関係タイプ名か関係スタイルを入れつつ2人の名前を織り込む。60字以内。",
  "work": "仕事での相性。具体的なシーンを想像できる言葉で。2人の名前を入れる。80〜110字。",
  "romance": "恋愛での相性。ときめきや葛藤を感じられる言葉で。2人の名前を入れる。80〜110字。",
  "friends": "友達としての相性。日常の関係感を描く言葉で。2人の名前を入れる。80〜110字。"
}

# 書き方のルール（全フィールド共通）
- 上記の「絶対に使ってはいけない表現」の日常語変換を必ず守る。
- 「関係タイプ」はMBTIの土台、「関係スタイル」はゲームで見せた実際の振る舞い。両方を組み合わせて解釈する。
- 似たタイプ（共鳴・ツインソウル）でも、素直さや対話の選択が多かったなら「深く共鳴できる」と前向きに読む。
- ダンジョンの冒険ログは直接引用せず、関係性の読み解きに活かす。
- 占い口調で温かく、断定しすぎず。

# 注意点の書き方（必須）
work / romance / friends の**全フィールドに**、良い面と注意点・落とし穴を必ず両方書くこと。
良いことだけを並べた鑑定は「当たっていない」と感じさせる。
- 「〜な反面、〜に注意」「ただし〜になりがち」「気をつけたいのは〜」など、
  リアルに起こりうる摩擦・すれ違い・陥りやすいパターンを1文以上入れること。
- 注意点は責めるのではなく、「こうすると防げる」「意識するといい」という前向きな表現で締める。
- 最後のフィールド(friends)だけ背中を押す一文で締める（注意点の後に）。`;
}
