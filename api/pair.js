// ===========================================================================
//  GET /type/TYPEA-TYPEB → MBTI相性SEOページHTML（動的版）
//  ※ 本番（静的ホスティング）では scripts/build-static.mjs が
//     /type/A-B.html を事前生成するため通常は不要。動的ホスティング用フォールバック。
//  HTML生成は lib/pair-page.mjs に集約（静的生成と共有）。
// ===========================================================================
import { TYPES } from "../lib/verdict.mjs";
import { renderPairPage } from "../lib/pair-page.mjs";

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
  const proto  = req.headers["x-forwarded-proto"] || "https";
  const host   = req.headers["x-forwarded-host"] || req.headers.host || "";
  const origin = host ? `${proto}://${host}` : "";
  const ogImage = `${origin}/api/og?pair=${typeA}-${typeB}`; // 動的版はランタイムOGを参照
  const html = renderPairPage(typeA, typeB, ogImage);

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=86400, stale-while-revalidate=604800");
  return res.status(200).send(html);
}
