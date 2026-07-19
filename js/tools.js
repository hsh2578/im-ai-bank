// ============================================================
// 은행 기능 = "AI가 호출하는 도구(Tool)"
// 지금은 더미데이터를 조작. 나중에 이 함수 본문만 실제 API로 교체.
// ============================================================

// 각 도구의 스펙 (OpenAI function calling에 그대로 넘길 형태)
//   requiresAuth: 실행 전 본인 인증(지문)이 필요한가 = 도구의 속성
//                 → agent가 아니라 도구 자신이 안다. LLM이 자유롭게 골라도 안전.
const TOOL_SPECS = [
  {
    name: "list_cards",
    description: "고객이 보유한 카드 목록과 사용 현황을 조회한다",
    parameters: {},
    requiresAuth: false,
  },
  {
    name: "get_card_autopays",
    description: "특정 카드에 걸린 자동이체(정기결제) 목록을 조회한다. 카드 해지 전 반드시 확인.",
    parameters: { card_id: "string" },
    requiresAuth: false,
  },
  {
    name: "cancel_card",
    description: "카드를 해지한다.",
    parameters: { card_id: "string" },
    requiresAuth: true,
  },
  {
    name: "move_autopays",
    description: "한 카드의 자동이체를 다른 카드로 옮긴다.",
    parameters: { from_card_id: "string", to_card_id: "string" },
    requiresAuth: true,
  },
  {
    name: "find_documents",
    description: "특정 목적(예: 종합부동산세 납부)에 필요한 증명서를 찾는다",
    parameters: { purpose: "string" },
    requiresAuth: false,
  },
  {
    name: "issue_documents",
    description: "증명서를 발급한다.",
    parameters: { doc_ids: "array" },
    requiresAuth: true,
  },
  {
    name: "list_accounts",
    description: "계좌 목록과 잔액을 조회한다",
    parameters: {},
    requiresAuth: false,
  },
  {
    name: "lookup_payee",
    description: "이름·별칭(예: '손자', '엄마')으로 최근 이체처의 계좌·예금주를 찾는다. 이체 전 예금주 확인용.",
    parameters: { query: "string" },
    requiresAuth: false,
  },
  {
    name: "prepare_transfer",
    description: "이체를 준비한다. lookup_payee로 확인된 수취인에게. 실행 전 인증 필요.",
    parameters: { payee_id: "string", amount: "number" },
    requiresAuth: true,
  },
  {
    name: "get_transfer_limit",
    description: "현재 이체 한도를 조회한다",
    parameters: {},
    requiresAuth: false,
  },
  {
    name: "search_knowledge",
    description: "iM 상품·서류·업무방법 지식을 검색한다. 규칙에 없는 일반 질문에 사용.",
    parameters: { query: "string" },
    requiresAuth: false,
  },
  {
    name: "get_account_balance",
    description: "계좌 잔액을 조회한다. account_id 없으면 전체 계좌.",
    parameters: { account_id: "string" },
    requiresAuth: false,
  },
  {
    name: "get_transactions",
    description: "최근 거래내역을 조회한다.",
    parameters: { limit: "number" },
    requiresAuth: false,
  },
  {
    name: "get_loans",
    description: "보유 대출 현황(잔액·금리·상환일)을 조회한다.",
    parameters: {},
    requiresAuth: false,
  },

  // ===== 세부 서비스 (묻혀있던 메뉴) =====
  {
    name: "export_card_statement",
    description: "카드 이용명세서를 엑셀(excel) 또는 PDF로 다운로드한다.",
    parameters: { card_id: "string", format: "string", month: "string" },
    requiresAuth: false,
  },
  {
    name: "update_personal_info",
    description: "개인정보를 변경한다. field는 address(주소)/phone(전화번호)/email 중 하나.",
    parameters: { field: "string", value: "string" },
    requiresAuth: true,
  },
  {
    name: "report_card_lost",
    description: "카드 분실신고를 하고 즉시 이용정지한다.",
    parameters: { card_id: "string" },
    requiresAuth: true,
  },
  {
    name: "setup_tax_autopay",
    description: "국세·지방세·공과금 자동납부를 신청한다. tax_type 예: 지방세, 재산세, 자동차세, 전기요금.",
    parameters: { tax_type: "string", account_id: "string" },
    requiresAuth: true,
  },
  {
    name: "register_autopay",
    description: "새 자동이체를 등록한다.",
    parameters: { merchant: "string", amount: "number", day: "number", account_id: "string" },
    requiresAuth: true,
  },
  {
    name: "cancel_autopay",
    description: "기존 자동이체(정기결제)를 해지한다. merchant명으로 지정.",
    parameters: { merchant: "string" },
    requiresAuth: true,
  },
  {
    name: "prepare_loan_repay",
    description: "대출을 일부/전액 상환 준비한다.",
    parameters: { loan_id: "string", amount: "number" },
    requiresAuth: true,
  },
  {
    name: "extend_loan",
    description: "대출 만기를 연장 신청한다.",
    parameters: { loan_id: "string" },
    requiresAuth: true,
  },
  {
    name: "change_transfer_limit",
    description: "이체 한도(1일/1회)를 변경 신청한다.",
    parameters: { daily: "number", once: "number" },
    requiresAuth: true,
  },
  {
    name: "prepare_scheduled_transfer",
    description: "예약이체를 준비한다. 지정한 날짜(date)에 자동 실행. lookup_payee로 수취인 확인 후.",
    parameters: { payee_id: "string", amount: "number", date: "string" },
    requiresAuth: true,
  },
  {
    name: "prepare_delayed_transfer",
    description: "지연이체(3시간 후 실행, 취소 가능)를 준비한다. 착오송금·보이스피싱 예방용.",
    parameters: { payee_id: "string", amount: "number" },
    requiresAuth: true,
  },
  {
    name: "pay_bill",
    description: "공과금·세금을 납부한다. bill_type: 지방세/국세/생활요금/지로/연금보험료/대학등록금/범칙금.",
    parameters: { bill_type: "string", amount: "number", account_id: "string" },
    requiresAuth: true,
  },
  {
    name: "prepare_exchange",
    description: "환전을 신청한다. currency(USD 등), amount, receive_place(수령처).",
    parameters: { currency: "string", amount: "number", receive_place: "string" },
    requiresAuth: true,
  },
  {
    name: "prepare_overseas_remit",
    description: "해외로 외화송금을 준비한다.",
    parameters: { to_name: "string", country: "string", amount: "number", currency: "string" },
    requiresAuth: true,
  },
  {
    name: "get_openbanking_accounts",
    description: "오픈뱅킹으로 등록된 타행 계좌들의 잔액을 통합조회한다.",
    parameters: {},
    requiresAuth: false,
  },
];

// 도구가 인증을 요구하는지 조회 (실행 루프가 사용)
function toolRequiresAuth(name) {
  const spec = TOOL_SPECS.find(s => s.name === name);
  return !!(spec && spec.requiresAuth);
}

// ============================================================
// 실제 실행부 (더미). 반환값은 {ok, data, log}
//   log = 화면 툴호출 로그 패널에 찍을 문자열
// ============================================================
const TOOLS = {
  list_cards() {
    return {
      ok: true,
      log: `list_cards() → ${BANK_DATA.cards.length}건`,
      data: BANK_DATA.cards.map(c => ({
        id: c.id, name: c.name, number: c.number,
        lastUsed: c.lastUsed, monthlyUsage: c.monthlyUsage,
      })),
    };
  },

  get_card_autopays({ card_id }) {
    const card = BANK_DATA.cards.find(c => c.id === card_id);
    const list = card ? card.autopays : [];
    return {
      ok: !!card,
      log: `get_card_autopays(card_id="${card_id}") → 자동이체 ${list.length}건`,
      data: list,
    };
  },

  cancel_card({ card_id }) {
    const card = BANK_DATA.cards.find(c => c.id === card_id);
    return {
      ok: !!card,
      log: `cancel_card(card_id="${card_id}") → 해지 완료`,
      data: { canceled: card ? card.name : null },
    };
  },

  move_autopays({ from_card_id, to_card_id }) {
    const from = BANK_DATA.cards.find(c => c.id === from_card_id);
    const to = BANK_DATA.cards.find(c => c.id === to_card_id);
    const moved = from ? from.autopays : [];
    return {
      ok: !!(from && to),
      log: `move_autopays("${from_card_id}"→"${to_card_id}") → ${moved.length}건 이전`,
      data: { moved, to: to ? to.name : null },
    };
  },

  find_documents({ purpose }) {
    const p = (purpose || "").replace(/\s/g, "");
    // 1) 목적별 서류 세트를 먼저 (종부세·연말정산·소득증빙 등)
    const set = BANK_DATA.documentSets.find(s =>
      p.includes(s.purpose) || s.purpose.includes(p) ||
      (s.purpose === "종부세" && /(종합부동산|종부|재산세)/.test(p)) ||
      (s.purpose === "연말정산" && /(연말정산|소득공제|적금.*증명|납입)/.test(p)) ||
      (s.purpose === "소득증빙" && /(소득|재직|회사|증빙)/.test(p)) ||
      (s.purpose === "유학비자" && /(유학|비자)/.test(p))
    );
    if (set) {
      const docs = set.docs.map(id => BANK_DATA.documents.find(d => d.id === id)).filter(Boolean);
      return {
        ok: true,
        log: `find_documents("${purpose}") → [${set.label}] ${docs.map(d => d.name).join(", ")}`,
        data: docs,
        note: set.note,
      };
    }
    // 2) 키워드 매칭
    const hits = BANK_DATA.documents.filter(d =>
      d.forWhat.some(w => p.includes(w) || w.includes(p || "___"))
    );
    const result = hits.length ? hits : BANK_DATA.documents.slice(0, 2);
    return {
      ok: true,
      log: `find_documents("${purpose}") → ${result.map(d => d.name).join(", ")}`,
      data: result,
    };
  },

  issue_documents({ doc_ids }) {
    const docs = BANK_DATA.documents.filter(d => (doc_ids || []).includes(d.id));
    return {
      ok: docs.length > 0,
      log: `issue_documents([${(doc_ids || []).join(", ")}]) → PDF ${docs.length}건 발급`,
      data: docs.map(d => ({ id: d.id, name: d.name, file: d.name + ".pdf" })),
    };
  },

  list_accounts() {
    return {
      ok: true,
      log: `list_accounts() → ${BANK_DATA.accounts.length}건`,
      data: BANK_DATA.accounts,
    };
  },

  // 수취인 조회 — 이름/별칭으로 계좌를 찾아 예금주 확인 (실제 이체의 핵심 단계)
  lookup_payee({ query }) {
    const p = findPayee(query || "");
    return {
      ok: !!p,
      log: p
        ? `lookup_payee("${query}") → ${p.name} (${p.bank} ${p.account})`
        : `lookup_payee("${query}") → 수취인 못 찾음`,
      data: p,
    };
  },

  prepare_transfer({ payee_id, amount }) {
    const p = BANK_DATA.payees.find(x => x.id === payee_id);
    const overLimit = amount > BANK_DATA.limits.oncePerTransfer;
    return {
      ok: !!p,
      log: `prepare_transfer(payee="${p ? p.name : payee_id}", amount=${amount}) → 준비 완료${overLimit ? " (한도초과·강화인증)" : ""}`,
      data: { payee: p, amount, overLimit },
    };
  },

  get_transfer_limit() {
    return {
      ok: true,
      log: `get_transfer_limit() → 1회 ${won(BANK_DATA.limits.oncePerTransfer)}`,
      data: BANK_DATA.limits,
    };
  },

  search_knowledge({ query }) {
    const know = searchKnowledge(query || "");
    const total = know.products.length + know.howto.length;
    return {
      ok: total > 0,
      log: `search_knowledge(query="${query}") → iM 지식 DB ${total}건`,
      data: know,
    };
  },

  get_account_balance({ account_id }) {
    const list = account_id
      ? BANK_DATA.accounts.filter(a => a.id === account_id)
      : BANK_DATA.accounts;
    return {
      ok: true,
      log: `get_account_balance() → ${list.length}개 계좌`,
      data: list.map(a => ({ name: a.name, number: a.number, balance: a.balance, type: a.type })),
    };
  },

  get_transactions({ limit }) {
    const n = limit || 8;
    const list = BANK_DATA.transactions.slice(0, n);
    return {
      ok: true,
      log: `get_transactions(limit=${n}) → ${list.length}건`,
      data: list,
    };
  },

  get_loans() {
    return {
      ok: true,
      log: `get_loans() → ${BANK_DATA.loans.length}건`,
      data: BANK_DATA.loans,
    };
  },

  // ===== 세부 서비스 (앱 메뉴에 묻혀있던 것들) =====

  // 카드 명세서 엑셀/PDF 다운로드
  export_card_statement({ card_id, format, month }) {
    const card = BANK_DATA.cards.find(c => c.id === card_id) || BANK_DATA.cards[0];
    const fmt = (format || "excel").toLowerCase();
    // month 미지정 시 데모 기준월 사용 (실제 날짜 하드코딩 방지)
    const ym = (month && /\d/.test(month)) ? month.replace(/[^\d]/g, "") : BANK_DATA.today.replace(/-/g, "").slice(0, 6);
    return {
      ok: true,
      log: `export_card_statement(${card.id}, ${fmt}, ${ym}) → 파일 생성`,
      data: { file: `${card.name}_명세서_${ym}.${fmt === "pdf" ? "pdf" : "xlsx"}`, card: card.name },
    };
  },

  // 개인정보 변경 (주소·전화번호·이메일)
  update_personal_info({ field, value }) {
    const labels = { address: "주소", phone: "전화번호", email: "이메일" };
    return {
      ok: !!labels[field],
      log: `update_personal_info(${field}="${value}") → 변경 준비`,
      data: { field: labels[field] || field, oldValue: field === "address" ? BANK_DATA.user.address : field === "phone" ? BANK_DATA.user.phone : "-", newValue: value },
    };
  },

  // 카드 분실신고
  report_card_lost({ card_id }) {
    const card = BANK_DATA.cards.find(c => c.id === card_id) || BANK_DATA.cards[0];
    return {
      ok: true,
      log: `report_card_lost(${card.id}) → 분실신고 접수 + 즉시 정지`,
      data: { card: card.name, status: "이용정지", reissue: "재발급 신청 가능" },
    };
  },

  // 세금(국세·지방세·공과금) 자동납부 신청
  setup_tax_autopay({ tax_type, account_id }) {
    const acc = BANK_DATA.accounts.find(a => a.id === account_id) || BANK_DATA.accounts[0];
    return {
      ok: true,
      log: `setup_tax_autopay(${tax_type}, ${acc.id}) → 자동납부 신청`,
      data: { taxType: tax_type || "지방세", fromAccount: acc.name },
    };
  },

  // 자동이체 등록
  register_autopay({ merchant, amount, day, account_id }) {
    const acc = BANK_DATA.accounts.find(a => a.id === account_id) || BANK_DATA.accounts[0];
    return {
      ok: true,
      log: `register_autopay(${merchant}, ${amount}, ${day}일) → 등록`,
      data: { merchant, amount, day, fromAccount: acc.name },
    };
  },

  // 자동이체 해지
  cancel_autopay({ merchant }) {
    // 전체 카드에서 해당 자동이체 찾기
    let found = null;
    for (const c of BANK_DATA.cards) {
      const a = c.autopays.find(x => x.merchant.includes(merchant || "___"));
      if (a) { found = { ...a, card: c.name }; break; }
    }
    return {
      ok: !!found,
      log: `cancel_autopay("${merchant}") → ${found ? "해지" : "못 찾음"}`,
      data: found,
    };
  },

  // 대출 상환 (일부/전액)
  prepare_loan_repay({ loan_id, amount }) {
    const loan = BANK_DATA.loans.find(l => l.id === loan_id) || BANK_DATA.loans[0];
    return {
      ok: !!loan,
      log: `prepare_loan_repay(${loan?.id}, ${amount}) → 상환 준비`,
      data: loan ? { loan: loan.name, balance: loan.balance, repay: amount, after: loan.balance - amount } : null,
    };
  },

  // 대출 만기연장
  extend_loan({ loan_id }) {
    const loan = BANK_DATA.loans.find(l => l.id === loan_id) || BANK_DATA.loans[0];
    return {
      ok: !!loan,
      log: `extend_loan(${loan?.id}) → 만기연장 신청`,
      data: loan ? { loan: loan.name } : null,
    };
  },

  // 이체한도 변경
  change_transfer_limit({ daily, once }) {
    return {
      ok: true,
      log: `change_transfer_limit(daily=${daily}, once=${once}) → 변경 신청`,
      data: { daily: daily || BANK_DATA.limits.dailyTransfer, once: once || BANK_DATA.limits.oncePerTransfer },
    };
  },

  // 예약이체 (지정일에 실행)
  prepare_scheduled_transfer({ payee_id, amount, date }) {
    const p = BANK_DATA.payees.find(x => x.id === payee_id);
    return {
      ok: !!p,
      log: `prepare_scheduled_transfer(${p ? p.name : payee_id}, ${amount}, ${date}) → 예약 준비`,
      data: { payee: p, amount, date, type: "예약이체" },
    };
  },

  // 지연이체 (취소 가능 시간 후 실행)
  prepare_delayed_transfer({ payee_id, amount }) {
    const p = BANK_DATA.payees.find(x => x.id === payee_id);
    return {
      ok: !!p,
      log: `prepare_delayed_transfer(${p ? p.name : payee_id}, ${amount}) → 지연이체 준비(3시간 후)`,
      data: { payee: p, amount, delayHours: 3, type: "지연이체" },
    };
  },

  // 공과금/세금 납부
  pay_bill({ bill_type, amount, account_id }) {
    const acc = BANK_DATA.accounts.find(a => a.id === account_id) || BANK_DATA.accounts[0];
    const bt = BANK_DATA.billTypes.find(b => (bill_type || "").includes(b.key));
    return {
      ok: true,
      log: `pay_bill(${bill_type}, ${amount || "고지서금액"}) → 납부 준비`,
      data: { billType: bt ? bt.key : bill_type, amount, fromAccount: acc.name },
    };
  },

  // 환전 신청
  prepare_exchange({ currency, amount, receive_place }) {
    return {
      ok: true,
      log: `prepare_exchange(${currency}, ${amount}, ${receive_place || "영업점"}) → 환전 준비(환율우대)`,
      data: { currency: currency || "USD", amount, place: receive_place || "영업점 수령", benefit: "환율 최대 30% 우대" },
    };
  },

  // 외화송금
  prepare_overseas_remit({ to_name, country, amount, currency }) {
    return {
      ok: true,
      log: `prepare_overseas_remit(${to_name}, ${country}, ${amount} ${currency}) → 송금 준비`,
      data: { toName: to_name, country, amount, currency: currency || "USD", benefit: "수수료 50% 저렴" },
    };
  },

  // 오픈뱅킹 - 타행 계좌 통합조회
  get_openbanking_accounts() {
    return {
      ok: true,
      log: `get_openbanking_accounts() → 타행 3건 조회`,
      data: [
        { bank: "국민은행", number: "123-45-****", balance: 1_850_000 },
        { bank: "카카오뱅크", number: "3333-01-****", balance: 620_000 },
        { bank: "토스뱅크", number: "1000-22-****", balance: 340_000 },
      ],
    };
  },
};

// 오케스트레이터에서 부르는 단일 진입점
function callTool(name, args) {
  const fn = TOOLS[name];
  if (!fn) return { ok: false, log: `알 수 없는 도구: ${name}`, data: null };
  return fn(args || {});
}
