/* =========================================================
   Kontorquizen — "Aktuelt" from Norwegian Wikipedia

   Pulls the current-events list straight from the "hovedsaker"
   (main headlines) subpage that feeds the "Aktuelt" box on
   no.wikipedia.org/wiki/Forside, via the public MediaWiki API.
   No API key needed — origin=* asks the API to allow the request
   from any domain, which is how the read API supports anonymous
   cross-site fetches.

   Deliberately NOT fetching the combined Mal:Aktuelt page, since
   that also pulls in several other boxes we don't want here:
   Mal:Aktuelt/saker (background events), Mal:Aktuelt/kultur
   (culture), Mal:Aktuelt/sport (sport), Mal:Avdøde (deaths),
   Mal:Gode nye (new good articles), Mal:Ukens artikkel (article
   of the week). Mal:Aktuelt/hovedsaker is just the main headlines.
   ========================================================= */

const WIKI_AKTUELT_API_URL =
  "https://no.wikipedia.org/w/api.php?action=parse&page=Mal%3AAktuelt%2Fhovedsaker&prop=text&formatversion=2&format=json&origin=*";

async function fetchWikiAktuelt() {
  const res = await fetch(WIKI_AKTUELT_API_URL);
  if (!res.ok) throw new Error(`Wikipedia API-feil: ${res.status}`);
  const data = await res.json();
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
