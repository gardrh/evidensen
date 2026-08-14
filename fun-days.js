/* =========================================================
   Kontorquizen — fun & food days

   A year-round list of Norwegian/international food and fun
   observance days. Dates repeat every year — either a fixed
   calendar date, the Nth weekday of a month, the last weekday
   of a month, or an offset from Easter Sunday (for the movable
   Fastelavn/pancake-day tradition).

   Sources: common Norwegian "matdager/temadager" calendars
   (Almanakken.no, MENY, Kalenderguiden, Unibake m.fl.).
   ========================================================= */

const FUN_DAYS = [
  { type: "fixed", month: 1, day: 1, name: "internasjonale pizzadagen" },
  { type: "fixed", month: 1, day: 13, name: "tjuendedag jul" },
  { type: "fixed", month: 1, day: 17, name: "grisens dag" },
  { type: "fixed", month: 1, day: 30, name: "internasjonale croissantdagen" },
  { type: "nth-weekday", month: 2, weekday: 0, nth: 2, name: "morsdag" },
  { type: "fixed", month: 2, day: 14, name: "alle hjerters dag" },
  { type: "easter-offset", offset: -47, name: "feitetirsdag \u2014 pannekakedagen" },
  { type: "fixed", month: 3, day: 6, name: "fiskens dag" },
  { type: "fixed", month: 3, day: 25, name: "vaffeldagen" },
  { type: "fixed", month: 4, day: 4, name: "gulrotens dag" },
  { type: "fixed", month: 4, day: 8, name: "kakedagen" },
  { type: "fixed", month: 6, day: 1, name: "verdens melkedag" },
  { type: "nth-weekday", month: 6, weekday: 6, nth: 2, name: "sjømatens dag" },
  { type: "fixed", month: 6, day: 23, name: "sankthans" },
  { type: "fixed", month: 7, day: 16, name: "internasjonale pølsedagen" },
  { type: "nth-weekday", month: 9, weekday: 6, nth: 1, name: "internasjonale bacondagen" },
  { type: "fixed", month: 9, day: 13, name: "internasjonale sjokoladedagen" },
  { type: "fixed", month: 9, day: 29, name: "dagen mot matsvinn" },
  { type: "last-weekday", month: 9, weekday: 4, name: "fårikålens festdag" },
  { type: "last-weekday", month: 9, weekday: 2, name: "norsk epledag" },
  { type: "fixed", month: 10, day: 1, name: "verdens vegetardag" },
  { type: "nth-weekday", month: 10, weekday: 5, nth: 2, name: "verdens eggdag" },
  { type: "fixed", month: 10, day: 4, name: "kanelbolledagen" },
  { type: "fixed", month: 10, day: 16, name: "verdens brøddag" },
  { type: "fixed", month: 10, day: 31, name: "halloween" },
  { type: "nth-weekday", month: 11, weekday: 0, nth: 2, name: "farsdag" },

  // Navnedager (Norwegian name days), verified against Almanakkforlaget-
  // based calendars (klikk.no/Navneguiden, Store norske leksikon).
  { type: "fixed", month: 4, day: 4, name: "navnedagen til Nina" },
  { type: "fixed", month: 4, day: 23, name: "navnedagen til Georg" },
  { type: "fixed", month: 5, day: 30, name: "navnedagen til Gard" },
  { type: "fixed", month: 7, day: 3, name: "navnedagen til Andrea" },
  { type: "fixed", month: 7, day: 29, name: "navnedagen til Olav" },
  { type: "fixed", month: 9, day: 6, name: "navnedagen til Siv" },
  { type: "fixed", month: 9, day: 18, name: "navnedagen til Henriette" },
  { type: "fixed", month: 12, day: 6, name: "navnedagen til Niklas" },
];

// --- date helpers ---------------------------------------------------

// JS weekday convention: Sunday=0 ... Saturday=6.
function nthWeekdayOfMonth(year, month, weekday, nth) {
  const first = new Date(year, month - 1, 1);
  const offset = (weekday - first.getDay() + 7) % 7;
  const day = 1 + offset + (nth - 1) * 7;
  return new Date(year, month - 1, day);
}

function lastWeekdayOfMonth(year, month, weekday) {
  const lastDay = new Date(year, month, 0).getDate();
  const last = new Date(year, month - 1, lastDay);
  const diff = (last.getDay() - weekday + 7) % 7;
  return new Date(year, month - 1, lastDay - diff);
}

// Anonymous Gregorian algorithm for Easter Sunday.
function easterSunday(year) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

function expandFunDay(entry, year) {
  switch (entry.type) {
    case "fixed":
      return new Date(year, entry.month - 1, entry.day);
    case "nth-weekday":
      return nthWeekdayOfMonth(year, entry.month, entry.weekday, entry.nth);
    case "last-weekday":
      return lastWeekdayOfMonth(year, entry.month, entry.weekday);
    case "easter-offset": {
      const d = easterSunday(year);
      d.setDate(d.getDate() + entry.offset);
      return d;
    }
    default:
      return null;
  }
}

function isSameDate(a, b) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function getFunDaysOn(date) {
  const year = date.getFullYear();
  return FUN_DAYS.filter((entry) => isSameDate(expandFunDay(entry, year), date)).map(
    (entry) => entry.name
  );
}

// Returns { today: [...names], tomorrow: [...names] }
function getFunDayBanner(referenceDate) {
  const today = referenceDate ? new Date(referenceDate) : new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  return {
    today: getFunDaysOn(today),
    tomorrow: getFunDaysOn(tomorrow),
  };
}
