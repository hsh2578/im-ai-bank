// ============================================================
// 에이전트 오케스트레이터 (turn 기반)
//
//   runTurn(userText) → { message, toolCalls: [{name, args}] }
//     = LLM이 실제로 뱉는 형태와 동일.
//       규칙 모드도 "LLM인 척" 이 형태로 반환.
//       → 나중에 진짜 LLM으로 바꿔도 ui.js(실행 루프)는 그대로.
//
//   [교체 지점] MODE 만 바꾸면 됨:
//     "rules"  = 규칙 기반 (서버 불필요, GitHub Pages 기본)
//     "openai" = 로컬 테스트 (config.local.js에 키, 커밋 금지)
//     "proxy"  = 배포용 (키는 서버리스 프록시에 숨김)
// ============================================================

const AGENT = {
  MODE: (window.IM_CONFIG && window.IM_CONFIG.mode) || "rules",
  proxyUrl: (window.IM_CONFIG && window.IM_CONFIG.proxyUrl) || "",
};

// 대화 한 턴 처리 → 통일된 형태 반환
//   onStep: LLM 모드에서 도구호출을 UI 로그에 실시간 전달
async function runTurn(userText, history, onStep) {
  // openai(로컬 직접) / proxy(배포·키숨김) 둘 다 같은 에이전트 루프를 탄다.
  // 차이는 "OpenAI를 어디로 호출하느냐"뿐 → callLLM()이 흡수한다.
  if (AGENT.MODE === "openai" || AGENT.MODE === "proxy")
    return await runTurnLLM(userText, history, onStep);
  return runTurnRules(userText);   // 기본(rules)
}

// OpenAI chat/completions 1회 호출 — 모드에 따라 직접 or 프록시 경유(얇은 중계).
//   openai = 브라우저가 키를 들고 api.openai.com 직접 (로컬 테스트 전용)
//   proxy  = 키 없는 요청을 프록시로. 프록시가 Authorization을 붙여 대신 호출.
async function callLLM(body) {
  const cfg = window.IM_CONFIG || {};
  if (AGENT.MODE === "proxy") {
    if (!AGENT.proxyUrl) throw new Error("proxyUrl 없음 (index.html 설정 확인)");
    const res = await fetch(AGENT.proxyUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`proxy ${res.status}: ${await res.text()}`);
    return await res.json();
  }
  const key = cfg.openaiKey;
  if (!key) throw new Error("openaiKey 없음 (config.local.js 확인)");
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${key}` },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${await res.text()}`);
  return await res.json();
}

// ------------------------------------------------------------
// [모드 1] 규칙 기반 — 시나리오를 "toolCalls 계획"으로 표현
// ------------------------------------------------------------
function runTurnRules(text) {
  const plan = ruleBasedPlan(text);
  // 규칙 plan을 통일 형태로 변환
  return {
    message: plan.reply_open,
    toolCalls: plan.steps.map(s => ({ name: s.tool, args: s.args })),
    // 확인 후 실행할 것들 (규칙 모드 전용 메타)
    followUp: {
      confirm: plan.confirm,
      onConfirm: plan.onConfirm.map(s => ({ name: s.tool, args: s.args })),
      reply_done: plan.reply_done,
      warnAutopay: plan.warnAutopay,
      showDisclaimer: plan.showDisclaimer,
      payeeConfirm: plan.payeeConfirm || null,
      intent: plan.intent,
    },
  };
}

// ------------------------------------------------------------
// [모드 2] OpenAI 직접 — 진짜 에이전트 루프 (로컬 테스트 전용)
//   LLM ↔ 도구를 여러 번 왕복하며 스스로 판단. 이게 "챗GPT 느낌".
//   대화 히스토리는 모듈 전역(LLM_HISTORY)에 누적 → 맥락 유지.
//   onStep(진행상황) 콜백으로 UI에 도구호출 로그를 실시간 전달.
// ------------------------------------------------------------
let LLM_HISTORY = [];   // {role, content, tool_calls?, tool_call_id?}

function resetLLMHistory() { LLM_HISTORY = []; }

async function runTurnLLM(text, _history, onStep) {
  // 사용자 메시지 누적
  LLM_HISTORY.push({ role: "user", content: text });

  const collectedToolCalls = [];   // UI가 렌더링에 쓸 실제 실행된 도구들
  let finalMessage = "";
  const MAX_STEPS = 5;

  for (let step = 0; step < MAX_STEPS; step++) {
    const body = {
      model: "gpt-4o-mini",
      messages: [{ role: "system", content: buildSystemPrompt() }, ...LLM_HISTORY],
      tools: toOpenAITools(TOOL_SPECS),
      tool_choice: "auto",
      temperature: 0.4,
    };
    const data = await callLLM(body);
    const msg = data.choices[0].message;
    LLM_HISTORY.push(msg);   // assistant 메시지(툴콜 포함) 누적

    const toolCalls = msg.tool_calls || [];
    if (!toolCalls.length) {
      finalMessage = msg.content || "";
      break;   // 더 부를 도구 없음 → 대화 종료
    }
    // (도구 실행 후 다음 루프에서 최종 답변 생성)

    // 각 도구 실행 → 결과를 히스토리에 넣고 다시 루프
    for (const tc of toolCalls) {
      const name = tc.function.name;
      let args = {};
      try { args = JSON.parse(tc.function.arguments || "{}"); } catch {}
      if (onStep) onStep({ type: "tool_call", name, args });

      const result = callTool(name, args);
      collectedToolCalls.push({ name, args, result });
      if (onStep) onStep({ type: "tool_result", name, log: result.log, result });

      LLM_HISTORY.push({
        role: "tool",
        tool_call_id: tc.id,
        content: JSON.stringify(result.data ?? { ok: result.ok }),
      });
    }
  }

  // ── 추천 답변(다음 행동 제안) 생성 ──
  const suggestions = await generateSuggestions(finalMessage);

  return { message: finalMessage, toolCalls: collectedToolCalls, followUp: { intent: "llm", llm: true, suggestions } };
}

// 방금 AI 답변에 이어질 만한 사용자 답변 3개를 생성 (칩으로 표시)
//   callLLM 경유 → openai/proxy 모드 모두에서 동작.
async function generateSuggestions(aiMessage) {
  if (!aiMessage) return [];
  try {
    const data = await callLLM({
      model: "gpt-4o-mini",
      temperature: 0.6,
      messages: [
        { role: "system", content:
          "은행 AI가 방금 한 말에 사용자가 이어서 할 법한 짧은 답변/요청 3개를 JSON 배열로만 출력해라. " +
          "각 항목은 12자 이내, 실제 버튼처럼 자연스럽게. 예: [\"GREiT 신용카드\",\"이번달만\",\"취소\"]. " +
          "설명 없이 JSON 배열만." },
        { role: "user", content: aiMessage },
      ],
    });
    let txt = (data.choices[0].message.content || "").trim();
    txt = txt.replace(/```json|```/g, "").trim();
    const arr = JSON.parse(txt);
    return Array.isArray(arr) ? arr.slice(0, 3) : [];
  } catch { return []; }
}

// OpenAI 응답 → {message, toolCalls} 정규화
function normalizeOpenAI(data) {
  const msg = data.choices && data.choices[0] && data.choices[0].message;
  const toolCalls = (msg && msg.tool_calls || []).map(tc => ({
    name: tc.function.name,
    args: JSON.parse(tc.function.arguments || "{}"),
  }));
  return { message: (msg && msg.content) || "", toolCalls, followUp: null };
}

// TOOL_SPECS → OpenAI function 포맷
function toOpenAITools(specs) {
  return specs.map(s => ({
    type: "function",
    function: {
      name: s.name,
      description: s.description,
      parameters: {
        type: "object",
        properties: Object.fromEntries(
          Object.entries(s.parameters).map(([k, t]) => [k, { type: t === "array" ? "array" : t === "number" ? "number" : "string" }])
        ),
      },
    },
  }));
}

function buildSystemPrompt() {
  const u = BANK_DATA.user;
  return `오늘은 ${BANK_DATA.today}이다. "이번 달"은 2026년 7월을 뜻한다.
너는 iM뱅크의 AI 은행 도우미다. 고객 "${u.name}"님(${u.ageGroup}, ${u.address} 거주, ${u.job})과 대화한다.

[역할]
- 고객이 막연하게 말해도("돈이 자꾸 빠져나가", "안 쓰는 카드 정리해줘") 의도를 파악한다.
- 필요한 정보는 반드시 제공된 도구(Function)를 호출해서 확인한다. 절대 지어내지 마라.
- 정보가 부족하면 되묻는다("얼마 보낼까요?", "어느 카드요?"). 한 번에 다 묻지 말고 자연스럽게.
- 은행 상품·업무방법은 search_knowledge로 검색해서 답한다.
- **서류·증명서 관련(종부세·연말정산·소득증빙·유학·비자·대출제출 등)은 네 상식으로 답하지 말고 반드시 find_documents(purpose=상황)를 호출**해서 iM이 실제 발급 가능한 서류로 안내하라. 사용자는 무슨 서류인지 모르니, 상황("연말정산", "유학비자")만 넘기면 된다.

[실행 규칙 — 중요]
- 필요한 정보(수취인·금액·계좌·서류종류 등)가 다 모이면 **바로 해당 도구를 호출**해라. "할까요?"를 반복하지 마라.
- 확인은 최대 1번만. 사용자가 계좌·수령처·대상을 지정하면 그 즉시 실행 도구를 부른다.
  (예: "주거래통장으로" → 바로 setup_tax_autopay 호출. 또 "이 계좌로 할까요?" 묻지 마라.)
- "안 쓰는 카드"는 **최근 사용일이 오래됐고 월 사용액이 0원인 카드**다. 지금은 card1(iM 스마트 체크카드)이 그렇다(2026-01-12 이후 미사용). 절대 다른 카드(iM Z, GREiT)를 안 쓰는 카드라고 하지 마라.
- 카드 해지는 되돌릴 수 없고 자동이체가 끊길 위험이 있으므로 **2단계로** 처리한다.
  1단계 — "안 쓰는 카드 정리해줘"처럼 모호하게 말하면: list_cards → get_card_autopays(card1)까지만 호출한다. **절대 move_autopays나 cancel_card를 부르지 마라.** card1에 걸린 자동이체(SKT·넷플릭스)를 알려주고 "이 결제들이 끊길 수 있는데, 다른 카드로 옮기고 해지할까요?"라고 확인만 한다.
  2단계 — 사용자가 "옮기고 해지해줘"처럼 명시적으로 승인하면: move_autopays(from=card1, to=card2) → cancel_card(card1)을 한 응답 안에서 연달아 실행한다.
- **card1 하나만 대상이다. GREiT(card3)나 iM Z(card2)의 자동이체는 절대 건드리지 마라.** 옮길 카드는 iM Z 체크카드(card2)로 고정하고 "어느 카드로 옮길까요?"라고 되묻지 마라.
- 이체는 lookup_payee로 계좌를 찾은 뒤, 금액이 있으면 바로 prepare_transfer를 호출하라.
- 사용자가 "발급해줘", "옮기고 해지해줘", "신청해줘"처럼 명확히 지시하면 **되묻지 말고 즉시 해당 실행 도구를 호출**하라.
- 정보가 정말 부족할 때만(대상이 없음, 금액이 없음) 딱 그것만 되묻는다.

[말투]
- 은행원처럼 친절하고 간결하게. 딱딱한 안내문 말고 사람처럼.
- 답변은 짧게. 표·목록보다 자연스러운 문장.
- 이모지는 가끔만.

지금 ${u.name}님과 대화 중이다.`;
}

// ============================================================
// 대화 상태 — 여러 턴에 걸쳐 정보를 모은다 (slot-filling)
//   진행 중인 작업이 있으면 되묻기로 슬롯을 채운다 = 대화 느낌
// ============================================================
let CONVO = null;   // { flow, slots } 또는 null

function resetConvo() { CONVO = null; }

// ============================================================
// 규칙 기반 플래너 (프로토타입)
// ============================================================
function ruleBasedPlan(text) {
  const t = text.replace(/\s/g, "");

  // ── 진행 중인 대화가 있으면 그 맥락으로 먼저 처리 ──
  if (CONVO) {
    const cont = continueConvo(text, t);
    if (cont) return cont;
  }

  // 1) 세금/서류 발급
  if (/(종부세|종합부동산세|세금|납세|서류|증명서)/.test(t)) {
    return {
      intent: "issue_document",
      reply_open: "종합부동산세 납부에는 보통 <b>납세증명서</b>와 <b>잔액증명서</b>가 필요해요.",
      steps: [{ tool: "find_documents", args: { purpose: "종합부동산세" } }],
      confirm: "이 두 서류를 지금 발급해드릴까요?",
      onConfirm: [{ tool: "issue_documents", args: { doc_ids: ["doc_tax", "doc_balance"] } }],
      reply_done: "발급했어요. 홈택스에 바로 첨부하실 수 있어요.",
      warnAutopay: false, showDisclaimer: false,
    };
  }

  // 2) 카드 해지 (+ 자동이체 경고)
  if (/(카드).*(해지|없애|정지|취소)|(해지|없애).*(카드)/.test(t)) {
    return {
      intent: "cancel_card",
      reply_open: "안 쓰시는 <b>iM 스마트 체크카드</b> 말씀이시죠?",
      steps: [
        { tool: "list_cards", args: {} },
        { tool: "get_card_autopays", args: { card_id: "card1" } },
      ],
      warnAutopay: true,
      confirm: "자동이체 2건이 걸려 있어요. 다른 카드로 옮기고 해지할까요?",
      onConfirm: [
        { tool: "move_autopays", args: { from_card_id: "card1", to_card_id: "card2" } },
        { tool: "cancel_card", args: { card_id: "card1" } },
      ],
      reply_done: "자동이체를 iM 위비 신용카드로 옮기고, 체크카드를 해지했어요.",
      showDisclaimer: false,
    };
  }

  // 3) 이체 시작 — slot-filling 대화로 진입
  if ((/(보내|송금)/.test(t) || /이체/.test(t)) && !/한도/.test(t)) {
    CONVO = { flow: "transfer", slots: { payee: findPayee(t), amount: parseAmount(t) } };
    return transferStep();
  }

  // 4) 자동이체/구독 조회 (막연한 불만)
  if (/(돈).*(빠져|나가)|자동이체|구독|정기결제|어디서.*빠/.test(t)) {
    return {
      intent: "check_autopay",
      reply_open: "최근 빠져나간 정기결제를 살펴볼게요.",
      steps: [
        { tool: "list_cards", args: {} },
        { tool: "get_card_autopays", args: { card_id: "card1" } },
      ],
      warnAutopay: true,
      confirm: "정리하고 싶은 항목이 있으면 말씀해주세요.",
      onConfirm: [],
      reply_done: "", showDisclaimer: false,
    };
  }

  // 5) 한도 조회/변경
  if (/(한도)/.test(t)) {
    return {
      intent: "limit",
      reply_open: "현재 이체 한도를 확인해드릴게요.",
      steps: [{ tool: "get_transfer_limit", args: {} }],
      confirm: "한도를 올리려면 본인 인증이 필요해요. 진행할까요?",
      onConfirm: [],
      reply_done: "한도 변경은 강화 인증 후 처리돼요.",
      warnAutopay: false, showDisclaimer: false,
    };
  }

  // 6) 규칙에 없으면 → 지식 DB 검색
  const know = searchKnowledge(text);
  if (know.products.length || know.howto.length) {
    return {
      intent: "knowledge",
      reply_open: buildKnowledgeReply(know),
      steps: [{ tool: "search_knowledge", args: { query: text } }],
      confirm: "", onConfirm: [], reply_done: "",
      warnAutopay: false,
      showDisclaimer: know.products.length > 0,
    };
  }

  // 그래도 못 찾으면 — "찾을 수 없어요" 대신 되묻기
  return {
    intent: "clarify",
    reply_open: "조금 더 자세히 알려주시겠어요? 예를 들어 <i>“세금 낼 때 필요한 서류”</i>, <i>“적금 추천”</i>, <i>“이 카드 해지”</i>, <i>“어머니께 30만원 이체”</i>처럼요.",
    steps: [], confirm: "", onConfirm: [], reply_done: "",
    warnAutopay: false, showDisclaimer: false,
  };
}

// ============================================================
// 대화 이어가기 — 진행 중 작업의 빈 슬롯을 채운다
// ============================================================
function continueConvo(text, t) {
  // 취소
  if (/(취소|그만|아니|됐어)/.test(t)) {
    resetConvo();
    return simpleReply("clarify", "네, 취소했어요. 다른 도움이 필요하시면 말씀해주세요.");
  }
  if (CONVO.flow === "transfer") {
    // 아직 없는 슬롯을 이번 입력에서 채운다
    if (!CONVO.slots.payee) {
      const p = findPayee(t);
      if (p) CONVO.slots.payee = p;
    }
    if (!CONVO.slots.amount) {
      const a = parseAmount(t);
      if (a) CONVO.slots.amount = a;
    }
    return transferStep();
  }
  return null;
}

// 이체 대화의 현재 상태에 맞는 응답 (되묻기 or 확인)
function transferStep() {
  const { payee, amount } = CONVO.slots;

  // 1) 받는 사람이 없으면 되묻기
  if (!payee) {
    return {
      intent: "transfer_ask",
      reply_open: "누구에게 보낼까요? 최근에 보낸 분이면 <b>이름만</b> 말씀하셔도 계좌를 찾아드려요.<br><span style='color:#7a8a89;font-size:13px'>예: 손자, 엄마, 철수</span>",
      steps: [], confirm: "", onConfirm: [], reply_done: "",
      warnAutopay: false, showDisclaimer: false,
    };
  }

  // 받는 사람을 방금 찾았으면 조회 로그 + 반가운 반응
  const foundLine = `아, <b>${payee.name}</b>님요! ${payee.lastDate ? `지난번(${payee.lastDate})에도 ${won(payee.lastAmount)} 보내셨네요.` : ""}`;

  // 2) 금액이 없으면 되묻기
  if (!amount) {
    return {
      intent: "transfer_ask",
      reply_open: `${foundLine}<br>얼마 보낼까요?`,
      steps: [{ tool: "lookup_payee", args: { query: payee.name } }],
      confirm: "", onConfirm: [], reply_done: "",
      warnAutopay: false, showDisclaimer: false,
    };
  }

  // 3) 둘 다 있으면 예금주 확인 카드 + 최종 확인
  const done = { payee, amount };
  resetConvo();   // 대화 완료
  return {
    intent: "transfer",
    reply_open: `${foundLine}`,
    steps: [{ tool: "lookup_payee", args: { query: payee.name } }],
    payeeConfirm: done,
    confirm: `${payee.bank} ${payee.account}\n<b>${payee.name}</b>님께 <b>${won(amount)}</b>을 보낼까요?`,
    onConfirm: [{ tool: "prepare_transfer", args: { payee_id: payee.id, amount } }],
    reply_done: `${payee.name}님께 ${won(amount)}을 이체했어요.`,
    warnAutopay: false, showDisclaimer: false,
  };
}

// 금액 파싱 — "30만", "5만원", "만원", "300000"
function parseAmount(t) {
  let m = t.match(/(\d+)\s*만/);
  if (m) return parseInt(m[1]) * 10000;
  if (/^만원|[^0-9]만원/.test(t) || t === "만원") return 10000;
  m = t.match(/(\d{4,})\s*원?/);
  if (m) return parseInt(m[1]);
  return null;
}

// 단순 응답 헬퍼
function simpleReply(intent, message) {
  return { intent, reply_open: message, steps: [], confirm: "", onConfirm: [], reply_done: "", warnAutopay: false, showDisclaimer: false };
}

// 지식 검색 결과를 자연어 답변으로
function buildKnowledgeReply(know) {
  if (know.products.length) {
    const top = know.products.slice(0, 3);
    const lines = top.map(p =>
      `· <b>${p.name}</b> — ${p.desc} <span style="color:#7a8a89">(${p.rateExample})</span>`
    ).join("<br>");
    return `이런 iM 상품이 있어요:<br>${lines}`;
  }
  const h = know.howto[0];
  return `<b>${h.name}</b> 안내드릴게요.<br>${h.steps}`;
}
