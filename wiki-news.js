/* =========================================================
   Kontorquizen — "Aktuelt" from Norwegian Wikipedia

   Pulls the current-events list straight from the template that
   powers the "Aktuelt" box on no.wikipedia.org/wiki/Forside
   (Mal:Aktuelt), via the public MediaWiki API. No API key needed —
   origin=* asks the API to allow the request from any domain, which
   is how the read API supports anonymous cross-site fetches.
   ========================================================= */

const WIKI_AKTUELT_API_URL =
  "https://no.wikipedia.org/w/api.php?action=parse&page=Mal%3AAktuelt&prop=text&formatversion=2&format=json&origin=*";

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
