// ============================================================
// 설정 예시 파일 — 이걸 복사해서 config.local.js 로 만드세요.
//   config.local.js 는 .gitignore 에 걸려 커밋되지 않습니다.
//
// 모드:
//   "rules"  = 규칙 기반 (기본, 키 불필요, GitHub Pages에서 그대로 동작)
//   "openai" = 로컬 테스트만! 키가 브라우저에 노출되므로 배포 금지
//   "proxy"  = 배포용, 키는 서버리스 프록시(Cloudflare Workers 등)에 숨김
// ============================================================
window.IM_CONFIG = {
  mode: "rules",

  // mode: "openai" 로컬 테스트 시에만 채우기 (절대 커밋/배포 금지)
  openaiKey: "",

  // mode: "proxy" 배포 시
  proxyUrl: "",   // 예: "https://im-ai.<계정>.workers.dev/chat"
};
