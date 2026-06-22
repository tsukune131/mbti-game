// ===========================================================================
//  Verdict（占い層）の単一ソース — サーバーレス/エッジ用 (ESM)
//  - 決定論的：型ペアだけで相性・アーキタイプ・決めゼリフが決まる
//  - 利用元：api/og.js（動的OG画像）, api/pair.js（SEOページ）
//  ⚠ ブラウザ側(game.js)にも punchline 型文のミラーがある。
//     決めゼリフの文面を編集するときは game.js の PUNCHLINES も合わせること。
// ===========================================================================

export const TYPES = [
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
  { key: "N", label: "ビジョン・直感", theme: "物事の捉え方（先を読む / いまを見る）" },
  { key: "S", label: "現実・感覚",     theme: "現実の扱い方（具体・五感）" },
  { key: "T", label: "論理・判断",     theme: "決断のしかた（論理・線引き）" },
  { key: "F", label: "感情・共感",     theme: "感情の扱い方（共感・価値観）" },
];

function attOf(fn) { return fn[1] === "e" ? "e" : "i"; }

function familyProfile(type) {
  const stack = STACKS[type];
  const prof = {};
  stack.forEach((fn, idx) => { prof[fn[0]] = { fn, att: attOf(fn), str: 4 - idx }; });
  return prof;
}

export function analyzeSynergy(typeA, typeB) {
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

// ===========================================================================
//  決めゼリフ（Punchline）— アーキタイプ(5) × 共通の壁(4) = 20系統
//  ⚠ game.js の PUNCHLINES と同一内容を保つこと（ブラウザ側ミラー）。
//  {a}/{b} は型コードに置換。拡散単位を「型ペア」に統一するため型名を使う。
// ===========================================================================
export const PUNCHLINES = {
  dual: {
    N: "{a}と{b}、正反対なのに噛み合う名コンビ。ただし『で、将来どうする？』の話だけは二人とも見て見ぬふり。",
    S: "{a}と{b}は凸凹が完璧にハマる二人。なのに現実的な段取りになると、急にお互い顔を見合わせる。",
    T: "{a}と{b}、違うからこそ惹かれ合う。ただ『どっちが正しい問題』になると決着まで一晩かかる。",
    F: "{a}と{b}は理屈で最強タッグ。でも『気持ちの話』になった瞬間、二人して固まる。",
  },
  twin: {
    N: "{a}も{b}も同じ温度。分かりすぎて楽。でも『誰か先を決めて』と二人で待ち続ける。",
    S: "{a}×{b}、感覚がそっくりで居心地は最高。ただし二人ともうっかり者、忘れ物も連帯責任。",
    T: "{a}と{b}は脳内が同じ。話は早い。けど『どっちも譲らない論破合戦』も同じ強さ。",
    F: "{a}も{b}も気持ち優先の似た者同士。共感は無限。でも言いにくいことは永遠に言わないまま。",
  },
  yin_yang: {
    N: "{a}が走り出し、{b}が現実に引き戻す。いいバランス。なのに『その先の計画』は二人とも空欄。",
    S: "{a}×{b}は役割分担が天才的。片方の苦手を片方が拾う。ただ詰めの作業だけは譲り合いがち。",
    T: "{a}と{b}、片方が決めて片方が和ませる名コンビ。揉めても最後はなぜか丸く収まる。",
    F: "{a}が引っ張り{b}が支える二人。頼れる関係。でも本音のケアだけは、つい後回し。",
  },
  blindspot: {
    N: "似た者の{a}×{b}。通じ合うけど『で、どうする？』を二人で放置して、同じ穴に落ちる。",
    S: "{a}と{b}、波長は完璧。ただし二人とも地に足つかず、現実が後ろから追いついてくる。",
    T: "{a}×{b}は分かり合える。でも白黒つける場面を二人で避けて、問題だけが育っていく。",
    F: "{a}も{b}も優しい。だから言いにくいことを言わず、小さな我慢が静かに積もる。",
  },
  mix: {
    N: "{a}×{b}はバランス型。場面次第で化ける。ただ『将来の話』だけは二人とも腰が重い。",
    S: "{a}と{b}、状況対応は上手い二人。でも地味な段取りになると急に静かになる。",
    T: "{a}×{b}は調整上手。なのに肝心の決断は『どっちでもいい』の譲り合いでループ。",
    F: "{a}と{b}はそつなくいい関係。ただ深い感情の話になると、お互い一歩引きがち。",
  },
};

export function punchlineFor(typeA, typeB, syn) {
  const s = syn || analyzeSynergy(typeA, typeB);
  const byArch = PUNCHLINES[s.archetype.key] || PUNCHLINES.mix;
  const tmpl = byArch[s.wall] || byArch.N;
  return tmpl.replace(/\{a\}/g, typeA).replace(/\{b\}/g, typeB);
}
