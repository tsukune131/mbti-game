// dungeon-scene.js
// Canvas でドット絵のダンジョンシーンを描画する（アニメーション強化版）
// 1 ゲームピクセル = SC 実ピクセル
(function () {
  'use strict';
  const SC = 4;

  // 1文字→カラーパレット
  const P = {
    '.': null,
    'k': '#0a0618', 'K': '#160e28',
    'W': '#2e2244', 'w': '#3d3157',
    'F': '#1a1030', 'f': '#221640',
    'S': '#f0c8a0', 's': '#c89060', 'E': '#080410',
    // Hero A (紫)
    'q': '#5c2e20', 'Q': '#8b4513',
    'a': '#7c6eea', 'A': '#5243b0', 'L': '#3a3090',
    // Hero B (琥珀)
    'j': '#3a2010', 'J': '#5c3317',
    'b': '#c98a4b', 'B': '#a06828', 'M': '#784a18',
    // 敵
    'g': '#a855f7', 'G': '#7c3aed',
    'c': '#06b6d4', 'C': '#0891b2',
    'd': '#9ca3af', 'D': '#4b5563',
    'p': '#f472b6', 'P': '#be185d',
    'r': '#f87171', 'R': '#dc2626',
    'y': '#fbbf24',
  };

  function drawSprite(rows, ox, oy, ctx) {
    const iox = Math.round(ox), ioy = Math.round(oy);
    for (let dy = 0; dy < rows.length; dy++) {
      const row = rows[dy];
      for (let dx = 0; dx < row.length; dx++) {
        const c = row[dx];
        if (c === '.' || !P[c]) continue;
        ctx.fillStyle = P[c];
        ctx.fillRect((iox + dx) * SC, (ioy + dy) * SC, SC, SC);
      }
    }
  }
  // 白フラッシュ等のティント描画（非透明ピクセルだけ塗る）
  function drawSpriteTint(rows, ox, oy, color, alpha, ctx) {
    const iox = Math.round(ox), ioy = Math.round(oy);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = color;
    for (let dy = 0; dy < rows.length; dy++) {
      const row = rows[dy];
      for (let dx = 0; dx < row.length; dx++) {
        if (row[dx] === '.' || !P[row[dx]]) continue;
        ctx.fillRect((iox + dx) * SC, (ioy + dy) * SC, SC, SC);
      }
    }
    ctx.restore();
  }

  // ── スプライト（胴体＋脚フレーム） ─────────────────────
  const HERO_A_TOP = [
    '.qqQqq..', '.QqSSSq.', '..SEsEs.', '..SSsss.',
    '....SS..', '.aaaaaa.', 'aaaaaaaa', 'aAAaaAAa', '.aA..Aa.',
  ];
  const LEGS_A = [
    ['.LL..LL.', '.LL..LL.', '.kk..kk.'], // 0 静止
    ['.LL..LL.', '.LL..kk.', '.kk.....'], // 1 右足上げ
    ['.LL..LL.', '.kk..LL.', '.....kk.'], // 2 左足上げ
  ];
  const HERO_B_TOP = [
    '.jjJjj..', '.JjSSSj.', '..SEsEs.', '..SSsss.',
    '....SS..', '.bbbbbb.', 'bbbbbbbb', 'bBBbbBBb', '.bB..Bb.',
  ];
  const LEGS_B = [
    ['.MM..MM.', '.MM..MM.', '.kk..kk.'],
    ['.MM..MM.', '.MM..kk.', '.kk.....'],
    ['.MM..MM.', '.kk..MM.', '.....kk.'],
  ];
  function hero(top, legs, frame) { return top.concat(legs[frame]); }

  const ENEMY = {
    N: ['DdDdDdDd', 'dDdDdDdD', 'DdEEdEEd', 'dDdDdDdD', 'DDDDDDDD', 'dDdDdDdD', 'DdDdDdDd', '.DdDdDd.'],
    S: ['..cCcC..', '.cCcCcC.', 'cCcCcCcC', 'CcEECEEc', 'cCcCcCcC', '.CcCcCc.', '..cCcC..', '...cC...'],
    T: ['..DDdD..', '.DdDdDd.', 'DDdDdDdD', 'DdEEdEEd', 'dDDDdDDd', '.DDdDdD.', '..DdDd..', '...DD...'],
    F: ['..pPpP..', '.pPpPpP.', 'pPpPpPpP', 'PpEEPEEp', 'pPppPppP', '.PpPpPp.', '..pPpP..', '...pP...'],
  };
  const BOSS = [
    '..RRrRRR..', '.RrRrRrRr.', 'RrRrErRrRr', 'rRREErERrR', 'RRRrRrRRRR',
    'rRRRRRRRRr', '.rRrRrRrR.', '..RRrRRR..', '...RrRr...', '....RR....',
  ];
  // 宝箱（10×7）
  const CHEST = [
    '..MMMMMM..', '.MyyyyyyM.', 'MyBBBBBByM', 'MyByyyyByM',
    'MMMMyMMMMM', 'MBBByMBBBM', 'MMMMMMMMMM',
  ];
  // 焚き火の薪（8×3）＋炎は動的描画
  const LOGS = [
    '.J....J.', '.MJJJJM.', 'MMMMMMMM',
  ];

  // ── 背景＋松明 ─────────────────────────────────────────
  function drawBg(ctx, W, H, frame) {
    const GW = W / SC, GH = H / SC;
    for (let y = 2; y < GH; y++)
      for (let x = 0; x < GW; x++) {
        ctx.fillStyle = ((x + y) % 4 < 2) ? P['F'] : P['f'];
        ctx.fillRect(x * SC, y * SC, SC, SC);
      }
    for (let x = 0; x < GW; x++) {
      ctx.fillStyle = (x % 4 < 2) ? P['W'] : P['w'];
      ctx.fillRect(x * SC, 0, SC, SC * 2);
    }
    // 松明2つ（ゆらぐ炎）
    [GW * 0.18, GW * 0.82].forEach((tx, i) => {
      const fl = 1 + Math.sin(frame * 0.3 + i * 2) * 0.4 + Math.sin(frame * 0.71 + i) * 0.25;
      ctx.fillStyle = '#5c3317';
      ctx.fillRect(Math.round(tx) * SC, SC * 2, SC, SC * 2); // 燭台
      ctx.fillStyle = '#fbbf24';
      ctx.fillRect(Math.round(tx) * SC, Math.round(SC * (1.2 - fl * 0.4)), SC, Math.round(SC * fl));
      ctx.fillStyle = 'rgba(248,113,49,0.5)';
      ctx.fillRect(Math.round(tx) * SC, Math.round(SC * (0.6 - fl * 0.3)), SC, Math.round(SC * fl * 0.7));
    });
  }

  // ── DungeonScene ───────────────────────────────────────
  class DungeonScene {
    constructor(canvas) {
      this.cv = canvas;
      this.ctx = canvas.getContext('2d');
      this.W = canvas.width;
      this.H = canvas.height;
      this.GW = this.W / SC;
      this.GH = this.H / SC;
      this.frame = 0;
      this.flash = 0;        // 赤フラッシュ
      this.shake = 0;        // 横揺れ
      this.lungeA = 0; this.lungeB = 0;     // 攻撃ランジ
      this.heroFlash = 0;    // 被弾時ヒーロー白点滅
      this.slash = 0;        // 斬撃エフェクト 0〜1
      this.enemyRecoil = 0;  // 敵けぞり
      this.enemyFlash = 0;   // 敵白フラッシュ
      this.walkIn = 0;       // 登場歩き込み 1→0
      this.endMode = null;   // 'win' | 'lose'
      this.endT = 0;
      this.particles = [];
      this.state = { floor: 1, kind: 'idle', wall: 'F', isBoss: false };
      this._dead = false;
      this._run();
    }

    set(floor, kind, wall, isBoss) {
      const changed = floor !== this.state.floor;
      this.state = { floor: floor || 1, kind, wall: wall || 'F', isBoss: !!isBoss };
      if (changed) this.walkIn = 1; // 階が変わったら歩いて入場
    }
    attack() {           // プレイヤーの攻撃ヒット
      this.lungeA = 5; this.lungeB = 4;
      this.slash = 1; this.enemyRecoil = 7; this.enemyFlash = 1;
      this._burst(this.GW - 8, this.GH * 0.45, 10, ['#fbbf24', '#ffffff', '#f87171']);
    }
    hit() {              // ヒーローが被弾
      this.flash = 0.55; this.shake = 7; this.heroFlash = 1;
      this._burst(8, this.GH * 0.5, 8, ['#f87171', '#7c6eea']);
    }
    bond() {             // 絆アイテム取得
      this._burst(10, this.GH * 0.42, 14, ['#fbbf24', '#5ec2a0', '#ffffff'], -1.2);
    }
    win() { this.endMode = 'win'; this.endT = 1; this._burst(this.GW / 2, 2, 26, ['#fbbf24', '#6fd39a', '#7c6eea', '#ffffff'], 0.6); }
    lose() { this.endMode = 'lose'; this.endT = 1; }
    destroy() { this._dead = true; }

    _burst(gx, gy, n, colors, vyBias) {
      for (let i = 0; i < n; i++) {
        const ang = Math.random() * Math.PI * 2;
        const sp = 0.5 + Math.random() * 2;
        this.particles.push({
          x: gx, y: gy,
          vx: Math.cos(ang) * sp,
          vy: Math.sin(ang) * sp + (vyBias || 0),
          life: 1, decay: 0.02 + Math.random() * 0.03,
          color: colors[(Math.random() * colors.length) | 0],
          grav: 0.04,
        });
      }
    }

    _run() {
      if (this._dead) return;
      requestAnimationFrame(() => this._run());
      this.frame++;
      this.flash = Math.max(0, this.flash - 0.04);
      this.heroFlash = Math.max(0, this.heroFlash - 0.08);
      this.enemyFlash = Math.max(0, this.enemyFlash - 0.07);
      this.slash = Math.max(0, this.slash - 0.08);
      this.lungeA *= 0.82; this.lungeB *= 0.82;
      this.enemyRecoil *= 0.84;
      if (this.walkIn > 0) this.walkIn = Math.max(0, this.walkIn - 0.04);
      if (this.endMode) this.endT = Math.max(0, this.endT - 0.01);
      if (Math.abs(this.shake) > 0.4) this.shake *= -0.55; else this.shake = 0;

      // 環境パーティクル（舞う塵）
      if (this.frame % 14 === 0) {
        this.particles.push({
          x: Math.random() * this.GW, y: this.GH,
          vx: (Math.random() - 0.5) * 0.2, vy: -0.2 - Math.random() * 0.3,
          life: 1, decay: 0.006, color: 'rgba(180,160,220,0.5)', grav: 0,
        });
      }
      this.particles.forEach((p) => { p.x += p.vx; p.y += p.vy; p.vy += p.grav; p.life -= p.decay; });
      this.particles = this.particles.filter((p) => p.life > 0);

      this._draw();
    }

    _draw() {
      const { ctx, W, H, frame, state } = this;
      ctx.save();
      ctx.clearRect(0, 0, W, H);
      ctx.translate(Math.round(this.shake), 0);
      drawBg(ctx, W, H, frame);

      const baseY = this.GH * 0.38;
      // 歩行フレーム（常に小さく足踏み、入場時は速い行進）
      const spd = this.walkIn > 0 ? 4 : 9;
      const wfA = [0, 1, 0, 2][Math.floor(frame / spd) % 4];
      const wfB = [0, 1, 0, 2][Math.floor((frame + 18) / spd) % 4];
      const bA = Math.sin(frame * 0.09) * 0.7;
      const bB = Math.sin(frame * 0.09 + Math.PI) * 0.7;

      // 入場オフセット（左から滑り込み）
      const inOff = ease(this.walkIn) * 26;

      // 勝敗の上下動
      let endDA = 0, endDB = 0;
      if (this.endMode === 'win') {
        endDA = -Math.abs(Math.sin(frame * 0.25)) * 4;
        endDB = -Math.abs(Math.sin(frame * 0.25 + 0.8)) * 4;
      } else if (this.endMode === 'lose') {
        endDA = 2; endDB = 2;
      }

      const ax = 3 + this.lungeA - inOff;
      const bx = 13 + this.lungeB - inOff;
      const ay = baseY + bA + endDA;
      const by = baseY + bB + endDB;

      // 主人公2人
      const sprA = hero(HERO_A_TOP, LEGS_A, wfA);
      const sprB = hero(HERO_B_TOP, LEGS_B, wfB);
      drawSprite(sprA, ax, ay, ctx);
      drawSprite(sprB, bx, by, ctx);
      if (this.heroFlash > 0) {
        drawSpriteTint(sprA, ax, ay, '#ffffff', this.heroFlash, ctx);
        drawSpriteTint(sprB, bx, by, '#ffffff', this.heroFlash, ctx);
      }

      ctx.textAlign = 'center';

      if (state.kind === 'battle') {
        const espr = state.isBoss ? BOSS : (ENEMY[state.wall] || ENEMY['F']);
        const eW = espr[0].length;
        let eX = this.GW - eW - 3 + this.enemyRecoil;
        const eB = state.isBoss ? Math.sin(frame * 0.05) * 1.3 - 0.5 : Math.sin(frame * 0.07) * 0.8;
        let eY = baseY + eB;
        // 敵タイプ別アイドル
        if (state.wall === 'F' || state.wall === 'S') eX += Math.sin(frame * 0.08) * 1.6;
        if (state.wall === 'N') eX += Math.round(Math.sin(frame * 0.7)) * 0.5;

        drawSprite(espr, eX, eY, ctx);
        if (this.enemyFlash > 0) drawSpriteTint(espr, eX, eY, '#ffffff', this.enemyFlash, ctx);

        // 斬撃エフェクト（敵手前の弧）
        if (this.slash > 0) {
          ctx.strokeStyle = `rgba(255,255,255,${this.slash})`;
          ctx.lineWidth = SC;
          ctx.beginPath();
          const cx = (eX - 2) * SC, cy = (eY + 4) * SC;
          ctx.arc(cx, cy, SC * 6, -1 + (1 - this.slash) * 2, 1 + (1 - this.slash) * 2);
          ctx.stroke();
        }

        ctx.fillStyle = '#fbbf24';
        ctx.font = `bold ${SC * 2}px monospace`;
        ctx.fillText('VS', W / 2, H * 0.72);

        ctx.fillStyle = state.isBoss ? '#f87171' : '#a99fc4';
        ctx.font = `bold ${SC * 1.5}px monospace`;
        ctx.fillText(`${state.floor}F${state.isBoss ? '  ★ BOSS' : ''}`, W / 2, SC * 3.5);

      } else if (state.kind === 'event') {
        const qY = H * 0.66 + Math.sin(frame * 0.1) * SC * 1.6;
        ctx.fillStyle = '#c084fc';
        ctx.font = `bold ${SC * 5}px monospace`;
        ctx.fillText('?', W / 2, qY);
        ctx.fillStyle = '#a99fc4';
        ctx.font = `bold ${SC * 1.5}px monospace`;
        ctx.fillText(`${state.floor}F  ✦ 分かれ道`, W / 2, SC * 3.5);

      } else if (state.kind === 'treasure') {
        const cx = this.GW / 2 - 5;
        const cy = baseY + 4 + Math.sin(frame * 0.12) * 0.5;
        drawSprite(CHEST, cx, cy, ctx);
        if (frame % 20 < 10) {
          ctx.fillStyle = '#fff';
          ctx.fillRect(Math.round((cx + 8) * SC), Math.round((cy - 1) * SC), SC, SC);
        }
        ctx.fillStyle = '#fbbf24';
        ctx.font = `bold ${SC * 1.5}px monospace`;
        ctx.fillText(`${state.floor}F  ◆ 宝箱`, W / 2, SC * 3.5);

      } else if (state.kind === 'rest') {
        const cx = this.GW / 2 - 4;
        const cy = baseY + 6;
        drawSprite(LOGS, cx, cy, ctx);
        const fh = 3 + Math.sin(frame * 0.4) + Math.sin(frame * 0.9) * 0.6;
        for (let i = 0; i < 4; i++) {
          const fx = cx + 2 + i;
          const h = Math.max(1, fh - Math.abs(i - 1.5));
          ctx.fillStyle = i % 2 ? '#fbbf24' : '#f87149';
          ctx.fillRect(Math.round(fx * SC), Math.round((cy - h) * SC), SC, Math.round(h * SC));
        }
        ctx.fillStyle = '#6fc4e0';
        ctx.font = `bold ${SC * 1.5}px monospace`;
        ctx.fillText(`${state.floor}F  ✦ 焚き火`, W / 2, SC * 3.5);

      } else {
        ctx.fillStyle = '#a99fc4';
        ctx.font = `bold ${SC * 1.5}px monospace`;
        ctx.fillText(`${state.floor}F`, W / 2, SC * 3.5);
      }

      // パーティクル
      this.particles.forEach((p) => {
        ctx.globalAlpha = Math.max(0, Math.min(1, p.life));
        ctx.fillStyle = p.color;
        ctx.fillRect(Math.round(p.x) * SC, Math.round(p.y) * SC, SC, SC);
      });
      ctx.globalAlpha = 1;

      // 被弾フラッシュ
      if (this.flash > 0) {
        ctx.fillStyle = `rgba(239,68,68,${this.flash})`;
        ctx.fillRect(-this.shake, 0, W, H);
      }
      // 敗北の暗転
      if (this.endMode === 'lose') {
        ctx.fillStyle = 'rgba(10,5,20,0.45)';
        ctx.fillRect(-this.shake, 0, W, H);
      }
      ctx.restore();
    }
  }

  function ease(t) { return t * t * (3 - 2 * t); } // smoothstep

  window.DungeonScene = DungeonScene;
})();
