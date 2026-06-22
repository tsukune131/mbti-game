// ===========================================================================
//  Vercel サーバーレス関数: POST /api/reading
//  ランの要約を受け取り、Gemini で「2人の相性鑑定文」を生成して返す。
//  APIキーはサーバー側の環境変数 GEMINI_API_KEY に置く（フロントには出さない）。
// ===========================================================================
import { GoogleGenAI } from "@google/genai";
import { punchlineFor } from "../lib/verdict.mjs";

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

    // 決定論の「決めゼリフ」（Verdict層）を文脈として渡し、鑑定全体をこれと一貫させる
    const punchline = (self.type && partner.type)
      ? punchlineFor(self.type, partner.type)
      : "";

    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: MODEL,
      contents: buildPrompt(self, partner, run, punchline),
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
function buildPrompt(self, partner, run, punchline) {
  const funcLines = run.functions
    .map((f) => `  - ${f.theme}: ${self.name}=${f.you} / ${partner.name}=${f.them} → ${f.relation}`)
    .join("\n");

  const sceneLine = run.highlight
    ? `\n- 今回の名シーン: 「${run.highlight.prompt}」で2人は『${run.highlight.choice}』を選んだ（${run.highlight.result}）`
    : "";

  const relStyleBlock = run.relStyle
    ? `\n# 2人がゲーム中に「実際に選んだこと」（★鑑定文はこれで変える★）
- 関係スタイル: 「${run.relStyle.label}」（${run.relStyle.desc || ""}）
- 選択の傾向: ${run.behaviorHighlights || "データなし"}${sceneLine}
※ スコアと相性タイプ（＝2人の素質）は固定だが、**鑑定文の中身はこの「選んだこと」で変わる**。
  同じ2人でも、対話を選んだか・素直さを選んだか・冒険を選んだかで読み解きを変えること。
  上の関係スタイルと名シーンを鑑定の軸に据え、その振る舞いを具体的に反映する。`
    : "";

  const punchBlock = punchline
    ? `\n# この2人の「決めゼリフ」（シェアされる確定の一言・トーンの基準）
「${punchline}」
※ これは2人の関係を一言で言い当てた、SNSで拡散される確定コピーです。
  鑑定文は**この決めゼリフと同じテーマ・同じ温度**で書き、矛盾させないこと。
  決めゼリフが指摘した「あるある」を、各シーンで具体的に膨らませるイメージ。`
    : "";

  return `あなたはMBTIに精通した、鋭くて笑いのセンスもある相性占い師です。
SNSで「これ私たちだ」と思わずスクショして共有したくなる、**刺さって・笑えて・最後にちょっと優しい**鑑定文を書いてください。
無難で当たり障りのない文章は禁止。あるあるを言い切ってください。

# 2人と機能スタック（dominant→inferior）
- 主人公: ${self.name}（${self.type}）= ${self.stack.join(" / ")}
- 連れ: ${partner.name}（${partner.type}）= ${partner.stack.join(" / ")}

# 関係タイプ（MBTIの構造から判定）
- ${run.archetype.name}：${run.archetype.desc}
- 相性スコア（型ペアで決まる固定値・2人の素質）: ${run.score}/100
${punchBlock}${relStyleBlock}
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
  "summary": "決めゼリフを受けた、もう一押しの一言鑑定。2人の名前を織り込む。60字以内。",
  "work": "仕事での相性。下記ルール通り、具体的な1シーンを名指しして描く。2人の名前を入れる。80〜110字。",
  "romance": "恋愛での相性。具体的な1シーンを名指し。ときめきと葛藤の両方。2人の名前を入れる。80〜110字。",
  "friends": "友達としての相性。具体的な1シーンを名指し。日常のノリを描く。2人の名前を入れる。80〜110字。"
}

# 書き方のルール（全フィールド共通）
- 上記の「絶対に使ってはいけない表現」の日常語変換を必ず守る。
- **必ず具体的な「日常の1シーン」を名指しする**（例：LINEの返信速度 / 旅行の計画の立て方 / ケンカ後の沈黙 / 待ち合わせ / 飲みの締め / 部屋の片付け / 既読のつけ方）。抽象論だけは禁止。
- **あるあるを言い切る**。「〜な気がします」「〜かもしれません」のような逃げを避け、「〜しがち」「絶対〜になる」と断定して刺す。読んだ2人が「わかる！」と笑える温度。
- 「関係タイプ」はMBTIの土台、「関係スタイル」はゲームで見せた実際の振る舞い。両方を組み合わせて解釈する。
- 似たタイプ（共鳴・ツインソウル）でも、素直さや対話の選択が多かったなら「深く共鳴できる」と前向きに読む。
- ダンジョンの冒険ログは直接引用せず、関係性の読み解きに活かす。
- 刺した後は必ず救う。責めっぱなしにせず、最後はクスッと笑えるか、前向きに着地させる。

# 注意点の書き方（必須）
work / romance / friends の**全フィールドに**、良い面と注意点・落とし穴を必ず両方書くこと。
良いことだけを並べた鑑定は「当たっていない」と感じさせる。
- 「〜な反面、〜に注意」「ただし〜になりがち」「気をつけたいのは〜」など、
  リアルに起こりうる摩擦・すれ違い・陥りやすいパターンを1文以上入れること。
- 注意点は責めるのではなく、「こうすると防げる」「意識するといい」という前向きな表現で締める。
- 最後のフィールド(friends)だけ背中を押す一文で締める（注意点の後に）。`;
}
