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
  let score = 50 + complement * 16 + support * 8 + resonance * 3 - blind * 14 - thin * 3;
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
  N: { name: "マンネリの檻", desc: "いつも通りに2人を閉じ込める", hp: 70, atk: 12, hint: "将来像を一緒に描けるか" },
  S: { name: "地に足つかずの靄", desc: "現実を見失わせる", hp: 72, atk: 12, hint: "目の前の具体を詰められるか" },
  T: { name: "優柔の渦", desc: "決めきれない2人を飲み込む", hp: 78, atk: 11, hint: "はっきり線を引けるか" },
  F: { name: "倦怠の影", desc: "気持ちのケアを忘れた2人を試す", hp: 66, atk: 14, hint: "相手の感情に寄り添えるか" },
};

// 雑魚（fam で見た目の色が変わる）
const MOBS = [
  { name: "迷いの霧",       hp: 40, atk: 9,  fam: "N" },
  { name: "すれ違いの影",   hp: 48, atk: 10, fam: "F" },
  { name: "気まずさの粒",   hp: 35, atk: 8,  fam: "S" },
  { name: "既読スルーの亡霊", hp: 44, atk: 11, fam: "F" },
  { name: "沈黙のスライム", hp: 52, atk: 7,  fam: "T" },
  { name: "束縛のツタ",     hp: 46, atk: 10, fam: "S" },
  { name: "嫉妬の火の粉",   hp: 38, atk: 13, fam: "F" },
  { name: "マウントの小鬼", hp: 42, atk: 12, fam: "T" },
  { name: "見栄の蜃気楼",   hp: 40, atk: 11, fam: "N" },
];

// 中ボス（道中に1回出る、雑魚とボスの中間）
const MINIBOSSES = [
  { name: "倦怠の使い",   hp: 95,  atk: 15, fam: "F", desc: "慣れた関係に忍び寄る" },
  { name: "干渉の番人",   hp: 105, atk: 13, fam: "T", desc: "踏み込みすぎを咎める" },
  { name: "不安の双子",   hp: 90,  atk: 16, fam: "N", desc: "見えない先を不安にさせる" },
  { name: "慣れの大蛇",   hp: 110, atk: 12, fam: "S", desc: "刺激のなさで締めつける" },
];

// ランの導入ナレーション（関係タイプで変わる）
const STORY_INTROS = {
  dual:      "ここは『補完の回廊』。正反対の二人だけが、その扉を開けられる。",
  twin:      "ここは『鏡の塔』。よく似た二人を映し、同じ弱みを突いてくる。",
  yin_yang:  "ここは『凸凹洞窟』。デコボコな二人の歩幅が試される。",
  blindspot: "ここは『死角の迷宮』。二人が見落としがちな場所に、罠が潜む。",
  mix:       "ここは『調和の遺跡』。バランスの取れた二人の真価が問われる。",
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
    prompt: "分かれ道。安全な遠回りと、危険な近道。",
    choices: [
      { label: "安全な遠回り", tags: { 安定: 2 }, effect: (p) => { p.hp = Math.min(p.maxHp, p.hp + 15); }, log: "安全策を選び、英気を養った" },
      { label: "危険な近道",   tags: { 冒険: 2 }, effect: (p) => { p.atk += 6; p.hp -= 8; }, log: "近道を選んだ。攻めの姿勢が火力に、でも少し消耗した" },
    ],
  },
  {
    prompt: "片方が弱音を吐いた。",
    choices: [
      { label: "そっと寄り添う", tags: { 思いやり: 2, 素直さ: 1 }, effect: (p) => { p.heal += 8; }, log: "寄り添った。心の支えが回復力になった" },
      { label: "発破をかける",   tags: { 冒険: 1 },              effect: (p) => { p.atk += 5; p.crit += 5; }, log: "発破をかけた。前向きさが攻撃を鋭くした" },
    ],
  },
  {
    prompt: "意見が割れた。今夜の進路をどっちが決める？",
    choices: [
      { label: "話し合って折衷案", tags: { 対話: 2, 歩み寄り: 1 }, effect: (p) => { p.def += 5; p.heal += 3; }, log: "折り合いをつけた。歩み寄りが守りを固めた" },
      { label: "ジャンケンで即決", tags: { 歩み寄り: 1 },          effect: (p) => { p.luck += 8; }, log: "運任せで即決。妙な一体感で運が向いてきた" },
    ],
  },
  {
    prompt: "古い祭壇。願いを1つ捧げられる。",
    choices: [
      { label: "強さを願う", tags: { 冒険: 1 },    effect: (p) => { p.atk += 8; }, log: "力を願った。二人の闘志が燃え上がる" },
      { label: "絆を願う",   tags: { 思いやり: 2 }, effect: (p) => { p.heal += 6; p.def += 3; }, log: "絆を願った。穏やかな自信が二人を包む" },
      { label: "幸運を願う", tags: { 歩み寄り: 1, 冒険: 1 }, effect: (p) => { p.luck += 12; p.crit += 3; }, log: "幸運を願った。追い風が吹き始めた" },
    ],
  },
  {
    prompt: "迷子の小動物がついてきた。",
    choices: [
      { label: "連れていく", tags: { 思いやり: 2 }, effect: (p) => { p.heal += 7; p.hp = Math.min(p.maxHp, p.hp + 8); }, log: "連れていくことに。和みが二人を癒やした" },
      { label: "見送る",     tags: { 安定: 1 },    effect: (p) => { p.crit += 6; }, log: "情を断って先を急ぐ。集中力が研ぎ澄まされた" },
    ],
  },
  {
    prompt: "謎かけの石碑。『二人の弱点を言え』",
    choices: [
      { label: "正直に認める",   tags: { 素直さ: 3 }, effect: (p) => { p.def += 8; }, log: "弱さを認め合った。それが何より硬い盾になった" },
      { label: "強がってみせる", tags: {},            effect: (p, rng) => { if (rng() < 0.5) { p.atk += 10; } else { p.hp -= 10; } }, log: "強がった。出方次第で吉とも凶とも転んだ" },
    ],
  },
  {
    prompt: "細い吊り橋。どう渡る？",
    choices: [
      { label: "手をつないで慎重に", tags: { 思いやり: 1, 安定: 1, 歩み寄り: 1 }, effect: (p) => { p.def += 6; p.hp = Math.min(p.maxHp, p.hp + 6); }, log: "手をつないで渡った。支え合いが安心を生んだ" },
      { label: "一気に走り抜ける",   tags: { 冒険: 2 },                          effect: (p) => { p.atk += 7; p.luck += 4; }, log: "二人で駆け抜けた。勢いが力に変わった" },
    ],
  },
  {
    prompt: "鏡の間。もう一組の自分たちが映る。",
    choices: [
      { label: "向き合って対話する", tags: { 対話: 2, 素直さ: 1 }, effect: (p) => { p.crit += 8; p.heal += 3; }, log: "鏡の自分と対話した。自己理解が冴えをもたらす" },
      { label: "無視して進む",       tags: { 安定: 1 },            effect: (p) => { p.atk += 4; p.def += 4; }, log: "脇目もふらず進んだ。地に足のついた強さ" },
    ],
  },
];

// --- 宝箱部屋（リスク/リワード） ------------------------------------------
const TREASURES = [
  {
    prompt: "豪華な宝箱を見つけた。",
    choices: [
      { label: "勢いよく開ける",    tags: { 冒険: 2 },              effect: (p, rng) => { if (rng() < 0.7) { p.atk += 10; p.crit += 6; } else { p.hp -= 18; } }, log: "勢いで開けた。大当たりか、罠か——" },
      { label: "慎重に調べてから",  tags: { 安定: 2 },              effect: (p) => { p.def += 5; p.heal += 4; }, log: "罠を確かめてから開けた。堅実な収穫" },
      { label: "見送る",            tags: { 安定: 1, 歩み寄り: 1 }, effect: (p) => { p.luck += 7; }, log: "欲を出さず見送った。冷静さが運を呼ぶ" },
    ],
  },
];

// --- 焚き火部屋（休息） ----------------------------------------------------
const RESTS = [
  {
    prompt: "焚き火を見つけた。少し休もう。",
    choices: [
      { label: "しっかり休む", tags: { 安定: 1 },              effect: (p) => { p.hp = Math.min(p.maxHp, p.hp + 30); }, log: "じっくり体を休めた。HPが大きく回復" },
      { label: "語り合う",     tags: { 対話: 2, 思いやり: 1 }, effect: (p) => { p.heal += 6; p.hp = Math.min(p.maxHp, p.hp + 10); }, log: "火を囲んで語り合った。絆が深まり心が満ちる" },
      { label: "作戦を練る",   tags: { 対話: 1, 歩み寄り: 1 }, effect: (p) => { p.atk += 6; p.crit += 5; }, log: "次の戦いに備えた。連携が研ぎ澄まされた" },
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
  const navScore = Object.values(party.behaviorProfile).reduce((s, v) => s + v, 0);
  const navNorm = Math.min(20, navScore) / 20; // 0〜1
  const blendedScore = Math.round(party.synergy.score * 0.5 + navNorm * 100 * 0.5);
  const rank = calcRank(blendedScore);
  return {
    self, partner, cleared, reachedFloor,
    fellTo: fellTo || null,
    bonds: party.bonds,
    behaviorProfile: party.behaviorProfile,
    relStyle,
    rank,
    synergy: { ...party.synergy, blendedScore },
    wall: dungeon.wall,
    hpLeft: party.hp, maxHp: party.maxHp,
    log,
  };
}

// ===========================================================================
//  鑑定文の生成（Gemini / 失敗時テンプレ）
// ===========================================================================
async function generateReading(result) {
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
      score: s.blendedScore !== undefined ? s.blendedScore : s.score,
      wallTheme: s.wallTheme,
      relStyle: r.relStyle || null,           // Phase C: 行動から導いた関係スタイル
      behaviorHighlights: profileHighlights,  // Phase C: 選択傾向サマリ
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

// --- フォールバック鑑定（API無しでも動く・3観点付き） --------------------
function templateReading(r) {
  const a = r.self.name, b = r.partner.name;
  const s = r.synergy;
  const arch = s.archetype.name;
  const styleLabel = r.relStyle ? r.relStyle.label : "";
  const comp  = s.axes.filter((x) => x.relation === "complement");
  const blind = s.axes.filter((x) => x.relation === "blind");
  const score = s.blendedScore !== undefined ? s.blendedScore : s.score;

  const summary = r.cleared
    ? `${a}と${b}は「${arch}」×「${styleLabel}」。ダンジョンを踏破した2人の絆は本物。`
    : `${a}と${b}は「${arch}」×「${styleLabel}」。${r.reachedFloor}階で足を止めたが、越える力は確かにある。`;

  const compTheme = comp.length ? comp[0].theme : "互いの違い";
  const blindTheme = blind.length ? blind[0].theme : s.wallTheme;
  const relKey = r.relStyle?.key || "";

  const work = comp.length
    ? `仕事では${compTheme}のアプローチが正反対で、役割分担がしやすい。ただし方向性の違いで衝突しがち。意見が割れたら早めに話し合うと長続きする。`
    : relKey === "対話"
    ? `仕事では意見が割れても話し合える${a}と${b}。ただし対話に時間をかけすぎて決断が遅くなりがち。期限を決めて動く意識が大切。`
    : `仕事では似た強みを持つ${a}と${b}。スピードは出るが「${blindTheme}」が2人共通の盲点になりやすい。そこだけ第三者の意見を取り入れると安心。`;

  const romance = s.archetype.key === "dual"
    ? `恋愛では、${a}が動けば${b}が受け止め、補い合う引力がある。ただし正反対ゆえにすれ違いも起きやすく、「なんで分かってくれないの」となりがち。相手の視点を一度受け入れてから話すといい。`
    : relKey === "素直さ"
    ? `恋愛では弱さをさらけ出せるから深く繋がれる。ただし弱さを見せすぎて依存気味になることも。お互いの自立した部分も大切にして。`
    : relKey === "思いやり"
    ? `恋愛では互いに相手を優先しやすい。ただし言いたいことを我慢しすぎて、ある日爆発するパターンに注意。小さな不満はその都度正直に伝えて。`
    : s.archetype.key === "twin"
    ? `恋愛では深く共鳴できる半面、似すぎて「言わなくても分かるでしょ」になりがち。実は伝わっていないことが積み重なりやすい。言葉にする習慣をつけると関係が安定する。`
    : `恋愛では凸凹が魅力になる2人。ただし価値観の違いから「どうしてそう考えるの？」と感じる場面も。違いを否定せず面白がれるかがポイント。`;

  const friends = relKey === "冒険"
    ? `友達としては「やってみようよ！」が合言葉の刺激的な組み合わせ。ただしノリだけで突っ走ると後悔も早い。たまには立ち止まって確認し合うことが長続きの秘訣。`
    : relKey === "安定"
    ? `友達としては一緒にいて落ち着ける、長く続く安心感がある。ただし変化を嫌うあまり同じパターンにはまりがち。たまには新しいことを試してみると関係に刺激が生まれる。`
    : `友達としては${score >= 70 ? "一緒にいて心地よい" : "ときどきズレるけどそれが面白い"}関係。「${blindTheme}」は2人とも苦手なので、そこで頼り合いすぎると判断を誤ることも。その場面だけは外の視点を借りるのがおすすめ。`;

  return { text: summary, work, romance, friends, source: "template" };
}

window.MBTIDungeon = { TYPES, STACKS, analyzeSynergy, runDungeon, runDungeonGen, generateReading };
