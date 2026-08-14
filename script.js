/* =========================================================
   Kontorquizen — config

   1. Open your Google Sheet.
   2. Share ▸ General access ▸ "Anyone with the link" ▸ Viewer.
   3. Copy the long ID from the sheet's URL:
      https://docs.google.com/spreadsheets/d/  >>THIS_PART<<  /edit
   4. If your data isn't on the first tab, open that tab and copy the
      gid= number from the URL. First tab is usually gid=0.
   ========================================================= */

const SHEET_ID = "1dhbJuSthEbjoDJhrP5NF6FmgeKiSocucrFgnc0p5aVU";
const GID = "0";

const CSV_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${GID}`;

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

/* ========================================================= */

const THEME = {
  ink: "#1C2233",
  inkSoft: "#4A5066",
  rule: "#C9C2AE",
  red: "#B3222A",
  gold: "#A9812F",
  paperRaised: "#F5F2E9",
};

document.addEventListener("DOMContentLoaded", init);

async function init() {
  setEdition();
  setupTabs();

  let rows;
  try {
    rows = await fetchSheet();
  } catch (err) {
    showStatus(
      "Kunne ikke hente data fra arket. Sjekk at det er delt med \u00abAlle med lenken\u00bb, og at SHEET_ID i script.js er riktig."
    );
    console.error(err);
    return;
  }

  const dataRows = rows.slice(DATA_START_ROW);
  const apWeeks = extractAftenpostenWeeks(dataRows);
  const mbWeeks = extractMorgenbladetWeeks(dataRows);

  renderThisWeek(apWeeks, mbWeeks);
  renderOverTime(apWeeks, mbWeeks);
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

async function fetchSheet() {
  const res = await fetch(CSV_URL, { cache: "no-store" });
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

function renderThisWeek(apWeeks, mbWeeks) {
  renderAftenpostenWeek(apWeeks.length ? apWeeks[apWeeks.length - 1] : null);
  renderMorgenbladetWeek(mbWeeks.length ? mbWeeks[mbWeeks.length - 1] : null);
}

function renderAftenpostenWeek(current) {
  const tag = document.getElementById("ap-week-tag");
  const canvas = document.getElementById("ap-week-chart");
  const emptyMsg = document.getElementById("ap-week-empty");
  const statsEl = document.getElementById("ap-week-stats");

  if (!current) {
    tag.textContent = "Ingen data ennå";
    canvas.style.display = "none";
    emptyMsg.hidden = false;
    return;
  }

  tag.textContent = `Uke ${current.week}`;

  const played = current.days.filter((d) => d !== null);
  const sum = played.reduce((a, b) => a + b, 0);
  const avg = played.length ? sum / played.length : 0;

  statsEl.querySelector('[data-stat="sum"]').textContent = played.length ? sum : "–";
  statsEl.querySelector('[data-stat="avg"]').textContent = played.length ? avg.toFixed(1) : "–";
  statsEl.querySelector('[data-stat="days"]').textContent = `${played.length}/5`;

  new Chart(canvas.getContext("2d"), {
    type: "bar",
    data: {
      labels: COLS.apDayLabels,
      datasets: [
        {
          data: current.days,
          backgroundColor: THEME.red,
          borderRadius: 2,
          maxBarThickness: 42,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: THEME.ink,
          bodyFont: { family: "IBM Plex Mono", size: 12, weight: "600" },
          displayColors: false,
          callbacks: {
            label: (ctx) => (ctx.parsed.y === null ? "Ikke spilt" : `${ctx.parsed.y} poeng`),
          },
        },
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { color: THEME.inkSoft, font: { family: "IBM Plex Mono", size: 11 } },
        },
        y: {
          beginAtZero: true,
          grid: { color: THEME.rule },
          border: { display: false },
          ticks: { color: THEME.inkSoft, font: { family: "IBM Plex Mono", size: 10 }, precision: 0 },
        },
      },
    },
  });
}

function renderMorgenbladetWeek(current) {
  const tag = document.getElementById("mb-week-tag");
  const numEl = document.getElementById("mb-score-num");
  const verdictEl = document.getElementById("mb-verdict");

  if (!current) {
    tag.textContent = "Ingen data ennå";
    numEl.textContent = "–";
    verdictEl.textContent = "Venter på denne ukens resultat …";
    return;
  }

  tag.textContent = `Uke ${current.week}`;
  numEl.textContent = current.score;
  verdictEl.textContent = moodMessage(current.score);
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

function renderOverTime(apWeeks, mbWeeks) {
  const canvas = document.getElementById("overtime-chart");
  const emptyMsg = document.getElementById("overtime-empty");

  if (!apWeeks.length && !mbWeeks.length) {
    canvas.style.display = "none";
    emptyMsg.hidden = false;
    return;
  }

  // Union of week labels, sorted numerically, oldest to newest.
  const weekSet = new Set([
    ...apWeeks.map((w) => w.week),
    ...mbWeeks.map((w) => w.week),
  ]);
  const weeks = [...weekSet].sort((a, b) => Number(a) - Number(b));

  const apByWeek = new Map(
    apWeeks.map((w) => {
      const played = w.days.filter((d) => d !== null);
      const avg = played.length ? played.reduce((a, b) => a + b, 0) / played.length : null;
      return [w.week, avg];
    })
  );
  const mbByWeek = new Map(mbWeeks.map((w) => [w.week, w.score]));

  const apSeries = weeks.map((w) => (apByWeek.has(w) ? round1(apByWeek.get(w)) : null));
  const mbSeries = weeks.map((w) => (mbByWeek.has(w) ? mbByWeek.get(w) : null));

  new Chart(canvas.getContext("2d"), {
    type: "line",
    data: {
      labels: weeks.map((w) => `U${w}`),
      datasets: [
        {
          label: "Aftenposten (ukesnitt)",
          data: apSeries,
          borderColor: THEME.red,
          backgroundColor: THEME.red,
          pointRadius: 3,
          pointHoverRadius: 5,
          borderWidth: 2,
          tension: 0.25,
          spanGaps: true,
          yAxisID: "yAP",
        },
        {
          label: "Morgenbladet (poeng)",
          data: mbSeries,
          borderColor: THEME.gold,
          backgroundColor: THEME.gold,
          pointRadius: 3,
          pointHoverRadius: 5,
          borderWidth: 2,
          tension: 0.25,
          spanGaps: true,
          yAxisID: "yMB",
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: "index", intersect: false },
      plugins: {
        legend: { display: false }, // shown via .legend-row instead
        tooltip: {
          backgroundColor: THEME.ink,
          titleFont: { family: "IBM Plex Mono", size: 11 },
          bodyFont: { family: "IBM Plex Mono", size: 12, weight: "600" },
          padding: 8,
        },
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { color: THEME.inkSoft, font: { family: "IBM Plex Mono", size: 10 }, maxRotation: 0, autoSkip: true, maxTicksLimit: 10 },
        },
        yAP: {
          position: "left",
          beginAtZero: true,
          grid: { color: THEME.rule },
          border: { display: false },
          ticks: { color: THEME.red, font: { family: "IBM Plex Mono", size: 10 } },
          title: { display: true, text: "Aftenposten", color: THEME.red, font: { family: "IBM Plex Mono", size: 10 } },
        },
        yMB: {
          position: "right",
          beginAtZero: true,
          max: MB_MAX,
          grid: { display: false },
          border: { display: false },
          ticks: { color: THEME.gold, font: { family: "IBM Plex Mono", size: 10 } },
          title: { display: true, text: "Morgenbladet", color: THEME.gold, font: { family: "IBM Plex Mono", size: 10 } },
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
}

function showStatus(message) {
  const el = document.getElementById("status-line");
  el.textContent = message;
  el.hidden = false;
}
