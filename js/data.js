// ============================================================
// 더미 뱅킹 데이터 — 전부 가상 (황성혁님)
// 실제 은행/개인정보 아님. 프로토타입 데모용.
// ============================================================

const BANK_DATA = {
  today: "2026-07-19",   // 데모 기준일 (명세서·예약이체 날짜 계산용)

  user: {
    name: "황성혁",
    ageGroup: "20대",
    birth: "1999-03-14",
    phone: "010-2578-1114",
    address: "대구광역시 수성구 동대구로 123",
    job: "직장인 (재직 1년 4개월)",
    pin: "0314",                 // 간편비밀번호 (데모: 지문 대체 확인용)
    creditScore: 812,            // NICE 기준 예시
  },

  // ---- 계좌 ----
  accounts: [
    { id: "acc1", name: "iM 주거래 입출금통장", number: "504-10-123456", balance: 3_240_500, primary: true, type: "입출금" },
    { id: "acc2", name: "iM 비상금박스", number: "504-10-998877", balance: 1_200_000, primary: false, type: "파킹" },
    { id: "acc3", name: "iM 세븐적금", number: "504-22-334455", balance: 2_800_000, primary: false, type: "적금", monthly: 200_000, maturity: "2027-08-01", rate: "연 3.5%" },
    { id: "acc4", name: "주택청약종합저축", number: "504-30-556677", balance: 4_500_000, primary: false, type: "청약", monthly: 100_000 },
  ],

  // ---- 카드 ----
  cards: [
    {
      id: "card1", name: "iM 스마트 체크카드", type: "체크",
      number: "5301-****-****-1234",
      lastUsed: "2026-01-12", monthlyUsage: 0,     // 6개월+ 미사용
      linkedAccount: "acc1",
      autopays: [
        { merchant: "SKT 통신비", amount: 55_000, day: 15 },
        { merchant: "넷플릭스", amount: 13_500, day: 22 },
      ],
    },
    {
      id: "card2", name: "iM Z 체크카드", type: "체크",
      number: "5388-****-****-5678",
      lastUsed: "2026-07-17", monthlyUsage: 480_000,
      linkedAccount: "acc1",
      autopays: [],
    },
    {
      id: "card3", name: "GREiT 신용카드", type: "신용",
      number: "5412-****-****-9012",
      lastUsed: "2026-07-15", monthlyUsage: 1_120_000,
      creditLimit: 3_000_000,
      autopays: [
        { merchant: "쿠팡 와우멤버십", amount: 7_890, day: 5 },
        { merchant: "유튜브 프리미엄", amount: 14_900, day: 8 },
        { merchant: "헬스장 정기권", amount: 99_000, day: 1 },
      ],
    },
  ],

  // ---- 대출 ----
  loans: [
    { id: "loan1", name: "iM웰컴대경 청년 신용대출", balance: 8_000_000, rate: "연 3.2%", monthlyPay: 210_000, dsrIncluded: false, nextDue: "2026-08-25", term: "36개월" },
  ],

  // ---- 최근 이체처 ----
  payees: [
    { id: "p1", name: "황손자", alias: ["손자", "손주", "조카"], bank: "iM뱅크", account: "504-11-227890", lastAmount: 300_000, lastDate: "2026-06-05" },
    { id: "p2", name: "이순자", alias: ["엄마", "어머니", "모친"], bank: "국민은행", account: "123-45-674567", lastAmount: 500_000, lastDate: "2026-07-01" },
    { id: "p3", name: "박철수", alias: ["철수", "친구"], bank: "카카오뱅크", account: "3333-01-8888888", lastAmount: 50_000, lastDate: "2026-07-10" },
    { id: "p4", name: "김영희", alias: ["영희", "여자친구", "여친"], bank: "토스뱅크", account: "1000-22-334455", lastAmount: 120_000, lastDate: "2026-07-16" },
    { id: "p5", name: "황아버지", alias: ["아빠", "아버지", "부친"], bank: "iM뱅크", account: "504-99-112233", lastAmount: 1_000_000, lastDate: "2026-05-20" },
  ],

  // ---- 최근 거래내역 (조회용) ----
  transactions: [
    { date: "2026-07-17", desc: "스타벅스 동대구점", amount: -5_600, card: "card2" },
    { date: "2026-07-16", desc: "김영희 이체", amount: -120_000, account: "acc1" },
    { date: "2026-07-15", desc: "쿠팡", amount: -34_800, card: "card3" },
    { date: "2026-07-15", desc: "GS25 수성점", amount: -8_200, card: "card2" },
    { date: "2026-07-14", desc: "급여 (주식회사 대구테크)", amount: +2_650_000, account: "acc1" },
    { date: "2026-07-10", desc: "박철수 이체", amount: -50_000, account: "acc1" },
    { date: "2026-07-08", desc: "배달의민족", amount: -23_000, card: "card3" },
    { date: "2026-07-05", desc: "쿠팡 와우멤버십", amount: -7_890, card: "card3" },
  ],

  // ---- 발급 가능 증명서 (실제 iM: 종합정보관리 > 제증명발급) ----
  documents: [
    { id: "doc_balance", name: "예금잔액증명서", forWhat: ["종합부동산세", "종부세", "세금", "대출", "제출", "잔액", "비자", "유학", "재산"] },
    { id: "doc_trans", name: "예금거래내역확인서", forWhat: ["소득", "증빙", "제출", "거래", "내역", "재직", "회사"] },
    { id: "doc_fin", name: "금융거래확인서", forWhat: ["금융거래", "제출", "확인"] },
    { id: "doc_loan", name: "부채증명서", forWhat: ["대출", "부채", "제출"] },
    { id: "doc_pay", name: "납입증명서", forWhat: ["납입", "적금", "연말정산", "소득공제", "청약", "연금", "낸거", "낸것"] },
  ],

  // 목적별 서류 세트 (익숙지 않은 상황 → 뭐가 필요한지 묶어서 안내)
  documentSets: [
    { purpose: "종부세", label: "종합부동산세", docs: ["doc_balance"], note: "종합부동산세는 홈택스 고지서로 납부하시면 되고, 은행에서 따로 떼야 하는 서류는 없어요. 다만 재산·잔액 증빙이 필요하시면 예금잔액증명서를 발급해드릴 수 있어요." },
    { purpose: "연말정산", label: "연말정산 소득공제", docs: ["doc_pay"], note: "주택청약·연금저축 납입증명서가 소득공제용으로 쓰여요." },
    { purpose: "소득증빙", label: "재직·소득 증빙", docs: ["doc_trans"], note: "급여 입금 내역이 담긴 거래내역확인서를 회사에 제출하면 돼요." },
    { purpose: "대출증빙", label: "대출 관련 제출", docs: ["doc_balance", "doc_loan"], note: "잔액증명서와 부채증명서 둘 다 필요할 수 있어요." },
    { purpose: "유학비자", label: "유학·비자 신청", docs: ["doc_balance"], note: "잔액증명서(영문 발급 가능)가 필요해요." },
  ],

  // ---- 공과금/세금 종류 (실제 iM: 전체메뉴 > 공과금) ----
  billTypes: [
    { key: "지방세", desc: "취득세·재산세·자동차세 등" },
    { key: "국세", desc: "소득세·부가세 등 (국세/관세/국고)" },
    { key: "생활요금", desc: "전기·가스·수도·통신" },
    { key: "지로", desc: "지로 고지서 납부" },
    { key: "연금보험료", desc: "국민연금·건강보험 등" },
    { key: "대학등록금", desc: "대학(원) 등록금" },
    { key: "범칙금", desc: "교통 범칙금·과태료" },
  ],

  // ---- 한도 ----
  limits: {
    dailyTransfer: 5_000_000,
    oncePerTransfer: 1_000_000,
  },
};

// 화폐 포맷
function won(n) {
  return n.toLocaleString("ko-KR") + "원";
}

// 이름/별칭으로 이체처 찾기
function findPayee(text) {
  const t = (text || "").replace(/\s/g, "");
  return BANK_DATA.payees.find(p =>
    t.includes(p.name) || p.alias.some(a => t.includes(a))
  ) || null;
}
