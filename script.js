/* =========================================================
   Kontorquizen — config

   Two office tabs in the same Google Sheet, same column layout:
     - Oslo:   gid 0 (the original tab)
     - Bergen: gid 1635601830

   Both tabs are expected to share the exact column layout below.
   Sharing settings: Share ▸ General access ▸ "Anyone with the link"
   ▸ Viewer, same as before — applies to the whole spreadsheet.
   ========================================================= */

const SHEET_ID = "1dhbJuSthEbjoDJhrP5NF6FmgeKiSocucrFgnc0p5aVU";
const GID_OSLO = "0";
const GID_BERGEN = "1635601830";

const CSV_URL_OSLO = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${GID_OSLO}`;
const CSV_URL_BERGEN = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${GID_BERGEN}`;

const OFFICES = [
  { id: "oslo", label: "Oslo", csvUrl: CSV_URL_OSLO },
  { id: "bergen", label: "Bergen", csvUrl: CSV_URL_BERGEN },
];

// Column layout, matching the sheet screenshot:
// A: Uke | B-F: Man-Fre (Aftenposten)   ...gap...   I: Uke | J: Score (Morgenbladet)
const COLS = {
  apWeek: 0,
  apDays: [1, 2, 3, 4, 5],
  apDayLabels: ["Man", "Tir", "Ons", "Tor", "Fre"],
  mbWeek: 8,
  mbScore: 9,
};

const DATA_START_ROW = 2; // rows 0 and 1 are the two header rows
const MB_MAX = 20;
const MB_STREAK_THRESHOLD = MB_MAX / 2;

// QUOTES is defined in quotes.js (loaded before this file) as
// [{ q: "...", a: "Author Name" }, ...]

/* ========================================================= */

const THEME = {
  ink: "#2B2013",
  inkSoft: "#5B4E38",
  rule: "#B8A67E",
  red: "#7B2D26",
  gold: "#8C6A2B",
  bergen: "#3B5A66",
  paperRaised: "#EFE7CE",
};

// Module-level state, keyed by office id, for the raw per-office data.
// The "this week" view itself is browsed by a SINGLE shared index per
// quiz, stepping through the union of weeks across both offices —
// each render looks up whichever office has data for that week label.
let apWeeksData = { oslo: [], bergen: [] };
let mbWeeksData = { oslo: [], bergen: [] };
let apUnionWeeks = [];
let mbUnionWeeks = [];
let apIndex = -1;
let mbIndex = -1;
let apChartInstance = null;

document.addEventListener("DOMContentLoaded", init);

async function init() {
  setEdition();
  setupTabs();
  setupPrintButton();
  renderFunDayBanner();
  renderWikiNews();
  renderWeather();

  const results = await Promise.allSettled(OFFICES.map((o) => fetchSheet(o.csvUrl)));

  let anySuccess = false;
  results.forEach((result, i) => {
    const officeId = OFFICES[i].id;
    if (result.status === "fulfilled") {
      anySuccess = true;
      const dataRows = result.value.slice(DATA_START_ROW);
      apWeeksData[officeId] = extractAftenpostenWeeks(dataRows);
      mbWeeksData[officeId] = extractMorgenbladetWeeks(dataRows);
    } else {
      console.error(`Kunne ikke hente ${OFFICES[i].label}-arket:`, result.reason);
      apWeeksData[officeId] = [];
      mbWeeksData[officeId] = [];
    }
  });

  if (!anySuccess) {
    showStatus(
      "Kunne ikke hente data fra arkene. Sjekk at de er delt med \u00abAlle med lenken\u00bb, og at SHEET_ID i script.js er riktig."
    );
    return;
  }

  apUnionWeeks = computeUnionWeeks(apWeeksData);
  mbUnionWeeks = computeUnionWeeks(mbWeeksData);
  apIndex = apUnionWeeks.length - 1;
  mbIndex = mbUnionWeeks.length - 1;

  setupWeekNav();
  try {
    renderAftenpostenWeek();
  } catch (err) {
    console.error("Feil under rendering av Aftenposten-uken:", err);
  }
  try {
    renderMorgenbladetWeek();
  } catch (err) {
    console.error("Feil under rendering av Morgenbladet-uken:", err);
  }
  try {
    renderOverTime();
  } catch (err) {
    console.error("Feil under rendering av Over tid-grafen:", err);
  }
}

function computeUnionWeeks(dataByOffice) {
  const weekSet = new Set();
  OFFICES.forEach((o) => dataByOffice[o.id].forEach((w) => weekSet.add(w.week)));
  return [...weekSet].sort((a, b) => Number(a) - Number(b));
}

function findWeekEntry(weeksArr, weekLabel) {
  return weeksArr.find((w) => w.week === weekLabel) || null;
}

/* ---------- Week navigation (prev/next) ---------- */

function setupWeekNav() {
  document.getElementById("ap-prev").addEventListener("click", () => {
    if (apIndex > 0) { apIndex--; renderAftenpostenWeek(); }
  });
  document.getElementById("ap-next").addEventListener("click", () => {
    if (apIndex < apUnionWeeks.length - 1) { apIndex++; renderAftenpostenWeek(); }
  });
  document.getElementById("mb-prev").addEventListener("click", () => {
    if (mbIndex > 0) { mbIndex--; renderMorgenbladetWeek(); }
  });
  document.getElementById("mb-next").addEventListener("click", () => {
    if (mbIndex < mbUnionWeeks.length - 1) { mbIndex++; renderMorgenbladetWeek(); }
  });
}

/* ---------- Fun & food days ---------- */

function renderFunDayBanner() {
  const el = document.getElementById("funday-banner");
  const { today, tomorrow } = getFunDayBanner();

  const lines = [];
  if (today.length) {
    lines.push(`Hurra, i dag er det ${joinNorwegian(today)}!`);
  }
  if (tomorrow.length) {
    lines.push(`I morgen er det ${joinNorwegian(tomorrow)}.`);
  }

  if (!lines.length) {
    el.hidden = true;
    return;
  }

  el.innerHTML = lines.map((line) => `<p>${line}</p>`).join("");
  el.hidden = false;
}

function joinNorwegian(names) {
  if (names.length === 1) return names[0];
  return `${names.slice(0, -1).join(", ")} og ${names[names.length - 1]}`;
}

/* ---------- Værmelding ---------- */

async function renderWeather() {
  const grid = document.getElementById("weather-grid");
  const timeLabel = nowTimeLabel();
  grid.innerHTML = WEATHER_LOCATIONS.map((loc, i) => `
    <div class="weather-col" id="weather-col-${i}">
      <h3 class="weather-col__title">${escapeHtml(loc.name)} <span class="weather-col__time" id="weather-time-${i}">${timeLabel}</span></h3>
      <p class="chart-empty news-empty weather-loading">Henter værdata …</p>
    </div>
  `).join("");

  await Promise.all(WEATHER_LOCATIONS.map((loc, i) => renderWeatherColumn(loc, i)));
  startWeatherClock();
}

let weatherClockInterval = null;

function startWeatherClock() {
  if (weatherClockInterval) return; // already running
  weatherClockInterval = setInterval(() => {
    const timeLabel = nowTimeLabel();
    WEATHER_LOCATIONS.forEach((loc, i) => {
      const el = document.getElementById(`weather-time-${i}`);
      if (el) el.textContent = timeLabel;
    });
  }, 1000);
}

function nowTimeLabel() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

async function renderWeatherColumn(loc, index) {
  const col = document.getElementById(`weather-col-${index}`);
  const timeLabel = nowTimeLabel();
  try {
    const hours = await fetchTodayHourly(loc.lat, loc.lon);
    if (!hours.length) throw new Error("Ingen timesdata for i dag");

    let html = `<h3 class="weather-col__title">${escapeHtml(loc.name)} <span class="weather-col__time" id="weather-time-${index}">${timeLabel}</span></h3>`;
    html += `<div class="weather-hours">`;
    html += hours
      .map((h) => {
        const info = symbolInfo(h.symbol);
        const temp = typeof h.temp === "number" ? `${Math.round(h.temp)}\u00B0` : "\u2014";
        return `
          <div class="weather-hour">
            <span class="weather-hour__time">${String(h.hour).padStart(2, "0")}</span>
            <span class="weather-hour__icon" title="${escapeHtml(info.label)}">${info.icon}</span>
            <span class="weather-hour__temp">${temp}</span>
          </div>`;
      })
      .join("");
    html += `</div>`;

    if (loc.nowcast) {
      html += `<div class="weather-nowcast" id="weather-nowcast-${index}">Henter nedbørsvarsel …</div>`;
    }

    col.innerHTML = html;

    if (loc.nowcast) {
      renderNowcast(loc, index).catch((err) => {
        console.error(err);
        const el = document.getElementById(`weather-nowcast-${index}`);
        if (el) el.textContent = "Kunne ikke hente nedbørsvarsel akkurat nå.";
      });
    }
  } catch (err) {
    console.error(err);
    col.innerHTML = `
      <h3 class="weather-col__title">${escapeHtml(loc.name)} <span class="weather-col__time" id="weather-time-${index}">${timeLabel}</span></h3>
      <p class="chart-empty news-empty">Kunne ikke hente værdata for ${escapeHtml(loc.name)} akkurat nå.</p>`;
  }
}

async function renderNowcast(loc, index) {
  const summary = await fetchNowcastSummary(loc.lat, loc.lon);
  const el = document.getElementById(`weather-nowcast-${index}`);
  if (!el) return;
  el.textContent = summary.rain
    ? summary.minutes <= 2
      ? "\u2602\uFE0F Regn like om hjørnet."
      : `\u2602\uFE0F Regn ventet om ca. ${summary.minutes} minutter.`
    : "\u2600\uFE0F Ingen nedbør ventet de neste 90 minuttene.";
}

/* ---------- Wikipedia "Aktuelt" ---------- */

async function renderWikiNews() {
  const listEl = document.getElementById("news-list");
  const emptyEl = document.getElementById("news-empty");

  try {
    const items = await fetchWikiAktuelt();
    if (!items.length) throw new Error("Tom liste fra Wikipedia");

    listEl.innerHTML = items
      .map((item) => {
        const text = escapeHtml(item.text);
        return item.url
          ? `<li><a href="${item.url}" target="_blank" rel="noopener">${text}</a></li>`
          : `<li>${text}</li>`;
      })
      .join("");
    listEl.hidden = false;
    emptyEl.hidden = true;
  } catch (err) {
    console.error(err);
    listEl.hidden = true;
    emptyEl.hidden = false;
    emptyEl.textContent = "Kunne ikke hente aktuelt-saker fra Wikipedia akkurat nå.";
  }

  renderOnThisDay();
}

async function renderOnThisDay() {
  const listEl = document.getElementById("onthisday-list");
  const emptyEl = document.getElementById("onthisday-empty");

  try {
    const items = await fetchOnThisDayTop5();
    if (!items.length) throw new Error("Tom liste fra Wikipedia");

    listEl.innerHTML = items
      .map((item) => {
        const text = escapeHtml(item.text);
        return item.url
          ? `<li><a href="${item.url}" target="_blank" rel="noopener">${text}</a></li>`
          : `<li>${text}</li>`;
      })
      .join("");
    listEl.hidden = false;
    emptyEl.hidden = true;
  } catch (err) {
    console.error(err);
    listEl.hidden = true;
    emptyEl.hidden = false;
    emptyEl.textContent = "Kunne ikke hente dagens historiske hendelser akkurat nå.";
  }
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

/* ---------- Print ---------- */

function setupPrintButton() {
  document.getElementById("print-btn").addEventListener("click", () => window.print());
}

/* ---------- Tabs ---------- */

function setupTabs() {
  const tabWeek = document.getElementById("tab-week");
  const tabOvertime = document.getElementById("tab-overtime");
  const viewWeek = document.getElementById("view-week");
  const viewOvertime = document.getElementById("view-overtime");

  function activate(tab) {
    const showWeek = tab === "week";
    viewWeek.hidden = !showWeek;
    viewOvertime.hidden = showWeek;
    tabWeek.classList.toggle("is-active", showWeek);
    tabOvertime.classList.toggle("is-active", !showWeek);
    tabWeek.setAttribute("aria-selected", String(showWeek));
    tabOvertime.setAttribute("aria-selected", String(!showWeek));
  }

  tabWeek.addEventListener("click", () => activate("week"));
  tabOvertime.addEventListener("click", () => activate("overtime"));
}

/* ---------- Fetch + parse ---------- */

async function fetchSheet(url) {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Sheet fetch failed: ${res.status}`);
  const text = await res.text();
  return parseCSV(text);
}

// Minimal CSV parser — handles quoted fields containing commas.
function parseCSV(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') { inQuotes = false; }
      else { field += c; }
    } else {
      if (c === '"') inQuotes = true;
      else if (c === ",") { row.push(field); field = ""; }
      else if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
      else if (c === "\r") { /* skip */ }
      else { field += c; }
    }
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows;
}

/* ---------- Extraction ----------
   Both return an array of week objects, in sheet order (oldest to newest),
   skipping weeks with no data at all. */

function extractAftenpostenWeeks(rows) {
  const weeks = [];
  for (const row of rows) {
    const week = (row[COLS.apWeek] || "").trim();
    if (!week) continue;
    const days = COLS.apDays.map((colIndex, i) => {
      const raw = (row[colIndex] || "").trim();
      if (raw === "") return null;
      const value = Number(raw.replace(",", "."));
      return Number.isNaN(value) ? null : value;
    });
    if (days.every((d) => d === null)) continue;
    weeks.push({ week, days });
  }
  return weeks;
}

function extractMorgenbladetWeeks(rows) {
  const weeks = [];
  for (const row of rows) {
    const week = (row[COLS.mbWeek] || "").trim();
    const raw = (row[COLS.mbScore] || "").trim();
    if (!week || raw === "") continue;
    const value = Number(raw.replace(",", "."));
    if (Number.isNaN(value)) continue;
    weeks.push({ week, score: value });
  }
  return weeks;
}

/* ---------- View: this week ---------- */

function renderAftenpostenWeek() {
  const tag = document.getElementById("ap-week-tag");
  const canvas = document.getElementById("ap-week-chart");
  const emptyMsg = document.getElementById("ap-week-empty");
  const prevBtn = document.getElementById("ap-prev");
  const nextBtn = document.getElementById("ap-next");

  prevBtn.disabled = apIndex <= 0;
  nextBtn.disabled = apIndex >= apUnionWeeks.length - 1;

  if (apChartInstance) {
    apChartInstance.destroy();
    apChartInstance = null;
  }

  const weekLabel = apIndex >= 0 ? apUnionWeeks[apIndex] : null;

  if (!weekLabel) {
    tag.textContent = "Ingen data ennå";
    canvas.style.display = "none";
    emptyMsg.hidden = false;
    OFFICES.forEach((o) => renderOfficeAftenpostenStats(o.id, null));
    renderLeaderLine("ap-leader", null, null);
    return;
  }

  canvas.style.display = "";
  emptyMsg.hidden = true;
  tag.textContent = `Uke ${weekLabel}`;

  const entries = {};
  OFFICES.forEach((o) => {
    entries[o.id] = findWeekEntry(apWeeksData[o.id], weekLabel);
    renderOfficeAftenpostenStats(o.id, entries[o.id]);
  });

  renderLeaderLine(
    "ap-leader",
    entries.oslo ? averageOf(entries.oslo.days) : null,
    entries.bergen ? averageOf(entries.bergen.days) : null
  );

  const emptyDays = [null, null, null, null, null];

  apChartInstance = new Chart(canvas.getContext("2d"), {
    type: "bar",
    data: {
      labels: COLS.apDayLabels,
      datasets: [
        {
          label: "Oslo",
          data: entries.oslo ? entries.oslo.days : emptyDays,
          backgroundColor: THEME.red,
          borderRadius: 2,
          maxBarThickness: 22,
        },
        {
          label: "Bergen",
          data: entries.bergen ? entries.bergen.days : emptyDays,
          backgroundColor: THEME.bergen,
          borderRadius: 2,
          maxBarThickness: 22,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false }, // shown via .legend-row instead
        tooltip: {
          backgroundColor: THEME.ink,
          bodyFont: { family: "Special Elite", size: 12, weight: "600" },
          displayColors: false,
          callbacks: {
            label: (ctx) =>
              ctx.parsed.y === null
                ? `${ctx.dataset.label}: ikke spilt`
                : `${ctx.dataset.label}: ${ctx.parsed.y} poeng`,
          },
        },
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { color: THEME.inkSoft, font: { family: "Special Elite", size: 11 } },
        },
        y: {
          beginAtZero: true,
          grid: { color: THEME.rule },
          border: { display: false },
          ticks: { color: THEME.inkSoft, font: { family: "Special Elite", size: 10 }, precision: 0 },
        },
      },
    },
  });
}

function renderOfficeAftenpostenStats(officeId, entry) {
  const statsEl = document.getElementById(`ap-week-stats-${officeId}`);

  if (!entry) {
    statsEl.querySelector('[data-stat="sum"]').textContent = "–";
    statsEl.querySelector('[data-stat="avg"]').textContent = "–";
    statsEl.querySelector('[data-stat="days"]').textContent = "–";
    return;
  }

  const played = entry.days.filter((d) => d !== null);
  const sum = played.reduce((a, b) => a + b, 0);
  const avg = played.length ? sum / played.length : 0;

  statsEl.querySelector('[data-stat="sum"]').textContent = played.length ? sum : "–";
  statsEl.querySelector('[data-stat="avg"]').textContent = played.length ? avg.toFixed(1) : "–";
  statsEl.querySelector('[data-stat="days"]').textContent = `${played.length}/5`;
}

function renderLeaderLine(elId, oslo, bergen) {
  const el = document.getElementById(elId);
  if (oslo === null && bergen === null) {
    el.hidden = true;
    return;
  }
  el.hidden = false;
  if (oslo === null || bergen === null) {
    el.textContent = "Ingen sammenligning denne uken \u2013 én av kontorene mangler resultater.";
  } else if (oslo > bergen) {
    el.textContent = "Oslo leder, Bergen henger etter.";
  } else if (bergen > oslo) {
    el.textContent = "Bergen leder, Oslo henger etter.";
  } else {
    el.textContent = "Uavgjort mellom Oslo og Bergen denne uken.";
  }
}

function renderMorgenbladetWeek() {
  const tag = document.getElementById("mb-week-tag");
  const prevBtn = document.getElementById("mb-prev");
  const nextBtn = document.getElementById("mb-next");

  prevBtn.disabled = mbIndex <= 0;
  nextBtn.disabled = mbIndex >= mbUnionWeeks.length - 1;

  const weekLabel = mbIndex >= 0 ? mbUnionWeeks[mbIndex] : null;

  if (!weekLabel) {
    tag.textContent = "Ingen data ennå";
    OFFICES.forEach((o) => renderOfficeMorgenbladetScore(o.id, null));
    renderLeaderLine("mb-leader", null, null);
    return;
  }

  tag.textContent = `Uke ${weekLabel}`;
  const entries = {};
  OFFICES.forEach((o) => {
    entries[o.id] = findWeekEntry(mbWeeksData[o.id], weekLabel);
    renderOfficeMorgenbladetScore(o.id, entries[o.id]);
  });

  renderLeaderLine(
    "mb-leader",
    entries.oslo ? entries.oslo.score : null,
    entries.bergen ? entries.bergen.score : null
  );
}

function renderOfficeMorgenbladetScore(officeId, entry) {
  const numEl = document.getElementById(`mb-score-num-${officeId}`);
  const verdictEl = document.getElementById(`mb-verdict-${officeId}`);
  const streakBadge = document.getElementById(`mb-streak-${officeId}`);
  const weeks = mbWeeksData[officeId];

  if (!entry) {
    numEl.textContent = "–";
    verdictEl.textContent = "Ingen resultat denne uken.";
    streakBadge.hidden = true;
    return;
  }

  numEl.textContent = entry.score;
  verdictEl.textContent = moodMessage(entry.score);

  const idxInOfficeWeeks = weeks.findIndex((w) => w.week === entry.week);
  const streak = computeMbStreak(officeId, idxInOfficeWeeks);
  if (streak >= 2) {
    streakBadge.hidden = false;
    streakBadge.textContent = `\u{1F525} ${streak} uker over middels`;
  } else {
    streakBadge.hidden = true;
  }
}

function computeMbStreak(officeId, uptoIndex) {
  const weeks = mbWeeksData[officeId];
  let streak = 0;
  for (let i = uptoIndex; i >= 0; i--) {
    if (weeks[i].score >= MB_STREAK_THRESHOLD) streak++;
    else break;
  }
  return streak;
}

function averageOf(days) {
  const played = days.filter((d) => d !== null);
  return played.length ? played.reduce((a, b) => a + b, 0) / played.length : null;
}

function moodMessage(score) {
  const pct = score / MB_MAX;
  if (pct >= 0.9) return "Glitrende. Er du sikker på at du ikke jobber i redaksjonen?";
  if (pct >= 0.7) return "Solid uke. Du følger tydeligvis med i tiden.";
  if (pct >= 0.5) return "Middels. Godkjent, men Morgenbladet fortjener bedre.";
  if (pct >= 0.25) return "Svakt. Har avisen egentlig blitt åpnet denne uken?";
  return "Katastrofalt. Vurder et abonnement — eller i det minste overskriftene.";
}

/* ---------- View: over time ---------- */

function renderOverTime() {
  const canvas = document.getElementById("overtime-chart");
  const emptyMsg = document.getElementById("overtime-empty");

  const anyData = OFFICES.some((o) => apWeeksData[o.id].length || mbWeeksData[o.id].length);
  if (!anyData) {
    canvas.style.display = "none";
    emptyMsg.hidden = false;
    return;
  }
  canvas.style.display = "";
  emptyMsg.hidden = true;

  // Union of week labels across every office/quiz, sorted numerically.
  const weekSet = new Set();
  OFFICES.forEach((o) => {
    apWeeksData[o.id].forEach((w) => weekSet.add(w.week));
    mbWeeksData[o.id].forEach((w) => weekSet.add(w.week));
  });
  const weeks = [...weekSet].sort((a, b) => Number(a) - Number(b));

  const datasets = [];
  OFFICES.forEach((o) => {
    const apByWeek = new Map(apWeeksData[o.id].map((w) => [w.week, averageOf(w.days)]));
    const mbByWeek = new Map(mbWeeksData[o.id].map((w) => [w.week, w.score]));
    const apSeries = weeks.map((w) => (apByWeek.has(w) ? round1(apByWeek.get(w)) : null));
    const mbSeries = weeks.map((w) => (mbByWeek.has(w) ? mbByWeek.get(w) : null));
    const borderDash = o.id === "bergen" ? [6, 4] : [];

    datasets.push({
      label: `Aftenposten \u2013 ${o.label}`,
      data: apSeries,
      borderColor: THEME.red,
      backgroundColor: THEME.red,
      borderDash,
      pointRadius: 3,
      pointHoverRadius: 5,
      borderWidth: 2,
      tension: 0.25,
      spanGaps: true,
      yAxisID: "yAP",
    });
    datasets.push({
      label: `Morgenbladet \u2013 ${o.label}`,
      data: mbSeries,
      borderColor: THEME.gold,
      backgroundColor: THEME.gold,
      borderDash,
      pointRadius: 3,
      pointHoverRadius: 5,
      borderWidth: 2,
      tension: 0.25,
      spanGaps: true,
      yAxisID: "yMB",
    });
  });

  new Chart(canvas.getContext("2d"), {
    type: "line",
    data: {
      labels: weeks.map((w) => `U${w}`),
      datasets,
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: "index", intersect: false },
      plugins: {
        legend: { display: false }, // shown via .legend-row instead
        tooltip: {
          backgroundColor: THEME.ink,
          titleFont: { family: "Special Elite", size: 11 },
          bodyFont: { family: "Special Elite", size: 12, weight: "600" },
          padding: 8,
        },
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { color: THEME.inkSoft, font: { family: "Special Elite", size: 10 }, maxRotation: 0, autoSkip: true, maxTicksLimit: 10 },
        },
        yAP: {
          position: "left",
          beginAtZero: true,
          grid: { color: THEME.rule },
          border: { display: false },
          ticks: { color: THEME.red, font: { family: "Special Elite", size: 10 } },
          title: { display: true, text: "Aftenposten", color: THEME.red, font: { family: "Special Elite", size: 10 } },
        },
        yMB: {
          position: "right",
          beginAtZero: true,
          max: MB_MAX,
          grid: { display: false },
          border: { display: false },
          ticks: { color: THEME.gold, font: { family: "Special Elite", size: 10 } },
          title: { display: true, text: "Morgenbladet", color: THEME.gold, font: { family: "Special Elite", size: 10 } },
        },
      },
    },
  });
}

function round1(n) {
  return n === null ? null : Math.round(n * 10) / 10;
}

/* ---------- Masthead date/edition ---------- */

function setEdition() {
  const now = new Date();
  const dateStr = now.toLocaleDateString("nb-NO", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  document.getElementById("edition-date").textContent = dateStr;

  const startOfYear = new Date(now.getFullYear(), 0, 1);
  const dayOfYear = Math.floor((now - startOfYear) / 86400000) + 1;
  document.getElementById("edition-number").textContent =
    `No. ${String(dayOfYear).padStart(3, "0")}`;

  const quote = QUOTES[dayOfYear % QUOTES.length];
  document.getElementById("masthead-quote").textContent = `${quote.q} \u2014 ${quote.a}`;
}

function showStatus(message) {
  const el = document.getElementById("status-line");
  el.textContent = message;
  el.hidden = false;
}
