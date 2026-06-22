// ===========================================================================
//  Vercel サーバーレス: GET /type/TYPEA-TYPEB → MBTI相性ページHTML
//  16×16 = 256組み合わせ分のSEOページをオンデマンド生成
//  vercel.json の rewrite で /type/:pair → /api/pair?pair=:pair にルーティング
// ===========================================================================

const TYPES = [
  "INTJ", "INTP", "ENTJ", "ENTP",
  "INFJ", "INFP", "ENFJ", "ENFP",
  "ISTJ", "ISFJ", "ESTJ", "ESFJ",
  "ISTP", "ISFP", "ESTP", "ESFP",
];

const STACKS = {
  ISTJ: ["Si","Te","Fi","Ne"], ISFJ: ["Si","Fe","Ti","Ne"],
  ESTJ: ["Te","Si","Ne","Fi"], ESFJ: ["Fe","Si","Ne","Ti"],
  ISTP: ["Ti","Se","Ni","Fe"], ISFP: ["Fi","Se","Ni","Te"],
  ESTP: ["Se","Ti","Fe","Ni"], ESFP: ["Se","Fi","Te","Ni"],
  INTJ: ["Ni","Te","Fi","Se"], INFJ: ["Ni","Fe","Ti","Se"],
  ENTJ: ["Te","Ni","Se","Fi"], ENFJ: ["Fe","Ni","Se","Ti"],
  INTP: ["Ti","Ne","Si","Fe"], INFP: ["Fi","Ne","Si","Te"],
  ENTP: ["Ne","Ti","Fe","Si"], ENFP: ["Ne","Fi","Te","Si"],
};

const FAMILIES = [
  { key: "N", label: "ビジョン・直感",  theme: "物事の捉え方（先を読む / いまを見る）" },
  { key: "S", label: "現実・感覚",      theme: "現実の扱い方（具体・五感）" },
  { key: "T", label: "論理・判断",      theme: "決断のしかた（論理・線引き）" },
  { key: "F", label: "感情・共感",      theme: "感情の扱い方（共感・価値観）" },
];

function attOf(fn) { return fn[1] === "e" ? "e" : "i"; }

function familyProfile(type) {
  const stack = STACKS[type];
  const prof = {};
  stack.forEach((fn, idx) => { prof[fn[0]] = { fn, att: attOf(fn), str: 4 - idx }; });
  return prof;
}

function analyzeSynergy(typeA, typeB) {
  const pa = familyProfile(typeA);
  const pb = familyProfile(typeB);
  const axes = FAMILIES.map((f) => {
    const a = pa[f.key], b = pb[f.key];
    const bothStrong = a.str >= 3 && b.str >= 3;
    const bothWeak   = a.str <= 2 && b.str <= 2;
    const sameAtt    = a.att === b.att;
    let relation;
    if (bothStrong)     relation = sameAtt ? "resonance" : "complement";
    else if (bothWeak)  relation = (a.str <= 1 && b.str <= 1) ? "blind" : "thin";
    else                relation = "support";
    return { family: f.key, label: f.label, theme: f.theme, relation, sum: a.str + b.str };
  });

  const count = (r) => axes.filter((x) => x.relation === r).length;
  const complement = count("complement"), resonance = count("resonance"),
        support = count("support"),       blind = count("blind");

  let score = 50 + complement * 16 + support * 8 + resonance * 3 - blind * 14;
  score = Math.max(5, Math.min(98, score));

  const wallAxis = axes.slice().sort((x, y) => x.sum - y.sum)[0];

  let archetype;
  if (complement === 2)              archetype = { key: "dual",       name: "デュアル（理想の補完）",     desc: "強みの方向は同じで、アプローチが正反対。自然に欠けを埋め合う相性。" };
  else if (resonance === 2)          archetype = { key: "twin",       name: "ツインソウル（鏡写し）",     desc: "似た者同士で深く分かり合える。ただし苦手も同じで死角を共有しがち。" };
  else if (support >= 3)             archetype = { key: "yin_yang",   name: "凸凹コンビ",                 desc: "強みと弱みが噛み合い、片方の苦手をもう片方が補う関係。" };
  else if (resonance >= 1 && complement === 0) archetype = { key: "blindspot", name: "似たもの同士の死角", desc: "通じ合う一方、2人とも同じ穴に落ちやすい。意識し合えば化ける。" };
  else                               archetype = { key: "mix",        name: "ミックス",                   desc: "補完と共鳴が入り混じる、バランス型の関係。" };

  return { axes, score, archetype, wall: wallAxis.family, wallTheme: wallAxis.theme, complement, resonance, support, blind };
}

// --- 関係の種類ごとのメタ情報 -----------------------------------------------
const RELATION_META = {
  complement: { label: "補完",       color: "#c98a4b", icon: "⚡", desc: "アプローチが正反対で、自然に補い合う" },
  resonance:  { label: "共鳴",       color: "#8a6bd1", icon: "🔮", desc: "同じ感覚を持ち、深く分かり合える" },
  support:    { label: "支え合い",   color: "#5ec2a0", icon: "🤝", desc: "強みと弱みが噛み合い、互いを補う" },
  blind:      { label: "共通の死角", color: "#e07a7a", icon: "⚠️", desc: "2人とも手薄になりがちな弱点" },
  thin:       { label: "希薄",       color: "#a99fc4", icon: "💨", desc: "どちらも似たような感覚" },
};

// --- コンテンツ生成 ----------------------------------------------------------
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
  if (syn.complement > 0) list.push(`${typeA}と${typeB}はアプローチが正反対だから、自然と役割分担が生まれる。得意なことを任せ合えば、2人でいると確実に1人より強くなる組み合わせ。`);
  if (syn.resonance > 0)  list.push(`同じ感覚を持つ部分があり、言葉にしなくても通じる瞬間がある。共感のスピードが速く、互いに「分かってもらえた」と感じやすい。`);
  if (syn.support > 0)    list.push(`凸凹が自然に噛み合っていて、一方が苦手なことをもう一方がカバーしやすい。意識しなくても支え合いが起きるのがこのペアの強み。`);
  if (syn.archetype.key === "dual")   list.push(`「デュアル」は最もバランスが取れた相性のひとつ。仕事でもプライベートでも、2人でいると互いのベストを引き出しやすい。`);
  if (syn.archetype.key === "twin")   list.push(`価値観や感性が非常に近いため、悩みを打ち明けたときに「ちゃんと分かってもらえた」と感じやすい。感情面での繋がりが深い。`);
  return list.slice(0, 3);
}

function buildWatchOuts(syn, typeA, typeB) {
  const list = [];
  if (syn.blind > 0)      list.push(`「${syn.wallTheme}」は2人とも手薄になりがちな共通の弱点。この領域では判断が甘くなることがあるので、外の視点を借りると安心。`);
  if (syn.resonance > 0)  list.push(`似ているがゆえに「言わなくても分かるでしょ」という思い込みが生まれやすい。実は伝わっていないことが積み重なりがちなので、言葉にする習慣が大切。`);
  if (syn.complement > 0) list.push(`アプローチが正反対だから「なんでそう考えるの？」と感じる衝突も起きやすい。相手の視点をまず受け取ってから話し合うと噛み合いやすい。`);
  if (list.length < 2)    list.push(`似た強みを持つ反面、共通して苦手な場面では共倒れになりやすい。得意分野で力を出し合い、苦手なところは早めに外に頼る判断が大切。`);
  return list.slice(0, 3);
}

// --- HTML レンダリング -------------------------------------------------------
function scoreBar(score) {
  const col = score >= 75 ? "#6fd39a" : score >= 55 ? "#c98a4b" : "#e07a7a";
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

function relatedHtml(typeA, typeB) {
  const links = TYPES.filter(t => t !== typeA).map(t => {
    const syn = analyzeSynergy(typeA, t);
    const col = syn.score >= 75 ? "#6fd39a" : syn.score >= 55 ? "#c98a4b" : "#a99fc4";
    return `<a href="/type/${typeA}-${t}" class="rel-chip" title="${syn.archetype.name}（${syn.score}点）">
      <span>${t}</span><span class="rel-score" style="color:${col}">${syn.score}</span>
    </a>`;
  }).join("");
  return `<div class="related-label">${typeA} の全相性（スコア付き）</div><div class="rel-chips">${links}</div>`;
}

function renderPage(typeA, typeB, syn) {
  const summary   = buildSummary(syn, typeA, typeB);
  const strengths = buildStrengths(syn, typeA, typeB);
  const watchouts = buildWatchOuts(syn, typeA, typeB);
  const desc = `${typeA}と${typeB}の相性は「${syn.archetype.name}」。スコア${syn.score}/100。良い面と注意点をMBTI認知機能で徹底解説。`;

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
  <meta name="twitter:card" content="summary" />
  <meta name="twitter:title" content="${typeA} × ${typeB} の相性｜相性ダンジョン" />
  <meta name="twitter:description" content="${desc}" />
  <link rel="stylesheet" href="/style.css" />
  <style>
    .back-link{color:var(--muted);font-size:13px;text-decoration:none;display:inline-block;margin-bottom:12px}
    .back-link:hover{color:var(--accent)}
    .pair-hero{text-align:center;padding:20px 0 16px}
    .pair-types{font-size:34px;font-weight:900;letter-spacing:.04em;margin:8px 0 4px}
    .pair-archetype{color:var(--accent2);font-size:16px;font-weight:700;margin-bottom:14px}
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
    ${scoreBar(syn.score)}
  </div>

  <div class="cta-box">
    <p class="cta-lead">同じ ${typeA} × ${typeB} でも、2人の行動次第で相性は変わる。<br>ゲームで実際の「関係スタイル」を発見しよう。</p>
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
    <div class="section-title">🔗 関連する相性</div>
    ${relatedHtml(typeA, typeB)}
  </div>

  <div class="page-footer">
    <a href="/">相性ダンジョン TOP</a> ／ 2人でダンジョンをクリアできる？ MBTI × ローグライク相性占い<br>
    <a href="/type/${typeB}-${typeA}">${typeB} × ${typeA} で見る</a>
  </div>
</main>
</body>
</html>`;
}

// --- ハンドラ ----------------------------------------------------------------
export default function handler(req, res) {
  const raw   = (req.query.pair || "").toUpperCase();
  const parts = raw.split("-");

  if (parts.length !== 2 || !TYPES.includes(parts[0]) || !TYPES.includes(parts[1])) {
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    return res.status(404).send(
      `<!DOCTYPE html><html lang="ja"><head><meta charset="UTF-8"><title>404</title>
       <link rel="stylesheet" href="/style.css"></head><body>
       <main class="app" style="text-align:center;padding-top:60px">
         <p style="color:var(--muted)">ページが見つかりません。</p>
         <a href="/" style="color:var(--accent)">TOPに戻る</a>
       </main></body></html>`
    );
  }

  const [typeA, typeB] = parts;
  const syn  = analyzeSynergy(typeA, typeB);
  const html = renderPage(typeA, typeB, syn);

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=86400, stale-while-revalidate=604800");
  return res.status(200).send(html);
}
