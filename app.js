// 매장 가계부 앱 로직 (index.html 에서 분리 — CSP로 인라인 스크립트를 막기 위함)
(() => {
  const C = window.LedgerCalc;
  const { DEFAULT_PLAN, CATS, isNum, N, ymd, parseYmd, addDays, mondayOf, ymOfWeek, ymLabel, addMonths, weeklyPlan } = C;

  const WEEK_FIELDS = [
    { g: "매출 (VAT 포함, POS 금액 그대로)" },
    { k: "bev", label: "음료 매출", hint: "커피·음료" }, { k: "alc", label: "주류 매출", hint: "맥주·하이볼·와인" },
    { k: "food", label: "음식 매출", hint: "분류를 모르면 한 칸에 합계만 넣어도 됩니다" },
    { k: "cust", label: "객수", hint: "결제 건수", unit: "명" },
    { g: "매입 · 지출" },
    { k: "tax", label: "재료 매입 — 과세", hint: "VAT 포함 · 주류·원두·공산품" },
    { k: "free", label: "재료 매입 — 면세", hint: "채소·고기·생선 등 (의제매입 공제 대상)" },
    { k: "etc", label: "기타 지출", hint: "소모품·포장재 등, VAT 포함" },
  ];
  const MONTH_FIELDS = [
    { g: "인건비" },
    { k: "wage", label: "직원 급여", hint: "세전 지급액 합계" }, { k: "ins", label: "4대보험 사업주 부담", hint: "고지서 기준" },
    { k: "sev", label: "퇴직금 적립 (선택)", hint: "대략 월 급여 ÷ 12" },
    { g: "임대 · 공과금" },
    { k: "rent", label: "임대료", hint: "VAT 포함" }, { k: "mgmt", label: "관리비", hint: "VAT 포함" },
    { k: "elec", label: "전기료", hint: "VAT 포함" }, { k: "water", label: "수도료", hint: "부가세 없음" },
    { g: "기타" },
    { k: "card", label: "카드수수료", hint: "정산 내역 합계. 비우면 계획 비율로 추정" },
    { k: "other", label: "기타 월 고정비", hint: "통신·보험·세무기장 등, VAT 포함" },
    { k: "ownh", label: "사장 본인 건강보험료" }, { k: "int", label: "대출이자" },
  ];
  const PLAN_FIELDS = [
    { g: "매장" },
    { k: "storeName", label: "매장 이름", text: true, hint: "화면 위쪽에 표시됩니다" },
    { g: "월 계획 매출 (VAT 포함, 정상 영업 기준)" },
    { k: "bev", label: "음료" }, { k: "alc", label: "주류" }, { k: "food", label: "음식" },
    { k: "cust", label: "계획 일 평균 객수", unit: "명" }, { k: "days", label: "월 영업일수", unit: "일" },
    { g: "비율" },
    { k: "cogs", label: "계획 재료비율 (%)", pct: true, hint: "VAT 뺀 매출 대비, 로스 포함" },
    { k: "deemed", label: "의제매입 공제율 (%)", pct: true, hint: "연 매출(VAT 뺀 금액) 4억 이하 9/109 ≈ 8.26%" },
    { k: "fee", label: "카드수수료율 (%)", pct: true, hint: "전체 매출 대비. 월 비용에 카드수수료를 안 적으면 이 비율로 추정" },
    { k: "vat", label: "부가세율 (%)", pct: true, hint: "일반과세자 10%" },
    { g: "월 고정비 계획" },
    { k: "labor", label: "인건비", hint: "급여·주휴·4대보험·퇴직금" }, { k: "rent", label: "임대료", hint: "VAT 별도" },
    { k: "mgmt", label: "관리비", hint: "VAT 별도" }, { k: "elec", label: "전기료", hint: "VAT 별도" }, { k: "water", label: "수도료" },
    { k: "other", label: "기타 월 고정비", hint: "VAT 별도" }, { k: "ownh", label: "사장 본인 건강보험료" }, { k: "int", label: "대출이자" },
    { k: "bep", label: "계획 손익분기 월매출", hint: "VAT 포함, 현금 기준 (DCF 모델 ① 현금 BEP)" },
  ];
  const GLOSS = [
    ["귀속 월", "주가 두 달에 걸치면 목요일이 속한 달로 셉니다 (그 주의 4일 이상이 그 달)."],
    ["계획 (입력한 주 기준)", "주간 계획 매출 × 입력한 주 수. 4주짜리 달과 5주짜리 달을 공정하게 비교하려는 방식입니다. 주간 계획 = 월 계획 × 12 ÷ 52."],
    ["달성률", "매출 ÷ 계획. 90% 미만은 빨강, 100% 이상은 초록으로 표시합니다."],
    ["재료비율", "재료 매입액(VAT 뺀 금액) ÷ 매출(VAT 뺀 금액). 매입 기준이라 재고를 몰아 산 달은 높게 나오니 몇 달 평균으로 보세요."],
    ["인건비율", "인건비 ÷ 매출(VAT 뺀 금액). 월 비용을 입력해야 계산됩니다."],
    ["고정비", "매출과 상관없이 나가는 돈: 인건비 + 임대료·관리비·전기·수도·기타 고정비 + 사장 건강보험 + 대출이자 (부가세는 돌려받으니 뺀 금액)."],
    ["부가세 모아둘 돈", "이번 달 매출로 생긴 부가세 − 매입 때 낸 부가세 − 의제매입 공제. 부가세는 1월·7월에 몰아서 내므로 매달 떼어 두세요. 카드매출 세액공제는 빼고 계산해 실제 납부액은 조금 적을 수 있습니다."],
    ["남은 돈", "매출 입금 − 모든 지출 − 부가세 모아둘 돈. 종합소득세(다음 해 5월) 내기 전 사장님 몫으로 남은 현금입니다."],
    ["손익분기 매출 (실적)", "이번 달 실제 고정비와 재료비율로 계산한, 남는 돈이 0이 되는 월 매출. 매출이 이보다 높아야 흑자입니다."],
    ["의제매입 공제", "채소·고기·생선처럼 부가세가 없는 식재료를 사도, 음식점은 산 금액의 일정 비율을 부가세에서 빼 줍니다."],
    ["객단가", "손님 1명(결제 1건)이 평균적으로 쓴 금액 = 매출 ÷ 객수."],
  ];
  const WEEK_COLS = ["bev", "alc", "food", "cust", "tax", "free", "etc"];
  const MONTH_COLS = { wage: "wage", ins: "ins", sev: "sev", rent: "rent", mgmt: "mgmt", elec: "elec", water: "water",
                       card: "card", other: "other", ownh: "ownh", int: "interest" };   // calc 키 → DB 컬럼
  const MENU_CATS = [["bev", "음료"], ["alc", "주류"], ["food", "음식"]];   // weeks 매출 칸과 같은 키
  const OWNER_TABS = [["dash", "현황"], ["week", "주간 입력"], ["menu", "메뉴"], ["month", "월 비용"], ["plan", "계획"], ["members", "구성원"]];
  const STAFF_TABS = [["week", "주간 입력"]];
  const APP_URL = location.origin + location.pathname;

  // ---------- 유틸 ----------
  const $ = (s) => document.querySelector(s);
  const el = (tag, props = {}, ...kids) => { const n = document.createElement(tag); Object.assign(n, props); for (const k of kids) n.append(k); return n; };
  const won = (v) => (isNum(v) ? Math.round(v).toLocaleString("ko-KR") : "–");
  const pct = (v) => (isNum(v) ? (v * 100).toFixed(1) + "%" : "–");
  const numOrNull = (v) => (v === null || v === undefined || v === "" ? null : Number(v));
  const parseMoney = (s) => { const t = String(s).replace(/[^\d.]/g, ""); return t === "" ? null : Number(t); };
  const store = { get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} } };
  let toastTimer;
  const toast = (msg) => { const t = $("#toast"); t.textContent = msg; t.hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => (t.hidden = true), 3000); };
  const errText = (e) => {
    if (!e) return "알 수 없는 문제가 생겼어요.";
    if (e.friendly) return e.friendly;
    const msg = String(e.message || "");
    if (e.code === "42501" || /row-level security|permission denied|forbidden/i.test(msg)) return "권한이 없어요. 사장님께 확인해 주세요.";
    if (e.code === "23505") return "이미 있는 항목이에요.";
    if (e.code === "23514") return "입력값이 허용 범위를 벗어났어요. 음수는 넣을 수 없어요.";
    if (e.status === 429 || /rate limit|too many/i.test(msg)) return "요청이 너무 잦아요. 잠시 후 다시 시도해 주세요.";
    if (/Failed to fetch|NetworkError|Load failed/i.test(msg)) return "인터넷 연결을 확인해 주세요.";
    return "처리하지 못했어요: " + msg;
  };

  // ---------- 상태 ----------
  const S = {
    sb: null, user: null, stores: [], cur: null,            // cur = { store_id, name, role }
    weeks: new Map(), months: new Map(), plan: { ...DEFAULT_PLAN }, planSaved: false, invites: [], members: [],
    view: "week", wk: ymd(mondayOf(new Date())), mo: null, loading: false,
    dirty: { w: false, m: false, p: false },
    admin: false, creators: [],   // 관리자 모드: 화면 표시용 판단일 뿐, 실제 권한은 서버 함수가 매번 확인
    menus: [], items: new Map(), menuReady: false, menuEdit: null, wkRows: [],   // 판매 메뉴 · 주별 메뉴 수량(week_start → 배열)
  };
  S.mo = ymOfWeek(S.wk);
  const isOwner = () => S.cur && S.cur.role === "owner";
  const storeTabs = () => (S.cur ? (isOwner() ? OWNER_TABS : STAFF_TABS) : []);

  // ---------- 화면 전환 ----------
  const SCREENS = ["screen-config", "screen-login", "screen-nostore", "view-dash", "view-week", "view-menu", "view-month", "view-plan", "view-members", "view-admin"];
  function show(id) { for (const s of SCREENS) $("#" + s).hidden = s !== id; }

  // ---------- 폼 공통 ----------
  function buildFields(container, spec, prefix) {
    container.replaceChildren();
    for (const f of spec) {
      if (f.g) { container.append(el("div", { className: "group-title", textContent: f.g })); continue; }
      const id = `${prefix}-${f.k}`;
      const input = el("input", { id, name: f.k, type: "text", inputMode: f.text ? "text" : "decimal", className: f.text ? "" : "money" });
      if (f.text) input.maxLength = 60;
      if (!f.text) {
        input.addEventListener("focus", () => { input.value = input.value.replace(/,/g, ""); });
        input.addEventListener("blur", () => { const v = parseMoney(input.value); input.value = v == null ? "" : f.pct ? String(v) : v.toLocaleString("ko-KR"); });
      }
      const lab = el("label", { htmlFor: id, textContent: f.label + (f.unit ? ` (${f.unit})` : f.text || f.pct ? "" : " (원)") });
      container.append(el("div", { className: "field" }, lab, input, f.hint ? el("div", { className: "hint", textContent: f.hint }) : ""));
    }
    if (prefix === "w" || prefix === "m") container.append(el("div", { className: "field", style: "grid-column:1/-1" },
      el("label", { htmlFor: `${prefix}-memo`, textContent: "메모" }),
      el("textarea", { id: `${prefix}-memo`, name: "memo", maxLength: 500, placeholder: prefix === "w" ? "행사·날씨·휴무 등" : "" })));
  }
  function fillForm(prefix, spec, data) {
    for (const f of spec) {
      if (f.g) continue;
      const input = $(`#${prefix}-${f.k}`); let v = data ? data[f.k] : null;
      if (f.text) { input.value = v || ""; continue; }
      if (f.pct && isNum(v)) v = Math.round(v * 10000) / 100;
      input.value = isNum(v) ? (f.pct ? String(v) : v.toLocaleString("ko-KR")) : "";
    }
    const memo = $(`#${prefix}-memo`); if (memo) memo.value = (data && data.memo) || "";
    S.dirty[prefix] = false;
  }
  function readForm(prefix, spec) {
    const out = {};
    for (const f of spec) {
      if (f.g) continue;
      const raw = $(`#${prefix}-${f.k}`).value;
      if (f.text) { out[f.k] = raw.trim(); continue; }
      let v = parseMoney(raw); if (f.pct && v != null) v = v / 100;
      out[f.k] = v;
    }
    const memo = $(`#${prefix}-memo`); if (memo) out.memo = memo.value.trim();
    return out;
  }
  function armDelete(btn, label, action) {
    let armed = false, timer, orig = label;
    const reset = () => { armed = false; clearTimeout(timer); btn.classList.remove("armed"); btn.textContent = orig; };
    btn.addEventListener("click", async () => {
      // 누르기 직전 글자를 기억했다가 되돌림 (상태에 따라 글자가 바뀌는 버튼 대응)
      if (!armed) { orig = btn.textContent || label; armed = true; btn.classList.add("armed"); btn.textContent = "한 번 더 누르면 실행"; timer = setTimeout(reset, 3500); return; }
      reset(); await action();
    });
  }
  async function run(btn, fn, okMsg) {
    if (btn) btn.disabled = true;
    try { await fn(); if (okMsg) toast(okMsg); return true; }
    catch (e) { toast(errText(e)); return false; }
    finally { if (btn) btn.disabled = false; }
  }
  const must = ({ data, error }) => { if (error) throw error; return data; };

  // ---------- 데이터 ----------
  async function loadStores() {
    S.stores = must(await S.sb.rpc("my_stores")) || [];
    const last = store.get("ledger.store");
    S.cur = S.stores.find((s) => s.store_id === last) || S.stores[0] || null;
  }
  async function loadStoreData() {
    if (!S.cur) return;
    const id = S.cur.store_id;
    const weeks = must(await S.sb.from("weeks").select("week_start," + WEEK_COLS.join(",") + ",memo").eq("store_id", id));
    S.weeks = new Map(weeks.map((r) => [r.week_start, Object.fromEntries([...WEEK_COLS.map((k) => [k, numOrNull(r[k])]), ["memo", r.memo]])]));
    await loadMenus();
    if (isOwner()) {
      const months = must(await S.sb.from("months").select("month," + Object.values(MONTH_COLS).join(",") + ",memo").eq("store_id", id));
      S.months = new Map(months.map((r) => [r.month.slice(0, 7),
        Object.fromEntries([...Object.entries(MONTH_COLS).map(([k, col]) => [k, numOrNull(r[col])]), ["memo", r.memo]])]));
      const plans = must(await S.sb.from("store_plans").select("plan").eq("store_id", id));
      const saved = (plans[0] && plans[0].plan) || {};
      S.planSaved = Object.keys(saved).length > 0;
      S.plan = { ...DEFAULT_PLAN };
      for (const k of Object.keys(DEFAULT_PLAN)) if (isNum(saved[k])) S.plan[k] = saved[k];
    } else {
      S.months = new Map(); S.plan = { ...DEFAULT_PLAN }; S.planSaved = false;   // 직원은 계획·월 비용을 요청하지 않음
    }
  }
  // 004_menu.sql 을 아직 실행하지 않은 서버면 메뉴 기능만 끄고 나머지는 그대로 동작
  const missingTable = (e) => e && (e.code === "42P01" || e.code === "PGRST205" || /does not exist|schema cache/i.test(String(e.message || "")));
  async function loadMenus() {
    const id = S.cur.store_id;
    const m = await S.sb.from("menu_items").select("id,name,cat,price,sort").eq("store_id", id).order("sort").order("name");
    if (missingTable(m.error)) { S.menuReady = false; S.menus = []; S.items = new Map(); return; }
    S.menuReady = true;
    S.menus = must(m).map((r) => ({ ...r, price: Number(r.price) }));
    const items = must(await S.sb.from("week_items").select("week_start,name,menu_id,cat,price,qty").eq("store_id", id));
    S.items = new Map();
    for (const r of items) {
      if (!S.items.has(r.week_start)) S.items.set(r.week_start, []);
      S.items.get(r.week_start).push({ ...r, price: Number(r.price), qty: Number(r.qty) });
    }
  }
  async function loadMembers() {
    if (!isOwner()) return;
    const id = S.cur.store_id;
    S.members = must(await S.sb.rpc("store_member_list", { p_store: id })) || [];
    S.invites = must(await S.sb.from("invites").select("id,email,created_at").eq("store_id", id).is("accepted_at", null).order("created_at")) || [];
  }
  async function refresh() {
    if (!S.cur || S.loading) return;
    S.loading = true;
    try { await loadStoreData(); if (S.view === "members") await loadMembers(); render(); }
    catch (e) { toast(errText(e)); }
    finally { S.loading = false; }
  }

  // ---------- 렌더 ----------
  function renderHeader() {
    $("#acct").hidden = !S.user;
    $("#meEmail").textContent = S.user ? S.user.email : "";
    const sel = $("#storeSelect"); sel.replaceChildren();
    for (const s of S.stores) sel.append(el("option", { value: s.store_id, textContent: s.name, selected: S.cur && s.store_id === S.cur.store_id }));
    sel.append(el("option", { value: "__new", textContent: "+ 새 매장 만들기" }));
    sel.hidden = !S.stores.length;
    const rp = $("#rolePill");
    rp.hidden = !S.cur; rp.textContent = isOwner() ? "사장" : "직원"; rp.className = "pill" + (isOwner() ? " good" : "");
    $("#storeTitle").textContent = S.cur ? `${S.cur.name} 가계부` : "매장 주간 가계부";
    const tabs = $("#tabs"); tabs.replaceChildren();
    const list = [...storeTabs(), ...(S.admin && S.cur ? [["admin", "관리자"]] : [])];
    tabs.hidden = list.length < 2;
    for (const [v, label] of list) {
      const b = el("button", { type: "button", textContent: label }); b.setAttribute("role", "tab"); b.setAttribute("aria-selected", String(v === S.view));
      b.addEventListener("click", async () => {
        S.view = v; if (v !== "admin") store.set("ledger.view", v);
        if (v === "members") await run(null, loadMembers);
        if (v === "admin") await run(null, loadCreators);
        render(); window.scrollTo({ top: 0 });
      });
      tabs.append(b);
    }
  }
  function render() {
    renderHeader();
    if (S.view === "admin" && S.admin) { show("view-admin"); renderAdmin(); return; }
    if (!S.cur) return;
    const allowed = (isOwner() ? OWNER_TABS : STAFF_TABS).map(([v]) => v);
    if (!allowed.includes(S.view)) S.view = allowed[0];
    show("view-" + S.view);
    ({ dash: renderDash, week: renderWeek, menu: renderMenu, month: renderMonth, plan: renderPlan, members: renderMembers })[S.view]();
  }

  function statusPill(r) { return el("span", { className: "pill " + (r.done ? "" : "warn"), textContent: r.done ? "마감" : `진행 중 ${r.T}/${r.U}주` }); }
  function renderDash() {
    const { rows, wkPlan, recent } = C.compute(S.weeks, S.months, S.plan);
    const cur = rows[rows.length - 1];
    const k = $("#kpis"); k.replaceChildren();
    const kpi = (label, value, foot, opts = {}) => {
      const lab = el("div", { className: "kpi-label" }, el("span", { textContent: label }));
      if (opts.pill) lab.append(opts.pill);
      k.append(el("div", { className: "kpi" }, lab, el("div", { className: "kpi-value" + (opts.neg ? " neg" : ""), textContent: value }), el("div", { className: "kpi-foot", textContent: foot })));
    };
    if (cur) {
      kpi(`${ymLabel(cur.ym)} 매출`, won(cur.sales) + "원", `계획 ${won(cur.plan)}원 대비 ${pct(cur.rate)}`, { pill: statusPill(cur) });
      kpi(`${ymLabel(cur.ym)} 남은 돈`, won(cur.left) + "원", cur.noM ? "월 비용 미입력 — 실제보다 크게 나옵니다" : "소득세 내기 전, 사장님 몫", { neg: cur.left < 0 });
    } else {
      kpi("이번 달 매출", "–", "'주간 입력'에서 첫 주를 저장하면 계산됩니다");
      kpi("이번 달 남은 돈", "–", "");
    }
    kpi("부가세 모아둘 돈 (누적)", won(rows.reduce((a, r) => a + r.vres, 0)) + "원", "1월·7월 신고 때 낼 돈. 통장에 따로 두세요");
    kpi("최근 4주 평균 주간 매출", recent ? won(recent.avg) + "원" : "–", recent ? `주간 계획 ${won(wkPlan)}원 대비 ${pct(recent.rate)}` : "");
    renderChart(rows.slice(-12));
    const cats = $("#cats"); cats.replaceChildren();
    $("#catTitle").textContent = cur ? `분류별 매출 — ${ymLabel(cur.ym)}` : "분류별 매출";
    if (cur) for (const [key, name] of CATS) {
      const plan = S.plan[key] * 12 / 52 * cur.T, act = cur.cat[key], r = plan ? act / plan : null;
      const bar = el("span", { className: r == null ? "" : r < 0.9 ? "bad" : r >= 1 ? "good" : "" });
      bar.style.width = Math.min(100, (r || 0) * 100) + "%";
      cats.append(el("div", { className: "cat" },
        el("div", { className: "row", style: "justify-content:space-between" }, el("b", { textContent: name }), el("span", { className: "num small", textContent: pct(r) })),
        el("div", { className: "meter" }, bar),
        el("div", { className: "muted small num", textContent: `${won(act)} / 계획 ${won(plan)}원` })));
    }
    else cats.append(el("p", { className: "muted small", style: "margin:0", textContent: "입력한 주가 생기면 분류별 달성률이 보입니다." }));
    const t = $("#monthTable"); t.replaceChildren();
    const heads = ["월", "상태", "매출", "계획", "달성률", "객수", "객단가", "재료비율", "인건비율", "고정비", "카드수수료", "부가세 모아둘 돈", "남은 돈", "누적 남은 돈", "손익분기 (실적)", "손익분기 (계획)"];
    t.append(el("thead", {}, el("tr", {}, ...heads.map((h, i) => el("th", { className: i < 2 ? "l" : "", textContent: h })))));
    const tb = el("tbody");
    for (const r of [...rows].reverse()) {
      const st = el("td", { className: "l" }, statusPill(r));
      if (r.noM) st.append(" ", el("span", { className: "pill warn", textContent: "월 비용 미입력" }));
      else if (r.cardEst) st.append(" ", el("span", { className: "pill", textContent: "카드수수료 추정" }));
      const td = (v, cls = "") => el("td", { className: cls, textContent: v });
      tb.append(el("tr", {},
        td(ymLabel(r.ym), "l strong"), st, td(won(r.sales), "strong"), td(won(r.plan)),
        td(pct(r.rate), r.rate < 0.9 ? "bad" : r.rate >= 1 ? "good" : ""), td(won(r.cust)), td(won(r.aov)),
        td(pct(r.cogsRate), r.cogsRate > S.plan.cogs + 0.03 ? "bad" : ""), td(pct(r.laborRate)), td(r.noM ? "–" : won(r.fixed)),
        td(won(r.card)), td(won(r.vres)), td(won(r.left), "strong" + (r.left < 0 ? " bad" : "")), td(won(r.cum)),
        td(typeof r.bep === "string" ? r.bep : won(r.bep)), td(won(S.plan.bep))));
    }
    if (!rows.length) tb.append(el("tr", {}, el("td", { colSpan: heads.length, className: "l muted", textContent: "아직 입력한 주가 없습니다." })));
    t.append(tb);
  }
  function renderChart(rows) {
    const box = $("#chart"); box.replaceChildren();
    if (!rows.length) { box.append(el("p", { className: "muted small", textContent: "입력한 주가 생기면 월별 막대가 그려집니다." })); return; }
    const W = 640, H = 230, L = 52, R = 10, T = 12, B = 28, NS = "http://www.w3.org/2000/svg";
    const max = Math.max(...rows.map((r) => Math.max(r.sales, r.plan)), S.plan.bep) * 1.08;
    const step = [1e6, 2e6, 5e6, 1e7, 2e7, 5e7, 1e8].find((s) => max / s <= 5) || 1e8;
    const y = (v) => T + (H - T - B) * (1 - v / max);
    const svg = document.createElementNS(NS, "svg"); svg.setAttribute("viewBox", `0 0 ${W} ${H}`); svg.setAttribute("role", "img");
    svg.setAttribute("aria-label", "월 매출과 계획, 손익분기 매출 막대 그래프");
    const add = (tag, attrs, text) => { const n = document.createElementNS(NS, tag); for (const [a, v] of Object.entries(attrs)) n.setAttribute(a, v); if (text != null) n.textContent = text; svg.append(n); return n; };
    for (let v = 0; v <= max; v += step) {
      add("line", { x1: L, x2: W - R, y1: y(v), y2: y(v), class: "grid" });
      add("text", { x: L - 6, y: y(v) + 4, "text-anchor": "end", class: "axis" }, v === 0 ? "0" : (v / 1e4).toLocaleString("ko-KR") + "만");
    }
    const bw = (W - L - R) / rows.length, pad = Math.min(14, bw * 0.22);
    rows.forEach((r, i) => {
      const x = L + i * bw + pad, w = bw - pad * 2;
      add("rect", { x, y: y(r.sales), width: w, height: y(0) - y(r.sales), class: "bar" + (r.rate >= 1 ? " hit" : ""), rx: 2 });
      add("line", { x1: x - 3, x2: x + w + 3, y1: y(r.plan), y2: y(r.plan), class: "plan" });
      add("text", { x: x + w / 2, y: H - 9, "text-anchor": "middle", class: "axis" }, Number(r.ym.slice(5)) + "월" + (r.done ? "" : "*"));
    });
    add("line", { x1: L, x2: W - R, y1: y(S.plan.bep), y2: y(S.plan.bep), class: "bep" });
    box.append(svg);
    if (rows.some((r) => !r.done)) box.append(el("p", { className: "muted small", style: "margin:4px 0 0", textContent: "* 아직 입력 중인 달 — 계획도 입력한 주 수만큼만 잡았습니다." }));
  }

  function renderWeek() {
    const mon = parseYmd(S.wk), sun = addDays(mon, 6), ym = ymOfWeek(S.wk);
    $("#wkLabel").textContent = `${mon.getMonth() + 1}월 ${mon.getDate()}일(월) ~ ${sun.getMonth() + 1}월 ${sun.getDate()}일(일)`;
    $("#wkNote").textContent = `${ymLabel(ym)}로 집계됩니다.` + (mon.getMonth() !== sun.getMonth() ? " 두 달에 걸친 주라 목요일이 속한 달로 셉니다." : "");
    const data = S.weeks.get(S.wk);
    const st = $("#wkState"); st.textContent = data ? "저장됨" : "아직 없음"; st.className = "pill" + (data ? " good" : "");
    if (!S.dirty.w) {
      // 이전 주의 자동 계산 잠금을 먼저 풀고 채워야, 메뉴 수량이 없는 주의 직접 입력 금액이 지워지지 않음
      for (const [k] of MENU_CATS) { const i = $("#w-" + k); i.readOnly = false; delete i.dataset.auto; }
      fillForm("w", WEEK_FIELDS, data);
      renderMenuQty();
    }
    menuSync();
    $("#weekDel").hidden = !data || !isOwner();
    $("#leaveCard").hidden = isOwner();
    weekLive();
    const list = $("#weekList"); list.replaceChildren();
    const ids = [...S.weeks.keys()].sort().reverse().slice(0, 10);
    const wkPlan = weeklyPlan(S.plan);
    for (const id of ids) {
      const s = C.weekSales(S.weeks.get(id)), d = parseYmd(id);
      const right = el("span", { className: "row" }, el("span", { className: "amt", textContent: won(s) + "원" }));
      if (isOwner()) { const r = s / wkPlan; right.append(el("span", { className: "pill " + (r < 0.9 ? "bad" : r >= 1 ? "good" : ""), textContent: pct(r) })); }
      const b = el("button", { type: "button" }, el("span", { textContent: `${d.getMonth() + 1}/${d.getDate()} 주` + (id === S.wk ? " · 보는 중" : "") }), right);
      b.addEventListener("click", () => { S.wk = id; S.dirty.w = false; renderWeek(); window.scrollTo({ top: 0 }); });
      list.append(b);
    }
    if (!ids.length) list.append(el("p", { className: "muted small", style: "margin:0", textContent: "저장한 주가 아직 없습니다." }));
  }
  // 이 주에 보여 줄 메뉴 줄: 현재 메뉴 + (지웠거나 바뀐) 저장된 수량. 저장된 줄은 저장 당시 가격을 유지.
  function weekRows() {
    const saved = [...(S.items.get(S.wk) || [])];
    const take = (pred) => { const i = saved.findIndex(pred); return i < 0 ? null : saved.splice(i, 1)[0]; };
    const rows = S.menus.map((m) => {
      const s = take((x) => x.menu_id === m.id) || take((x) => !x.menu_id && x.name === m.name && x.cat === m.cat);
      return { menu_id: m.id, name: m.name, cat: m.cat, price: s ? s.price : m.price, qty: s ? s.qty : null, oldPrice: !!s && s.price !== m.price };
    });
    for (const s of saved) rows.push({ menu_id: null, name: s.name, cat: s.cat, price: s.price, qty: s.qty, gone: true });
    return rows;
  }
  function renderMenuQty() {
    const box = $("#menuQty"); box.replaceChildren();
    S.wkRows = S.menuReady ? weekRows() : [];
    if (!S.wkRows.length) {
      box.hidden = !(S.menuReady && isOwner());
      box.append(el("p", { className: "muted small", style: "margin:0", textContent: "'메뉴' 탭에서 판매 메뉴와 가격을 등록하면, 여기서 수량만 넣어 매출을 계산할 수 있어요." }));
      return;
    }
    box.hidden = false;
    box.append(el("div", { className: "group-title", style: "margin:0", textContent: "메뉴별 판매 수량" }),
      el("div", { className: "hint muted small", textContent: "수량을 넣은 분류는 아래 매출 칸이 자동으로 계산됩니다. 수량이 없는 분류는 금액을 직접 넣으세요." }));
    S.wkRows.forEach((r, i) => { r.i = i; });
    for (const [cat, label] of MENU_CATS) {
      const rows = S.wkRows.filter((r) => r.cat === cat);
      if (!rows.length) continue;
      box.append(el("div", { className: "mq-cat" }, el("span", { textContent: label }), el("span", { className: "num", id: "mq-sum-" + cat })));
      for (const r of rows) {
        const id = "mq-" + r.i;
        const input = el("input", { id, type: "text", inputMode: "decimal", value: isNum(r.qty) ? String(r.qty) : "", placeholder: "0" });
        input.dataset.row = String(r.i);
        const name = el("label", { htmlFor: id, className: "name", textContent: r.name });
        if (r.gone) name.append(" ", el("span", { className: "pill warn", textContent: "지운 메뉴" }));
        else if (r.oldPrice) name.append(" ", el("span", { className: "pill", textContent: "저장 당시 가격" }));
        box.append(el("div", { className: "mq-row" }, name, el("span", { className: "muted num", textContent: won(r.price) + "원 ×" }), input,
          el("span", { className: "amt", id: "mq-amt-" + r.i })));
      }
    }
  }
  // 수량 → 줄 금액·분류 합계 → 매출 칸. 수량이 하나라도 있는 분류는 칸을 잠그고 합계로 채움.
  function menuSync() {
    const sums = {};
    for (const r of S.wkRows) {
      const input = $("#mq-" + r.i); if (!input) continue;
      r.qty = parseMoney(input.value);
      const amt = isNum(r.qty) && r.qty > 0 ? r.price * r.qty : null;
      $("#mq-amt-" + r.i).textContent = amt == null ? "" : won(amt) + "원";
      if (amt != null) sums[r.cat] = (sums[r.cat] || 0) + amt;
    }
    for (const [cat] of MENU_CATS) {
      const f = $("#w-" + cat), sum = $("#mq-sum-" + cat);
      if (sum) sum.textContent = cat in sums ? won(sums[cat]) + "원" : "";
      if (cat in sums) { f.value = sums[cat].toLocaleString("ko-KR"); f.readOnly = true; f.dataset.auto = "1"; }
      else if (f.dataset.auto) { f.value = ""; f.readOnly = false; delete f.dataset.auto; }
    }
  }
  function weekLive() {
    const f = readForm("w", WEEK_FIELDS); const s = N(f.bev) + N(f.alc) + N(f.food);
    const parts = [el("span", {}, "매출 합계 ", el("b", { textContent: won(s) + "원" }))];
    if (isOwner()) parts.push(el("span", {}, "주간 계획 대비 ", el("b", { textContent: s ? pct(s / weeklyPlan(S.plan)) : "–" })));
    parts.push(el("span", {}, "객단가 ", el("b", { textContent: f.cust && s ? won(s / f.cust) + "원" : "–" })));
    $("#weekLive").replaceChildren(...parts);
  }
  function renderMonth() {
    $("#moLabel").textContent = ymLabel(S.mo);
    const data = S.months.get(S.mo);
    const st = $("#moState"); st.textContent = data ? "저장됨" : "아직 없음"; st.className = "pill" + (data ? " good" : "");
    if (!S.dirty.m) fillForm("m", MONTH_FIELDS, data);
    $("#monthDel").hidden = !data;
    const wsales = [...S.weeks.entries()].filter(([id]) => ymOfWeek(id) === S.mo).reduce((a, [, w]) => a + C.weekSales(w), 0);
    $("#m-card").placeholder = wsales ? `비우면 약 ${won(wsales * S.plan.fee)}원으로 추정` : "비우면 계획 비율로 추정";
  }
  function resetMenuForm() {
    S.menuEdit = null; $("#menuName").value = ""; $("#menuPrice").value = ""; $("#menuCat").value = "bev";
    $("#menuFormTitle").textContent = "메뉴 추가"; $("#menuSave").textContent = "메뉴 추가"; $("#menuCancel").hidden = true;
  }
  function renderMenu() {
    $("#menuSetup").hidden = S.menuReady; $("#menuForm").hidden = !S.menuReady;
    const t = $("#menuTable"); t.replaceChildren();
    t.append(el("thead", {}, el("tr", {}, ...["분류", "메뉴", "가격", ""].map((h, i) => el("th", { className: i === 2 ? "" : "l", textContent: h })))));
    const tb = el("tbody");
    for (const [cat, label] of MENU_CATS) for (const m of S.menus.filter((x) => x.cat === cat)) {
      const edit = el("button", { type: "button", className: "btn", textContent: "수정" });
      edit.addEventListener("click", () => {
        S.menuEdit = m.id; $("#menuName").value = m.name; $("#menuCat").value = m.cat; $("#menuPrice").value = m.price.toLocaleString("ko-KR");
        $("#menuFormTitle").textContent = `메뉴 수정 — ${m.name}`; $("#menuSave").textContent = "수정 저장"; $("#menuCancel").hidden = false;
        window.scrollTo({ top: 0 }); $("#menuName").focus();
      });
      const del = el("button", { type: "button", className: "btn danger", textContent: "삭제" });
      armDelete(del, "삭제", () => run(del, async () => {
        const d = must(await S.sb.from("menu_items").delete().eq("store_id", S.cur.store_id).eq("id", m.id).select("id"));
        if (!d.length) throw { code: "42501", message: "menu not deleted" };
        if (S.menuEdit === m.id) resetMenuForm();
        await loadMenus(); renderMenu();
      }, `'${m.name}' 메뉴를 지웠어요.`));
      tb.append(el("tr", {}, el("td", { className: "l muted", textContent: label }), el("td", { className: "l strong", textContent: m.name }),
        el("td", { textContent: won(m.price) + "원" }), el("td", { className: "l" }, el("span", { className: "row" }, edit, del))));
    }
    if (!tb.children.length) tb.append(el("tr", {}, el("td", { colSpan: 4, className: "l muted", textContent: S.menuReady ? "아직 등록한 메뉴가 없어요." : "메뉴 기능이 아직 설치되지 않았어요." })));
    t.append(tb);
  }
  function renderPlan() {
    if (!S.dirty.p) fillForm("p", PLAN_FIELDS, { ...S.plan, storeName: S.cur.name });
    $("#planBanner").hidden = S.planSaved; planLive();
  }
  function planLive() {
    const p = readForm("p", PLAN_FIELDS); const mon = N(p.bev) + N(p.alc) + N(p.food);
    const fixed = ["labor", "rent", "mgmt", "elec", "water", "other", "ownh", "int"].reduce((a, k) => a + N(p[k]), 0);
    $("#planLive").replaceChildren(
      el("span", {}, "월 계획 매출 ", el("b", { textContent: won(mon) + "원" })),
      el("span", {}, "주간 계획 ", el("b", { textContent: won(mon * 12 / 52) + "원" })),
      el("span", {}, "월 고정비 ", el("b", { textContent: won(fixed) + "원" })));
  }
  function renderMembers() {
    $("#appUrl").textContent = APP_URL;
    const il = $("#inviteList"); il.replaceChildren();
    for (const inv of S.invites) {
      const cancel = el("button", { type: "button", className: "btn danger", textContent: "초대 취소" });
      cancel.style.padding = "4px 10px"; cancel.style.fontSize = "13px";
      armDelete(cancel, "초대 취소", () => run(cancel, async () => {
        const d = must(await S.sb.from("invites").delete().eq("id", inv.id).select("id"));
        if (!d.length) throw { friendly: "이미 수락됐거나 없는 초대예요." };
        await loadMembers(); renderMembers();
      }, "초대를 취소했어요."));
      const row = el("div", { className: "row", style: "justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--line)" },
        el("span", { textContent: inv.email }), cancel);
      il.append(row);
    }
    if (!S.invites.length) il.append(el("p", { className: "muted small", style: "margin:0", textContent: "기다리는 초대가 없습니다." }));
    const t = $("#memberTable"); t.replaceChildren();
    t.append(el("thead", {}, el("tr", {}, ...["이메일", "역할", "합류일", ""].map((h) => el("th", { className: "l", textContent: h })))));
    const tb = el("tbody");
    for (const m of S.members) {
      const act = el("td", { className: "l" });
      if (m.role === "staff") {
        const b = el("button", { type: "button", className: "btn danger", textContent: "내보내기" });
        armDelete(b, "내보내기", () => run(b, async () => {
          const d = must(await S.sb.from("store_members").delete().eq("store_id", S.cur.store_id).eq("user_id", m.user_id).select("user_id"));
          if (!d.length) throw { friendly: "내보내지 못했어요." };
          await loadMembers(); renderMembers();
        }, "직원을 내보냈어요."));
        act.append(b);
      }
      tb.append(el("tr", {}, el("td", { className: "l", textContent: m.email || "(이메일 없음)" }),
        el("td", { className: "l" }, el("span", { className: "pill" + (m.role === "owner" ? " good" : ""), textContent: m.role === "owner" ? "사장" : "직원" })),
        el("td", { className: "l", textContent: String(m.created_at || "").slice(0, 10) }), act));
    }
    t.append(tb);
  }

  // ---------- 이벤트 ----------
  const goWeek = (id) => { S.wk = id; S.dirty.w = false; renderWeek(); };
  const goMonth = (ym) => { S.mo = ym; S.dirty.m = false; renderMonth(); };
  $("#wkPrev").addEventListener("click", () => goWeek(ymd(addDays(parseYmd(S.wk), -7))));
  $("#wkNext").addEventListener("click", () => goWeek(ymd(addDays(parseYmd(S.wk), 7))));
  $("#wkToday").addEventListener("click", () => goWeek(ymd(mondayOf(new Date()))));
  $("#moPrev").addEventListener("click", () => goMonth(addMonths(S.mo, -1)));
  $("#moNext").addEventListener("click", () => goMonth(addMonths(S.mo, 1)));
  $("#moToday").addEventListener("click", () => goMonth(ymOfWeek(ymd(mondayOf(new Date())))));
  $("#weekForm").addEventListener("input", () => { S.dirty.w = true; menuSync(); weekLive(); });
  $("#monthForm").addEventListener("input", () => { S.dirty.m = true; });
  $("#planForm").addEventListener("input", () => { S.dirty.p = true; planLive(); });

  $("#weekForm").addEventListener("submit", (e) => {
    e.preventDefault(); const f = readForm("w", WEEK_FIELDS);
    if (!["bev", "alc", "food"].some((k) => isNum(f[k]))) { toast("매출을 한 칸 이상 입력해 주세요."); return; }
    const id = S.wk, row = { store_id: S.cur.store_id, week_start: id, memo: f.memo || null };
    for (const k of WEEK_COLS) row[k] = f[k];   // 빈 칸은 null 로 저장 (0 으로 바꾸지 않음)
    const items = S.wkRows.filter((r) => isNum(r.qty) && r.qty > 0)
      .map((r) => ({ name: r.name, menu_id: r.menu_id, cat: r.cat, price: r.price, qty: r.qty }));
    if (new Set(items.map((r) => r.name)).size < items.length) { toast("같은 이름의 메뉴가 두 줄 있어요. 한쪽 수량을 비우고 저장해 주세요."); return; }
    run($("#weekSave"), async () => {
      if (S.menuReady) {
        // 주간 합계와 메뉴 수량을 한 번에 저장 (중간에 실패해도 둘이 어긋나지 않게)
        const { store_id, week_start, ...fields } = row;
        must(await S.sb.rpc("save_week", { p_store: store_id, p_week: week_start, p_row: fields, p_items: items }));
      } else {
        must(await S.sb.from("weeks").upsert(row, { onConflict: "store_id,week_start" }));
      }
      S.dirty.w = false; await refresh();
    }, `${Number(id.slice(5, 7))}/${Number(id.slice(8))} 주를 저장했어요.`);
  });
  $("#monthForm").addEventListener("submit", (e) => {
    e.preventDefault(); const f = readForm("m", MONTH_FIELDS); const id = S.mo;
    if (!Object.keys(MONTH_COLS).some((k) => isNum(f[k]))) { toast("비용을 한 칸 이상 입력해 주세요."); return; }
    const row = { store_id: S.cur.store_id, month: id + "-01", memo: f.memo || null };
    for (const [k, col] of Object.entries(MONTH_COLS)) row[col] = f[k];
    run($("#monthSave"), async () => {
      must(await S.sb.from("months").upsert(row, { onConflict: "store_id,month" }));
      S.dirty.m = false; await refresh();
    }, `${ymLabel(id)} 비용을 저장했어요.`);
  });
  $("#planForm").addEventListener("submit", (e) => {
    e.preventDefault(); const f = readForm("p", PLAN_FIELDS); const { storeName, ...raw } = f;
    if (!storeName) { toast("매장 이름을 입력해 주세요."); return; }
    const plan = {};
    for (const k of Object.keys(DEFAULT_PLAN)) plan[k] = isNum(raw[k]) ? raw[k] : DEFAULT_PLAN[k];
    run($("#planSave"), async () => {
      const d = must(await S.sb.from("store_plans").update({ plan }).eq("store_id", S.cur.store_id).select("store_id"));
      if (!d.length) throw { code: "42501", message: "plan not updated" };
      if (storeName !== S.cur.name) {
        must(await S.sb.from("stores").update({ name: storeName }).eq("id", S.cur.store_id));
        await loadStores();
      }
      S.dirty.p = false; await refresh();
    }, "계획을 저장했어요.");
  });
  $("#menuPrice").addEventListener("focus", (e) => { e.target.value = e.target.value.replace(/,/g, ""); });
  $("#menuPrice").addEventListener("blur", (e) => { const v = parseMoney(e.target.value); e.target.value = v == null ? "" : v.toLocaleString("ko-KR"); });
  $("#menuCancel").addEventListener("click", resetMenuForm);
  $("#menuForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const name = $("#menuName").value.trim(), cat = $("#menuCat").value, price = parseMoney($("#menuPrice").value), editing = S.menuEdit;
    if (!name) { toast("메뉴 이름을 입력해 주세요."); return; }
    if (!isNum(price)) { toast("가격을 입력해 주세요."); return; }
    if (S.menus.some((m) => m.name === name && m.id !== editing)) { toast("같은 이름의 메뉴가 이미 있어요."); return; }
    run($("#menuSave"), async () => {
      let res;
      if (editing) res = await S.sb.from("menu_items").update({ name, cat, price }).eq("store_id", S.cur.store_id).eq("id", editing).select("id");
      else res = await S.sb.from("menu_items").insert({ store_id: S.cur.store_id, name, cat, price, sort: S.menus.length });
      if (res.error && res.error.code === "23505") throw { friendly: "같은 이름의 메뉴가 이미 있어요." };
      must(res);
      if (editing && !res.data.length) throw { code: "42501", message: "menu not updated" };
      resetMenuForm(); await loadMenus(); renderMenu();
    }, editing ? `'${name}' 메뉴를 고쳤어요.` : `'${name}' 메뉴를 추가했어요.`);
  });
  $("#planReset").addEventListener("click",() => { fillForm("p", PLAN_FIELDS, { ...DEFAULT_PLAN, storeName: $("#p-storeName").value }); S.dirty.p = true; planLive(); toast("예시 값을 채웠어요. 저장해야 반영됩니다."); });
  armDelete($("#weekDel"), "이 주 삭제", () => { const id = S.wk; return run($("#weekDel"), async () => {
    const d = must(await S.sb.from("weeks").delete().eq("store_id", S.cur.store_id).eq("week_start", id).select("week_start"));
    if (!d.length) throw { code: "42501", message: "not deleted" };
    S.dirty.w = false; await refresh();
  }, "이 주를 삭제했어요."); });
  armDelete($("#monthDel"), "이 달 삭제", () => { const id = S.mo; return run($("#monthDel"), async () => {
    const d = must(await S.sb.from("months").delete().eq("store_id", S.cur.store_id).eq("month", id + "-01").select("month"));
    if (!d.length) throw { code: "42501", message: "not deleted" };
    S.dirty.m = false; await refresh();
  }, "이 달 비용을 삭제했어요."); });
  armDelete($("#leaveBtn"), "이 매장에서 나가기", () => run($("#leaveBtn"), async () => {
    const d = must(await S.sb.from("store_members").delete().eq("store_id", S.cur.store_id).eq("user_id", S.user.id).select("user_id"));
    if (!d.length) throw { code: "42501", message: "not left" };
    await enterApp();
  }, "매장에서 나왔어요."));

  $("#inviteForm").addEventListener("submit", (e) => {
    e.preventDefault(); const email = $("#inviteEmail").value.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { toast("이메일 주소를 확인해 주세요."); return; }
    if (S.members.some((m) => (m.email || "").toLowerCase() === email)) { toast("이미 이 매장의 구성원이에요."); return; }
    run($("#inviteBtn"), async () => {
      const { error } = await S.sb.from("invites").insert({ store_id: S.cur.store_id, email });
      if (error && error.code === "23505") throw { friendly: "이미 초대한 이메일이에요." };
      if (error) throw error;
      $("#inviteEmail").value = ""; await loadMembers(); renderMembers();
    }, `${email} 을(를) 초대했어요. 앱 주소를 직원에게 보내 주세요.`);
  });
  $("#copyUrl").addEventListener("click", async () => {
    try { await navigator.clipboard.writeText(APP_URL); toast("주소를 복사했어요."); }
    catch (e) { const r = document.createRange(); r.selectNodeContents($("#appUrl")); const s = getSelection(); s.removeAllRanges(); s.addRange(r); toast("주소를 선택했어요. 복사해 주세요."); }
  });
  $("#exportBtn").addEventListener("click", () => {
    // 엑셀이 수식으로 실행하지 않도록 = + - @ 로 시작하는 글자 칸 앞에 ' 를 붙임 (직원 메모 → 사장 PC 공격 방지)
    const q = (v) => {
      if (v == null) return "";
      let t = String(v);
      if (typeof v === "string" && /^[=+\-@\t\r]/.test(t)) t = "'" + t;
      return /[",\n\r]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
    };
    const wf = WEEK_FIELDS.filter((f) => f.k), mf = MONTH_FIELDS.filter((f) => f.k);
    const lines = ["[주간]", ["주 시작일(월)", "귀속 월", ...wf.map((f) => f.label), "메모"].map(q).join(",")];
    for (const id of [...S.weeks.keys()].sort()) { const w = S.weeks.get(id); lines.push([id, ymOfWeek(id), ...wf.map((f) => q(w[f.k])), q(w.memo)].join(",")); }
    lines.push("", "[월간]", ["월", ...mf.map((f) => f.label), "메모"].map(q).join(","));
    for (const id of [...S.months.keys()].sort()) { const m = S.months.get(id); lines.push([id, ...mf.map((f) => q(m[f.k])), q(m.memo)].join(",")); }
    if (S.items.size) {
      const catName = Object.fromEntries(MENU_CATS);
      lines.push("", "[메뉴별 판매]", ["주 시작일(월)", "메뉴", "분류", "단가", "수량", "금액"].map(q).join(","));
      for (const id of [...S.items.keys()].sort()) for (const r of S.items.get(id))
        lines.push([id, q(r.name), q(catName[r.cat]), q(r.price), q(r.qty), q(r.price * r.qty)].join(","));
    }
    const blob = new Blob(["﻿" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
    const a = el("a", { href: URL.createObjectURL(blob), download: `${S.cur.name}_가계부_${ymd(new Date())}.csv` });
    document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  });

  $("#storeSelect").addEventListener("change", async (e) => {
    const v = e.target.value;
    if (v === "__new") { showCreate(true); return; }
    S.cur = S.stores.find((s) => s.store_id === v) || S.cur; store.set("ledger.store", S.cur.store_id);
    S.dirty = { w: false, m: false, p: false }; resetMenuForm();
    await refresh();
  });
  $("#createForm").addEventListener("submit", (e) => {
    e.preventDefault(); const name = $("#createName").value.trim();
    if (!name) return;
    run($("#createBtn"), async () => {
      const { data: id, error } = await S.sb.rpc("create_store", { p_name: name });
      if (error && (error.hint === "store_creators" || error.code === "42501"))
        throw { friendly: `이 이메일(${S.user.email})은 매장을 만들 수 있도록 등록되어 있지 않아요. 관리자에게 등록을 요청해 주세요. 직원이라면 사장님께 초대를 요청하세요.` };
      if (error) throw error;
      store.set("ledger.store", id); $("#createName").value = "";
      S.view = "plan"; await enterApp();
    }, `'${name}' 매장을 만들었어요. 먼저 계획을 매장에 맞게 고쳐 주세요.`);
  });
  $("#createCancel").addEventListener("click", () => { render(); });
  function showCreate(extra) {
    $("#createTitle").textContent = extra ? "새 매장 추가" : "매장을 만들어 시작하세요";
    $("#createCancel").hidden = !extra;
    $("#inviteHint").textContent = extra ? "" : `직원으로 초대받으셨다면 사장님께 이 이메일(${S.user.email})로 초대를 요청하세요. 초대된 뒤 다시 로그인하면 매장이 보입니다. 매장 만들기는 관리자가 등록한 이메일만 할 수 있어요.`;
    $("#adminOpenBtn").hidden = !S.admin || extra;
    $("#tabs").hidden = true;
    show("screen-nostore");
  }

  // ---------- 관리자 모드 ----------
  async function loadCreators() { S.creators = must(await S.sb.rpc("admin_list_creators")) || []; }
  function renderAdmin() {
    $("#adminBackRow").hidden = !!S.cur;
    const open = S.creators.some((c) => c.email === "*");
    $("#openState").textContent = open
      ? "지금은 누구나 가입해서 매장을 만들 수 있어요. 무료 요금제 용량을 모르는 사람이 쓸 수 있으니 필요할 때만 켜 두세요."
      : "지금은 아래 목록에 등록된 이메일만 매장을 만들 수 있어요.";
    const tg = $("#openToggle");
    tg.textContent = open ? "등록된 이메일만 허용으로 바꾸기" : "누구나 매장 만들기 허용"; tg.dataset.open = String(open);
    tg.classList.toggle("danger", !open);
    const t = $("#creatorTable"); t.replaceChildren();
    t.append(el("thead", {}, el("tr", {}, ...["이메일", "가입", "만든 매장", "등록일", ""].map((h) => el("th", { className: "l", textContent: h })))));
    const tb = el("tbody");
    for (const c of S.creators.filter((c) => c.email !== "*")) {
      const act = el("td", { className: "l" });
      const b = el("button", { type: "button", className: "btn danger", textContent: "등록 삭제" });
      b.style.padding = "4px 10px"; b.style.fontSize = "13px";
      armDelete(b, "등록 삭제", () => run(b, async () => {
        const removed = must(await S.sb.rpc("admin_remove_creator", { p_email: c.email }));
        if (!removed) throw { friendly: "이미 삭제된 이메일이에요." };
        await loadCreators(); renderAdmin();
      }, `${c.email} 등록을 삭제했어요.`));
      act.append(b);
      tb.append(el("tr", {}, el("td", { className: "l", textContent: c.email }),
        el("td", { className: "l" }, el("span", { className: "pill" + (c.signed_up ? " good" : ""), textContent: c.signed_up ? "가입함" : "아직" })),
        el("td", { className: "l", textContent: `${c.owned_stores || 0}개` }),
        el("td", { className: "l", textContent: String(c.created_at || "").slice(0, 10) }), act));
    }
    if (!tb.children.length) tb.append(el("tr", {}, el("td", { colSpan: 5, className: "l muted", textContent: "등록된 이메일이 없어요." })));
    t.append(tb);
  }
  $("#adminAddForm").addEventListener("submit", (e) => {
    e.preventDefault(); const email = $("#adminEmail").value.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { toast("이메일 주소를 확인해 주세요."); return; }
    run($("#adminAddBtn"), async () => {
      const { data, error } = await S.sb.rpc("admin_add_creator", { p_email: email });
      if (error && error.code === "22023") throw { friendly: "이메일 형식이 올바르지 않아요." };
      if (error) throw error;
      if (!data) throw { friendly: `${email} 은(는) 이미 등록돼 있어요.` };
      $("#adminEmail").value = ""; await loadCreators(); renderAdmin();
    }, `${email} 을(를) 등록했어요. 앱 주소를 보내 주세요.`);
  });
  armDelete($("#openToggle"), "", () => run($("#openToggle"), async () => {
    const open = $("#openToggle").dataset.open === "true";
    must(await S.sb.rpc(open ? "admin_remove_creator" : "admin_add_creator", { p_email: "*" }));
    await loadCreators(); renderAdmin();
  }, "설정을 바꿨어요."));
  $("#adminOpenBtn").addEventListener("click", async () => { S.view = "admin"; await run(null, loadCreators); render(); });
  $("#adminBackBtn").addEventListener("click", () => { S.view = ""; showCreate(false); });

  $("#loginForm").addEventListener("submit", async (e) => {
    e.preventDefault(); const email = $("#loginEmail").value.trim();
    const msg = $("#loginMsg"); const btn = $("#loginBtn"); btn.disabled = true;
    const { error } = await S.sb.auth.signInWithOtp({ email, options: { emailRedirectTo: APP_URL } });
    btn.disabled = false; msg.hidden = false;
    if (error) {
      msg.className = "small"; msg.style.color = "var(--bad)";
      msg.textContent = (error.status === 429 || /rate limit/i.test(error.message))
        ? "로그인 메일 발송 한도에 걸렸어요. 잠시 후 다시 시도해 주세요. (관리자: README의 SMTP 설정 참고)"
        : errText(error);
    } else {
      msg.className = "small muted"; msg.style.color = "";
      msg.textContent = `${email} 로 로그인 링크를 보냈어요. 메일함(스팸함 포함)에서 링크를 눌러 주세요.`;
    }
  });
  $("#logoutBtn").addEventListener("click", async () => { await S.sb.auth.signOut(); });
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible" && S.cur) refresh(); });

  // ---------- 시작 ----------
  async function enterApp() {
    try {
      const n = must(await S.sb.rpc("accept_invites"));
      if (n > 0) toast(`초대 ${n}건을 받아 매장에 들어왔어요.`);
      // 관리자 여부 (서버에 003 마이그레이션이 없으면 에러 → 관리자 아님으로 처리)
      const adm = await S.sb.rpc("am_i_admin");
      S.admin = !adm.error && adm.data === true;
      await loadStores();
      if (!S.cur) { renderHeader(); showCreate(false); return; }
      store.set("ledger.store", S.cur.store_id);
      const v = store.get("ledger.view");
      if (!S.view || !(isOwner() ? OWNER_TABS : STAFF_TABS).some(([x]) => x === S.view)) S.view = v || (isOwner() ? "dash" : "week");
      await loadStoreData();
      render();
    } catch (e) { toast(errText(e)); }
  }
  function signedOut() {
    S.user = null; S.stores = []; S.cur = null; S.weeks = new Map(); S.months = new Map(); S.invites = []; S.members = [];
    S.admin = false; S.creators = []; S.menus = []; S.items = new Map(); S.wkRows = []; resetMenuForm();
    // 다음에 로그인하는 사람이 이전 사람의 화면 위치(보던 주·달·탭)를 이어받지 않게 초기화
    S.view = ""; S.wk = ymd(mondayOf(new Date())); S.mo = ymOfWeek(S.wk); S.dirty = { w: false, m: false, p: false };
    renderHeader(); $("#tabs").hidden = true; show("screen-login");
  }

  buildFields($("#weekFields"), WEEK_FIELDS, "w");
  buildFields($("#monthFields"), MONTH_FIELDS, "m");
  buildFields($("#planFields"), PLAN_FIELDS, "p");
  $("#gloss").append(...GLOSS.flatMap(([t, d]) => [el("dt", { textContent: t }), el("dd", { textContent: d })]));

  const cfg = window.LEDGER_CONFIG || {};
  if (!cfg.supabaseUrl || !cfg.supabaseAnonKey || !window.supabase) { show("screen-config"); return; }
  S.sb = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: "implicit" },
  });
  S.view = store.get("ledger.view") || "";
  let bootedFor = null;
  S.sb.auth.onAuthStateChange((event, session) => {
    // 콜백 안에서 바로 supabase 호출을 await 하면 잠금이 걸릴 수 있어 다음 틱으로 미룬다
    setTimeout(async () => {
      if (!session) { bootedFor = null; signedOut(); return; }
      S.user = session.user;
      if (location.hash.includes("access_token")) history.replaceState(null, "", APP_URL);
      if (bootedFor === session.user.id) return;   // 토큰 갱신 등은 다시 부팅하지 않음
      bootedFor = session.user.id;
      await enterApp();
    }, 0);
  });
})();
