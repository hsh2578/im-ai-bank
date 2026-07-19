// ============================================================
// 자동 시연 모드 — 말 없이 화면만 공유용
//   "▶ 자동시연" 버튼 → 시나리오가 알아서 타이핑·진행·인증
// ============================================================

// 시나리오: "일반 챗봇과 다르다"를 화면으로 증명하는 순서
//   각 장면 = 기존 챗봇이 못 하는 것 → 우리가 하는 것
const DEMO_SCRIPT = [
  { caption: "❌ 기존 챗봇: 정확한 메뉴명을 몰라 헤맵니다\n✅ iM AI: 막연하게 말해도 스스로 판단합니다",
    type: "돈이 자꾸 빠져나가는데 뭔지 모르겠어" },

  { caption: "❌ 무슨 서류가 필요한지도 모릅니다\n✅ 상황만 말하면 필요한 서류를 찾아 발급합니다",
    type: "나 종부세 처음 내는데 뭐 준비해야 돼?" },
  { type: "응 그거 발급해줘" },

  { caption: "✅ 1년에 한 번이라 매번 잊는 것도 — 말만 하면 됩니다",
    type: "연말정산 하려는데 적금 낸거 증명서 필요하대" },

  { caption: "❌ 기존 챗봇: \"메뉴로 이동하세요\" 안내만\n✅ iM AI: 묻힌 기능을 직접 실행합니다",
    type: "카드 명세서 엑셀로 뽑아줘" },
  { type: "GREiT 신용카드로 이번달꺼" },

  { caption: "❌ 기존 챗봇: 시킨 것만 처리\n✅ iM AI: 위험을 먼저 경고하고, 실행은 지문으로",
    type: "안 쓰는 카드 정리해줘" },
  { type: "자동이체 다른 카드로 옮기고 그 체크카드 해지해줘" },

  { caption: "❌ 기존 챗봇: 계좌번호를 직접 입력해야\n✅ iM AI: \"손자한테\"만 해도 계좌를 찾습니다",
    type: "손자한테 용돈 30만원만 보내줘" },

  { caption: "✅ 대화를 기억하고 이어갑니다 (기존 챗봇은 매번 초기화)",
    type: "방금 그 손자한테 다음달 1일에 또 10만원 예약이체 해줘" },
];

let DEMO_RUNNING = false;

// 사람처럼 한 글자씩 입력창에 타이핑
async function typeInto(text, cps = 22) {
  const el = document.getElementById("userInput");
  el.value = "";
  for (const ch of text) {
    el.value += ch;
    await sleep(1000 / cps);
  }
  await sleep(400);
}

// 자막 오버레이 표시
function showCaption(text) {
  let c = document.getElementById("demoCaption");
  if (!c) {
    c = document.createElement("div");
    c.id = "demoCaption";
    c.className = "demo-caption";
    document.body.appendChild(c);
  }
  c.textContent = text;
  c.classList.add("show");
}
function hideCaption() {
  const c = document.getElementById("demoCaption");
  if (c) c.classList.remove("show");
}

// 자동으로 지문 인증을 눌러줌 (모달이 뜨면 감지)
function autoApproveFingerprint() {
  const iv = setInterval(() => {
    const overlay = document.getElementById("authOverlay");
    const fp = document.getElementById("fpBtn");
    if (overlay && overlay.classList.contains("show") && fp) {
      setTimeout(() => fp.click(), 700);   // 살짝 뜸 들이고 누름
    }
    if (!DEMO_RUNNING) clearInterval(iv);
  }, 300);
}

async function runDemo() {
  if (DEMO_RUNNING) return;
  DEMO_RUNNING = true;
  const btn = document.getElementById("demoBtn");
  btn.textContent = "■ 시연 중…";
  btn.disabled = true;

  // 화면 초기화 (환영화면 복구 느낌으로 리로드하는 대신 대화만 비움)
  autoApproveFingerprint();

  for (const step of DEMO_SCRIPT) {
    if (step.caption) { showCaption(step.caption); await sleep(1800); hideCaption(); await sleep(300); }
    await typeInto(step.type);
    await handleUser(document.getElementById("userInput").value);
    // 응답·추천칩·지문까지 끝날 시간 여유
    await sleep(2600);
  }

  showCaption("메뉴를 찾지 않습니다. 말하면 됩니다.");
  await sleep(2500);
  hideCaption();

  DEMO_RUNNING = false;
  btn.textContent = "▶ 자동시연";
  btn.disabled = false;
}
