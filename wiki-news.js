/* =========================================================
   Kontorquizen — "Aktuelt" from Norwegian Wikipedia

   Pulls the current-events list from the combined "Aktuelt" box
   (Mal:Aktuelt) that powers no.wikipedia.org/wiki/Forside, via the
   public MediaWiki API. No API key needed — origin=* asks the API
   to allow the request from any domain, which is how the read API
   supports anonymous cross-site fetches.

   Mal:Aktuelt itself combines several sub-lists, some of which we
   don't want here. Rather than guessing at a single "main headlines
   only" subpage name (fragile — got a placeholder/doc page by
   mistake last time), this fetches the combined box PLUS each
   excluded sub-list individually, then removes any line from the
   combined box whose text matches something from an excluded list:
     - Mal:Aktuelt/saker    (background events)
     - Mal:Aktuelt/kultur   (culture)
     - Mal:Aktuelt/sport    (sport)
     - Mal:Avdøde           (deaths)
     - Mal:Gode nye         (new good articles)
     - Mal:Ukens artikkel   (article of the week)
   Whatever's left is the main headline items.
   ========================================================= */

const WIKI_API_BASE = "https://no.wikipedia.org/w/api.php";
const WIKI_MAIN_PAGE = "Mal:Aktuelt";
const WIKI_EXCLUDED_PAGES = [
  "Mal:Aktuelt/saker",
  "Mal:Aktuelt/kultur",
  "Mal:Aktuelt/sport",
  "Mal:Avdøde",
  "Mal:Gode nye",
  "Mal:Ukens artikkel",
];

async function wikiApiFetch(params) {
  const url = `${WIKI_API_BASE}?${new URLSearchParams({
    format: "json",
    formatversion: "2",
    origin: "*",
    ...params,
  })}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Wikipedia API-feil: ${res.status}`);
  return res.json();
}

async function fetchPageListItems(page) {
  const data = await wikiApiFetch({ action: "parse", page, prop: "text" });
  const html = data && data.parse && data.parse.text;
  if (!html) return [];

  const doc = new DOMParser().parseFromString(html, "text/html");
  return [...doc.querySelectorAll("li")]
    .map((li) => {
      const link = li.querySelector("a[href]");
      let url = link ? link.getAttribute("href") : null;
      if (url && url.startsWith("/")) url = `https://no.wikipedia.org${url}`;
      const text = li.textContent.replace(/\s+/g, " ").trim();
      return { text, url };
    })
    .filter((item) => item.text.length > 0);
}

async function fetchWikiAktuelt() {
  const [combined, ...excludedLists] = await Promise.all([
    fetchPageListItems(WIKI_MAIN_PAGE),
    ...WIKI_EXCLUDED_PAGES.map((page) => fetchPageListItems(page).catch(() => [])),
  ]);

  const excludedTexts = new Set(excludedLists.flat().map((item) => item.text));
  return combined.filter((item) => !excludedTexts.has(item.text));
}
