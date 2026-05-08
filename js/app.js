// FobForge — app.js
// Application bootstrap and state management.
// Coordinates prj.js, db.js, validate.js and ui.js.
// No DOM manipulation here — that lives in ui.js.
// No file I/O here — that lives in prj.js and db.js.

import { initI18n }                    from './i18n.js';
import { validateUID, validateAssignment } from './validate.js';
import { readPrj, writePrj }           from './prj.js';
import {
  initDb, loadDb, exportDb, closeDb,
  getContacts, getBadges, getAssignments,
  addBadge, assignBadge, removeBadge,
} from './db.js';
import { initUI, renderContacts,
         showSuccess, showSystemError, setLoading } from './ui.js';         showSuccess, showSystemError, setLoading } from './ui.js';

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

  // Load sql.js from CDN (pinned version)
  try {
    const SQL = await initSqlJs({
      locateFile: file =>
        `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.3/${file}`
    });
    initDb(SQL);
  } catch (e) {
    showSystemError('error.sqljsload');
    return;
  }

  initUI({
    onFileLoad:      handleFileLoad,
    onAddBadge:      handleAddBadge,
    onRemoveBadge:   handleRemoveBadge,
    onSave:          handleSave,
  });
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

// Called by ui.js when the user selects or drops a .prj file.

export async function handleFileLoad(arrayBuffer, fileName) {
  setLoading(true);
  closeDb();

  try {
    const { dbBytes, rawXtz0, rawXtz1 } = await readPrj(arrayBuffer);

    loadDb(dbBytes);

    state.loaded      = true;
    state.fileName    = fileName;
    state.rawXtz0     = rawXtz0;
    state.rawXtz1     = rawXtz1;

    _refreshState();
    renderContacts(state);

  } catch (e) {
    console.error(e);
    showSystemError('error.file.load');
  } finally {
    setLoading(false);
  }
}

// Called by ui.js when the user submits the add badge form.
// payload: { memberId, uid, type, note }

export function handleAddBadge({ memberId, uid, type, note }) {
  // Normalize
  uid = uid.trim().toUpperCase();

  // Validate UID
  const uidResult = validateUID(uid, state.badges);
  if (!uidResult.valid) {
    return { ok: false, field: 'uid', error: uidResult.error };
  }

  // Validate assignment
  const assignResult = validateAssignment(memberId, uid, state.assignments);
  if (!assignResult.valid) {
    return { ok: false, field: 'assign', error: assignResult.error };
  }

  // Write to database
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

// Called by ui.js when the user clicks remove on a badge.
// payload: { memberId, badgeId }

export function handleRemoveBadge({ memberId, badgeId }) {
  try {
    removeBadge(memberId, badgeId);
  } catch (e) {
    console.error(e);
    showSystemError('error.save');
    return;
  }

  _refreshState();
}

// Called by ui.js when the user clicks Save.

export async function handleSave() {
  if (!state.loaded) return;
  setLoading(true);

  try {
    const dbBytes = exportDb();

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
  }
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

// Sync in-memory state from the database after every write operation.

function _refreshState() {
  state.contacts    = getContacts();
  state.badges      = getBadges();
  state.assignments = getAssignments();
  renderContacts(state);
}

// Trigger a file download in the browser.

function _downloadFile(bytes, fileName) {
  const blob = new Blob([bytes], { type: 'application/octet-stream' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}