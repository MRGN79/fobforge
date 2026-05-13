// FobForge — app.js
// Application bootstrap and state management.
// Coordinates prj.js, db.js, validate.js and ui.js.
// No DOM manipulation here — that lives in ui.js.
// No file I/O here — that lives in prj.js and db.js.

import { initI18n }                                                    from './i18n.js';
import { validateUID, validateAssignment, validateMemberName, validateMemberSurname, validateApartmentScsAddr } from './validate.js';
import { readPrj, writePrj }                                           from './prj.js';
import {
  initDb, loadDb, createEmptyDb, exportDb, closeDb,
  getContacts, getBadges, getAssignments,
  addBadge, assignBadge, removeBadge,
  addContact, editContact, deleteContact,
  addApartment, assignApartment, editApartment, removeApartment,
} from './db.js';
import {
  initUI, renderContacts, clearSelection, clearSearch,
  showSuccess, showSystemError, setLoading, setSaveEnabled, setDirty, resetUI,
} from './ui.js';

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

const state = {
  loaded:      false,
  dirty:       false,
  fileName:    '',
  contacts:    [],
  badges:      [],
  assignments: [],
  rawXtz0:     null,
  rawXtz1:     null,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function _generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

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

  window.addEventListener('beforeunload', e => {
    if (state.loaded && state.dirty) {
      e.preventDefault();
      return '';
    }
  });

  initUI({
    onFileLoad:        handleFileLoad,
    onAddBadge:        handleAddBadge,
    onRemoveBadge:     handleRemoveBadge,
    onSave:            handleSave,
    onClose:           handleClose,
    onNew:             handleNew,
    onAddContact:      handleAddContact,
    onEditContact:     handleEditContact,
    onDeleteContact:   handleDeleteContact,
    onAddApartment:    handleAddApartment,
    onRemoveApartment: handleRemoveApartment,
  });

  return true;
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

export function handleNew() {
  closeDb();
  clearSelection();
  clearSearch();

  try {
    createEmptyDb();
  } catch (e) {
    console.error(e);
    showSystemError('error.sqljsload');
    return;
  }

  state.loaded      = true;
  state.dirty       = false;
  state.fileName    = 'new_project.prj';
  state.rawXtz0     = null;
  state.rawXtz1     = null;
  setDirty(false);
  _refreshState();
}

export async function handleFileLoad(arrayBuffer, fileName) {
  setLoading(true);
  closeDb();
  clearSelection();
  clearSearch();

  try {
    const { dbBytes, rawXtz0, rawXtz1 } = await readPrj(arrayBuffer);
    loadDb(dbBytes);

    state.loaded   = true;
    state.dirty    = false;
    state.fileName = fileName || 'untitled.prj';
    state.rawXtz0  = rawXtz0;
    state.rawXtz1  = rawXtz1;

    setDirty(false);
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

  state.dirty = true;
  setDirty(true);
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
  state.dirty = true;
  setDirty(true);
  _refreshState();
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Contact Handlers
// ---------------------------------------------------------------------------

export function handleAddContact({ name, surname }) {
  name = name.trim();
  surname = surname.trim();

  const nameResult = validateMemberName(name);
  if (!nameResult.valid) {
    return { ok: false, field: 'name', error: nameResult.error };
  }

  const surnameResult = validateMemberSurname(surname);
  if (!surnameResult.valid) {
    return { ok: false, field: 'surname', error: surnameResult.error };
  }

  try {
    const memberId = _generateUUID();
    addContact(memberId, name, surname);
  } catch (e) {
    console.error(e);
    return { ok: false, field: 'system', error: 'error.save' };
  }

  state.dirty = true;
  setDirty(true);
  _refreshState();
  return { ok: true };
}

export function handleEditContact({ memberId, name, surname }) {
  name = name.trim();
  surname = surname.trim();

  const nameResult = validateMemberName(name);
  if (!nameResult.valid) {
    return { ok: false, field: 'name', error: nameResult.error };
  }

  const surnameResult = validateMemberSurname(surname);
  if (!surnameResult.valid) {
    return { ok: false, field: 'surname', error: surnameResult.error };
  }

  try {
    editContact(memberId, name, surname);
  } catch (e) {
    console.error(e);
    return { ok: false, field: 'system', error: 'error.save' };
  }

  state.dirty = true;
  setDirty(true);
  _refreshState();
  return { ok: true };
}

export function handleDeleteContact({ memberId }) {
  try {
    deleteContact(memberId);
  } catch (e) {
    console.error(e);
    return { ok: false };
  }

  state.dirty = true;
  setDirty(true);
  _refreshState();
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Apartment Handlers
// ---------------------------------------------------------------------------

export function handleAddApartment({ memberId, apt, scsAddr, block, floor }) {
  apt = (apt ?? '').trim();
  scsAddr = scsAddr ? parseInt(scsAddr, 10) : '';
  block = (block ?? '').trim();
  floor = (floor ?? '').trim();

  const scsResult = validateApartmentScsAddr(scsAddr);
  if (!scsResult.valid) {
    return { ok: false, field: 'scsaddr', error: scsResult.error };
  }

  try {
    const aptId = _generateUUID();
    addApartment(aptId, apt, scsAddr || null, block, floor);
    assignApartment(memberId, aptId);
  } catch (e) {
    console.error(e);
    return { ok: false, field: 'system', error: 'error.save' };
  }

  state.dirty = true;
  setDirty(true);
  _refreshState();
  return { ok: true };
}

export function handleEditApartment({ aptId, apt, scsAddr, block, floor }) {
  apt = (apt ?? '').trim();
  scsAddr = scsAddr ? parseInt(scsAddr, 10) : '';
  block = (block ?? '').trim();
  floor = (floor ?? '').trim();

  const scsResult = validateApartmentScsAddr(scsAddr);
  if (!scsResult.valid) {
    return { ok: false, field: 'scsaddr', error: scsResult.error };
  }

  try {
    editApartment(aptId, apt, scsAddr || null, block, floor);
  } catch (e) {
    console.error(e);
    return { ok: false, field: 'system', error: 'error.save' };
  }

  state.dirty = true;
  setDirty(true);
  _refreshState();
  return { ok: true };
}

export function handleRemoveApartment({ memberId, aptId }) {
  try {
    removeApartment(memberId, aptId);
  } catch (e) {
    console.error(e);
    return { ok: false };
  }

  state.dirty = true;
  setDirty(true);
  _refreshState();
  return { ok: true };
}

export function handleClose() {
  closeDb();
  clearSelection();
  state.loaded      = false;
  state.dirty       = false;
  state.fileName    = '';
  state.contacts    = [];
  state.badges      = [];
  state.assignments = [];
  state.rawXtz0     = null;
  state.rawXtz1     = null;
  resetUI();
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
    state.dirty = false;
    setDirty(false);
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