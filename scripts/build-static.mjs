// ===========================================================================
//  静的サイトビルド: dist/ に「完全ホスト可搬」な成果物を書き出す
//   - フロント一式（index.html / *.js / style.css）
//   - 256ペアのSEOページ      → dist/type/A-B.html  （/type/A-B で配信）
//   - 256ペアのOG画像 + 既定  → dist/og/A-B.png
//  サーバーレス不要。Cloudflare Pages 等に dist/ をそのまま publish できる。
//
//  使い方:
//    SITE_URL=https://example.com npm run build
//    （SITE_URL 未指定なら og:image は相対パスで出力。クローラ向けには絶対URL推奨）
//    OG画像生成を飛ばす: SKIP_OG=1 npm run build
// ===========================================================================
import { mkdir, writeFile, readFile, rm, copyFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { TYPES } from "../lib/verdict.mjs";
import { renderPairPage } from "../lib/pair-page.mjs";
import { buildCard, loadFont, renderOgPng } from "../lib/og-card.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DIST = join(ROOT, "dist");
const SITE_URL = (process.env.SITE_URL || "").replace(/\/$/, "");
const SKIP_OG = process.env.SKIP_OG === "1";

const FRONT_FILES = ["game.js", "dungeon-scene.js", "main.js", "style.css"];
const ogUrl = (a, b) => `${SITE_URL}/og/${a}-${b}.png`; // SITE_URL空なら /og/A-B.png

async function main() {
  console.log("▶ static build start" + (SITE_URL ? ` (SITE_URL=${SITE_URL})` : " (no SITE_URL → 相対og)"));
  await rm(DIST, { recursive: true, force: true });
  await mkdir(join(DIST, "type"), { recursive: true });
  await mkdir(join(DIST, "og"), { recursive: true });

  // 1) フロント一式をコピー
  for (const f of FRONT_FILES) await copyFile(join(ROOT, f), join(DIST, f));

  // index.html は OG を静的の既定画像へ差し替えてコピー
  let indexHtml = await readFile(join(ROOT, "index.html"), "utf8");
  const defaultOg = `${SITE_URL}/og/default.png`;
  indexHtml = indexHtml.replaceAll('content="/api/og"', `content="${defaultOg}"`);
  await writeFile(join(DIST, "index.html"), indexHtml, "utf8");

  // 2) 全ペア列挙（16×16=256、同タイプ同士も含む）
  const pairs = [];
  for (const a of TYPES) for (const b of TYPES) pairs.push([a, b]);

  // 3) SEOページ 256枚
  for (const [a, b] of pairs) {
    const html = renderPairPage(a, b, ogUrl(a, b));
    await writeFile(join(DIST, "type", `${a}-${b}.html`), html, "utf8");
  }
  console.log(`✓ SEOページ ${pairs.length} 枚`);

  // 4) OG画像 256枚 + 既定（フォントは全文字を一括取得して1回だけ）
  if (SKIP_OG) {
    console.log("⚠ SKIP_OG=1 のためOG画像生成をスキップ");
  } else {
    const chars = new Set();
    for (const [a, b] of pairs) for (const ch of buildCard(a, b, true).allText) chars.add(ch);
    for (const ch of buildCard("INFP", "ENFJ", false).allText) chars.add(ch);
    console.log(`… フォント取得中（${chars.size}文字サブセット）`);
    const font = await loadFont(Array.from(chars).join(""));

    let n = 0;
    for (const [a, b] of pairs) {
      const png = await renderOgPng(a, b, true, font);
      await writeFile(join(DIST, "og", `${a}-${b}.png`), png);
      if (++n % 32 === 0) console.log(`  OG ${n}/${pairs.length}`);
    }
    // 既定（トップ/不正pair用）
    await writeFile(join(DIST, "og", "default.png"), await renderOgPng("INFP", "ENFJ", false, font));
    console.log(`✓ OG画像 ${pairs.length} 枚 + default.png`);
  }

  console.log(`▶ done → ${DIST}`);
}

main().catch((e) => { console.error("build failed:", e); process.exit(1); });
