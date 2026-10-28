# Fix Your Hometown

An interactive map of Africa for the **EF Hult Prize at ALU Rwanda**. Students pin one real problem from their hometown, browse problems by country or theme, and find teammates.

- **Website:** `index.html` (one file), hosted free on GitHub Pages.
- **Data:** a Google Sheet you own, connected with Google Apps Script (`apps-script/Code.gs`).

## 1. Set up the Google Sheet (10 min)

1. Create a new Google Sheet, e.g. "Fix Your Hometown – Pins".
2. In the sheet: **Extensions → Apps Script**.
3. Delete what's in `Code.gs` and paste everything from `apps-script/Code.gs`. Save.
4. At the top, choose the function **setup** and click **Run**. Accept the permissions (it's your own script). A tab called **Pins** appears with headers.
5. Click **Deploy → New deployment → ⚙️ → Web app**:
   - Execute as: **Me**
   - Who has access: **Anyone**
   - Click **Deploy** and copy the **Web app URL** (starts with `https://script.google.com/macros/s/...`).

## 2. Connect the website

Open `index.html`, find this line near the bottom and paste your URL between the quotes:

```js
const API_URL = "PASTE_YOUR_APPS_SCRIPT_URL_HERE";
```

## 3. Put it online with GitHub Pages

1. On GitHub, create a new public repository, e.g. `fix-your-hometown`.
2. Upload `index.html` and `README.md` (and the `apps-script` folder if you like).
3. **Settings → Pages → Build and deployment → Deploy from a branch → main / (root) → Save**.
4. After a minute your site is live at `https://<your-username>.github.io/fix-your-hometown/`.

## Managing pins

- Every pin is a row in the **Pins** tab, with each student's full name, email and phone. Email and phone appear on the website only if the student ticks "Show my email and phone".
- You can sort, filter or export the sheet like any other.
- To hide a pin from the website, type `TRUE` in its **hidden** column.
- Never share the **token** column: it lets each student edit their own pin.
- Students can edit or remove their own pin from the same browser they used to create it.

## If you change Code.gs later

**Deploy → Manage deployments → ✏️ Edit → Version: New version → Deploy.** The URL stays the same.
