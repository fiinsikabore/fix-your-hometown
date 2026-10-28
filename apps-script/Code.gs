/**
 * Fix Your Hometown — Google Sheets backend (Apps Script web app)
 * EF Hult Prize at ALU Rwanda
 *
 * Every pin is one row in the "Pins" sheet.
 * To hide a pin from the website, type TRUE in its "hidden" column.
 * Never share the "token" column: it lets a student edit their own pin.
 * Email and phone are only shown on the website when the student ticks share_contact.
 */

const SHEET_NAME = 'Pins';
const HEADERS = ['id', 'token', 'at', 'full_name', 'country', 'city', 'category', 'problem', 'team', 'email', 'phone', 'share_contact', 'hidden'];
const HIDDEN_COL = 12; // 0-based index of 'hidden'

const COUNTRY_CODES = ['MA','DZ','TN','LY','EG','CV','MR','ML','NE','TD','SD','ER','SN','GM','BF','NG','CF','SS','ET','DJ',
  'GW','GN','CI','GH','CM','UG','KE','SO','SL','LR','TG','BJ','GA','CD','RW','ST','GQ','CG','BI','TZ','SC','AO','ZM','MW',
  'KM','NA','BW','ZW','MZ','MG','ZA','LS','SZ','MU','XX'];
// ALU Grand Challenges and Great Opportunities
const CATEGORIES = ['Urbanization','Education','Healthcare','Climate Change','Governance','Job Creation','Infrastructure',
  'Agriculture','Natural Resource Management','Wildlife Conservation','Regional Integration','Arts, Design & Culture',
  'Tourism','Empowerment of Women'];

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

/** GET ?action=list → all visible pins (tokens are never sent).
 *  GET ?action=save|delete&data={...} → same as POST (fallback for browsers that block POST). */
function doGet(e) {
  const p = (e && e.parameter) || {};
  if ((p.action === 'save' || p.action === 'delete') && p.data) {
    return handle_(p.data);
  }
  try {
    const rows = sheet_().getDataRange().getValues();
    const pins = [];
    for (let i = 1; i < rows.length; i++) {
      const r = rows[i];
      if (!r[0] || r[HIDDEN_COL] === true || String(r[HIDDEN_COL]).toUpperCase() === 'TRUE') continue;
      const share = r[11] === true || String(r[11]).toUpperCase() === 'TRUE';
      pins.push({
        id: r[0], at: Number(r[2]) || 0, name: r[3], country: r[4], city: r[5],
        category: r[6], problem: r[7], team: r[8] === true || String(r[8]).toUpperCase() === 'TRUE',
        contact: share ? [r[9], r[10]].filter(String).join(' · ') : ''
      });
    }
    return json_({ ok: true, pins: pins });
  } catch (err) {
    return json_({ ok: false, error: String(err.message || err) });
  }
}

/** POST {action:"save"|"delete", ...} */
function doPost(e) {
  return handle_((e && e.postData && e.postData.contents) || '{}');
}

function handle_(raw) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    const body = JSON.parse(raw);
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
        name: clean_(body.name, 60),
        country: clean_(body.country, 2).toUpperCase(),
        city: clean_(body.city, 40),
        category: clean_(body.category, 40),
        problem: clean_(body.problem, 240),
        team: body.team === true,
        email: clean_(body.email, 80).toLowerCase(),
        phone: clean_(body.phone, 25),
        share: body.share === true
      };
      if (pin.name.split(/\s+/).length < 2) return json_({ ok: false, error: 'Full name is required' });
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(pin.email)) return json_({ ok: false, error: 'A valid email is required' });
      if (pin.phone.replace(/\D/g, '').length < 8) return json_({ ok: false, error: 'A valid phone number is required' });
      if (COUNTRY_CODES.indexOf(pin.country) < 0) return json_({ ok: false, error: 'Unknown country' });
      if (CATEGORIES.indexOf(pin.category) < 0) return json_({ ok: false, error: 'Unknown Grand Challenge or Opportunity' });
      if (pin.problem.length < 15) return json_({ ok: false, error: 'Problem is too short' });
      // Stop formulas being injected into the sheet
      ['name', 'city', 'problem', 'email'].forEach(function (k) {
        if (/^[=+\-@]/.test(pin[k])) pin[k] = "'" + pin[k];
      });

      const now = Date.now();
      if (body.id && body.token) {
        const row = findRow(clean_(body.id, 64), clean_(body.token, 64));
        if (row > 0) {
          const hidden = rows[row - 1][HIDDEN_COL];
          sh.getRange(row, 1, 1, HEADERS.length).setValues([[body.id, body.token, now, pin.name, pin.country, pin.city,
            pin.category, pin.problem, pin.team, pin.email, "'" + pin.phone, pin.share, hidden]]);
          return json_({ ok: true, id: body.id, token: body.token });
        }
      }
      if (rows.length > 3000) return json_({ ok: false, error: 'The map is full' });
      const id = Utilities.getUuid(), token = Utilities.getUuid();
      sh.appendRow([id, token, now, pin.name, pin.country, pin.city, pin.category, pin.problem, pin.team, pin.email, "'" + pin.phone, pin.share, false]);
      return json_({ ok: true, id: id, token: token });
    }

    return json_({ ok: false, error: 'Unknown action' });
  } catch (err) {
    return json_({ ok: false, error: String(err.message || err) });
  } finally {
    lock.releaseLock();
  }
}
