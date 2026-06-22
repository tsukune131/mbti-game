// ===========================================================================
//  GET /api/og?pair=INFP-ENFJ → 1200×630 のシェア用OG画像（PNG・動的版）
//  ※ 本番（静的ホスティング）では scripts/build-static.mjs が /og/A-B.png を
//     事前生成するため通常は不要。Vercel等で動的に出したい場合のフォールバック。
//  描画ロジックは lib/og-card.mjs に集約（静的生成と共有）。
// ===========================================================================
import { renderOgPng } from "../lib/og-card.mjs";
import { TYPES } from "../lib/verdict.mjs";

export default async function handler(req, res) {
  try {
    const raw = String(req.query?.pair || "").toUpperCase();
    const parts = raw.split("-");
    const valid = parts.length === 2 && TYPES.includes(parts[0]) && TYPES.includes(parts[1]);
    const typeA = valid ? parts[0] : "INFP";
    const typeB = valid ? parts[1] : "ENFJ";

    const buf = await renderOgPng(typeA, typeB, valid);

    res.setHeader("Content-Type", "image/png");
    res.setHeader("Cache-Control", "public, max-age=86400, stale-while-revalidate=604800");
    return res.status(200).send(buf);
  } catch (e) {
    console.error("og error:", e);
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    return res.status(500).send("og error: " + (e?.message || e));
  }
}
