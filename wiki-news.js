/* =========================================================
   Kontorquizen — "Aktuelt" from Norwegian Wikipedia

   Parses the real Forside page and reads straight out of the
   "Aktuelt" box (<div id="aktuelt">). Confirmed structure:

     <div id="aktuelt" class="forsideboks ...">
       <h3>Aktuelt</h3>
       <ul>                     <-- the real headlines: what we want
         <li>...</li>
       </ul>
       <hr>
       <table>                  <-- Bakgrunn / Samfunn / Kultur / Sport
         <tr><td>Bakgrunn:</td><td>links separated by "•"</td></tr>
         ...
       </table>
     </div>

   The table has no <li> elements at all (just "•"-separated links in
   table cells), so scoping to "#aktuelt li" naturally picks up only
   the real headline list and skips Bakgrunn/Samfunn/Kultur/Sport —
   no extra filtering needed. Mal:Avdøde, Mal:Gode nye, and
   Mal:Ukens artikkel are entirely separate boxes elsewhere on the
   page, so they're excluded automatically too.

   No API key needed — origin=* asks the API to allow the request
   from any domain, which is how the read API supports anonymous
   cross-site fetches.
   ========================================================= */

const WIKI_API_BASE = "https://no.wikipedia.org/w/api.php";
const WIKI_FRONT_PAGE = "Forside";

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

async function fetchWikiAktuelt() {
  const data = await wikiApiFetch({ action: "parse", page: WIKI_FRONT_PAGE, prop: "text" });
  const html = data && data.parse && data.parse.text;
  if (!html) throw new Error("Uventet svar fra Wikipedia API");

  const doc = new DOMParser().parseFromString(html, "text/html");
  const box = doc.querySelector("#aktuelt");
  if (!box) throw new Error("Fant ikke #aktuelt-boksen på forsiden");

  const items = [...box.querySelectorAll("li")]
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
