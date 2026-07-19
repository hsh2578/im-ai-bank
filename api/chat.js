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
    const raw = typeof req.body === "string" ? (req.body || "{}") : JSON.stringify(req.body || {});
    // 과대요청 차단: 정상 요청은 수 KB. 100KB 넘으면 남용으로 보고 거절.
    if (raw.length > 100_000) return res.status(413).json({ error: "요청이 너무 큽니다" });
    const body = JSON.parse(raw);

    // 주의: messages는 자르지 않는다. tool_call↔tool_result 짝을 끊으면 OpenAI가 400을 낸다.
    // 입력 비용은 위 100KB 가드로, 출력 비용은 아래 max_tokens로 묶는다.
    const messages = Array.isArray(body.messages) ? body.messages : [];

    // 안전: 모델 gpt-4o-mini 고정 + 출력 토큰 상한(비용 백스톱). chat/completions만 중계.
    const safeBody = {
      model: "gpt-4o-mini",
      messages,
      tools: body.tools,
      tool_choice: body.tool_choice,
      temperature: typeof body.temperature === "number" ? body.temperature : 0.4,
      max_tokens: 1024,
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
