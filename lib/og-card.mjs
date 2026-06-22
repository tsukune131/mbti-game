// ===========================================================================
//  OGカード描画の単一ソース（@vercel/og / Satori）
//  - 利用元: api/og.js（動的）, scripts/build-static.mjs（静的256枚生成）
//  - CJKフォントは内蔵されないため Google Fonts からサブセット取得して渡す
// ===========================================================================
import { ImageResponse } from "@vercel/og";
import { analyzeSynergy, punchlineFor } from "./verdict.mjs";

// JSXを使わずSatori要素を組む軽量ヘルパー（{type, props}形式）
const el = (type, style, children) => ({ type, props: { style, children } });

function rankOf(score) {
  if (score >= 85) return { label: "SS", color: "#fbbf24" };
  if (score >= 75) return { label: "S",  color: "#f97316" };
  if (score >= 65) return { label: "A",  color: "#6fd39a" };
  if (score >= 55) return { label: "B",  color: "#6fc4e0" };
  if (score >= 45) return { label: "C",  color: "#a99fc4" };
  return             { label: "D",  color: "#e07a7a" };
}

// Google Fonts から、渡した文字を含む TTF をサブセット取得
export async function loadFont(text) {
  const api = `https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@700&text=${encodeURIComponent(text)}`;
  // woff2非対応の古いUAを送ると Google は truetype(ttf) を返す（Satoriは ttf/otf/woff のみ対応）
  const css = await (await fetch(api, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; MSIE 9.0; Windows NT 6.1; Trident/5.0)" },
  })).text();
  const m = css.match(/src:\s*url\((https:\/\/[^)]+\.(?:ttf|otf|woff))\)/i)
        || css.match(/src:\s*url\((https:\/\/[^)]+)\)/);
  if (!m) throw new Error("font url not found in CSS: " + css.slice(0, 200));
  const fontRes = await fetch(m[1]);
  if (!fontRes.ok) throw new Error("font fetch failed: " + fontRes.status);
  return await fontRes.arrayBuffer();
}

export function buildCard(typeA, typeB, valid) {
  const syn = analyzeSynergy(typeA, typeB);
  const rank = rankOf(syn.score);
  const punch = valid
    ? punchlineFor(typeA, typeB, syn)
    : "あなたと、あの人。2人の相性、占ってみる？";
  const pairText = valid ? `${typeA} × ${typeB}` : "相性ダンジョン";
  const archName = valid ? syn.archetype.name : "MBTI 相性占い";

  const allText =
    `相性ランクスコア#相性ダンジョン${pairText}${archName}${punch}${rank.label}${syn.score}/100`;

  const card = el("div",
    {
      width: "100%", height: "100%", display: "flex", flexDirection: "column",
      justifyContent: "space-between", padding: "56px 64px",
      backgroundColor: "#0e0b1c",
      backgroundImage: "linear-gradient(135deg,#1c1232,#0e0b1c)",
      color: "#f0eaf8", fontFamily: "Noto",
    },
    [
      el("div", { display: "flex", justifyContent: "space-between", alignItems: "center" }, [
        el("div", { fontSize: 40, fontWeight: 700, letterSpacing: "0.04em" }, pairText),
        el("div", { fontSize: 22, color: "#8a7fa8" }, "相性ランク"),
      ]),
      el("div", { display: "flex", flexDirection: "column" }, [
        el("div", { fontSize: 30, fontWeight: 700, color: "#cdb8f0", marginBottom: "18px" }, archName),
        el("div", { fontSize: 46, fontWeight: 700, lineHeight: 1.4, color: "#f0eaf8" }, `“${punch}”`),
      ]),
      el("div", { display: "flex", justifyContent: "space-between", alignItems: "flex-end" }, [
        el("div", { display: "flex", alignItems: "baseline" }, [
          el("div", { fontSize: 84, fontWeight: 700, color: rank.color, marginRight: "16px" }, rank.label),
          el("div", { fontSize: 28, color: rank.color }, `スコア ${syn.score}/100`),
        ]),
        el("div", { fontSize: 24, color: "#c98a4b" }, "#相性ダンジョン"),
      ]),
    ]
  );
  return { card, allText };
}

// PNG(Buffer)を返す。fontData を渡せばフォント取得を省略（256枚一括生成で1回だけ取得）。
export async function renderOgPng(typeA, typeB, valid, fontData) {
  const { card, allText } = buildCard(typeA, typeB, valid);
  const data = fontData || (await loadFont(allText));
  const image = new ImageResponse(card, {
    width: 1200,
    height: 630,
    fonts: [{ name: "Noto", data, weight: 700, style: "normal" }],
  });
  return Buffer.from(await image.arrayBuffer());
}
