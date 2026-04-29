const STORAGE_KEY = "appetittenArbeidsapp.v1";
const dayNames = ["Mandag", "Tirsdag", "Onsdag", "Torsdag", "Fredag", "Lørdag", "Søndag"];
const shortDate = new Intl.DateTimeFormat("no-NO", { day: "2-digit", month: "short" });
const longDate = new Intl.DateTimeFormat("no-NO", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

const defaultState = {
  activeEmployeeId: "emp-1",
  currentWeekStart: toISO(startOfWeek(new Date())),
  employees: [
    { id: "emp-1", name: "Diego", role: "Daglig vakt" },
    { id: "emp-2", name: "Sara", role: "Kasse" },
    { id: "emp-3", name: "Ali", role: "Kjøkken" },
    { id: "emp-4", name: "Mina", role: "Levering" }
  ],
  shifts: seedShifts(),
  entries: [],
  messages: [
    {
      id: crypto.randomUUID(),
      employeeId: "emp-2",
      text: "Jeg kan ta fredag kveld hvis noen kan bytte søndag.",
      createdAt: addMinutes(new Date(), -95).toISOString()
    },
    {
      id: crypto.randomUUID(),
      employeeId: "emp-3",
      text: "Jeg kan søndag etter kl. 16.",
      createdAt: addMinutes(new Date(), -48).toISOString()
    }
  ]
};

let state = loadState();

const els = {
  navItems: document.querySelectorAll(".nav-item"),
  views: document.querySelectorAll(".view"),
  pageTitle: document.querySelector("#pageTitle"),
  todayPill: document.querySelector("#todayPill"),
  activeEmployee: document.querySelector("#activeEmployee"),
  monthHours: document.querySelector("#monthHours"),
  monthShiftCount: document.querySelector("#monthShiftCount"),
  quickClockButton: document.querySelector("#quickClockButton"),
  upcomingShifts: document.querySelector("#upcomingShifts"),
  latestMessages: document.querySelector("#latestMessages"),
  weekLabel: document.querySelector("#weekLabel"),
  scheduleBoard: document.querySelector("#scheduleBoard"),
  previousWeek: document.querySelector("#previousWeek"),
  nextWeek: document.querySelector("#nextWeek"),
  shiftForm: document.querySelector("#shiftForm"),
  shiftEmployee: document.querySelector("#shiftEmployee"),
  shiftDate: document.querySelector("#shiftDate"),
  shiftStart: document.querySelector("#shiftStart"),
  shiftEnd: document.querySelector("#shiftEnd"),
  shiftRole: document.querySelector("#shiftRole"),
  clockStatus: document.querySelector("#clockStatus"),
  clockSubtext: document.querySelector("#clockSubtext"),
  clockButton: document.querySelector("#clockButton"),
  timeEntries: document.querySelector("#timeEntries"),
  chatFeed: document.querySelector("#chatFeed"),
  chatForm: document.querySelector("#chatForm"),
  chatInput: document.querySelector("#chatInput"),
  chatCount: document.querySelector("#chatCount"),
  reportMonth: document.querySelector("#reportMonth"),
  reportEmployee: document.querySelector("#reportEmployee"),
  reportOutput: document.querySelector("#reportOutput"),
  copyReportButton: document.querySelector("#copyReportButton"),
  employeeForm: document.querySelector("#employeeForm"),
  employeeName: document.querySelector("#employeeName"),
  employeeRole: document.querySelector("#employeeRole"),
  teamList: document.querySelector("#teamList")
};

init();

function init() {
  els.todayPill.textContent = sentenceCase(longDate.format(new Date()));
  els.shiftDate.value = toISO(new Date());
  els.reportMonth.value = currentMonth();
  bindEvents();
  registerServiceWorker();
  render();
}

function bindEvents() {
  els.navItems.forEach((button) => {
    button.addEventListener("click", () => showView(button.dataset.view));
  });

  document.querySelectorAll("[data-view-jump]").forEach((button) => {
    button.addEventListener("click", () => showView(button.dataset.viewJump));
  });

  els.activeEmployee.addEventListener("change", () => {
    state.activeEmployeeId = els.activeEmployee.value;
    saveAndRender();
  });

  els.previousWeek.addEventListener("click", () => changeWeek(-7));
  els.nextWeek.addEventListener("click", () => changeWeek(7));
  els.clockButton.addEventListener("click", toggleClock);
  els.quickClockButton.addEventListener("click", toggleClock);
  els.shiftForm.addEventListener("submit", addShift);
  els.chatForm.addEventListener("submit", addMessage);
  els.reportMonth.addEventListener("change", renderReport);
  els.reportEmployee.addEventListener("change", renderReport);
  els.copyReportButton.addEventListener("click", copyReport);
  els.employeeForm.addEventListener("submit", addEmployee);
}

function render() {
  renderEmployeeOptions();
  renderDashboard();
  renderSchedule();
  renderClock();
  renderChat();
  renderReport();
  renderTeam();
}

function renderEmployeeOptions() {
  const options = state.employees.map((employee) => `<option value="${employee.id}">${escapeHtml(employee.name)}</option>`).join("");
  [els.activeEmployee, els.shiftEmployee, els.reportEmployee].forEach((select) => {
    const previousValue = select.value;
    select.innerHTML = options;
    select.value = state.employees.some((employee) => employee.id === previousValue) ? previousValue : state.activeEmployeeId;
  });
  els.activeEmployee.value = state.activeEmployeeId;
  els.shiftEmployee.value = state.activeEmployeeId;
  if (!els.reportEmployee.value) els.reportEmployee.value = state.activeEmployeeId;
}

function renderDashboard() {
  const employeeId = state.activeEmployeeId;
  const month = currentMonth();
  const entries = completedEntries(employeeId, month);
  const total = entries.reduce((sum, entry) => sum + entryHours(entry), 0);
  els.monthHours.textContent = `${formatHours(total)} timer`;
  els.monthShiftCount.textContent = `${entries.length} registrerte økter`;

  const nextShifts = state.shifts
    .filter((shift) => shift.employeeId === employeeId && shift.date >= toISO(new Date()))
    .sort(sortByDateAndStart)
    .slice(0, 4);

  els.upcomingShifts.innerHTML = nextShifts.length
    ? nextShifts.map(shiftListItem).join("")
    : `<p class="empty">Ingen kommende vakter er satt opp.</p>`;

  els.latestMessages.innerHTML = state.messages
    .slice()
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 3)
    .map(messageListItem)
    .join("");
}

function renderSchedule() {
  const weekStart = parseISO(state.currentWeekStart);
  const weekEnd = addDays(weekStart, 6);
  els.weekLabel.textContent = `${shortDate.format(weekStart)} - ${shortDate.format(weekEnd)}`;
  const today = toISO(new Date());

  els.scheduleBoard.innerHTML = Array.from({ length: 7 }, (_, index) => {
    const date = addDays(weekStart, index);
    const dateISO = toISO(date);
    const shifts = state.shifts.filter((shift) => shift.date === dateISO).sort(sortByDateAndStart);
    const shiftMarkup = shifts.length
      ? shifts.map(shiftChip).join("")
      : `<p class="empty">Ingen vakter</p>`;

    return `
      <article class="day-column ${dateISO === today ? "today" : ""}">
        <div class="day-head">
          <strong>${dayNames[index]}</strong>
          <span>${shortDate.format(date)}</span>
        </div>
        ${shiftMarkup}
      </article>
    `;
  }).join("");

  document.querySelectorAll("[data-delete-shift]").forEach((button) => {
    button.addEventListener("click", () => {
      state.shifts = state.shifts.filter((shift) => shift.id !== button.dataset.deleteShift);
      saveAndRender();
    });
  });
}

function renderClock() {
  const active = activeEntry();
  els.clockStatus.textContent = active ? "Du er stemplet inn" : "Ikke på jobb";
  els.clockSubtext.textContent = active
    ? `Startet ${formatTime(active.start)}. Husk å stemple ut når du er ferdig.`
    : "Trykk når du starter eller slutter vakten.";
  els.clockButton.textContent = active ? "Stemple ut" : "Stemple inn";
  els.clockButton.classList.toggle("clocked-in", Boolean(active));
  els.quickClockButton.textContent = active ? "Stemple ut" : "Stemple inn";

  const entries = state.entries
    .filter((entry) => entry.employeeId === state.activeEmployeeId)
    .sort((a, b) => new Date(b.start) - new Date(a.start))
    .slice(0, 12);

  els.timeEntries.innerHTML = entries.length
    ? entries.map(entryListItem).join("")
    : `<p class="empty">Ingen økter registrert ennå.</p>`;
}

function renderChat() {
  els.chatCount.textContent = `${state.messages.length} meldinger`;
  els.chatFeed.innerHTML = state.messages
    .slice()
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
    .map((message) => {
      const employee = findEmployee(message.employeeId);
      const mine = message.employeeId === state.activeEmployeeId ? "mine" : "";
      return `
        <div class="message ${mine}">
          <strong>${escapeHtml(employee.name)}</strong>
          ${escapeHtml(message.text)}
          <span>${formatDateTime(message.createdAt)}</span>
        </div>
      `;
    })
    .join("");
  els.chatFeed.scrollTop = els.chatFeed.scrollHeight;
}

function renderReport() {
  const month = els.reportMonth.value || currentMonth();
  const employeeId = els.reportEmployee.value || state.activeEmployeeId;
  const employee = findEmployee(employeeId);
  const entries = completedEntries(employeeId, month).sort((a, b) => new Date(a.start) - new Date(b.start));
  const total = entries.reduce((sum, entry) => sum + entryHours(entry), 0);

  els.reportOutput.innerHTML = `
    <p class="eyebrow">Klar til sjefen</p>
    <h2>${escapeHtml(employee.name)} - ${month}</h2>
    <div>
      ${entries.length ? entries.map(reportLine).join("") : `<p class="empty">Ingen ferdige økter i denne måneden.</p>`}
    </div>
    <div class="report-total">Totalt: ${formatHours(total)} timer</div>
  `;
}

function renderTeam() {
  els.teamList.innerHTML = state.employees.map((employee) => `
    <div class="employee-row">
      <div>
        <strong>${escapeHtml(employee.name)}</strong>
        <span>${escapeHtml(employee.role || "Ansatt")}</span>
      </div>
      <button class="delete-button" data-delete-employee="${employee.id}">Fjern</button>
    </div>
  `).join("");

  document.querySelectorAll("[data-delete-employee]").forEach((button) => {
    button.addEventListener("click", () => {
      if (state.employees.length === 1) return;
      const employeeId = button.dataset.deleteEmployee;
      state.employees = state.employees.filter((employee) => employee.id !== employeeId);
      state.shifts = state.shifts.filter((shift) => shift.employeeId !== employeeId);
      state.entries = state.entries.filter((entry) => entry.employeeId !== employeeId);
      state.messages = state.messages.filter((message) => message.employeeId !== employeeId);
      if (state.activeEmployeeId === employeeId) state.activeEmployeeId = state.employees[0].id;
      saveAndRender();
    });
  });
}

function showView(viewName) {
  const titles = {
    dashboard: "Oversikt",
    schedule: "Ukeplan",
    clock: "Stempling",
    chat: "Chat",
    report: "Timer",
    team: "Ansatte"
  };
  els.pageTitle.textContent = titles[viewName];
  els.navItems.forEach((item) => item.classList.toggle("active", item.dataset.view === viewName));
  els.views.forEach((view) => view.classList.toggle("active", view.id === `${viewName}View`));
}

function changeWeek(days) {
  state.currentWeekStart = toISO(addDays(parseISO(state.currentWeekStart), days));
  saveAndRender();
}

function toggleClock() {
  const active = activeEntry();
  if (active) {
    active.end = new Date().toISOString();
  } else {
    state.entries.push({
      id: crypto.randomUUID(),
      employeeId: state.activeEmployeeId,
      start: new Date().toISOString(),
      end: null
    });
  }
  saveAndRender();
}

function addShift(event) {
  event.preventDefault();
  if (!els.shiftDate.value || !els.shiftStart.value || !els.shiftEnd.value || els.shiftStart.value >= els.shiftEnd.value) {
    return;
  }
  state.shifts.push({
    id: crypto.randomUUID(),
    employeeId: els.shiftEmployee.value,
    date: els.shiftDate.value,
    start: els.shiftStart.value,
    end: els.shiftEnd.value,
    role: els.shiftRole.value.trim()
  });
  els.shiftRole.value = "";
  saveAndRender();
}

function addMessage(event) {
  event.preventDefault();
  const text = els.chatInput.value.trim();
  if (!text) return;
  state.messages.push({
    id: crypto.randomUUID(),
    employeeId: state.activeEmployeeId,
    text,
    createdAt: new Date().toISOString()
  });
  els.chatInput.value = "";
  saveAndRender();
}

function addEmployee(event) {
  event.preventDefault();
  const name = els.employeeName.value.trim();
  if (!name) return;
  state.employees.push({
    id: crypto.randomUUID(),
    name,
    role: els.employeeRole.value.trim()
  });
  els.employeeName.value = "";
  els.employeeRole.value = "";
  saveAndRender();
}

async function copyReport() {
  const month = els.reportMonth.value;
  const employeeId = els.reportEmployee.value;
  const employee = findEmployee(employeeId);
  const entries = completedEntries(employeeId, month).sort((a, b) => new Date(a.start) - new Date(b.start));
  const total = entries.reduce((sum, entry) => sum + entryHours(entry), 0);
  const lines = [
    `Timerapport - Appetitten Pizza & Grill`,
    `Ansatt: ${employee.name}`,
    `Måned: ${month}`,
    "",
    ...entries.map((entry) => `${formatDate(entry.start)}: ${formatTime(entry.start)}-${formatTime(entry.end)} (${formatHours(entryHours(entry))} t)`),
    "",
    `Totalt: ${formatHours(total)} timer`
  ];
  try {
    await navigator.clipboard.writeText(lines.join("\n"));
    els.copyReportButton.textContent = "Kopiert";
  } catch {
    els.copyReportButton.textContent = "Kunne ikke kopiere";
  }
  setTimeout(() => {
    els.copyReportButton.textContent = "Kopier rapport";
  }, 1400);
}

function shiftChip(shift) {
  const employee = findEmployee(shift.employeeId);
  return `
    <div class="shift-chip">
      <strong>${escapeHtml(employee.name)}</strong>
      <span>${shift.start} - ${shift.end}</span>
      <span>${escapeHtml(shift.role || employee.role || "Vakt")}</span>
      <button class="delete-button" data-delete-shift="${shift.id}">Slett</button>
    </div>
  `;
}

function shiftListItem(shift) {
  const employee = findEmployee(shift.employeeId);
  return `
    <div class="list-item">
      <div>
        <strong>${escapeHtml(employee.name)}</strong>
        <span>${formatReadableDate(shift.date)} kl. ${shift.start}-${shift.end}</span>
      </div>
      <span>${escapeHtml(shift.role || "Vakt")}</span>
    </div>
  `;
}

function messageListItem(message) {
  const employee = findEmployee(message.employeeId);
  return `
    <div class="list-item">
      <div>
        <strong>${escapeHtml(employee.name)}</strong>
        <span>${escapeHtml(message.text)}</span>
      </div>
    </div>
  `;
}

function entryListItem(entry) {
  const hours = entry.end ? `${formatHours(entryHours(entry))} t` : "Pågår";
  return `
    <div class="list-item">
      <div>
        <strong>${formatDate(entry.start)}</strong>
        <span>${formatTime(entry.start)} - ${entry.end ? formatTime(entry.end) : "nå"}</span>
      </div>
      <span>${hours}</span>
    </div>
  `;
}

function reportLine(entry) {
  return `
    <div class="report-line">
      <span>${formatDate(entry.start)} · ${formatTime(entry.start)}-${formatTime(entry.end)}</span>
      <strong>${formatHours(entryHours(entry))} t</strong>
    </div>
  `;
}

function completedEntries(employeeId, month) {
  return state.entries.filter((entry) => entry.employeeId === employeeId && entry.end && entry.start.slice(0, 7) === month);
}

function activeEntry() {
  return state.entries.find((entry) => entry.employeeId === state.activeEmployeeId && !entry.end);
}

function entryHours(entry) {
  return (new Date(entry.end) - new Date(entry.start)) / 36e5;
}

function findEmployee(id) {
  return state.employees.find((employee) => employee.id === id) || { name: "Ukjent", role: "" };
}

function sortByDateAndStart(a, b) {
  return `${a.date} ${a.start}`.localeCompare(`${b.date} ${b.start}`);
}

function saveAndRender() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  render();
}

function loadState() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    const loaded = stored ? { ...structuredClone(defaultState), ...JSON.parse(stored) } : structuredClone(defaultState);
    if (!loaded.employees.some((employee) => employee.id === loaded.activeEmployeeId)) {
      loaded.activeEmployeeId = loaded.employees[0]?.id || defaultState.activeEmployeeId;
    }
    if (parseISO(loaded.currentWeekStart).getDay() !== 1) {
      loaded.currentWeekStart = toISO(startOfWeek(new Date()));
    }
    return loaded;
  } catch {
    return structuredClone(defaultState);
  }
}

function seedShifts() {
  const monday = startOfWeek(new Date());
  return [
    { id: crypto.randomUUID(), employeeId: "emp-1", date: toISO(monday), start: "14:00", end: "22:00", role: "Kjøkken" },
    { id: crypto.randomUUID(), employeeId: "emp-2", date: toISO(addDays(monday, 1)), start: "16:00", end: "22:00", role: "Kasse" },
    { id: crypto.randomUUID(), employeeId: "emp-3", date: toISO(addDays(monday, 3)), start: "14:00", end: "23:00", role: "Pizza" },
    { id: crypto.randomUUID(), employeeId: "emp-4", date: toISO(addDays(monday, 4)), start: "17:00", end: "23:00", role: "Levering" },
    { id: crypto.randomUUID(), employeeId: "emp-1", date: toISO(addDays(monday, 6)), start: "12:00", end: "22:00", role: "Helgevakt" }
  ];
}

function startOfWeek(date) {
  const copy = new Date(date);
  const day = copy.getDay() || 7;
  copy.setHours(0, 0, 0, 0);
  copy.setDate(copy.getDate() - day + 1);
  return copy;
}

function addDays(date, days) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

function addMinutes(date, minutes) {
  const copy = new Date(date);
  copy.setMinutes(copy.getMinutes() + minutes);
  return copy;
}

function parseISO(value) {
  return new Date(`${value}T00:00:00`);
}

function toISO(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function currentMonth() {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
}

function formatDate(value) {
  return new Intl.DateTimeFormat("no-NO", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(value));
}

function formatReadableDate(value) {
  return sentenceCase(longDate.format(parseISO(value)));
}

function formatDateTime(value) {
  return new Intl.DateTimeFormat("no-NO", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

function formatTime(value) {
  return new Intl.DateTimeFormat("no-NO", { hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

function formatHours(value) {
  return new Intl.NumberFormat("no-NO", { maximumFractionDigits: 2 }).format(Math.max(0, value));
}

function sentenceCase(value) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  });
}
