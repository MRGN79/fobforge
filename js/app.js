// FobForge — app.js
// Application bootstrap and state management.
// Coordinates prj.js, db.js, validate.js and ui.js.
// No DOM manipulation here — that lives in ui.js.
// No file I/O here — that lives in prj.js and db.js.

import { initI18n }                        from './i18n.js';
import { validateUID, validateAssignment } from './validate.js';
import { readPrj, writePrj }               from './prj.js';
import {
  initDb, loadDb, exportDb, closeDb,
  getContacts, getBadges, getAssignments,
  addBadge, assignBadge, removeBadge,
} from './db.js';
import {
  initUI, renderContacts,
  showSuccess, showSystemError, setLoading,
} from './ui.js';

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

const state = {
  loaded:      false,
  fileName:    '',
  contacts:    [],
  badges:      [],
  assignments: [],
  rawXtz0:     null,
  rawXtz1:     null,
};

// ---------------------------------------------------------------------------
// Debug panel (mobile — remove after testing)
// ---------------------------------------------------------------------------

function _initDebug() {
  const panel = document.createElement('div');
  panel.id = 'debug';
  panel.style.cssText = `
    position: fixed;
    bottom: 0; left: 0; right: 0;
    background: #111;
    color: #00ff88;
    font-size: 11px;
    padding: 8px;
    z-index: 9999;
    max-height: 35vh;
    overflow-y: auto;
    font-family: monospace;
    border-top: 1px solid #333;
  `;
  document.body.appendChild(panel);

  window.onerror = (msg, src, line) => {
    _log('ERROR: ' + msg + ' (line ' + line + ')');
  };

  window.onunhandledrejection = e => {
    _log('PROMISE ERROR: ' + (e.reason?.message || e.reason));
  };
}

function _log(msg) {
  const el = document.getElementById('debug');
  if (el) {
    el.innerHTML += msg + '<br>';
    el.scrollTop = el.scrollHeight;
  }
}

// ---------------------------------------------------------------------------
// Bootstrap
// ---------------------------------------------------------------------------

export async function bootstrap() {
  _initDebug();
  _log('bootstrap start');

  initI18n();
  _log('i18n ok');

  // Load sql.js from CDN (pinned version)
  try {
    _log('loading sql.js...');
    const SQL = await initSqlJs({
      locateFile: file =>
        `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.3/${file}`,
    });
    initDb(SQL);
    _log('sql.js ok');
  } catch (e) {
    _log('sql.js FAILED: ' + e.message);
    showSystemError('error.sqljsload');
    return;
  }

  initUI({
    onFileLoad:    handleFileLoad,
    onAddBadge:    handleAddBadge,
    onRemoveBadge: handleRemoveBadge,
    onSave:        handleSave,
  });

  _log('ui init ok — ready');
  return true;
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

// Called by ui.js when the user selects or drops a .prj file.

export async function handleFileLoad(arrayBuffer, fileName) {
  _log('loading file: ' + fileName);
  setLoading(true);
  closeDb();

  try {
    const { dbBytes, rawXtz0, rawXtz1 } = await readPrj(arrayBuffer);
    _log('prj parsed ok');

    loadDb(dbBytes);
    _log('db loaded ok');

    state.loaded   = true;
    state.fileName = fileName;
    state.rawXtz0  = rawXtz0;
    state.rawXtz1  = rawXtz1;

    _refreshState();
    _log('contacts: ' + state.contacts.length);
    _log('badges: '   + state.badges.length);

  } catch (e) {
    _log('ERROR loading file: ' + e.message);
    showSystemError('error.file.load');
  } finally {
    setLoading(false);
  }
}

// Called by ui.js when the user submits the add badge form.
// payload: { memberId, uid, type, note }

export function handleAddBadge({ memberId, uid, type, note }) {
  uid = uid.trim().toUpperCase();
  _log('addBadge: ' + uid);

  const uidResult = validateUID(uid, state.badges);
  if (!uidResult.valid) {
    _log('uid invalid: ' + uidResult.error);
    return { ok: false, field: 'uid', error: uidResult.error };
  }

  const assignResult = validateAssignment(memberId, uid, state.assignments);
  if (!assignResult.valid) {
    _log('assign invalid: ' + assignResult.error);
    return { ok: false, field: 'assign', error: assignResult.error };
  }

  try {
    addBadge(uid, type, note);
    assignBadge(memberId, uid);
    _log('badge added ok');
  } catch (e) {
    _log('ERROR adding badge: ' + e.message);
    return { ok: false, field: 'system', error: 'error.save' };
  }

  _refreshState();
  return { ok: true };
}

// Called by ui.js when the user clicks remove on a badge.
// payload: { memberId, badgeId }

export function handleRemoveBadge({ memberId, badgeId }) {
  _log('removeBadge: ' + badgeId);
  try {
    removeBadge(memberId, badgeId);
    _log('badge removed ok');
  } catch (e) {
    _log('ERROR removing badge: ' + e.message);
    showSystemError('error.save');
    return;
  }
  _refreshState();
}

// Called by ui.js when the user clicks Save.

export async function handleSave() {
  if (!state.loaded) return;
  _log('saving...');
  setLoading(true);

  try {
    const dbBytes  = exportDb();
    const prjBytes = await writePrj({
      dbBytes,
      rawXtz0: state.rawXtz0,
      rawXtz1: state.rawXtz1,
    });

    _downloadFile(prjBytes, state.fileName);
    _log('saved ok');
    showSuccess('success.file.saved');

  } catch (e) {
    _log('ERROR saving: ' + e.message);
    showSystemError('error.save');
  } finally {
    setLoading(false);
  }
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function _refreshState() {
  state.contacts    = getContacts();
  state.badges      = getBadges();
  state.assignments = getAssignments();
  renderContacts(state);
}

function _downloadFile(bytes, fileName) {
  const blob = new Blob([bytes], { type: 'application/octet-stream' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}