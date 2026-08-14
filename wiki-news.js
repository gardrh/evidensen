/* =========================================================
   Kontorquizen — "Aktuelt" from Norwegian Wikipedia

   Pulls the current-events list from whichever "Aktuelt/..."
   subtemplate is the main-headlines one, via the public MediaWiki
   API. No API key needed — origin=* asks the API to allow the
   request from any domain, which is how the read API supports
   anonymous cross-site fetches.

   Deliberately excludes: Mal:Aktuelt/saker (background events),
   Mal:Aktuelt/kultur (culture), Mal:Aktuelt/sport (sport),
   Mal:Avdøde (deaths), Mal:Gode nye (new good articles),
   Mal:Ukens artikkel (article of the week).

   Rather than hardcoding the exact main-headlines subpage name
   (which is easy to get wrong and silently break), this asks
   Wikipedia itself: it fetches the full list of templates used on
   Forside, finds the "Mal:Aktuelt/…" ones, and picks whichever
   isn't on the exclude list above. Self-correcting if Wikipedia
   ever renames things.
   ========================================================= */

const WIKI_API_BASE = "https://no.wikipedia.org/w/api.php";

const WIKI_EXCLUDED_TEMPLATES = [
  "mal:aktuelt/saker",
  "mal:aktuelt/kultur",
  "mal:aktuelt/sport",
  "mal:avdøde",
  "mal:gode nye",
  "mal:ukens artikkel",
];

// Fallback guess, used only if the discovery step itself fails
// (e.g. network hiccup) — best-effort, not load-bearing.
const WIKI_FALLBACK_PAGE = "Mal:Aktuelt/hovedsaker";

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

async function discoverAktueltHeadlinePage() {
  const data = await wikiApiFetch({
    action: "parse",
    page: "Forside",
    prop: "templates",
  });
  const templates = (data.parse && data.parse.templates) || [];
  const candidates = templates
    .map((t) => t.title)
    .filter((title) => /^Mal:Aktuelt\//i.test(title))
    .filter((title) => !WIKI_EXCLUDED_TEMPLATES.includes(title.toLowerCase()));
  return candidates[0] || null;
}

async function fetchWikiAktuelt() {
  let pageName = WIKI_FALLBACK_PAGE;
  try {
    const discovered = await discoverAktueltHeadlinePage();
    if (discovered) pageName = discovered;
  } catch (err) {
    console.warn("Fant ikke Aktuelt-malen dynamisk, bruker reserveløsning.", err);
  }

  const data = await wikiApiFetch({
    action: "parse",
    page: pageName,
    prop: "text",
  });
  const html = data && data.parse && data.parse.text;
  if (!html) throw new Error("Uventet svar fra Wikipedia API");

  const doc = new DOMParser().parseFromString(html, "text/html");
  const items = [...doc.querySelectorAll("li")]
    .map((li) => {
      const link = li.querySelector("a[href]");
      let url = link ? link.getAttribute("href") : null;
      if (url && url.startsWith("/")) url = `https://no.wikipedia.org${url}`;
      const text = li.textContent.replace(/\s+/g, " ").trim();
      return { text, url };
    })
    .filter((item) => item.text.length > 0);

  return items;
}
