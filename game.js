// ===========================================================================
// MBTI × ローグライク 相性占い（認知機能エンジン版）
// 「2人でダンジョンをクリアできるか？」= 相性占いの答え
// ---------------------------------------------------------------------------
//  ネットの相性記事の元ネタ = 認知機能(Cognitive Functions)理論。
//  各タイプの機能スタックは確定事項なので、それを照合して相性を導く。
//   - 各タイプは N/S/T/F の4家族を1つずつ持つ（態度 e/i と 強さ1〜4）
//   - 2人を家族ごとに照合 → 補完 / 共鳴 / 支え / 死角 に分類
//   - 死角(2人とも弱い機能) = 乗り越える「壁」= ボス
//   - 構造データを Gemini に渡して鑑定文に"解読"させる
// ===========================================================================

const TYPES = [
  "INTJ", "INTP", "ENTJ", "ENTP",
  "INFJ", "INFP", "ENFJ", "ENFP",
  "ISTJ", "ISFJ", "ESTJ", "ESFJ",
  "ISTP", "ISFP", "ESTP", "ESFP",
];

// --- 16タイプの認知機能スタック（dominant→inferior の順）-----------------
const STACKS = {
  ISTJ: ["Si", "Te", "Fi", "Ne"], ISFJ: ["Si", "Fe", "Ti", "Ne"],
  ESTJ: ["Te", "Si", "Ne", "Fi"], ESFJ: ["Fe", "Si", "Ne", "Ti"],
  ISTP: ["Ti", "Se", "Ni", "Fe"], ISFP: ["Fi", "Se", "Ni", "Te"],
  ESTP: ["Se", "Ti", "Fe", "Ni"], ESFP: ["Se", "Fi", "Te", "Ni"],
  INTJ: ["Ni", "Te", "Fi", "Se"], INFJ: ["Ni", "Fe", "Ti", "Se"],
  ENTJ: ["Te", "Ni", "Se", "Fi"], ENFJ: ["Fe", "Ni", "Se", "Ti"],
  INTP: ["Ti", "Ne", "Si", "Fe"], INFP: ["Fi", "Ne", "Si", "Te"],
  ENTP: ["Ne", "Ti", "Fe", "Si"], ENFP: ["Ne", "Fi", "Te", "Si"],
};

// 機能 → 態度(e/i)。家族は先頭文字(N/S/T/F)で判定。
function attOf(fn) { return fn[1] === "e" ? "e" : "i"; }

// 各タイプの「家族プロファイル」: 家族 → {att, str(1〜4)}
function familyProfile(type) {
  const stack = STACKS[type];
  const prof = {};
  stack.forEach((fn, idx) => {
    prof[fn[0]] = { fn, att: attOf(fn), str: 4 - idx }; // dominant=4 … inferior=1
  });
  return prof;
}

const FAMILIES = [
  { key: "N", theme: "物事の捉え方（先を読む / いまを見る）", domain: "探索ルーム" },
  { key: "S", theme: "現実の扱い方（具体・五感）", domain: "実地ルーム" },
  { key: "T", theme: "決断のしかた（論理・線引き）", domain: "選択ルーム" },
  { key: "F", theme: "感情の扱い方（共感・価値観）", domain: "心情ルーム" },
];

// --- キャラ生成: 機能スタック → ステータス -------------------------------
function deriveCharacter(type, name) {
  const p = familyProfile(type);
  const s = { hp: 64, atk: 10, def: 8, heal: 6, crit: 7, luck: 7 };
  // 各家族の強さ×態度をステータスに変換
  // T: 高いほど火力/クリティカル, F: 回復, N: クリティカル/運, S: HP/攻撃
  s.atk += Math.round(p.T.str * 1.6 + p.S.str * 1.1);
  s.crit += Math.round(p.T.str * 1.2 + p.N.str * 1.3);
  s.heal += Math.round(p.F.str * 2.0);
  s.hp += Math.round(p.S.str * 4 + p.F.str * 1.5);
  s.luck += Math.round(p.N.str * 1.6);
  // 態度: 外向(e)が多い=攻め, 内向(i)が多い=守り
  const eCount = Object.values(p).filter((x) => x.att === "e").length;
  s.atk += (eCount - 2) * 2;
  s.def += (2 - eCount) * 2 + 4;
  return { type, name: name || type, ...s };
}

// --- 相性エンジン: 2人の機能スタックを照合 -------------------------------
function analyzeSynergy(typeA, typeB) {
  const pa = familyProfile(typeA);
  const pb = familyProfile(typeB);

  const axes = FAMILIES.map((f) => {
    const a = pa[f.key], b = pb[f.key];
    const sameAtt = a.att === b.att;
    const bothStrong = a.str >= 3 && b.str >= 3;
    const bothWeak = a.str <= 2 && b.str <= 2;
    let relation;
    if (bothStrong) relation = sameAtt ? "resonance" : "complement"; // 共鳴 / 補完
    else if (bothWeak) relation = (a.str <= 1 && b.str <= 1) ? "blind" : "thin"; // 死角 / 希薄
    else relation = "support"; // 凸凹の支え合い
    return {
      family: f.key, theme: f.theme, domain: f.domain,
      functions: [a.fn, b.fn], sameAtt, relation,
      sum: a.str + b.str,
      // 表示・互換用
      letters: a.fn + " / " + b.fn,
      shared: sameAtt,
    };
  });

  const count = (r) => axes.filter((x) => x.relation === r).length;
  const complement = count("complement");
  const resonance = count("resonance");
  const support = count("support");
  const blind = count("blind");
  const thin = count("thin");

  // 構造上の上限: 各タイプは強い家族(str>=3)を2つだけ持つので
  //   complement / resonance は 0〜2、blind は 0〜1 にしかならない。
  // スコア(5〜98): 補完・支え合いが高評価、死角は減点
  // ⚠ lib/verdict.mjs（OG画像・SEOページ）と同一式に揃えること（in-app/共有でスコア一致）。
  let score = 50 + complement * 16 + support * 8 + resonance * 3 - blind * 14;
  score = Math.max(5, Math.min(98, score));

  // 壁(ボス) = 2人が最も弱い家族（共に苦手なこと）
  const wallAxis = axes.slice().sort((x, y) => x.sum - y.sum)[0];

  // 難易度: 壁の弱さ − 補完/支えのクッション
  const wallHarsh = Math.round((8 - wallAxis.sum) / 1.5); // 0〜4
  const cushion = complement + Math.round(support / 2);   // 補完が効くほど楽
  const difficulty = Math.max(0, Math.min(4, wallHarsh - cushion));

  // アーキタイプ命名（上限を踏まえた閾値）
  let archetype;
  if (complement === 2) archetype = { key: "dual", name: "デュアル（理想の補完）", desc: "強みの方向は同じで、アプローチが正反対。自然に欠けを埋め合う相性。" };
  else if (resonance === 2) archetype = { key: "twin", name: "ツインソウル（鏡写し）", desc: "似た者同士で深く分かり合える。ただし苦手も同じで死角を共有しがち。" };
  else if (support >= 3) archetype = { key: "yin_yang", name: "凸凹コンビ", desc: "強みと弱みが噛み合い、片方の苦手をもう片方が補う関係。" };
  else if (resonance >= 1 && complement === 0) archetype = { key: "blindspot", name: "似たもの同士の死角", desc: "通じ合う一方、2人とも同じ穴に落ちやすい。意識し合えば化ける。" };
  else archetype = { key: "mix", name: "ミックス", desc: "補完と共鳴が入り混じる、バランス型の関係。" };

  return {
    axes, score, difficulty, archetype, wall: wallAxis.family,
    wallTheme: wallAxis.theme,
    complement, resonance, support, blind, thin,
    sharedCount: axes.filter((x) => x.sameAtt).length, // 互換
  };
}

// --- パーティ構築: 2人を合成 ---------------------------------------------
function buildParty(self, partner) {
  const ca = deriveCharacter(self.type, self.name);
  const cb = deriveCharacter(partner.type, partner.name);
  const syn = analyzeSynergy(self.type, partner.type);

  const party = {
    hp: ca.hp + cb.hp,
    maxHp: ca.hp + cb.hp,
    atk: Math.round((ca.atk + cb.atk) * 0.82),
    def: Math.round((ca.def + cb.def) * 0.6),
    heal: Math.round((ca.heal + cb.heal) * 0.6),
    crit: Math.min(60, ca.crit + cb.crit),
    luck: Math.round((ca.luck + cb.luck) * 0.5),
    members: [ca, cb],
    synergy: syn,
    bonds: [],
    behaviorProfile: { 対話: 0, 素直さ: 0, 思いやり: 0, 冒険: 0, 安定: 0, 歩み寄り: 0 },
  };
  // アーキタイプ・ボーナス
  const arch = syn.archetype.key;
  if (arch === "dual") { party.def += 6; party.hp += 16; party.maxHp += 16; }
  else if (arch === "yin_yang") { party.def += 5; party.heal += 4; party.hp += 10; party.maxHp += 10; }
  else if (arch === "twin") { party.atk += 6; party.crit += 6; }
  else if (arch === "blindspot") { party.atk += 3; }
  // 補完の数だけ底力
  party.hp += syn.complement * 5; party.maxHp += syn.complement * 5;
  return party;
}

// --- 敵 = 関係の壁（家族ごと）--------------------------------------------
const ENEMIES = {
  N: { name: "「で、私たちどうなるの？」の門番", desc: "将来の話を避け続けた二人の前に立ちはだかる", hp: 70, atk: 12, hint: "二人の“この先”を言葉にできるか" },
  S: { name: "地に足つかずフワフワ妖怪", desc: "夢ばかりで現実を見ない二人を試す", hp: 72, atk: 12, hint: "目の前の現実を二人で片づけられるか" },
  T: { name: "「どっちでもいい」無限ループ沼", desc: "決められない二人を静かに飲み込む", hp: 78, atk: 11, hint: "二人ではっきり決めきれるか" },
  F: { name: "言わなきゃ伝わらないオバケ", desc: "気持ちのケアを後回しにした二人を襲う", hp: 66, atk: 14, hint: "素直に気持ちを伝え合えるか" },
};

// 雑魚（fam で見た目の色が変わる）= 関係の小さなすれ違いあるある
const MOBS = [
  { name: "未読のまま3日経過した影",       hp: 44, atk: 11, fam: "F" },
  { name: "既読スルーの亡霊",             hp: 44, atk: 11, fam: "F" },
  { name: "「今どこ？」催促スライム",       hp: 48, atk: 10, fam: "S" },
  { name: "予定をギリギリまで決めない霧",   hp: 40, atk: 9,  fam: "N" },
  { name: "正論で殴ってくる小鬼",          hp: 42, atk: 12, fam: "T" },
  { name: "マウント取りたがりの妖精",       hp: 42, atk: 12, fam: "T" },
  { name: "昔の話を蒸し返す亡者",          hp: 46, atk: 10, fam: "S" },
  { name: "「なんでもいい」のち不機嫌の幻", hp: 38, atk: 13, fam: "F" },
  { name: "見栄の蜃気楼",                 hp: 40, atk: 11, fam: "N" },
];

// 中ボス（道中に1回出る、雑魚とボスの中間）
const MINIBOSSES = [
  { name: "記念日を忘れた罪の番人",   hp: 95,  atk: 15, fam: "F", desc: "うっかりを見逃さない" },
  { name: "返信遅いと不安になる双子", hp: 90,  atk: 16, fam: "N", desc: "既読の“間”で心を揺らす" },
  { name: "正論パンチの審判",         hp: 105, atk: 13, fam: "T", desc: "正しさで殴ってくる" },
  { name: "マンネリ大蛇",             hp: 110, atk: 12, fam: "S", desc: "“いつメン”の刺激のなさで締めつける" },
];

// ランの導入ナレーション（関係タイプで変わる）
const STORY_INTROS = {
  dual:      "正反対の二人が挑む『補完の回廊』。「なんで分かってくれないの」を越えた先に、最強のコンビが待つ。",
  twin:      "よく似た二人が映る『鏡の塔』。「それな」で通じ合うが、同じ落とし穴も二人で待っている。",
  yin_yang:  "凸凹な二人の『凸凹洞窟』。片方がアクセル、片方がブレーキ。歩幅が合うかが試される。",
  blindspot: "似た二人が挑む『死角の迷宮』。お互い見えていない場所に、罠は仕掛けられている。",
  mix:       "バランス型の二人の『調和の遺跡』。名コンビにも珍道中にもなる、その真価が問われる。",
};

// --- Phase A/B: 行動プロファイル・動的難易度エンジン ----------------------
// 各家族の壁を和らげる行動軸（ゲーム中の選択でカバーできる）
const WALL_COVERAGE = {
  N: ["冒険"],               // 先を見通す不安   → 挑戦する姿勢でカバー
  S: ["安定"],               // 現実対処の弱さ   → 地に足ついた選択でカバー
  T: ["対話", "歩み寄り"],   // 決断の曖昧さ     → 対話と折り合いでカバー
  F: ["思いやり", "素直さ"], // 感情疎通の弱さ   → 寄り添いと正直さでカバー
};

// 行動プロファイルから壁へのナビゲーションボーナスを算出 (0〜2)
function computeNavBonus(profile, wall) {
  const dims = WALL_COVERAGE[wall] || [];
  const total = dims.reduce((s, d) => s + (profile[d] || 0), 0);
  if (total >= 6) return 2;
  if (total >= 3) return 1;
  return 0;
}

// Phase C: 最も強い行動軸から「関係スタイル」を導出
const REL_STYLES = {
  対話:    { label: "本音でぶつかれる二人", desc: "言葉で壁を越えてきた。それが2人の最大の武器。" },
  素直さ:  { label: "弱さを見せ合える二人", desc: "脆さをさらけ出せるから、本当の意味で深く繋がれる。" },
  思いやり: { label: "支え合いの二人",       desc: "自然と相手を先に考えてしまう。その優しさが2人の土台。" },
  冒険:    { label: "刺激を共にする二人",   desc: "「やってみよう」を共有できる。その勢いが関係を生き生きとさせる。" },
  安定:    { label: "地に足のついた二人",   desc: "急がず焦らず歩める。長く続く安心感がある。" },
  歩み寄り: { label: "折り合いが得意な二人", desc: "どちらが正しいかより、どう一緒にいられるかを選べる。" },
};
function deriveRelStyle(profile) {
  let best = "歩み寄り", bestVal = -1;
  for (const [k, v] of Object.entries(profile)) {
    if (v > bestVal) { bestVal = v; best = k; }
  }
  const s = REL_STYLES[best] || { label: "バランスの二人", desc: "" };
  return { key: best, ...s };
}

// --- 絆アイテム(レリック) ------------------------------------------------
const BONDS = [
  { name: "笑いのかけら", effect: "heal", val: 8, text: "ふとした笑いが2人を癒やす" },
  { name: "信頼の指輪", effect: "def", val: 6, text: "任せられる安心が守りになる" },
  { name: "勢いのお守り", effect: "atk", val: 6, text: "ノリの良さが攻めを後押し" },
  { name: "ひらめきの種", effect: "crit", val: 10, text: "息の合った瞬間が急所を突く" },
  { name: "幸運の合鍵", effect: "luck", val: 10, text: "なぜか噛み合うタイミング" },
];

// --- シード付き乱数 -------------------------------------------------------
function makeRng(seedStr) {
  let h = 2166136261;
  for (let i = 0; i < seedStr.length; i++) {
    h ^= seedStr.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  let state = h >>> 0;
  return function () {
    state ^= state << 13; state >>>= 0;
    state ^= state >> 17;
    state ^= state << 5; state >>>= 0;
    return state / 4294967296;
  };
}
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }

// --- ダンジョン生成 -------------------------------------------------------
function generateDungeon(party, rng) {
  const wall = party.synergy.wall;       // 共に弱い家族 = 最終ボス
  const len = 6 + Math.floor(rng() * 2); // 6〜7階
  const floors = [{ floor: 1, kind: "battle" }]; // 1階は導入の戦闘

  const pool = ["battle", "event", "event", "treasure", "rest", "battle"];
  const miniAt = 2 + Math.floor(rng() * (len - 3)); // 中盤に中ボス1回
  let last = "battle";
  let hasEvent = false;

  for (let i = 2; i < len; i++) {
    let kind;
    if (i === miniAt) {
      kind = "miniboss";
    } else {
      // 直前と同じ「休憩系」は避けて単調さを防ぐ
      do { kind = pick(rng, pool); }
      while ((kind === "rest" || kind === "treasure") && kind === last);
    }
    floors.push({ floor: i, kind });
    if (kind === "event") hasEvent = true;
    last = kind;
  }
  // イベントが1つも無ければ直前をイベントに
  if (!hasEvent) floors[floors.length - 1].kind = "event";

  floors.push({ floor: len, kind: "boss", wall });
  return { floors, wall, len };
}

// --- 関係イベント(非戦闘・選択) ------------------------------------------
// tags: 選択が示す関係の振る舞いを5軸で蓄積（Phase A）
const EVENTS = [
  {
    prompt: "片方がへこんでいる。どうする？",
    choices: [
      { label: "一緒に解決策を考える", tags: { 対話: 2 },              effect: (p) => { p.atk += 5; p.crit += 5; }, log: "並んで解決策を出した。前向きさが攻めを鋭くした" },
      { label: "何も言わず隣にいる",   tags: { 思いやり: 2, 素直さ: 1 }, effect: (p) => { p.heal += 8; }, log: "ただ黙って隣にいた。その温もりが回復力になった" },
    ],
  },
  {
    prompt: "旅行の計画、どう立てる？",
    choices: [
      { label: "分単位のしおりを作る", tags: { 安定: 2 }, effect: (p) => { p.def += 6; p.heal += 3; }, log: "完璧なしおりを用意。備えが守りを固めた" },
      { label: "現地でなんとかする",   tags: { 冒険: 2 }, effect: (p) => { p.atk += 6; p.luck += 4; }, log: "ノープランで突撃。勢いが力になった" },
    ],
  },
  {
    prompt: "相手からの返信が来ない。",
    choices: [
      { label: "気にせず自分の時間",     tags: { 安定: 1, 冒険: 1 },  effect: (p) => { p.crit += 6; }, log: "どんと構えた。マイペースが冴えを生む" },
      { label: "「何かあった？」と送る", tags: { 思いやり: 1, 対話: 1 }, effect: (p) => { p.heal += 5; p.def += 3; }, log: "そっと気にかけた。優しさが安心になった" },
    ],
  },
  {
    prompt: "意見が割れた。今夜の進路はどっちが決める？",
    choices: [
      { label: "とことん話し合う",   tags: { 対話: 2, 歩み寄り: 1 }, effect: (p) => { p.def += 5; p.heal += 3; }, log: "納得いくまで話した。歩み寄りが守りを固めた" },
      { label: "ジャンケンで即決",   tags: { 歩み寄り: 1, 冒険: 1 }, effect: (p) => { p.luck += 8; }, log: "運任せで即決。妙な一体感で運が向いてきた" },
    ],
  },
  {
    prompt: "うっかり相手の地雷を踏んだ。",
    choices: [
      { label: "すぐ謝って理由を聞く", tags: { 素直さ: 2, 対話: 1 }, effect: (p) => { p.def += 8; }, log: "素直に謝った。それが何より硬い盾になった" },
      { label: "少し時間を置く",       tags: { 安定: 1 },            effect: (p) => { p.crit += 6; }, log: "一旦クールダウン。冷静さが研ぎ澄まされた" },
    ],
  },
  {
    prompt: "楽しみにしてた店が、まさかの定休日。",
    choices: [
      { label: "ノリで別の店を探す",   tags: { 冒険: 2 },            effect: (p) => { p.atk += 7; p.luck += 4; }, log: "その場で開拓。ハプニングも楽しめる二人" },
      { label: "次こそはと予約し直す", tags: { 安定: 1, 歩み寄り: 1 }, effect: (p) => { p.def += 4; p.heal += 4; }, log: "仕切り直しを約束。堅実な絆が深まった" },
    ],
  },
  {
    prompt: "相手が「なんでもいいよ」と言った。",
    choices: [
      { label: "じゃあ私が決める！", tags: { 冒険: 1, 歩み寄り: 1 }, effect: (p) => { p.atk += 6; }, log: "スパッとリード。決断力が場を動かした" },
      { label: "いや一緒に選ぼうよ", tags: { 対話: 2 },            effect: (p) => { p.heal += 4; p.def += 3; }, log: "粘って一緒に選んだ。対話が絆を厚くした" },
    ],
  },
  {
    prompt: "ケンカした。先に折れるのは？",
    choices: [
      { label: "非があれば自分から", tags: { 素直さ: 2 }, effect: (p) => { p.def += 7; }, log: "自分から折れた。素直さが信頼を生んだ" },
      { label: "まず相手の話を聞く", tags: { 思いやり: 2 }, effect: (p) => { p.heal += 7; }, log: "相手の気持ちを先に聞いた。寄り添いが癒やしに" },
    ],
  },
];

// --- 宝箱部屋（リスク/リワード） ------------------------------------------
const TREASURES = [
  {
    prompt: "ちょっと高そうなお店を見つけた。",
    choices: [
      { label: "ノリで入っちゃう",     tags: { 冒険: 2 },              effect: (p, rng) => { if (rng() < 0.7) { p.atk += 10; p.crit += 6; } else { p.hp -= 18; } }, log: "勢いで入店。当たりか、財布の悲鳴か——" },
      { label: "口コミを調べてから",   tags: { 安定: 2 },              effect: (p) => { p.def += 5; p.heal += 4; }, log: "下調べしてから入った。堅実な満足" },
      { label: "今日はやめておく",     tags: { 安定: 1, 歩み寄り: 1 }, effect: (p) => { p.luck += 7; }, log: "欲を出さず見送った。冷静さが運を呼ぶ" },
    ],
  },
];

// --- 焚き火部屋（休息） ----------------------------------------------------
const RESTS = [
  {
    prompt: "ふたりで一息。今夜はどう過ごす？",
    choices: [
      { label: "とにかく寝て充電", tags: { 安定: 1 },              effect: (p) => { p.hp = Math.min(p.maxHp, p.hp + 30); }, log: "しっかり休んで充電。HPが大きく回復" },
      { label: "夜通し語り合う",   tags: { 対話: 2, 思いやり: 1 }, effect: (p) => { p.heal += 6; p.hp = Math.min(p.maxHp, p.hp + 10); }, log: "夜通し語り合った。絆が深まり心が満ちる" },
      { label: "明日の作戦会議",   tags: { 対話: 1, 歩み寄り: 1 }, effect: (p) => { p.atk += 6; p.crit += 5; }, log: "明日に備えて作戦会議。連携が研ぎ澄まされた" },
    ],
  },
];

// ===========================================================================
//  ランの実行（ジェネレータ）
//  - イベント階では {type:'choice'} を yield して停止し、プレイヤーの選択を待つ
//  - それ以外の表示は {type:'log', entry} を yield（UIは「次へ」で進める）
//  - 最後に finalize() の結果を return
// ===========================================================================
function* runDungeonGen(self, partner, seed) {
  const rng = makeRng(seed);
  const party = buildParty(self, partner);
  const dungeon = generateDungeon(party, rng);
  const log = [];
  let reachedFloor = 0;
  let cleared = false;

  // 導入ナレーション（関係タイプで変わる）
  const intro = STORY_INTROS[party.synergy.archetype.key] || STORY_INTROS.mix;
  const introEntry = { floor: 0, type: "story", text: intro };
  log.push(introEntry);
  yield { type: "log", entry: introEntry, sceneKind: "idle" };

  // 選択式の部屋を共通処理するヘルパー
  function* choiceRoom(f, room, sceneKind, entryType, bondChance) {
    const idx = yield { type: "choice", floor: f.floor, prompt: room.prompt, choices: room.choices.map((c) => c.label), sceneKind };
    const ch = room.choices[idx] != null ? room.choices[idx] : room.choices[0];
    ch.effect(party, rng);
    // Phase A: 選択の行動タグを蓄積してプロファイルを育てる
    if (ch.tags) {
      for (const [k, v] of Object.entries(ch.tags)) {
        party.behaviorProfile[k] = (party.behaviorProfile[k] || 0) + v;
      }
    }
    const entry = { floor: f.floor, type: entryType, prompt: room.prompt, choice: ch.label, result: ch.log };
    log.push(entry);
    yield { type: "log", entry };
    if (rng() < bondChance) {
      const bond = pick(rng, BONDS);
      applyBond(party, bond);
      const b = { floor: f.floor, type: "bond", name: bond.name, text: bond.text };
      log.push(b);
      yield { type: "log", entry: b };
    }
  }

  for (const f of dungeon.floors) {
    reachedFloor = f.floor;

    if (f.kind === "event") {
      yield* choiceRoom(f, pick(rng, EVENTS), "event", "event", 0.5);
      continue;
    }
    if (f.kind === "treasure") {
      yield* choiceRoom(f, pick(rng, TREASURES), "treasure", "treasure", 0.7);
      continue;
    }
    if (f.kind === "rest") {
      yield* choiceRoom(f, pick(rng, RESTS), "rest", "rest", 0.3);
      continue;
    }

    // 戦闘系（battle / miniboss / boss）
    let enemy;
    if (f.kind === "boss") {
      const e = ENEMIES[f.wall];
      // Phase B: 選択で積み上げた行動プロファイルがボスの壁を和らげる
      const navBonus = computeNavBonus(party.behaviorProfile, f.wall);
      const d = Math.max(0, party.synergy.difficulty - navBonus);
      enemy = {
        ...e, isBoss: true, wall: f.wall,
        hp: Math.round(e.hp * (1 + 0.5 * d)),
        atk: Math.round((e.atk + 7) * (1 + 0.45 * d)),
      };
    } else if (f.kind === "miniboss") {
      const m = pick(rng, MINIBOSSES);
      enemy = { ...m, isBoss: false, mini: true, wall: m.fam };
    } else {
      const m = pick(rng, MOBS);
      enemy = { ...m, isBoss: false, wall: m.fam };
    }
    const battle = autoBattle(party, enemy, rng);
    const entry = {
      floor: f.floor, type: "battle", enemy: enemy.name, desc: enemy.desc || "",
      boss: !!enemy.isBoss, mini: !!enemy.mini, wall: enemy.wall || null, ...battle,
    };
    log.push(entry);
    yield { type: "log", entry };

    if (!battle.win) {
      return finalize({ self, partner, party, dungeon, log, reachedFloor, cleared: false, fellTo: enemy.name });
    }
    if (f.kind === "boss") cleared = true;
  }
  return finalize({ self, partner, party, dungeon, log, reachedFloor, cleared });
}

// 非対話版（テスト・自動実行用）。chooser(choiceStep)->index、無ければ先頭を選ぶ。
function runDungeon(self, partner, seed, chooser) {
  const gen = runDungeonGen(self, partner, seed);
  let step = gen.next();
  while (!step.done) {
    if (step.value.type === "choice") {
      const idx = chooser ? chooser(step.value) : 0;
      step = gen.next(idx);
    } else {
      step = gen.next();
    }
  }
  return step.value;
}

function applyBond(party, bond) {
  party.bonds.push(bond.name);
  party[bond.effect] += bond.val;
}

// --- オートバトル ---------------------------------------------------------
function autoBattle(party, enemy, rng) {
  let pHp = party.hp, eHp = enemy.hp;
  const turns = [];
  let safety = 0;
  while (pHp > 0 && eHp > 0 && safety < 30) {
    safety++;
    let dmg = party.atk + Math.floor(rng() * 6);
    const critical = rng() * 100 < party.crit;
    if (critical) dmg = Math.round(dmg * 1.8);
    if (enemy.isBoss) dmg = Math.round(dmg * 0.9);
    eHp -= dmg;
    turns.push(`${critical ? "会心の一撃！ " : ""}${enemy.name}に ${dmg} ダメージ`);
    if (eHp <= 0) break;

    let edmg = Math.max(2, enemy.atk + Math.floor(rng() * 5) - Math.floor(party.def / 3));
    pHp -= edmg;
    if (party.heal > 0 && rng() * 100 < party.heal) {
      const heal = Math.round(party.heal * 0.8);
      pHp = Math.min(party.maxHp, pHp + heal);
      turns.push(`${enemy.name}の攻撃 ${edmg}、しかし持ち直して ${heal} 回復`);
    } else {
      turns.push(`${enemy.name}の攻撃 ${edmg}`);
    }
    if (pHp < party.maxHp * 0.25 && rng() * 100 < party.luck) {
      eHp -= party.atk * 2;
      turns.push(`土壇場の踏ん張り！ ${enemy.name}に大ダメージ`);
    }
  }
  party.hp = Math.max(0, pHp);
  return { win: eHp <= 0 && pHp > 0, hpLeft: party.hp, turns };
}

// --- ランク判定（blendedScore → SS〜D） -----------------------------------
function calcRank(score) {
  if (score >= 85) return { label: "SS", color: "#fbbf24", desc: "伝説級の相性" };
  if (score >= 75) return { label: "S",  color: "#f97316", desc: "非常に高い相性" };
  if (score >= 65) return { label: "A",  color: "#6fd39a", desc: "良好な相性" };
  if (score >= 55) return { label: "B",  color: "#6fc4e0", desc: "まずまずの相性" };
  if (score >= 45) return { label: "C",  color: "#a99fc4", desc: "要努力な相性" };
  return             { label: "D",  color: "#e07a7a", desc: "険しい道のり" };
}

// --- 結果まとめ -----------------------------------------------------------
function finalize(state) {
  const { self, partner, party, dungeon, log, reachedFloor, cleared, fellTo } = state;
  // Phase C: MBTI構造スコア × ゲーム行動スコアの合成
  const relStyle = deriveRelStyle(party.behaviorProfile);

  // 名場面（今回の名シーン）= 直近の選択イベントを1つ拾ってシェア燃料にする
  const choiceLogs = log.filter((l) => l.type === "event" || l.type === "treasure" || l.type === "rest");
  const pickedScene = choiceLogs.length ? choiceLogs[choiceLogs.length - 1] : null;
  const highlight = pickedScene
    ? { prompt: pickedScene.prompt, choice: pickedScene.choice, result: pickedScene.result }
    : null;
  // v2 Verdict分離: スコア・ランクは「型ペアだけで決まる不変値」。
  // 選択（behaviorProfile）はスコアに混ぜず、関係スタイル・名場面・鑑定文に反映する。
  // → アプリ内／OG画像／SEOページで同じスコアが出る（シェアがブレない）。
  const rank = calcRank(party.synergy.score);
  return {
    self, partner, cleared, reachedFloor,
    fellTo: fellTo || null,
    bonds: party.bonds,
    behaviorProfile: party.behaviorProfile,
    relStyle,
    highlight,
    rank,
    synergy: { ...party.synergy }, // blendedScore は廃止（score に一本化）
    wall: dungeon.wall,
    hpLeft: party.hp, maxHp: party.maxHp,
    log,
  };
}

// ===========================================================================
//  鑑定文の生成
//  最小コスト運用: 既定はテンプレ鑑定（LLM不使用＝ランニング$0）。
//   - 決めゼリフ・スコアは Verdict で固定
//   - 鑑定文は relStyle（＝プレイ中の選択）で分岐して変化
//  ライブGemini鑑定は generateDetailedReading() に分離し、
//  将来「詳細鑑定」(リワード広告/課金ゲート)からのみ呼ぶ → 1プレイ毎の課金を断つ。
// ===========================================================================
async function generateReading(result) {
  return templateReading(result);
}

// 任意の本格鑑定（ライブGemini）。広告/課金ゲートの後ろからのみ呼ぶこと。
async function generateDetailedReading(result) {
  try {
    const res = await fetch("/api/reading", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buildReadingPayload(result)),
    });
    if (!res.ok) throw new Error("api " + res.status);
    const data = await res.json();
    if (data.summary) return {
      text: data.summary,
      work: data.work || "",
      romance: data.romance || "",
      friends: data.friends || "",
      source: "gemini",
    };
    throw new Error("no reading");
  } catch (e) {
    return templateReading(result);
  }
}

const RELATION_JA = { complement: "補完", resonance: "共鳴", support: "支え合い", blind: "共通の死角", thin: "希薄" };

// API へ渡すラン要約（認知機能構造 + 行動プロファイル込み）
function buildReadingPayload(r) {
  const s = r.synergy;
  const profileHighlights = Object.entries(r.behaviorProfile || {})
    .filter(([, v]) => v > 0)
    .sort(([, a], [, b]) => b - a)
    .map(([k, v]) => `${k}（${v}点）`)
    .join("、");
  return {
    self: { ...r.self, stack: STACKS[r.self.type] },
    partner: { ...r.partner, stack: STACKS[r.partner.type] },
    run: {
      cleared: r.cleared,
      reachedFloor: r.reachedFloor,
      fellTo: r.fellTo,
      bonds: r.bonds,
      archetype: s.archetype,
      score: s.score,                         // v2: 型ペア固定の相性スコア
      wallTheme: s.wallTheme,
      relStyle: r.relStyle || null,           // 行動から導いた関係スタイル（選択で変わる）
      behaviorHighlights: profileHighlights,  // 選択傾向サマリ（選択で変わる）
      highlight: r.highlight || null,         // §8: 今回の名シーン（選択で変わる）
      functions: s.axes.map((a) => ({
        theme: a.theme, you: a.functions[0], them: a.functions[1],
        relation: RELATION_JA[a.relation] || a.relation,
      })),
      timeline: r.log.map((l) => {
        if (l.type === "battle") return `${l.floor}階: ${l.enemy}と戦い${l.win ? "勝利" : "敗北"}`;
        if (l.type === "event") return `${l.floor}階: ${l.prompt} → ${l.choice}`;
        if (l.type === "bond") return `${l.floor}階: 絆「${l.name}」を得た`;
        return "";
      }).filter(Boolean),
    },
  };
}

// --- テンプレ鑑定（LLM不使用・$0／relStyleで分岐＝選択で文面が変わる） ----
//  決めゼリフ・スコアは固定（Verdict）、3観点は relStyle（プレイの選択）で変化。
//  トーンは §7 と統一：具体シーンを名指し・あるあるを言い切り・最後に救う。
const TEMPLATE_READINGS = {
  対話: {
    work:    (a, b) => `仕事で意見が割れても、${a}と${b}は納得いくまで話せる強さがある。ただし会議が長引いて「で、結論は？」になりがち。時間を区切るとキレが出る。`,
    romance: (a, b) => `ケンカしても${a}と${b}は言葉でぶつかれるから、沈黙が短い。ただし正論で詰めすぎると相手が黙る。気持ちを先に言うと丸く収まる。`,
    friends: (a, b) => `${a}と${b}は何でも話せて、気づけば朝。語りすぎ注意だけど、その時間こそ2人の財産。`,
  },
  素直さ: {
    work:    (a, b) => `「ここ分からない」を素直に言い合える${a}と${b}は、ミスを早めに潰せる。ただ気を使って抱え込むと逆効果。困ったら即共有が吉。`,
    romance: (a, b) => `弱さを見せ合えるから、${a}と${b}は深く繋がれる。ただし甘えすぎて依存気味になることも。お互いの一人時間も大事に。`,
    friends: (a, b) => `見栄を張らない楽な関係の${a}と${b}。たまに本音が刺さりすぎるので、言い方だけ気をつければ最高の相棒。`,
  },
  思いやり: {
    work:    (a, b) => `${a}と${b}はお互いの負担をさりげなく気にかける。和むけど、遠慮し合って締切ギリギリになりがち。役割を先に決めると安定する。`,
    romance: (a, b) => `相手を優先しすぎて、${a}と${b}は言いたいことを我慢→ある日爆発、のパターンに注意。小さな不満こそその都度どうぞ。`,
    friends: (a, b) => `困ったとき真っ先に駆けつけ合える${a}と${b}。遠慮しすぎて頼れないこともあるけど、その優しさが絆の土台。`,
  },
  冒険: {
    work:    (a, b) => `「とりあえずやってみよう」で前に進める${a}と${b}。勢い余って詰めが甘くなることも。最後の確認役を決めておくと安心。`,
    romance: (a, b) => `デートも勢いで決めて楽しめる${a}と${b}。ノリで突っ走って後悔も早いので、たまに立ち止まって確認を。それでも一緒なら笑い話。`,
    friends: (a, b) => `「やってみよう！」が合言葉の刺激コンビ、${a}と${b}。突っ走りすぎて後悔も2人分。でもその無茶が最高の思い出になる。`,
  },
  安定: {
    work:    (a, b) => `手堅く積み上げる${a}と${b}。安定感は抜群だけど、変化への一歩が遅れがち。たまに新しいやり方を試すと一気に伸びる。`,
    romance: (a, b) => `一緒にいて落ち着く、長続きタイプの${a}と${b}。油断するとマンネリに。記念日や小さな非日常で火を絶やさないで。`,
    friends: (a, b) => `一緒にいてラクな、長い付き合い向きの${a}と${b}。たまに新しい遊びを入れると、関係がもっと色づく。`,
  },
  歩み寄り: {
    work:    (a, b) => `どっちが正しいかより、どう進めるかを選べる${a}と${b}。揉めにくい反面、本音の対立を避けて問題が残ることも。たまには本気でぶつかって。`,
    romance: (a, b) => `折り合いが上手で揉めにくい${a}と${b}。でも遠慮が募ると距離になる。たまにワガママを言い合うくらいがちょうどいい。`,
    friends: (a, b) => `衝突を上手く避けるいい距離感の${a}と${b}。たまには遠慮なくぶつかると、もっと深い仲になれる。`,
  },
};

function templateReading(r) {
  const a = r.self.name, b = r.partner.name;
  const s = r.synergy;
  const relKey = (r.relStyle && r.relStyle.key) || "歩み寄り";
  const set = TEMPLATE_READINGS[relKey] || TEMPLATE_READINGS["歩み寄り"];

  // 決めゼリフ（Verdict・固定）をサマリーにも使い、全面で一貫させる
  const summary = punchlineFor(r.self.type, r.partner.type, s);

  return {
    text: summary,
    work:    set.work(a, b),
    romance: set.romance(a, b),
    friends: set.friends(a, b),
    source: "template",
  };
}

// ===========================================================================
//  決めゼリフ（Punchline）— ブラウザ側ミラー
//  ⚠ lib/verdict.mjs の PUNCHLINES と同一内容を保つこと（編集時は両方）。
//  シェアカード(main.js)で使う。決定論・型ペアのみ依存（Verdict層）。
// ===========================================================================
const PUNCHLINES = {
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
function punchlineFor(typeA, typeB, syn) {
  const s = syn || analyzeSynergy(typeA, typeB);
  const byArch = PUNCHLINES[s.archetype.key] || PUNCHLINES.mix;
  const tmpl = byArch[s.wall] || byArch.N;
  return tmpl.replace(/\{a\}/g, typeA).replace(/\{b\}/g, typeB);
}

window.MBTIDungeon = { TYPES, STACKS, analyzeSynergy, punchlineFor, runDungeon, runDungeonGen, generateReading, generateDetailedReading };
