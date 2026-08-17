/* =========================================================
   Kontorquizen — vær fra Yr / MET Norway

   Uses the free MET Norway Weather API (api.met.no), the same data
   that powers Yr. Two products:
     - locationforecast/2.0/compact  — the 08–17 hourly forecast
     - nowcast/2.0/complete          — rain in the next ~90 minutes
       (Nordic countries only; used for Oslo per request)

   NOTE on calling this from a browser: MET's docs recommend
   server-side calls with a custom User-Agent identifying your app.
   Browsers won't let JS set a custom User-Agent — MET's API instead
   identifies the caller by the Origin header the browser sends
   automatically, which is fine for a real, low-traffic site like
   this one (their warning is really about localhost / anonymous
   traffic). No API key needed either way.
   ========================================================= */

const MET_API_BASE = "https://api.met.no/weatherapi";

const WEATHER_LOCATIONS = [
  { name: "Meltzersgate 4, Oslo", lat: 59.9175307, lon: 10.7203985, nowcast: true },
  { name: "Villaveien 5, Bergen", lat: 60.3859335, lon: 5.3229234, nowcast: true },
];

const WEATHER_FROM_HOUR = 8;
const WEATHER_TO_HOUR = 17;
const WEATHER_HOUR_STEP = 2; // every other hour, to keep the row compact

// Short Norwegian labels + a small icon per MET symbol_code family
// (the _day/_night/_polartwilight suffix is stripped before lookup).
const SYMBOL_INFO = {
  clearsky: { label: "Klart", icon: "\u2600\uFE0F" },
  fair: { label: "Lettskyet", icon: "\uD83C\uDF24\uFE0F" },
  partlycloudy: { label: "Delvis skyet", icon: "\u26C5" },
  cloudy: { label: "Skyet", icon: "\u2601\uFE0F" },
  fog: { label: "Tåke", icon: "\uD83C\uDF2B\uFE0F" },
  lightrain: { label: "Lett regn", icon: "\uD83C\uDF26\uFE0F" },
  lightrainshowers: { label: "Regnbyger", icon: "\uD83C\uDF26\uFE0F" },
  rain: { label: "Regn", icon: "\uD83C\uDF27\uFE0F" },
  rainshowers: { label: "Regnbyger", icon: "\uD83C\uDF27\uFE0F" },
  heavyrain: { label: "Kraftig regn", icon: "\uD83C\uDF27\uFE0F" },
  heavyrainshowers: { label: "Kraftige byger", icon: "\uD83C\uDF27\uFE0F" },
  lightsleet: { label: "Lett sludd", icon: "\uD83C\uDF28\uFE0F" },
  sleet: { label: "Sludd", icon: "\uD83C\uDF28\uFE0F" },
  sleetshowers: { label: "Sluddbyger", icon: "\uD83C\uDF28\uFE0F" },
  heavysleet: { label: "Kraftig sludd", icon: "\uD83C\uDF28\uFE0F" },
  lightsnow: { label: "Lett snø", icon: "\u2744\uFE0F" },
  snow: { label: "Snø", icon: "\u2744\uFE0F" },
  snowshowers: { label: "Snøbyger", icon: "\u2744\uFE0F" },
  heavysnow: { label: "Kraftig snø", icon: "\u2744\uFE0F" },
  lightrainandthunder: { label: "Tordenbyger", icon: "\u26C8\uFE0F" },
  rainandthunder: { label: "Torden og regn", icon: "\u26C8\uFE0F" },
  heavyrainandthunder: { label: "Kraftig torden", icon: "\u26C8\uFE0F" },
  thunder: { label: "Torden", icon: "\u26C8\uFE0F" },
};

function symbolInfo(code) {
  if (!code) return { label: "\u2014", icon: "\u2014" };
  const base = code.replace(/_(day|night|polartwilight)$/, "");
  return SYMBOL_INFO[base] || { label: base, icon: "\u2014" };
}

async function metFetch(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`MET API-feil: ${res.status}`);
  return res.json();
}

function localDateKey(d) {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function minutesFromNow(isoTime) {
  return Math.round((new Date(isoTime).getTime() - Date.now()) / 60000);
}

async function fetchTodayHourly(lat, lon) {
  const data = await metFetch(
    `${MET_API_BASE}/locationforecast/2.0/compact?lat=${lat}&lon=${lon}`
  );
  const series = data.properties.timeseries;
  const todayKey = localDateKey(new Date());

  return series
    .map((entry) => {
      const t = new Date(entry.time);
      const symbol =
        (entry.data.next_1_hours && entry.data.next_1_hours.summary.symbol_code) ||
        (entry.data.next_6_hours && entry.data.next_6_hours.summary.symbol_code) ||
        null;
      return {
        dateKey: localDateKey(t),
        hour: t.getHours(),
        temp: entry.data.instant.details.air_temperature,
        symbol,
      };
    })
    .filter(
      (e) =>
        e.dateKey === todayKey &&
        e.hour >= WEATHER_FROM_HOUR &&
        e.hour <= WEATHER_TO_HOUR &&
        (e.hour - WEATHER_FROM_HOUR) % WEATHER_HOUR_STEP === 0
    );
}

async function fetchNowcastSummary(lat, lon) {
  const data = await metFetch(`${MET_API_BASE}/nowcast/2.0/complete?lat=${lat}&lon=${lon}`);
  const withinWindow = data.properties.timeseries.filter((t) => {
    const mins = minutesFromNow(t.time);
    return mins >= -5 && mins <= 90;
  });
  const wet = withinWindow.find((t) => {
    const rate = t.data.instant && t.data.instant.details.precipitation_rate;
    return typeof rate === "number" && rate > 0.1;
  });
  if (!wet) return { rain: false };
  return { rain: true, minutes: Math.max(0, minutesFromNow(wet.time)) };
}
