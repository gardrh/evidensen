# Kontorquizen

A small front page that tracks two office quizzes over time, straight from a
Google Sheet:

- **Aftenposten** — daily quiz, Monday–Friday
- **Morgenbladet** — weekly quiz

No backend, no build step. It's three files that read your sheet as CSV
in the browser.

## 1. Point it at your sheet

Open `script.js` and edit the top:

```js
const SHEET_ID = "PASTE_YOUR_SHEET_ID_HERE";
const GID = "0";
```

- `SHEET_ID` is the long string in your sheet's URL:
  `https://docs.google.com/spreadsheets/d/`**`THIS_PART`**`/edit`
- `GID` is which tab to read. The first tab is usually `0`. If your data
  lives on another tab, open it and copy the `gid=` number from the URL.

Then make the sheet readable without login:
**Share → General access → "Anyone with the link" → Viewer.**
(You don't need to use Google's "Publish to web" feature — plain
link-sharing is enough for this.)

The sheet is expected to match the layout in your screenshot:

| | A | B | C | D | E | F | ... | I | J |
|---|---|---|---|---|---|---|---|---|---|
| 1 | Aftenposten | | | | | | | Morgenbladet | |
| 2 | Uke | Mandag | Tirsdag | Onsdag | Torsdag | Fredag | | Uke | Score |
| 3+ | 33 | 11 | 12 | 9 | 14 | | | 33 | 14 |

If your columns end up somewhere else, adjust the `COLS` object near the
top of `script.js` — it just holds column indices (A=0, B=1, ...).

## 2. Add your logos

Drop two image files into `assets/`:

- `assets/logo.png` — Aftenposten
- `assets/logo1.png` — Morgenbladet

If a file's missing, that logo slot just stays empty; nothing else breaks.

## 3. Publish on GitHub Pages

```bash
git init
git add .
git commit -m "Kontorquizen"
git branch -M main
git remote add origin https://github.com/gardrh/YOUR_REPO_NAME.git
git push -u origin main
```

Then in the repo on GitHub: **Settings → Pages → Source → Deploy from
branch → `main` / `(root)`**. Your page will be live at
`https://gardrh.github.io/YOUR_REPO_NAME/` a minute or two later.

## Notes

- Charts are drawn with [Chart.js](https://www.chartjs.org/) (loaded from
  a CDN, no install needed).
- The page re-fetches the sheet fresh on every load — no caching, so
  new results show up as soon as someone reloads the page.
- If nothing shows up, open the browser console — the most common cause
  is the sheet not being shared as "Anyone with the link."
