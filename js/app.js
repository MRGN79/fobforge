// FobForge — app.js
// Application bootstrap and state management.
// Coordinates prj.js, db.js, validate.js and ui.js.
// No DOM manipulation here — that lives in ui.js.
// No file I/O here — that lives in prj.js and db.js.

import { initI18n, t }                                                 from './i18n.js';
import { validateUID, validateAssignment, validateMemberName, validateMemberSurname, validateApartmentScsAddr } from './validate.js';
import { readPrj, writePrj }                                           from './prj.js';
import {
  initDb, loadDb, createEmptyDb, exportDb, closeDb,
  getContacts, getBadges, getAssignments,
  addBadge, assignBadge, removeBadge,
  addContact, editContact, deleteContact,
  addApartment, assignApartment, removeApartment,
  withTransaction,
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
  prjCtx:      null,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function _generateUUID() {
  return crypto.randomUUID();
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
    onBulkDelete:      handleBulkDelete,
    onBulkAssign:      handleBulkAssign,
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
    showSystemError('error.db.create');
    return;
  }

  state.loaded      = true;
  state.dirty       = false;
  state.fileName    = 'new_project.prj';
  state.prjCtx      = null;
  setDirty(false);
  _refreshState();
}

export async function handleFileLoad(arrayBuffer, fileName) {
  setLoading(true);
  closeDb();
  clearSelection();
  clearSearch();

  try {
    const { dbBytes, prjCtx } = await readPrj(arrayBuffer);
    loadDb(dbBytes);

    state.loaded   = true;
    state.dirty    = false;
    state.fileName = fileName || 'untitled.prj';
    state.prjCtx   = prjCtx;

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
  scsAddr = scsAddr !== '' ? parseInt(scsAddr, 10) : null;
  if (scsAddr !== null && isNaN(scsAddr)) scsAddr = null;
  block = (block ?? '').trim();
  floor = (floor ?? '').trim();

  const scsResult = validateApartmentScsAddr(scsAddr);
  if (!scsResult.valid) {
    return { ok: false, field: 'scsaddr', error: scsResult.error };
  }

  try {
    const aptId = _generateUUID();
    addApartment(aptId, apt, scsAddr, block, floor);
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

// ---------------------------------------------------------------------------
// Bulk Handlers
// ---------------------------------------------------------------------------

export function handleBulkDelete({ memberIds }) {
  if (!memberIds.length) return { ok: false };
  try {
    withTransaction(() => memberIds.forEach(id => deleteContact(id)));
  } catch (e) {
    console.error(e);
    return { ok: false };
  }
  state.dirty = true;
  setDirty(true);
  _refreshState();
  const msg = t('success.bulk_deleted').replace('{n}', memberIds.length);
  showSuccess(msg);
  return { ok: true };
}

export function handleBulkAssign({ memberIds, uid, type }) {
  if (!memberIds.length) return { ok: false };
  uid = uid.trim().toUpperCase();

  const uidResult = validateUID(uid, state.badges);
  const badgeExists = state.badges.some(b => b.id === uid);

  if (!badgeExists && !uidResult.valid) {
    return { ok: false, field: 'uid', error: uidResult.error };
  }

  let assigned = 0;
  try {
    withTransaction(() => {
      if (!badgeExists) {
        addBadge(uid, type, '');
      }
      memberIds.forEach(memberId => {
        const alreadyAssigned = state.assignments.some(
          a => a.memberId === memberId && a.badgeId === uid
        );
        if (!alreadyAssigned) {
          assignBadge(memberId, uid);
          assigned++;
        }
      });
    });
  } catch (e) {
    console.error(e);
    return { ok: false, error: 'error.save' };
  }
  if (assigned === 0) return { ok: false, error: 'error.badge.assigned' };
  state.dirty = true;
  setDirty(true);
  _refreshState();
  const msg = t('success.bulk_assigned').replace('{n}', assigned);
  showSuccess(msg);
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
  state.prjCtx      = null;
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
      prjCtx: state.prjCtx,
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