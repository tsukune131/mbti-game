// Gemini 疎通チェック: モデルIDとAPIキーが有効か5秒で確認する。
//   使い方: node scripts/check-gemini.mjs
//   .env の GEMINI_API_KEY を読みます（環境変数が優先）。
import { readFileSync } from "node:fs";
import { GoogleGenAI } from "@google/genai";

// api/reading.js と同じモデルID
const MODEL = "gemini-3.1-flash-lite";

// .env を軽くパース（環境変数が無ければ）
function loadEnv() {
  if (process.env.GEMINI_API_KEY) return process.env.GEMINI_API_KEY;
  try {
    const txt = readFileSync(new URL("../.env", import.meta.url), "utf8");
    for (const line of txt.split("\n")) {
      const m = line.match(/^\s*GEMINI_API_KEY\s*=\s*(.+)\s*$/);
      if (m) return m[1].trim();
    }
  } catch {}
  return null;
}

const apiKey = loadEnv();
if (!apiKey || apiKey.includes("ここにキー")) {
  console.error("✗ GEMINI_API_KEY が見つかりません。.env に設定してください。");
  process.exit(1);
}

console.log(`モデル: ${MODEL} で疎通確認中…`);
try {
  const ai = new GoogleGenAI({ apiKey });
  const res = await ai.models.generateContent({
    model: MODEL,
    contents: "「相性占いゲームのテスト成功」とだけ日本語で返して。",
    config: { maxOutputTokens: 50 },
  });
  console.log("✓ 成功:", (res.text || "").trim());
} catch (e) {
  console.error("✗ 失敗:", String(e?.message || e));
  console.error("  → モデルIDが正しいか / キーが有効か を確認してください。");
  process.exit(1);
}
