/**
 * Fix Your Hometown — Google Sheets backend (Apps Script web app)
 * EF Hult Prize at ALU Rwanda
 *
 * Every pin is one row in the "Pins" sheet.
 * To hide a pin from the website, type TRUE in its "hidden" column.
 * Never share the "token" column: it lets a student edit their own pin.
 */

const SHEET_NAME = 'Pins';
const HEADERS = ['id', 'token', 'at', 'name', 'country', 'city', 'category', 'problem', 'team', 'contact', 'hidden'];

const COUNTRY_CODES = ['MA','DZ','TN','LY','EG','CV','MR','ML','NE','TD','SD','ER','SN','GM','BF','NG','CF','SS','ET','DJ',
  'GW','GN','CI','GH','CM','UG','KE','SO','SL','LR','TG','BJ','GA','CD','RW','ST','GQ','CG','BI','TZ','SC','AO','ZM','MW',
  'KM','NA','BW','ZW','MZ','MG','ZA','LS','SZ','MU','XX'];
const CATEGORIES = ['Health','Education','Water & sanitation','Energy','Food & agriculture','Jobs & income',
  'Climate & environment','Transport','Other'];

/** Run this once from the editor (select "setup" then click Run). */
function setup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME);
  sh.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]).setFontWeight('bold');
  sh.setFrozenRows(1);
}

function sheet_() {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
  if (!sh) throw new Error('Run setup() first.');
  return sh;
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function clean_(v, max) {
  return String(v == null ? '' : v).replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, max);
}

/** GET ?action=list → all visible pins (tokens are never sent). */
function doGet(e) {
  try {
    const rows = sheet_().getDataRange().getValues();
    const pins = [];
    for (let i = 1; i < rows.length; i++) {
      const r = rows[i];
      if (!r[0] || r[10] === true || String(r[10]).toUpperCase() === 'TRUE') continue;
      pins.push({
        id: r[0], at: Number(r[2]) || 0, name: r[3], country: r[4], city: r[5],
        category: r[6], problem: r[7], team: r[8] === true || String(r[8]).toUpperCase() === 'TRUE', contact: r[9]
      });
    }
    return json_({ ok: true, pins: pins });
  } catch (err) {
    return json_({ ok: false, error: String(err.message || err) });
  }
}

/** POST {action:"save"|"delete", ...} */
function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    const body = JSON.parse(e.postData.contents || '{}');
    const sh = sheet_();
    const rows = sh.getDataRange().getValues();
    const findRow = function (id, token) {
      for (let i = 1; i < rows.length; i++) {
        if (rows[i][0] === id && rows[i][1] === token) return i + 1; // sheet row number
      }
      return -1;
    };

    if (body.action === 'delete') {
      const row = findRow(clean_(body.id, 64), clean_(body.token, 64));
      if (row < 0) return json_({ ok: false, error: 'Pin not found' });
      sh.deleteRow(row);
      return json_({ ok: true });
    }

    if (body.action === 'save') {
      const pin = {
        name: clean_(body.name, 30),
        country: clean_(body.country, 2).toUpperCase(),
        city: clean_(body.city, 40),
        category: clean_(body.category, 30),
        problem: clean_(body.problem, 240),
        team: body.team === true,
        contact: clean_(body.contact, 60)
      };
      if (!pin.name) return json_({ ok: false, error: 'Name is required' });
      if (COUNTRY_CODES.indexOf(pin.country) < 0) return json_({ ok: false, error: 'Unknown country' });
      if (CATEGORIES.indexOf(pin.category) < 0) return json_({ ok: false, error: 'Unknown theme' });
      if (pin.problem.length < 15) return json_({ ok: false, error: 'Problem is too short' });
      // Stop formulas being injected into the sheet
      ['name', 'city', 'problem', 'contact'].forEach(function (k) {
        if (/^[=+\-@]/.test(pin[k])) pin[k] = "'" + pin[k];
      });

      const now = Date.now();
      if (body.id && body.token) {
        const row = findRow(clean_(body.id, 64), clean_(body.token, 64));
        if (row > 0) {
          const hidden = rows[row - 1][10];
          sh.getRange(row, 1, 1, HEADERS.length).setValues([[body.id, body.token, now, pin.name, pin.country, pin.city,
            pin.category, pin.problem, pin.team, pin.contact, hidden]]);
          return json_({ ok: true, id: body.id, token: body.token });
        }
      }
      if (rows.length > 3000) return json_({ ok: false, error: 'The map is full' });
      const id = Utilities.getUuid(), token = Utilities.getUuid();
      sh.appendRow([id, token, now, pin.name, pin.country, pin.city, pin.category, pin.problem, pin.team, pin.contact, false]);
      return json_({ ok: true, id: id, token: token });
    }

    return json_({ ok: false, error: 'Unknown action' });
  } catch (err) {
    return json_({ ok: false, error: String(err.message || err) });
  } finally {
    lock.releaseLock();
  }
}
