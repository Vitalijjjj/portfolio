/**
 * Google Apps Script — приймач відповідей квіза → запис у таблицю.
 *
 * Пише один рядок на респондента (upsert за полем `session`), тож рядок
 * поступово заповнюється в міру відповідей — навіть якщо людина не завершила.
 *
 * Розгортання: див. quiz/google-apps-script/README.md
 */

var SHEET_ID = '1NJ3K7pxehYSrUoRd1rrGZvPGl297ksajKB-nsi4OZMc';
var TAB_NAME = 'Відповіді';

// Порядок і заголовки колонок. Перша колонка (session) — технічна, для пошуку.
var FIELDS = [
  ['session',          'ID сесії'],
  ['startedAt',        'Час початку'],
  ['updatedAt',        'Оновлено'],
  ['status',           'Статус'],
  ['name',             "Ім'я"],
  ['phone',            'Телефон'],
  ['telegram',         'Телеграм'],
  ['business',         'Бізнес'],
  ['likes',            'Що подобається'],
  ['dislikes',         'Що не подобається'],
  ['stories_interest', 'Сторіс (1–10)'],
  ['stories_wish',     'Хочуть частіше в сторіс'],
  ['source',           'Звідки дізнались'],
  ['why_follow',       'Чому слідкують'],
  ['collab_offer',     'Що потрібно для співпраці'],
  ['seen_offer',       'Бачили оффер 200€'],
  ['offer_doubts',     'Що зупиняло замовити']
];

function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000); // серіалізуємо паралельні записи
  try {
    var data = JSON.parse(e.postData.contents);
    if (!data || !data.session) {
      return json({ ok: false, error: 'no session' });
    }

    var sheet = getSheet_();
    ensureHeader_(sheet);

    var kyivNow = Utilities.formatDate(new Date(), 'Europe/Kiev', 'yyyy-MM-dd HH:mm:ss');

    // Значення, що прийшли цього разу (лише непорожні — щоб не затирати вже наявне)
    var incoming = {};
    for (var i = 0; i < FIELDS.length; i++) {
      var key = FIELDS[i][0];
      if (data[key] !== undefined && data[key] !== null && data[key] !== '') {
        incoming[key] = String(data[key]);
      }
    }
    incoming['updatedAt'] = kyivNow;
    if (data.status) incoming['status'] = String(data.status);

    var rowIndex = findRowBySession_(sheet, data.session);

    if (rowIndex === -1) {
      // Новий респондент — формуємо повний рядок
      incoming['session'] = String(data.session);
      if (!incoming['startedAt']) incoming['startedAt'] = kyivNow;
      var row = FIELDS.map(function (f) { return incoming[f[0]] || ''; });
      sheet.appendRow(row);
    } else {
      // Оновлюємо лише ті клітинки, для яких прийшли значення (partial upsert)
      var range = sheet.getRange(rowIndex, 1, 1, FIELDS.length);
      var current = range.getValues()[0];
      for (var c = 0; c < FIELDS.length; c++) {
        var k = FIELDS[c][0];
        if (incoming[k] !== undefined) current[c] = incoming[k];
      }
      range.setValues([current]);
    }

    return json({ ok: true });
  } catch (err) {
    return json({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

function doGet() {
  return json({ ok: true, service: 'quiz-sheet', ts: new Date().toISOString() });
}

/* ---------- допоміжні ---------- */

function getSheet_() {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var sheet = ss.getSheetByName(TAB_NAME);
  if (!sheet) sheet = ss.insertSheet(TAB_NAME);
  return sheet;
}

function ensureHeader_(sheet) {
  if (sheet.getLastRow() >= 1) {
    var first = sheet.getRange(1, 1).getValue();
    if (first === FIELDS[0][1] || first === FIELDS[0][0]) return; // заголовок уже є
  }
  var headers = FIELDS.map(function (f) { return f[1]; });
  sheet.insertRowBefore(1);
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');
  sheet.setFrozenRows(1);
}

function findRowBySession_(sheet, session) {
  var last = sheet.getLastRow();
  if (last < 2) return -1;
  var col = sheet.getRange(2, 1, last - 1, 1).getValues(); // колонка session
  for (var i = 0; i < col.length; i++) {
    if (String(col[i][0]) === String(session)) return i + 2; // +2: рядок 1 — заголовок
  }
  return -1;
}

function json(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
