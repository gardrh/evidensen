/* =========================================================
   Kontorquizen — config

   1. Open your Google Sheet.
   2. Share ▸ General access ▸ "Anyone with the link" ▸ Viewer.
      (Publishing to the web also works, but link-sharing is enough.)
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

  const aftenposten = extractDaily(dataRows);
  const morgenbladet = extractWeekly(dataRows);

  renderSection({
    points: aftenposten,
    canvasId: "ap-chart",
    emptyId: "ap-empty",
    statsId: "ap-stats",
    color: THEME.red,
    unitLabel: "poeng",
  });

  renderSection({
    points: morgenbladet,
    canvasId: "mb-chart",
    emptyId: "mb-empty",
    statsId: "mb-stats",
    color: THEME.gold,
    unitLabel: "poeng",
  });
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

function extractDaily(rows) {
  const points = [];
  for (const row of rows) {
    const week = (row[COLS.apWeek] || "").trim();
    if (!week) continue;
    COLS.apDays.forEach((colIndex, i) => {
      const raw = (row[colIndex] || "").trim();
      if (raw === "") return;
      const value = Number(raw.replace(",", "."));
      if (Number.isNaN(value)) return;
      points.push({ label: `U${week} ${COLS.apDayLabels[i]}`, value });
    });
  }
  return points;
}

function extractWeekly(rows) {
  const points = [];
  for (const row of rows) {
    const week = (row[COLS.mbWeek] || "").trim();
    const raw = (row[COLS.mbScore] || "").trim();
    if (!week || raw === "") continue;
    const value = Number(raw.replace(",", "."));
    if (Number.isNaN(value)) continue;
    points.push({ label: `U${week}`, value });
  }
  return points;
}

/* ---------- Rendering ---------- */

function renderSection({ points, canvasId, emptyId, statsId, color, unitLabel }) {
  const canvas = document.getElementById(canvasId);
  const emptyMsg = document.getElementById(emptyId);
  const statsEl = document.getElementById(statsId);

  if (!points.length) {
    canvas.style.display = "none";
    emptyMsg.hidden = false;
    return;
  }

  const values = points.map((p) => p.value);
  const count = values.length;
  const avg = values.reduce((a, b) => a + b, 0) / count;
  const bestIndex = values.indexOf(Math.max(...values));

  statsEl.querySelector('[data-stat="count"]').textContent = count;
  statsEl.querySelector('[data-stat="avg"]').textContent = avg.toFixed(1);
  statsEl.querySelector('[data-stat="best"]').textContent = `${values[bestIndex]}`;

  new Chart(canvas.getContext("2d"), {
    type: "line",
    data: {
      labels: points.map((p) => p.label),
      datasets: [
        {
          data: values,
          borderColor: color,
          backgroundColor: hexToRgba(color, 0.12),
          pointBackgroundColor: color,
          pointBorderColor: THEME.paperRaised,
          pointBorderWidth: 1.5,
          pointRadius: points.length > 40 ? 0 : 3,
          pointHoverRadius: 5,
          borderWidth: 2,
          fill: true,
          tension: 0.25,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: "index", intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: THEME.ink,
          titleFont: { family: "IBM Plex Mono", size: 11 },
          bodyFont: { family: "IBM Plex Mono", size: 12, weight: "600" },
          padding: 8,
          displayColors: false,
          callbacks: {
            label: (ctx) => `${ctx.parsed.y} ${unitLabel}`,
          },
        },
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: {
            color: THEME.inkSoft,
            font: { family: "IBM Plex Mono", size: 10 },
            maxRotation: 0,
            autoSkip: true,
            maxTicksLimit: 8,
          },
        },
        y: {
          beginAtZero: true,
          grid: { color: THEME.rule },
          border: { display: false },
          ticks: {
            color: THEME.inkSoft,
            font: { family: "IBM Plex Mono", size: 10 },
            precision: 0,
          },
        },
      },
    },
  });
}

function hexToRgba(hex, alpha) {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
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
