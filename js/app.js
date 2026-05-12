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
  initUI, renderContacts, clearSelection,
  showSuccess, showSystemError, setLoading, setSaveEnabled,
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
// Bootstrap
// ---------------------------------------------------------------------------

export async function bootstrap() {
  initI18n();

  try {
    const SQL = await initSqlJs({
      locateFile: file =>
        `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.3/${file}`,
    });
    initDb(SQL);
  } catch (e) {
    showSystemError('error.sqljsload');
    return;
  }

  initUI({
    onFileLoad:    handleFileLoad,
    onAddBadge:    handleAddBadge,
    onRemoveBadge: handleRemoveBadge,
    onSave:        handleSave,
  });

  return true;
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

export async function handleFileLoad(arrayBuffer, fileName) {
  setLoading(true);
  closeDb();
  clearSelection();

  try {
    const { dbBytes, rawXtz0, rawXtz1 } = await readPrj(arrayBuffer);
    loadDb(dbBytes);

    state.loaded   = true;
    state.fileName = fileName;
    state.rawXtz0  = rawXtz0;
    state.rawXtz1  = rawXtz1;

    _refreshState();

  } catch (e) {
    console.error(e);
    showSystemError('error.file.load');
  } finally {
    setLoading(false);
  }
}

export function handleAddBadge({ memberId, uid, type, note }) {
  uid = uid.trim().toUpperCase();

  const uidResult = validateUID(uid, state.badges);
  if (!uidResult.valid) {
    return { ok: false, field: 'uid', error: uidResult.error };
  }

  const assignResult = validateAssignment(memberId, uid, state.assignments);
  if (!assignResult.valid) {
    return { ok: false, field: 'assign', error: assignResult.error };
  }

  try {
    addBadge(uid, type, note);
    assignBadge(memberId, uid);
  } catch (e) {
    console.error(e);
    return { ok: false, field: 'system', error: 'error.save' };
  }

  _refreshState();
  return { ok: true };
}

export function handleRemoveBadge({ memberId, badgeId }) {
  try {
    removeBadge(memberId, badgeId);
  } catch (e) {
    console.error(e);
    return { ok: false };
  }
  _refreshState();
  return { ok: true };
}

export async function handleSave() {
  if (!state.loaded) return;
  setLoading(true);
  setSaveEnabled(false);

  try {
    const dbBytes  = exportDb();
    const prjBytes = await writePrj({
      dbBytes,
      rawXtz0: state.rawXtz0,
      rawXtz1: state.rawXtz1,
    });

    _downloadFile(prjBytes, state.fileName);
    showSuccess('success.file.saved');

  } catch (e) {
    console.error(e);
    showSystemError('error.save');
  } finally {
    setLoading(false);
    setSaveEnabled(true);
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
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}