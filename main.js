// ===========================================================================
//  UIコントローラ
//  IIFE でラップ → game.js のグローバル const と名前衝突しない
// ===========================================================================
(function () {
  const $ = (id) => document.getElementById(id);

  // game.js が失敗してもグリッドが出るようにフォールバックを持つ
  const FALLBACK_TYPES = [
    "INTJ","INTP","ENTJ","ENTP",
    "INFJ","INFP","ENFJ","ENFP",
    "ISTJ","ISFJ","ESTJ","ESFJ",
    "ISTP","ISFP","ESTP","ESFP",
  ];
  const _g             = window.MBTIDungeon || {};
  const TYPES          = _g.TYPES          || FALLBACK_TYPES;
  const runDungeonGen  = _g.runDungeonGen;
  const generateReading = _g.generateReading;
  const punchlineFor   = _g.punchlineFor   || (() => "");

  if (!window.MBTIDungeon) {
    console.error("game.js のロードに失敗しました");
    document.body.insertAdjacentHTML("afterbegin",
      '<p style="color:red;padding:12px;background:#300;font-weight:bold">' +
      "⚠ game.js 読み込みエラー（F12コンソールを確認）</p>");
  }

  // --- タイプグリッド（16タイプを常時表示） --------------------------------
  function buildTypeGrid(gridId, hiddenId, defaultVal) {
    const grid  = $(gridId);
    const input = $(hiddenId);
    if (!grid) return;
    if (input) input.value = defaultVal; // URLパラメータ由来のデフォルト値を反映

    TYPES.forEach((t) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "type-chip" + (t === defaultVal ? " selected" : "");
      btn.textContent = t;
      btn.addEventListener("click", () => {
        grid.querySelectorAll(".type-chip.selected").forEach((el) => el.classList.remove("selected"));
        btn.classList.add("selected");
        if (input) input.value = t;
      });
      grid.appendChild(btn);
    });
  }

  // DOM 準備後に初期化（SEOページからのリンク: /?self=INFP&partner=ENFJ に対応）
  function initGrids() {
    const params     = new URLSearchParams(location.search);
    const urlSelf    = (params.get("self")    || "").toUpperCase();
    const urlPartner = (params.get("partner") || "").toUpperCase();
    buildTypeGrid("self-type-grid",    "self-type",    TYPES.includes(urlSelf)    ? urlSelf    : "INFP");
    buildTypeGrid("partner-type-grid", "partner-type", TYPES.includes(urlPartner) ? urlPartner : "ENFJ");
    renderHistory();
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initGrids);
  } else {
    initGrids();
  }

  // --- 画面切り替え ---------------------------------------------------------
  function show(id) {
    ["screen-input", "screen-run", "screen-result"].forEach((s) => $(s).classList.add("hidden"));
    $(id).classList.remove("hidden");
  }

  let currentResult  = null;
  let currentReading = null;
  let scene          = null;  // DungeonScene インスタンス

  // --- localStorage 履歴 ---------------------------------------------------
  const HIST_KEY = "aisho_dungeon_history";
  function saveHistory(r) {
    try {
      const h = JSON.parse(localStorage.getItem(HIST_KEY) || "[]");
      h.unshift({
        selfType: r.self.type,       selfName: r.self.name,
        partnerType: r.partner.type, partnerName: r.partner.name,
        archetype: r.synergy.archetype.name,
        style: r.relStyle?.label || "",
        score: r.synergy.score,
        rank: r.rank?.label || "C",
        cleared: r.cleared,
        ts: Date.now(),
      });
      localStorage.setItem(HIST_KEY, JSON.stringify(h.slice(0, 20)));
    } catch (_) {}
  }
  function loadHistory() {
    try { return JSON.parse(localStorage.getItem(HIST_KEY) || "[]"); } catch (_) { return []; }
  }

  function selectTypeInGrid(gridId, hiddenId, type) {
    $(gridId).querySelectorAll(".type-chip").forEach((btn) => {
      btn.classList.toggle("selected", btn.textContent === type);
    });
    $(hiddenId).value = type;
  }

  function renderHistory() {
    const sec = $("history-section");
    if (!sec) return;
    const h = loadHistory();
    if (!h.length) { sec.classList.add("hidden"); return; }

    const bestRank = ["SS","S","A","B","C","D"].find((r) => h.some((x) => x.rank === r)) || "C";
    const typesPlayed = new Set(h.flatMap((x) => [x.selfType, x.partnerType]));

    sec.innerHTML = `
      <div class="hist-stats">🏆 ベスト <strong>${bestRank}ランク</strong> ｜ 🎮 ${h.length}回挑戦 ｜ 📊 ${typesPlayed.size}/16タイプ体験</div>
      <div class="hist-label">最近の挑戦</div>
      ${h.slice(0, 5).map((r, i) => `
        <button class="hist-item" data-i="${i}">
          <span class="hist-types">${r.selfType} × ${r.partnerType}</span>
          <span class="hist-rank hist-rank-${r.rank}">${r.rank}</span>
          <span class="hist-arch">${r.archetype}</span>
          <span class="hist-arrow">→</span>
        </button>`).join("")}
    `;
    sec.querySelectorAll(".hist-item").forEach((btn) => {
      btn.addEventListener("click", () => {
        const e = h[Number(btn.dataset.i)];
        selectTypeInGrid("self-type-grid",    "self-type",    e.selfType);
        selectTypeInGrid("partner-type-grid", "partner-type", e.partnerType);
        $("self-name").value    = e.selfName;
        $("partner-name").value = e.partnerName;
        window.scrollTo({ top: 0, behavior: "smooth" });
      });
    });
    sec.classList.remove("hidden");
  }

  // --- スタート -------------------------------------------------------------
  $("start-btn").addEventListener("click", () => {
    const self    = { type: $("self-type").value,    name: ($("self-name").value    || "あなた").trim() };
    const partner = { type: $("partner-type").value, name: ($("partner-name").value || "あの人").trim() };
    const seed = `${self.type}_${partner.type}_${self.name}_${partner.name}_${Date.now()}`;

    show("screen-run");
    $("run-heading").textContent = `${self.name} × ${partner.name} の挑戦`;
    $("log").innerHTML = "";

    // ドット絵シーンを初期化
    if (scene) { scene.destroy(); scene = null; }
    if (window.DungeonScene) {
      scene = new window.DungeonScene($("battle-canvas"));
      scene.set(1, "idle", null, false);
    }

    const gen = runDungeonGen(self, partner, seed);
    driveStep(gen, gen.next());
  });

  // --- ステップ駆動 ---------------------------------------------------------
  function driveStep(gen, step) {
    hideChoices();
    $("next-btn").classList.add("hidden");

    if (step.done) { finishRun(step.value); return; }

    const s = step.value;
    if (s.type === "choice") {
      // 部屋に応じたシーン（event=?, treasure=宝箱, rest=焚き火）
      if (scene) scene.set(s.floor, s.sceneKind || "event", null, false);
      renderChoices(s, (idx) => driveStep(gen, gen.next(idx)));

    } else if (s.type === "log") {
      const e = s.entry;
      if (scene) {
        if (e.type === "battle") {
          scene.set(e.floor, "battle", e.wall, !!e.boss);
          setTimeout(() => {
            if (!scene) return;
            if (e.win) scene.attack(); else scene.hit();
          }, 420);
        } else if (e.type === "bond") {
          setTimeout(() => scene && scene.bond(), 200);
        } else if (s.sceneKind) {
          scene.set(e.floor || 1, s.sceneKind, null, false);
        }
      }
      appendLog(s.entry);
      showNext(() => driveStep(gen, gen.next()));
    }
  }

  // --- 選択肢を表示 ---------------------------------------------------------
  function renderChoices(s, onPick) {
    const box = $("choices");
    box.innerHTML =
      `<div class="choice-prompt"><span class="floor-tag">${s.floor}階 ｜分かれ道</span>${s.prompt}</div>` +
      s.choices.map((c, i) => `<button class="choice-btn" data-i="${i}">${c}</button>`).join("");
    box.classList.remove("hidden");
    box.querySelectorAll(".choice-btn").forEach((btn) => {
      btn.addEventListener("click", () => onPick(Number(btn.dataset.i)), { once: true });
    });
    box.scrollIntoView({ behavior: "smooth", block: "end" });
  }
  function hideChoices() { const b = $("choices"); b.classList.add("hidden"); b.innerHTML = ""; }

  // --- ログ追記 -------------------------------------------------------------
  function appendLog(entry) {
    $("log").insertAdjacentHTML("beforeend", entryHtml(entry));
    $("log").lastElementChild.scrollIntoView({ behavior: "smooth", block: "end" });
  }

  function entryHtml(l) {
    if (l.type === "story") {
      return `<div class="log-entry story">📜 ${l.text}</div>`;
    }
    if (l.type === "battle") {
      const cls     = l.boss ? "boss" : "";
      const tag     = l.boss ? "｜ボス" : (l.mini ? "｜中ボス" : "");
      const outcome = l.win ? `<span class="win">勝利</span>` : `<span class="lose">敗北</span>`;
      return `<div class="log-entry ${cls}">
        <span class="floor-tag">${l.floor}階 ${tag}</span>
        <strong>${l.enemy}</strong> ${l.desc ? "— " + l.desc : ""}<br />${outcome}（残りHP ${l.hpLeft}）
      </div>`;
    }
    const labels = {
      event:    { tag: "｜分かれ道", cls: "" },
      treasure: { tag: "｜宝箱",     cls: "treasure" },
      rest:     { tag: "｜焚き火",   cls: "rest" },
    };
    if (labels[l.type]) {
      const { tag, cls } = labels[l.type];
      return `<div class="log-entry ${cls}">
        <span class="floor-tag">${l.floor}階 ${tag}</span>
        ${l.prompt}<br />→ <strong>${l.choice}</strong>：${l.result}
      </div>`;
    }
    if (l.type === "bond") {
      return `<div class="log-entry bond">
        <span class="floor-tag">${l.floor}階 ｜絆</span>
        「${l.name}」を分かち合った — ${l.text}
      </div>`;
    }
    return "";
  }

  function showNext(handler) {
    const btn = $("next-btn");
    btn.classList.remove("hidden");
    btn.onclick = handler;
  }

  // --- ラン終了 → 鑑定 → 結果 ----------------------------------------------
  async function finishRun(result) {
    currentResult = result;
    saveHistory(result);
    // ドット絵の勝敗演出
    if (scene) { result.cleared ? scene.win() : scene.lose(); }
    appendLog({
      type: "battle", floor: result.reachedFloor, boss: !result.cleared,
      enemy: result.cleared ? "ダンジョン踏破！" : `${result.reachedFloor}階で挑戦終了`,
      win: result.cleared, hpLeft: result.hpLeft, desc: "",
    });

    $("next-btn").classList.add("hidden");
    currentReading = await generateReading(result); // 既定はテンプレ鑑定（即時・$0）

    drawResultCard(result, currentReading.text);
    drawRankDisplay(result);
    drawReadingSections(currentReading);
    $("reading-source").textContent = ""; // 簡易鑑定が既定。詳細鑑定は将来の広告ゲートで提供
    show("screen-result");
  }

  // --- 結果カード描画（Canvas） --------------------------------------------
  function drawResultCard(result, readingText) {
    const cv  = $("result-card");
    const ctx = cv.getContext("2d");
    const W = cv.width, H = cv.height;

    // 背景グラデーション
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "#1c1232"); g.addColorStop(1, "#0e0b1c");
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

    // 外枠
    ctx.strokeStyle = "rgba(201,138,75,0.4)";
    ctx.lineWidth = 2;
    ctx.strokeRect(20, 20, W - 40, H - 40);

    const rank  = result.rank || { label: "C", color: "#a99fc4", desc: "要努力な相性" };
    const score = result.synergy.score; // v2: 型ペア固定の相性スコア（OG/SEOと一致）

    // ヘルパー：横区切り線
    const divider = (y, alpha = 0.09) => {
      ctx.save();
      ctx.strokeStyle = `rgba(255,255,255,${alpha})`;
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(52, y); ctx.lineTo(W - 52, y); ctx.stroke();
      ctx.restore();
    };

    ctx.textAlign = "center";

    // ① タイトル
    ctx.fillStyle = "#c98a4b";
    ctx.font = "bold 18px sans-serif";
    ctx.fillText("✦  相性ダンジョン  ✦", W / 2, 58);

    // ② 名前（最大の要素のひとつ）
    ctx.fillStyle = "#f0eaf8";
    ctx.font = "bold 44px sans-serif";
    ctx.fillText(clip(`${result.self.name} × ${result.partner.name}`, 16), W / 2, 136);

    ctx.fillStyle = "#8a7fa8";
    ctx.font = "18px sans-serif";
    ctx.fillText(`${result.self.type}  ×  ${result.partner.type}`, W / 2, 166);

    divider(188);

    // ③ アーキタイプ + 関係スタイル
    ctx.fillStyle = "#cdb8f0";
    ctx.font = "bold 21px sans-serif";
    ctx.fillText(result.synergy.archetype.name, W / 2, 218);

    if (result.relStyle?.label) {
      ctx.fillStyle = "#88b8d8";
      ctx.font = "15px sans-serif";
      ctx.fillText(result.relStyle.label, W / 2, 244);
    }

    divider(266);

    // ④ ランク（画面中央・主役）
    ctx.save();
    ctx.shadowColor = rank.color;
    ctx.shadowBlur  = 60;
    ctx.fillStyle   = rank.color;
    ctx.font        = "bold 112px sans-serif";
    ctx.fillText(rank.label, W / 2, 378);
    ctx.restore();

    // RANK ラベル
    ctx.fillStyle = rank.color + "bb";
    ctx.font      = "bold 13px sans-serif";
    ctx.fillText("R A N K", W / 2, 404);

    // ランク説明 + スコア
    ctx.fillStyle = rank.color + "88";
    ctx.font      = "13px sans-serif";
    ctx.fillText(`${rank.desc}  ／  スコア ${score} / 100`, W / 2, 426);

    // ⑤ 踏破 or 到達
    const cleared = result.cleared;
    ctx.fillStyle = cleared ? "#6fd39a" : "#e0a07a";
    ctx.font      = "bold 22px sans-serif";
    ctx.fillText(cleared ? "★ ダンジョン踏破 ★" : `★ ${result.reachedFloor}階まで挑戦`, W / 2, 458);

    divider(480);

    // ⑥ 決めゼリフ（シェアの主役・決定論。readingTextではなくpunchlineを出す）
    const punch = punchlineFor(result.self.type, result.partner.type, result.synergy) ||
                  (readingText.length > 95 ? readingText.slice(0, 93) + "…" : readingText);
    ctx.fillStyle   = "#e7defa";
    ctx.font        = "bold 18px sans-serif";
    ctx.textAlign   = "left";
    wrapText(ctx, `“${punch}”`, 52, 506, W - 104, 28);

    // ⑦ ハッシュタグ
    ctx.textAlign = "center";
    ctx.fillStyle = "#4e4864";
    ctx.font      = "13px sans-serif";
    ctx.fillText("#相性ダンジョン", W / 2, H - 28);
  }

  // --- ランク表示（HTML） --------------------------------------------------
  function drawRankDisplay(result) {
    const el = $("rank-display");
    if (!el) return;
    const r = result.rank || { label: "C", color: "#a99fc4", desc: "要努力な相性" };
    const score = result.synergy.score; // v2: 型ペア固定の相性スコア
    el.style.borderColor = r.color;
    el.innerHTML = `
      <span class="rank-letter" style="color:${r.color};text-shadow:0 0 32px ${r.color}88">${r.label}</span>
      <span class="rank-label-text" style="color:${r.color}">RANK</span>
      <span class="rank-desc-text" style="color:${r.color}">${r.desc}</span>
      <span class="rank-score-text">相性スコア ${score} / 100</span>
    `;
    el.classList.remove("hidden");
  }

  // --- 3観点セクション表示 -------------------------------------------------
  function drawReadingSections(reading) {
    const sec = $("reading-sections");
    sec.innerHTML = "";

    // Phase D: 関係スタイルを先頭に表示
    const rs = currentResult && currentResult.relStyle;
    if (rs) {
      sec.insertAdjacentHTML("beforeend", `
        <div class="reading-card" style="border-left:3px solid #a78bfa;background:rgba(167,139,250,0.07)">
          <div class="reading-card-label" style="color:#a78bfa">🎭 関係スタイル</div>
          <div class="reading-card-body"><strong>${rs.label}</strong><br /><span style="color:var(--muted);font-size:13px">${rs.desc || ""}</span></div>
        </div>`);
    }

    // §8: 今回の名シーン（道中の選択を振り返る＝シェア燃料）
    const hl = currentResult && currentResult.highlight;
    if (hl) {
      sec.insertAdjacentHTML("beforeend", `
        <div class="reading-card" style="border-left:3px solid #c98a4b;background:rgba(201,138,75,0.07)">
          <div class="reading-card-label" style="color:#c98a4b">🎬 今回の名シーン</div>
          <div class="reading-card-body">「${hl.prompt}」<br />→ <strong>${hl.choice}</strong><br /><span style="color:var(--muted);font-size:13px">${hl.result}</span></div>
        </div>`);
    }

    const sections = [
      { key: "work",    label: "💼 仕事での相性",   cls: "work"    },
      { key: "romance", label: "💕 恋愛での相性",   cls: "romance" },
      { key: "friends", label: "🤝 友達としての相性", cls: "friends" },
    ];
    sections.forEach(({ key, label, cls }) => {
      const text = reading[key];
      if (!text) return;
      sec.insertAdjacentHTML("beforeend", `
        <div class="reading-card">
          <div class="reading-card-label ${cls}">${label}</div>
          <div class="reading-card-body">${text}</div>
        </div>`);
    });
  }

  function clip(s, n) { return s.length > n ? s.slice(0, n - 1) + "…" : s; }

  function wrapText(ctx, text, x, y, maxW, lh) {
    let yy = y;
    for (const para of text.split("\n")) {
      let line = "";
      for (const ch of para) {
        const test = line + ch;
        if (ctx.measureText(test).width > maxW && line) {
          ctx.fillText(line, x, yy); line = ch; yy += lh;
        } else { line = test; }
      }
      if (line) { ctx.fillText(line, x, yy); yy += lh; }
      yy += 8;
    }
  }

  // --- シェア / 保存 / リトライ ---------------------------------------------
  $("share-btn").addEventListener("click", async () => {
    const r     = currentResult;
    const punch = punchlineFor(r.self.type, r.partner.type, r.synergy);
    // 拡散単位は「型ペア」。決定論の /type/A-B を共有 → リンクに動的OG画像が出る
    const url   = `${location.origin}/type/${r.self.type}-${r.partner.type}`;
    const head  = punch || `${r.self.type}×${r.partner.type}は「${r.synergy.archetype.name}」。`;
    const text  = `${head}\nあなたの相性は？ #相性ダンジョン`;

    // モバイル等はOSの共有シート（Xアプリが既ログインで開く＝ログイン壁を回避）
    if (navigator.share) {
      try {
        await navigator.share({ text, url });
        return;
      } catch (e) {
        if (e && e.name === "AbortError") return; // ユーザーが共有をキャンセル
        // それ以外（未対応など）は下のフォールバックへ
      }
    }
    // デスクトップ等は X(Twitter) の投稿画面（※Xにログイン済みである必要あり）
    window.open(
      `https://x.com/intent/post?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`,
      "_blank", "noopener,noreferrer"
    );
  });

  $("save-btn").addEventListener("click", () => {
    const link = document.createElement("a");
    link.download = "aisho-dungeon.png";
    link.href = $("result-card").toDataURL("image/png");
    link.click();
  });

  $("retry-btn").addEventListener("click", () => {
    if (scene) { scene.destroy(); scene = null; }
    show("screen-input");
  });

})(); // IIFE 終了
