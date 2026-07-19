// ============================================================
// Vercel 서버리스 함수 — OpenAI 프록시 (얇은 중계)
//   브라우저는 키 없이 여기로 요청 → 이 함수가 Authorization을 붙여 OpenAI 호출.
//   키는 Vercel 환경변수(OPENAI_KEY)에만 존재. 절대 클라이언트로 안 나감.
//
// 배포:
//   1) 이 저장소를 Vercel에 import (자동으로 /api/chat 함수 인식)
//   2) Vercel > Settings > Environment Variables 에 OPENAI_KEY 추가
//   3) 배포 URL: https://<project>.vercel.app/api/chat
// ============================================================

// CORS: 우리 GitHub Pages 도메인만 허용 (봇/타사이트의 무단 사용 차단)
const ALLOW_ORIGIN = "https://hsh2578.github.io";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", ALLOW_ORIGIN);
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(204).end();   // preflight
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  const key = process.env.OPENAI_KEY;
  if (!key) return res.status(500).json({ error: "OPENAI_KEY 미설정 (Vercel 환경변수 확인)" });

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});

    // 안전: 모델은 서버에서 gpt-4o-mini로 고정(비용 상한), chat/completions만 중계.
    const safeBody = {
      model: "gpt-4o-mini",
      messages: body.messages,
      tools: body.tools,
      tool_choice: body.tool_choice,
      temperature: typeof body.temperature === "number" ? body.temperature : 0.4,
    };

    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${key}` },
      body: JSON.stringify(safeBody),
    });
    const data = await r.json();
    return res.status(r.status).json(data);
  } catch (e) {
    return res.status(500).json({ error: String(e && e.message || e) });
  }
}
