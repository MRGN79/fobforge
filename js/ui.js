// FobForge — ui.js
// All DOM manipulation and event handling lives here.
// No business logic — calls app.js handlers for everything.
// No direct database access — all data comes from state via renderContacts().

import { t, getLang, setLang } from './i18n.js';

// ---------------------------------------------------------------------------
// Callbacks registered by app.js via initUI()
// ---------------------------------------------------------------------------

let _callbacks = {
  onFileLoad:    null,
  onAddBadge:    null,
  onRemoveBadge: null,
  onSave:        null,
};

// Current selected contact ID
let _selectedMemberId = null;

export function clearSelection() {
  _selectedMemberId = null;
}

// ---------------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------------

export function initUI(callbacks) {
  _callbacks = callbacks;
  _renderShell();
  _bindFileEvents();
  _bindLangSelector();
  _bindSaveButton();
}

// ---------------------------------------------------------------------------
// Shell — builds the full page structure
// ---------------------------------------------------------------------------

function _renderShell() {
  document.getElementById('app').innerHTML = `
    <header class="header">
      <div class="header__brand">
        <span class="header__logo">FobForge</span>
        <span class="header__subtitle" data-i18n="app.subtitle"></span>
      </div>
      <div class="header__actions">
        <select id="lang-selector" class="lang-selector">
          <option value="en" data-i18n="lang.en"></option>
          <option value="es" data-i18n="lang.es"></option>
        </select>
        <button id="btn-open" class="btn btn--secondary" hidden
                data-i18n="file.open"></button>
        <button id="btn-save" class="btn btn--primary" disabled
                data-i18n="file.save"></button>
      </div>
    </header>

    <main class="layout">

      <section class="panel panel--left">
        <div class="panel__header">
          <span class="panel__title" data-i18n="contacts.title"></span>
        </div>

        <div id="drop-zone" class="drop-zone">
          <span class="drop-zone__icon">📂</span>
          <p class="drop-zone__label" data-i18n="file.drop"></p>
          <p class="drop-zone__or" data-i18n="file.or"></p>
          <label class="btn btn--secondary">
            <span data-i18n="file.browse"></span>
            <input type="file" id="file-input" accept=".prj" hidden>
          </label>
        </div>

        <div id="contact-list" class="contact-list" hidden></div>
      </section>

      <section class="panel panel--right" id="panel-right">
        <div class="panel__placeholder">
          <span class="panel__placeholder-icon">🔑</span>
          <p data-i18n="contacts.empty"></p>
        </div>
      </section>

    </main>

    <div id="drag-overlay" class="drag-overlay" hidden>
      <span data-i18n="file.drop"></span>
    </div>
    <div id="toast" class="toast" hidden></div>
    <div id="loading" class="loading" hidden>
      <span data-i18n="app.loading"></span>
    </div>
  `;

  _applyI18n();
  _syncLangSelector();
}

// ---------------------------------------------------------------------------
// i18n helpers
// ---------------------------------------------------------------------------

// Apply translations to all elements with data-i18n attribute.

function _applyI18n() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    el.textContent = t(el.dataset.i18n);
  });
}

function _syncLangSelector() {
  const sel = document.getElementById('lang-selector');
  if (sel) sel.value = getLang();
}

function _bindLangSelector() {
  document.addEventListener('change', e => {
    if (e.target.id !== 'lang-selector') return;
    setLang(e.target.value);
    if (_currentState) {
      renderContacts(_currentState);
    } else {
      _applyI18n();
    }
  });
}

// ---------------------------------------------------------------------------
// File events
// ---------------------------------------------------------------------------

function _bindFileEvents() {
  document.addEventListener('change', e => {
    if (e.target.id !== 'file-input') return;
    const file = e.target.files[0];
    if (file && file.name.endsWith('.prj')) _loadFile(file);
  });

  document.addEventListener('click', e => {
    if (e.target.id === 'btn-open' || e.target.closest('#btn-open')) {
      document.getElementById('file-input').click();
    }
  });

  let _dragCounter = 0;

  document.addEventListener('dragenter', e => {
    e.preventDefault();
    _dragCounter++;
    const overlay = document.getElementById('drag-overlay');
    if (overlay) overlay.hidden = false;
  });

  document.addEventListener('dragleave', e => {
    if (e.relatedTarget === null) {
      _dragCounter = 0;
      const overlay = document.getElementById('drag-overlay');
      if (overlay) overlay.hidden = true;
      return;
    }
    _dragCounter--;
    if (_dragCounter <= 0) {
      _dragCounter = 0;
      const overlay = document.getElementById('drag-overlay');
      if (overlay) overlay.hidden = true;
    }
  });

  document.addEventListener('dragover', e => { e.preventDefault(); });

  document.addEventListener('drop', e => {
    e.preventDefault();
    _dragCounter = 0;
    const overlay = document.getElementById('drag-overlay');
    if (overlay) overlay.hidden = true;
    const file = e.dataTransfer?.files[0];
    if (file && file.name.endsWith('.prj')) _loadFile(file);
  });
}

function _loadFile(file) {
  const input = document.getElementById('file-input');
  const reader = new FileReader();
  reader.onload = e => {
    if (input) input.value = '';
    _callbacks.onFileLoad(e.target.result, file.name);
  };
  reader.readAsArrayBuffer(file);
}

// ---------------------------------------------------------------------------
// Save button
// ---------------------------------------------------------------------------

function _bindSaveButton() {
  document.addEventListener('click', e => {
    if (e.target.id === 'btn-save' || e.target.closest('#btn-save')) {
      _callbacks.onSave();
    }
  });
}

// ---------------------------------------------------------------------------
// Contact list rendering
// ---------------------------------------------------------------------------

let _currentState = null;

export function renderContacts(state) {
  _currentState = state;

  const dropZone   = document.getElementById('drop-zone');
  const contactList = document.getElementById('contact-list');
  const btnSave    = document.getElementById('btn-save');
  const btnOpen    = document.getElementById('btn-open');

  if (dropZone)    dropZone.hidden    = true;
  if (contactList) contactList.hidden = false;
  if (btnSave)     btnSave.disabled   = false;
  if (btnOpen)     btnOpen.hidden     = false;

  if (!contactList) return;

  if (!state.contacts.length) {
    contactList.innerHTML = `
      <p class="contact-list__empty" data-i18n="contacts.empty"></p>
    `;
    _applyI18n();
    _syncPanel(state);
    return;
  }

  contactList.innerHTML = state.contacts.map(contact => {
    const badgeCount = state.assignments.filter(
      a => a.memberId === contact.id
    ).length;

    const isSelected = contact.id === _selectedMemberId;
    const initials   = _initials(contact.name, contact.surname);

    return `
      <div class="contact-item ${isSelected ? 'contact-item--active' : ''}"
           data-member-id="${contact.id}">
        <div class="contact-item__avatar">${initials}</div>
        <div class="contact-item__info">
          <span class="contact-item__name">
            ${_esc(contact.surname)}, ${_esc(contact.name)}
          </span>
          <span class="contact-item__meta">
            APT ${_esc(contact.apt)} &middot; SCS ${contact.scsAddr ?? ''}
          </span>
        </div>
        ${badgeCount > 0 ? `
          <span class="badge-count">
            ${badgeCount} ${t('contacts.badge_count')}
          </span>` : ''}
      </div>
    `;
  }).join('');

  // Bind contact click events
  contactList.querySelectorAll('.contact-item').forEach(el => {
    el.addEventListener('click', () => {
      _selectedMemberId = el.dataset.memberId;
      renderContacts(_currentState);
    });
  });

  _applyI18n();
  _syncPanel(state);
}

function _syncPanel(state) {
  const panel = document.getElementById('panel-right');
  if (!panel) return;

  if (_selectedMemberId && state.contacts.find(c => c.id === _selectedMemberId)) {
    _renderBadgePanel(panel, state);
  } else {
    _selectedMemberId = null;
    panel.innerHTML = `
      <div class="panel__placeholder">
        <span class="panel__placeholder-icon">🔑</span>
        <p data-i18n="contacts.empty"></p>
      </div>
    `;
    _applyI18n();
  }
}

// ---------------------------------------------------------------------------
// Badge panel rendering
// ---------------------------------------------------------------------------

function _renderBadgePanel(panel, state) {
  if (!panel || !_selectedMemberId) return;

  const contact = state.contacts.find(c => c.id === _selectedMemberId);
  if (!contact) return;

  const assigned = state.assignments
    .filter(a => a.memberId === _selectedMemberId)
    .map(a => state.badges.find(b => b.id === a.badgeId))
    .filter(Boolean);

  panel.innerHTML = `
    <div class="badge-panel">

      <div class="badge-panel__header">
        <div class="badge-panel__contact">
          <span class="badge-panel__name">
            ${_esc(contact.surname)}, ${_esc(contact.name)}
          </span>
          <span class="badge-panel__meta">
            APT ${_esc(contact.apt)} &middot; SCS ${contact.scsAddr ?? ''}
          </span>
        </div>
      </div>

      <div class="badge-panel__section">
        <h2 class="badge-panel__section-title" data-i18n="badges.title"></h2>

        ${assigned.length === 0
          ? `<p class="badge-panel__empty" data-i18n="badges.empty"></p>`
          : `<table class="badge-table">
              <thead>
                <tr>
                  <th data-i18n="badges.uid"></th>
                  <th data-i18n="badges.type"></th>
                  <th data-i18n="badges.note"></th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                ${assigned.map(badge => `
                  <tr>
                    <td class="badge-table__uid">${badge.id}</td>
                    <td>
                      <span class="badge-type badge-type--${badge.type}"
                            data-i18n="badges.type.${badge.type}">
                      </span>
                    </td>
                    <td class="badge-table__note">${_esc(badge.note || '')}</td>
                    <td>
                      <button class="btn btn--danger btn--sm"
                              data-action="remove"
                              data-member-id="${_selectedMemberId}"
                              data-badge-id="${badge.id}"
                              data-i18n="badges.remove">
                      </button>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
             </table>`
        }
      </div>

      <div class="badge-panel__section">
        <h2 class="badge-panel__section-title" data-i18n="badges.add"></h2>

        <form id="add-badge-form" class="add-badge-form" novalidate>
          <input type="hidden" name="memberId" value="${_selectedMemberId}">

          <div class="form-group">
            <label class="form-label" for="badge-uid"
                   data-i18n="badges.uid"></label>
            <input class="form-input form-input--mono"
                   type="text"
                   id="badge-uid"
                   name="uid"
                   maxlength="8"
                   autocomplete="off"
                   placeholder="A1B2C3D4">
            <span class="form-error" id="error-uid" hidden></span>
          </div>

          <div class="form-group">
            <label class="form-label" for="badge-type"
                   data-i18n="badges.type"></label>
            <select class="form-select" id="badge-type" name="type">
              <option value="0" data-i18n="badges.type.0"></option>
              <option value="1" data-i18n="badges.type.1"></option>
              <option value="2" data-i18n="badges.type.2"></option>
            </select>
          </div>

          <div class="form-group">
            <label class="form-label" for="badge-note"
                   data-i18n="badges.note"></label>
            <input class="form-input"
                   type="text"
                   id="badge-note"
                   name="note"
                   maxlength="64"
                   autocomplete="off">
          </div>

          <div class="form-group form-group--actions">
            <button type="submit" class="btn btn--primary"
                    data-i18n="badges.add"></button>
            <span class="form-error" id="error-assign" hidden></span>
          </div>

        </form>
      </div>

    </div>
  `;

  _applyI18n();
  _bindBadgeFormEvents(panel);
  _bindRemoveEvents(panel);
}

// ---------------------------------------------------------------------------
// Badge form events
// ---------------------------------------------------------------------------

function _bindBadgeFormEvents(panel) {
  const form = panel.querySelector('#add-badge-form');
  if (!form) return;

  // Auto-uppercase UID input
  const uidInput = form.querySelector('#badge-uid');
  uidInput.addEventListener('input', () => {
    const pos = uidInput.selectionStart;
    const raw = uidInput.value;
    const filtered = raw.toUpperCase().replace(/[^0-9A-F]/g, '');
    const invalidBefore = raw.slice(0, pos).replace(/[0-9A-Fa-f]/g, '').length;
    uidInput.value = filtered;
    const newPos = Math.max(0, pos - invalidBefore);
    uidInput.setSelectionRange(newPos, newPos);
  });

  form.addEventListener('submit', e => {
    e.preventDefault();
    _clearFormErrors(form);

    const memberId = form.querySelector('[name="memberId"]').value;
    const uid      = form.querySelector('[name="uid"]').value.trim().toUpperCase();
    const type     = parseInt(form.querySelector('[name="type"]').value, 10);
    const note     = form.querySelector('[name="note"]').value.trim();

    const result = _callbacks.onAddBadge({ memberId, uid, type, note });

    if (!result.ok) {
      if (result.field === 'system') {
        _showToast(t(result.error), 'toast--error');
      } else {
        _showFormError(form, result.field, result.error);
      }
      return;
    }

    showSuccess('success.badge.added');
    form.querySelector('[name="uid"]').value  = '';
    form.querySelector('[name="note"]').value = '';
  });
}

function _bindRemoveEvents(panel) {
  panel.addEventListener('click', e => {
    const btn = e.target.closest('[data-action="remove"]');
    if (!btn) return;
    const memberId = btn.dataset.memberId;
    const badgeId  = btn.dataset.badgeId;
    const result = _callbacks.onRemoveBadge({ memberId, badgeId });
    if (result?.ok) {
      showSuccess('success.badge.removed');
    } else {
      showSystemError('error.save');
    }
  });
}

// ---------------------------------------------------------------------------
// Form error helpers
// ---------------------------------------------------------------------------

function _showFormError(form, field, message) {
  if (field === 'uid') {
    const el = form.querySelector('#error-uid');
    if (el) { el.textContent = t(message); el.hidden = false; }
  } else if (field === 'assign') {
    const el = form.querySelector('#error-assign');
    if (el) { el.textContent = t(message); el.hidden = false; }
  }
}

function _clearFormErrors(form) {
  form.querySelectorAll('.form-error').forEach(el => {
    el.textContent = '';
    el.hidden = true;
  });
}

// ---------------------------------------------------------------------------
// Toast notifications
// ---------------------------------------------------------------------------

let _toastTimer = null;

export function showSuccess(key) {
  _showToast(t(key), 'toast--success');
}

export function showSystemError(key) {
  _showToast(t(key), 'toast--error');
}

function _showToast(message, modifier) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = message;
  toast.className   = `toast ${modifier}`;
  toast.hidden      = false;
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => { toast.hidden = true; }, 3500);
}

// ---------------------------------------------------------------------------
// Loading state
// ---------------------------------------------------------------------------

export function setLoading(active) {
  const el = document.getElementById('loading');
  if (el) el.hidden = !active;
}

export function setSaveEnabled(enabled) {
  const btn = document.getElementById('btn-save');
  if (btn) btn.disabled = !enabled;
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

function _initials(name, surname) {
  const a = (name    || '?')[0].toUpperCase();
  const b = (surname || '?')[0].toUpperCase();
  return a + b;
}

function _esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}