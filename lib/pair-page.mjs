// ===========================================================================
//  相性SEOページ（/type/A-B）HTML の単一ソース
//  - 利用元: api/pair.js（動的）, scripts/build-static.mjs（静的256枚生成）
//  - 決定論（型ペアのみ依存）。決めゼリフ・スコア・ランキングを掲載。
// ===========================================================================
import { TYPES, analyzeSynergy, punchlineFor } from "./verdict.mjs";

const RELATION_META = {
  complement: { label: "補完",       color: "#c98a4b", icon: "⚡", desc: "アプローチが正反対で、自然に補い合う" },
  resonance:  { label: "共鳴",       color: "#8a6bd1", icon: "🔮", desc: "同じ感覚を持ち、深く分かり合える" },
  support:    { label: "支え合い",   color: "#5ec2a0", icon: "🤝", desc: "強みと弱みが噛み合い、互いを補う" },
  blind:      { label: "共通の死角", color: "#e07a7a", icon: "⚠️", desc: "2人とも手薄になりがちな弱点" },
  thin:       { label: "希薄",       color: "#a99fc4", icon: "💨", desc: "どちらも似たような感覚" },
};

function buildSummary(syn, typeA, typeB) {
  const scoreLabel = syn.score >= 80 ? "非常に高い" : syn.score >= 65 ? "やや高め" : syn.score >= 50 ? "中程度" : "低め";
  const intros = {
    dual:      `${typeA}と${typeB}は「デュアル」——理想的な補完関係です。強みの向きは同じなのにアプローチが正反対で、2人でいると互いの欠けた部分を自然に埋め合います。相性スコアは${syn.score}/100（${scoreLabel}）。`,
    twin:      `${typeA}と${typeB}は「ツインソウル」——鏡のような相性です。よく似た価値観と感性を持ち、深く分かり合えるペア。ただし苦手な部分も共通しているため、意識的に補い合うことが大切です。相性スコアは${syn.score}/100（${scoreLabel}）。`,
    yin_yang:  `${typeA}と${typeB}は「凸凹コンビ」。強みと弱みが絶妙に噛み合い、どちらかが苦手なことをもう一方が補う関係です。個性の違いが摩擦ではなく推進力になるペアです。相性スコアは${syn.score}/100（${scoreLabel}）。`,
    blindspot: `${typeA}と${typeB}は「似たもの同士の死角」。通じ合う感覚がある一方、2人とも同じ落とし穴にはまりやすい相性です。お互いの弱点を意識して補い合えれば、化ける可能性を秘めています。相性スコアは${syn.score}/100（${scoreLabel}）。`,
    mix:       `${typeA}と${typeB}は「ミックス」——補完と共鳴が入り混じるバランス型の相性です。特定のシチュエーションで強みが際立つペアです。相性スコアは${syn.score}/100（${scoreLabel}）。`,
  };
  return intros[syn.archetype.key] || intros.mix;
}

function buildStrengths(syn, typeA, typeB) {
  const list = [];
  if (syn.complement > 0) list.push(`旅行の計画なら「きっちり決めたい派」と「現地でノリ派」みたいに、${typeA}と${typeB}は役割が自然に分かれる。得意を任せ合えば、2人なら1人の倍は進める。`);
  if (syn.resonance > 0)  list.push(`「それな」が口癖になるくらい感覚が近い。LINEのテンションも笑うツボも合うから、一緒にいて余計な気を使わなくていい。`);
  if (syn.support > 0)    list.push(`片方がうっかりやらかしても、もう片方がさらっと回収。意識しなくても凸凹が噛み合って、自然と支え合いが起きるペア。`);
  if (syn.archetype.key === "dual")   list.push(`正反対だからこそ、相手が持っていないものをお互い持っている。「ケンカするほど仲がいい」を地で行ける組み合わせ。`);
  if (syn.archetype.key === "twin")   list.push(`悩みを打ち明けたとき「わかる、それ」が秒で返ってくる安心感。いちいち説明しなくても伝わる気楽さがある。`);
  return list.slice(0, 3);
}

function buildWatchOuts(syn, typeA, typeB) {
  const list = [];
  if (syn.blind > 0)      list.push(`「${syn.wallTheme}」が2人そろっての弱点。大事な決断や面倒な手続きを「まあそのうち」と先延ばしして、気づけば手遅れ…になりがち。ここだけは早めに、できれば第三者の意見も。`);
  if (syn.resonance > 0)  list.push(`似てるぶん「言わなくても分かるでしょ」が発動しやすい。実は全然伝わってなくて、小さなすれ違いが地味に積もる。面倒でも言葉にするのが吉。`);
  if (syn.complement > 0) list.push(`考え方が逆だから「なんでそうなるの？」とイラッとする瞬間も。正そうとする前に、まず相手のやり方を一回受け入れると一気にラクになる。`);
  if (list.length < 2)    list.push(`似た強みで盛り上がれる反面、2人とも苦手な場面では仲良く共倒れ。得意は出し合い、苦手は潔く外に頼るのが長続きのコツ。`);
  return list.slice(0, 3);
}

function scoreColor(s) { return s >= 75 ? "#6fd39a" : s >= 55 ? "#c98a4b" : "#e07a7a"; }

function rankingHtml(typeA) {
  const ranked = TYPES.filter((t) => t !== typeA)
    .map((t) => ({ t, syn: analyzeSynergy(typeA, t) }))
    .sort((a, b) => b.syn.score - a.syn.score);
  const top = ranked.slice(0, 3);
  const worst = ranked.slice(-3).reverse();
  const row = (x, medal) => `<a href="/type/${typeA}-${x.t}" class="rank-row">
    <span class="rank-pos">${medal}</span>
    <span class="rank-type">${x.t}</span>
    <span class="rank-arch">${x.syn.archetype.name}</span>
    <span class="rank-num" style="color:${scoreColor(x.syn.score)}">${x.syn.score}</span>
  </a>`;
  return `
    <div class="rank-block">
      <div class="rank-head good">💖 ${typeA} の最高の相棒 TOP3</div>
      ${top.map((x, i) => row(x, ["🥇", "🥈", "🥉"][i])).join("")}
    </div>
    <div class="rank-block">
      <div class="rank-head bad">⚡ ${typeA} が試される相手 WORST3</div>
      ${worst.map((x) => row(x, "💢")).join("")}
    </div>`;
}

function scoreBar(score) {
  const col = scoreColor(score);
  return `<div class="score-wrap">
    <div class="score-label">相性スコア <strong style="color:${col}">${score}</strong> / 100</div>
    <div class="score-track"><div class="score-fill" style="width:${score}%;background:${col}"></div></div>
  </div>`;
}

function axesHtml(syn) {
  return syn.axes.map((ax) => {
    const m = RELATION_META[ax.relation] || RELATION_META.thin;
    return `<div class="axis-card">
      <div class="axis-label" style="color:${m.color}">${m.icon} ${ax.label}</div>
      <div class="axis-theme">${ax.theme}</div>
      <div class="axis-rel"><span class="axis-rel-tag" style="color:${m.color}">${m.label}</span> ${m.desc}</div>
    </div>`;
  }).join("");
}

function relatedHtml(typeA) {
  const links = TYPES.filter(t => t !== typeA).map(t => {
    const syn = analyzeSynergy(typeA, t);
    const col = syn.score >= 75 ? "#6fd39a" : syn.score >= 55 ? "#c98a4b" : "#a99fc4";
    return `<a href="/type/${typeA}-${t}" class="rel-chip" title="${syn.archetype.name}（${syn.score}点）">
      <span>${t}</span><span class="rel-score" style="color:${col}">${syn.score}</span>
    </a>`;
  }).join("");
  return `<div class="related-label">${typeA} の全相性（スコア付き）</div><div class="rel-chips">${links}</div>`;
}

// ogImage = OG画像の絶対URL（静的なら /og/A-B.png、動的なら /api/og?pair=A-B）
export function renderPairPage(typeA, typeB, ogImage) {
  const syn       = analyzeSynergy(typeA, typeB);
  const summary   = buildSummary(syn, typeA, typeB);
  const strengths = buildStrengths(syn, typeA, typeB);
  const watchouts = buildWatchOuts(syn, typeA, typeB);
  const punch     = punchlineFor(typeA, typeB, syn);
  const desc = `${typeA}と${typeB}の相性は「${syn.archetype.name}」。スコア${syn.score}/100。良い面と注意点をMBTI認知機能で徹底解説。`;
  const og = ogImage || `/og/${typeA}-${typeB}.png`;

  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${typeA} × ${typeB} の相性｜相性ダンジョン</title>
  <meta name="description" content="${desc}" />
  <meta property="og:title" content="${typeA} × ${typeB} の相性｜相性ダンジョン" />
  <meta property="og:description" content="${desc}" />
  <meta property="og:type" content="article" />
  <meta property="og:image" content="${og}" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${typeA} × ${typeB} の相性｜相性ダンジョン" />
  <meta name="twitter:description" content="${desc}" />
  <meta name="twitter:image" content="${og}" />
  <link rel="stylesheet" href="/style.css" />
  <style>
    .back-link{color:var(--muted);font-size:13px;text-decoration:none;display:inline-block;margin-bottom:12px}
    .back-link:hover{color:var(--accent)}
    .pair-hero{text-align:center;padding:20px 0 16px}
    .pair-types{font-size:34px;font-weight:900;letter-spacing:.04em;margin:8px 0 4px}
    .pair-archetype{color:var(--accent2);font-size:16px;font-weight:700;margin-bottom:10px}
    .pair-punch{font-size:18px;font-weight:800;line-height:1.7;margin:0 auto 16px;max-width:440px;color:var(--ink)}
    .score-wrap{margin:0 auto 4px;max-width:260px}
    .score-label{font-size:14px;margin-bottom:6px;text-align:center}
    .score-track{height:8px;background:rgba(255,255,255,.08);border-radius:99px;overflow:hidden}
    .score-fill{height:100%;border-radius:99px}
    .section{margin:22px 0}
    .section-title{font-size:14px;font-weight:800;color:var(--accent);margin-bottom:10px;letter-spacing:.06em;text-transform:uppercase}
    .summary-text{line-height:1.85;font-size:15px}
    .cta-box{background:rgba(201,138,75,.08);border:1px solid rgba(201,138,75,.3);border-radius:16px;padding:18px;text-align:center;margin:22px 0}
    .cta-lead{color:var(--muted);font-size:13px;margin:0 0 12px;line-height:1.6}
    .cta-btn{display:inline-block;padding:13px 28px;border-radius:999px;background:linear-gradient(100deg,var(--accent),var(--accent2));color:#fff;font-size:15px;font-weight:800;text-decoration:none;letter-spacing:.04em}
    .axis-grid{display:flex;flex-direction:column;gap:8px}
    .axis-card{background:rgba(255,255,255,.04);border:1px solid var(--line);border-radius:12px;padding:12px 14px}
    .axis-label{font-size:13px;font-weight:800;margin-bottom:2px}
    .axis-theme{font-size:11px;color:var(--muted);margin-bottom:4px}
    .axis-rel{font-size:13px}.axis-rel-tag{font-weight:700;margin-right:4px}
    .points-grid{display:flex;flex-direction:column;gap:12px}
    .points-card{background:rgba(255,255,255,.04);border-radius:14px;padding:14px 16px}
    .points-title{font-size:14px;font-weight:800;margin-bottom:10px}
    .points-list{list-style:none;padding:0;margin:0;display:flex;flex-direction:column;gap:8px}
    .points-list li{font-size:14px;line-height:1.75;padding-left:14px;position:relative}
    .points-list li::before{content:"";position:absolute;left:0;top:8px;width:6px;height:6px;border-radius:50%}
    .strength li::before{background:#6fd39a}
    .watchout li::before{background:#e07a7a}
    .related-label{font-size:12px;color:var(--muted);margin-bottom:8px}
    .rel-chips{display:flex;flex-wrap:wrap;gap:6px}
    .rel-chip{display:flex;align-items:center;gap:5px;padding:5px 10px;border-radius:8px;border:1px solid var(--line);background:transparent;color:var(--muted);font-size:12px;font-weight:700;text-decoration:none;transition:border-color .1s,color .1s}
    .rel-chip:hover{border-color:var(--accent2);color:var(--ink)}
    .rel-score{font-size:10px;opacity:.8}
    .rank-block{margin-bottom:14px}
    .rank-head{font-size:13px;font-weight:800;margin-bottom:6px}
    .rank-head.good{color:#6fd39a}
    .rank-head.bad{color:#e07a7a}
    .rank-row{display:flex;align-items:center;gap:10px;padding:9px 12px;border-radius:10px;background:rgba(255,255,255,.04);border:1px solid var(--line);text-decoration:none;color:var(--ink);margin-bottom:6px}
    .rank-row:hover{border-color:var(--accent2)}
    .rank-pos{font-size:16px;width:22px;text-align:center}
    .rank-type{font-size:15px;font-weight:800;letter-spacing:.03em;width:54px}
    .rank-arch{flex:1;font-size:12px;color:var(--muted)}
    .rank-num{font-size:16px;font-weight:900}
    .page-footer{text-align:center;color:var(--muted);font-size:12px;margin-top:32px;padding-top:16px;border-top:1px solid var(--line);line-height:1.8}
    .page-footer a{color:var(--accent);text-decoration:none}
  </style>
</head>
<body>
<main class="app">
  <div class="pair-hero">
    <a href="/" class="back-link">← 相性ダンジョン TOP</a>
    <div class="pair-types">${typeA} × ${typeB}</div>
    <div class="pair-archetype">${syn.archetype.name}</div>
    <p class="pair-punch">“${punch}”</p>
    ${scoreBar(syn.score)}
  </div>

  <div class="cta-box">
    <p class="cta-lead">同じ ${typeA} × ${typeB} でも、2人の行動次第で物語は変わる。<br>ゲームで実際の「関係スタイル」を発見しよう。</p>
    <a href="/?self=${typeA}&partner=${typeB}" class="cta-btn">ダンジョンに挑む →</a>
  </div>

  <div class="section">
    <div class="section-title">📊 総合判定</div>
    <p class="summary-text">${summary}</p>
  </div>

  <div class="section">
    <div class="section-title">🔍 4つの軸での噛み合い</div>
    <div class="axis-grid">${axesHtml(syn)}</div>
  </div>

  <div class="section">
    <div class="section-title">💡 相性のポイント</div>
    <div class="points-grid">
      <div class="points-card">
        <div class="points-title" style="color:#6fd39a">✨ 良い面</div>
        <ul class="points-list strength">${strengths.map(s => `<li>${s}</li>`).join("")}</ul>
      </div>
      <div class="points-card">
        <div class="points-title" style="color:#e07a7a">⚠️ 気をつけたい点</div>
        <ul class="points-list watchout">${watchouts.map(w => `<li>${w}</li>`).join("")}</ul>
      </div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">🏆 ${typeA} の相性ランキング</div>
    ${rankingHtml(typeA)}
  </div>

  <div class="section">
    <div class="section-title">🔗 全タイプとの相性（スコア付き）</div>
    ${relatedHtml(typeA)}
  </div>

  <div class="page-footer">
    <a href="/">相性ダンジョン TOP</a> ／ 2人でダンジョンをクリアできる？ MBTI × ローグライク相性占い<br>
    <a href="/type/${typeB}-${typeA}">${typeB} × ${typeA} で見る</a>
  </div>
</main>
</body>
</html>`;
}
