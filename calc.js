// 가계부 계산 — reference/ledger_app.html 의 compute()와 날짜 유틸을 식 변경 없이 옮김.
// 매장_가계부.xlsx '월별 현황'과 같은 결과를 내야 한다 (tests/calc.test.js).
// 브라우저: 전역 LedgerCalc / Node: module.exports
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.LedgerCalc = api;
})(typeof self !== "undefined" ? self : this, function () {
  // DCF 모델 예시 매장 값 (매장_가계부.xlsx '계획' 시트와 같음). 계획을 저장하기 전까지 쓰는 기본값.
  const DEFAULT_PLAN = {
    bev: 13620000, alc: 4120000, food: 8100000, cust: 150, days: 26, vat: 0.1,
    cogs: 0.2922790247678019, deemed: 9 / 109, fee: 0.003325,
    labor: 6639257, rent: 3000000, mgmt: 300000, elec: 450000, water: 80000, other: 1200000, ownh: 250000, int: 114583,
    bep: 18558839,
  };
  const CATS = [["bev", "음료"], ["alc", "주류"], ["food", "음식"]];
  const MONTH_KEYS = ["wage", "ins", "sev", "rent", "mgmt", "elec", "water", "card", "other", "ownh", "int"];

  const isNum = (v) => typeof v === "number" && isFinite(v);
  const N = (v) => (isNum(v) ? v : 0);
  const pad = (n) => String(n).padStart(2, "0");
  const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const parseYmd = (s) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
  const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
  const mondayOf = (d) => addDays(d, -((d.getDay() + 6) % 7));
  const ymOfWeek = (mondayStr) => { const t = addDays(parseYmd(mondayStr), 3); return `${t.getFullYear()}-${pad(t.getMonth() + 1)}`; };
  const ymLabel = (ym) => { const [y, m] = ym.split("-").map(Number); return `${y}년 ${m}월`; };
  const addMonths = (ym, n) => { const [y, m] = ym.split("-").map(Number); const d = new Date(y, m - 1 + n, 1); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`; };
  const weeksInMonth = (ym) => {
    const [y, m] = ym.split("-").map(Number); let c = 0;
    for (let d = mondayOf(new Date(y, m - 1, 1)); d <= new Date(y, m, 0); d = addDays(d, 7)) if (ymOfWeek(ymd(d)) === ym) c++;
    return c;
  };
  const weekSales = (w) => N(w.bev) + N(w.alc) + N(w.food);
  const weeklyPlan = (P) => (P.bev + P.alc + P.food) * 12 / 52;

  function compute(weeks, months, P) {
    const vat = P.vat, ex = (x) => x / (1 + vat), vin = (x) => (x * vat) / (1 + vat);
    const wkPlan = (P.bev + P.alc + P.food) * 12 / 52;
    const keys = new Set([...[...weeks.keys()].map(ymOfWeek), ...months.keys()]);
    const rows = []; let cum = 0;
    for (const ym of [...keys].sort()) {
      const ws = [...weeks.entries()].filter(([id]) => ymOfWeek(id) === ym).map(([, w]) => w);
      const salesOf = (w) => (isNum(w.bev) || isNum(w.alc) || isNum(w.food) ? N(w.bev) + N(w.alc) + N(w.food) : null);
      const T = ws.filter((w) => salesOf(w) > 0).length, U = weeksInMonth(ym);
      if (T === 0) continue;
      const sum = (k) => ws.reduce((a, w) => a + N(w[k]), 0);
      const sales = ws.reduce((a, w) => a + N(salesOf(w)), 0);
      const cat = Object.fromEntries(CATS.map(([k]) => [k, sum(k)]));
      const cust = sum("cust"), tax = sum("tax"), free = sum("free"), etc = sum("etc");
      const m = months.get(ym) || {}; const MV = (k) => N(m[k]);
      const noM = !MONTH_KEYS.some((k) => isNum(m[k]));
      const labor = MV("wage") + MV("ins") + MV("sev");
      const vatItems = MV("rent") + MV("mgmt") + MV("elec") + MV("other");
      const fixed = labor + ex(vatItems) + MV("water") + MV("ownh") + MV("int");
      const card = isNum(m.card) ? m.card : sales * P.fee;
      const vres = Math.max(0, vin(sales) - (vin(tax) + vin(etc) + vin(vatItems)) - free * P.deemed);
      const left = sales - tax - free - etc - labor - (vatItems + MV("water") + MV("ownh") + MV("int")) - card - vres;
      cum += left;
      const varRate = (ex(tax) + free * (1 - P.deemed) + ex(etc) + card) / ex(sales);
      const bep = noM ? null : 1 - varRate > 0 ? (fixed / (1 - varRate)) * (1 + vat) : "산출불가";
      rows.push({ ym, T, U, done: T >= U, noM, cardEst: !isNum(m.card), sales, plan: T * wkPlan, rate: sales / (T * wkPlan), cust,
                  aov: cust ? sales / cust : null, cogsRate: (ex(tax) + free) / ex(sales), labor: noM ? null : labor,
                  laborRate: noM ? null : labor / ex(sales), fixed, card, vres, left, cum, bep, cat });
    }
    // 최근 4주 평균 (마지막으로 매출을 적은 주 포함 4주 중 매출 > 0 인 주)
    const entered = [...weeks.entries()].filter(([, w]) => isNum(w.bev) || isNum(w.alc) || isNum(w.food)).map(([id]) => id).sort();
    let recent = null;
    if (entered.length) {
      const lastId = entered[entered.length - 1], from = ymd(addDays(parseYmd(lastId), -21));
      const vals = [...weeks.entries()].filter(([id]) => id >= from && id <= lastId)
        .map(([, w]) => N(w.bev) + N(w.alc) + N(w.food)).filter((v) => v > 0);
      if (vals.length) recent = { avg: vals.reduce((a, b) => a + b, 0) / vals.length, lastId, rate: vals.reduce((a, b) => a + b, 0) / vals.length / wkPlan };
    }
    return { rows, wkPlan, recent };
  }

  return { DEFAULT_PLAN, CATS, MONTH_KEYS, isNum, N, pad, ymd, parseYmd, addDays, mondayOf, ymOfWeek, ymLabel, addMonths,
           weeksInMonth, weekSales, weeklyPlan, compute };
});
