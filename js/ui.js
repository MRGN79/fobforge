// FobForge — ui.js
// All DOM manipulation and event handling lives here.
// No business logic — calls app.js handlers for everything.
// No direct database access — all data comes from state via renderContacts().

import { t, getLang, setLang } from './i18n.js';
import { VERSION } from './version.js';

// ---------------------------------------------------------------------------
// Callbacks registered by app.js via initUI()
// ---------------------------------------------------------------------------

let _callbacks = {
  onFileLoad:        null,
  onAddBadge:        null,
  onRemoveBadge:     null,
  onSave:            null,
  onClose:           null,
  onNew:             null,
  onAddContact:      null,
  onEditContact:     null,
  onDeleteContact:   null,
  onAddApartment:    null,
  onRemoveApartment: null,
  onBulkDelete:      null,
  onBulkAssign:      null,
};

// Current selected contact ID
let _selectedMemberId = null;

// Active search query for the contact list
let _searchQuery = '';
let _searchDebounceTimer = null;

// Sort order: 'name-asc' | 'name-desc' | 'fobs-desc' | 'fobs-asc'
let _sortOrder = 'name-asc';

// Filter: show only contacts without any fob
let _filterNoFob = false;

// Bulk selection mode
let _bulkMode = false;
let _bulkSelected = new Set();

// Focus the active contact item after the next render (keyboard nav)
let _focusAfterRender = false;

// Tracks unsaved changes — set externally via setDirty()
let _isDirty = false;

export function clearSelection() {
  _selectedMemberId = null;
}

export function clearSearch() {
  _searchQuery = '';
  const input = document.getElementById('contact-search');
  if (input) input.value = '';
}

export function setDirty(dirty) {
  _isDirty = dirty;
  const btn = document.getElementById('btn-save');
  if (btn) btn.classList.toggle('btn--dirty', dirty);
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
  _bindCloseButton();
  _bindNewButton();
  _bindRemoveButton();
  _bindApartmentRemoveButton();
  _bindSearchInput();
  _bindSortSelect();
  _bindNoFobFilter();
  _bindBulkMode();
  _bindAddContactButton();
  _bindThemeToggle();
  _bindBeforeUnload();
}

function _bindBeforeUnload() {
  window.addEventListener('beforeunload', e => {
    if (_isDirty) {
      e.preventDefault();
      e.returnValue = '';
    }
  });
}

// ---------------------------------------------------------------------------
// Shell — builds the full page structure
// ---------------------------------------------------------------------------

function _renderShell() {
  document.getElementById('app').innerHTML = `
    <header class="header">
      <div class="header__brand">
        <span class="header__logo">FobForge</span>
        <span class="header__version">v${VERSION}</span>
        <span class="header__subtitle" data-i18n="app.subtitle"></span>
      </div>
      <div class="header__actions">
        <a href="https://github.com/MRGN79/fobforge/issues/new"
           class="feedback-link"
           target="_blank"
           rel="noopener noreferrer"
           data-i18n-title="feedback.title"
           data-i18n="feedback.link"></a>
        <button id="btn-theme" class="theme-toggle"
                data-i18n-aria-label="a11y.theme.toggle">🌙</button>
        <select id="lang-selector" class="lang-selector">
          <option value="en" data-i18n="lang.en"></option>
          <option value="es" data-i18n="lang.es"></option>
        </select>
        <button id="btn-open" class="btn btn--secondary" hidden
                data-i18n="file.open"></button>
        <button id="btn-close" class="btn btn--secondary" hidden
                data-i18n="file.close"></button>
        <button id="btn-save" class="btn btn--primary" disabled
                data-i18n="file.save"></button>
      </div>
    </header>

    <div class="disclaimer-bar">
      <span data-i18n="disclaimer.text"></span>
    </div>

    <main class="layout" id="main-content">

      <section class="panel panel--left">
        <div class="panel__header">
          <span class="panel__title" data-i18n="contacts.title"></span>
          <div class="panel__header-actions">
            <button id="btn-bulk-select" class="btn btn--sm" hidden
                    data-i18n="contacts.bulk_select"></button>
            <button id="btn-add-contact" class="btn btn--sm" hidden
                    data-i18n="contacts.add"></button>
          </div>
        </div>

        <div id="contact-stats" class="contact-stats" hidden></div>

        <div id="search-bar" class="search-bar" hidden>
          <input type="search"
                 id="contact-search"
                 class="search-input"
                 data-i18n-placeholder="contacts.search"
                 data-i18n-aria-label="contacts.search"
                 autocomplete="off">
          <div class="list-controls">
            <select id="sort-select" class="sort-select">
              <option value="name-asc"  data-i18n="contacts.sort.name_asc"></option>
              <option value="name-desc" data-i18n="contacts.sort.name_desc"></option>
              <option value="fobs-desc" data-i18n="contacts.sort.fobs_desc"></option>
              <option value="fobs-asc"  data-i18n="contacts.sort.fobs_asc"></option>
            </select>
            <button id="btn-filter-nofob" class="btn btn--sm btn--filter"
                    data-i18n="contacts.filter.nofob"></button>
          </div>
          <div id="contact-counter" class="contact-counter"></div>
        </div>

        <div id="add-contact-wrap" class="add-contact-wrap" hidden>
          <form id="add-contact-form" class="add-contact-form" novalidate>
            <div class="form-group">
              <label class="form-label" for="new-contact-name"
                     data-i18n="contacts.name"></label>
              <input class="form-input" type="text" id="new-contact-name"
                     name="name" autocomplete="off"
                     aria-describedby="error-new-name">
              <span class="form-error" id="error-new-name" hidden role="alert"></span>
            </div>
            <div class="form-group">
              <label class="form-label" for="new-contact-surname"
                     data-i18n="contacts.surname"></label>
              <input class="form-input" type="text" id="new-contact-surname"
                     name="surname" autocomplete="off"
                     aria-describedby="error-new-surname">
              <span class="form-error" id="error-new-surname" hidden role="alert"></span>
            </div>
            <div class="form-group form-group--actions">
              <button type="submit" class="btn btn--primary btn--sm"
                      data-i18n="contacts.add"></button>
              <button type="button" id="btn-cancel-add-contact"
                      class="btn btn--sm" data-i18n="action.cancel"></button>
            </div>
          </form>
        </div>

        <div id="drop-zone" class="drop-zone">
          <span class="drop-zone__icon">📂</span>
          <p class="drop-zone__label" data-i18n="file.drop"></p>
          <p class="drop-zone__or" data-i18n="file.or"></p>
          <label class="btn btn--secondary">
            <span data-i18n="file.browse"></span>
            <input type="file" id="file-input" accept=".prj" hidden>
          </label>
          <button id="btn-new" class="btn btn--sm drop-zone__new"
                  data-i18n="file.new"></button>
        </div>

        <div id="contact-list" class="contact-list" hidden></div>

        <div id="bulk-bar" class="bulk-bar" hidden>
          <div class="bulk-bar__row bulk-bar__row--info">
            <span id="bulk-count" class="bulk-bar__count"></span>
            <button id="btn-bulk-delete" class="btn btn--sm btn--danger"
                    data-i18n="contacts.bulk_delete_btn"></button>
          </div>
          <div class="bulk-bar__row bulk-bar__row--assign">
            <input type="text" id="bulk-uid-input" class="form-input bulk-uid-input"
                   maxlength="8" placeholder="UID" autocomplete="off"
                   aria-label="Badge UID">
            <select id="bulk-type-select" class="sort-select bulk-type-select">
              <option value="0" data-i18n="badges.type.0"></option>
              <option value="1" data-i18n="badges.type.1"></option>
              <option value="2" data-i18n="badges.type.2"></option>
            </select>
            <button id="btn-bulk-assign" class="btn btn--sm btn--primary"
                    data-i18n="contacts.bulk_assign"></button>
          </div>
        </div>
      </section>

      <section class="panel panel--right" id="panel-right">
        <div class="panel__placeholder">
          <span class="panel__placeholder-icon">🔑</span>
          <p data-i18n="app.welcome"></p>
        </div>
      </section>

    </main>

    <div id="drag-overlay" class="drag-overlay" hidden>
      <span data-i18n="file.drop"></span>
    </div>
    <div id="toast-region" role="status" aria-live="polite" aria-atomic="true"></div>
    <div id="loading" class="loading" hidden>
      <span data-i18n="app.loading"></span>
    </div>
  `;

  _applyI18n();
  _syncLangSelector();
  _bindContactListEvents();
}

// ---------------------------------------------------------------------------
// i18n helpers
// ---------------------------------------------------------------------------

// Apply translations to all elements with data-i18n / data-i18n-placeholder.

function _applyI18n() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    el.textContent = t(el.dataset.i18n);
  });
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    el.placeholder = t(el.dataset.i18nPlaceholder);
  });
  document.querySelectorAll('[data-i18n-title]').forEach(el => {
    el.title = t(el.dataset.i18nTitle);
  });
  document.querySelectorAll('[data-i18n-aria-label]').forEach(el => {
    el.setAttribute('aria-label', t(el.dataset.i18nAriaLabel));
  });
  _updateThemeButton();
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

const FILE_SIZE_LIMIT = 20 * 1024 * 1024; // 20 MB

function _loadFile(file) {
  if (_isDirty && !window.confirm(t('confirm.close'))) return;
  if (file.size > FILE_SIZE_LIMIT) {
    showSystemError('error.file.toobig');
    return;
  }
  const input = document.getElementById('file-input');
  const reader = new FileReader();
  reader.onload = e => {
    if (input) input.value = '';
    _callbacks.onFileLoad(e.target.result, file.name);
  };
  reader.onerror = () => {
    if (input) input.value = '';
    showSystemError('error.file.load');
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

function _bindCloseButton() {
  document.addEventListener('click', e => {
    if (e.target.id === 'btn-close' || e.target.closest('#btn-close')) {
      if (_isDirty && !window.confirm(t('confirm.close'))) return;
      _callbacks.onClose();
    }
  });
}

function _bindNewButton() {
  document.addEventListener('click', e => {
    if (e.target.id === 'btn-new' || e.target.closest('#btn-new')) {
      if (_isDirty && !window.confirm(t('confirm.close'))) return;
      _callbacks.onNew();
    }
  });
}

function _bindSearchInput() {
  document.addEventListener('input', e => {
    if (e.target.id !== 'contact-search') return;
    _searchQuery = e.target.value;
    clearTimeout(_searchDebounceTimer);
    _searchDebounceTimer = setTimeout(() => {
      if (_currentState) renderContacts(_currentState);
    }, 120);
  });
}

function _bindRemoveButton() {
  document.addEventListener('click', e => {
    const btn = e.target.closest('[data-action="remove"]');
    if (!btn) return;
    if (!window.confirm(t('confirm.delete_badge'))) return;
    const memberId = btn.dataset.memberId;
    const badgeId  = btn.dataset.badgeId;
    const result   = _callbacks.onRemoveBadge({ memberId, badgeId });
    if (result?.ok) {
      showSuccess('success.badge.removed');
    } else {
      showSystemError('error.save');
    }
  });
}

export function resetUI() {
  _currentState     = null;
  _selectedMemberId = null;
  _sortOrder        = 'name-asc';
  _filterNoFob      = false;
  _bulkMode         = false;
  _bulkSelected.clear();
  setDirty(false);
  clearSearch();

  const dropZone       = document.getElementById('drop-zone');
  const searchBar      = document.getElementById('search-bar');
  const contactList    = document.getElementById('contact-list');
  const btnSave        = document.getElementById('btn-save');
  const btnOpen        = document.getElementById('btn-open');
  const btnClose       = document.getElementById('btn-close');
  const btnAddContact  = document.getElementById('btn-add-contact');
  const btnBulkSelect  = document.getElementById('btn-bulk-select');
  const addContactWrap = document.getElementById('add-contact-wrap');
  const panel          = document.getElementById('panel-right');
  const contactStats   = document.getElementById('contact-stats');
  const bulkBar        = document.getElementById('bulk-bar');
  const sortSelect     = document.getElementById('sort-select');
  const filterBtn      = document.getElementById('btn-filter-nofob');

  if (dropZone)       { dropZone.hidden = false; }
  if (searchBar)      { searchBar.hidden = true; }
  if (contactList)    { contactList.hidden = true; contactList.innerHTML = ''; }
  if (btnSave)        { btnSave.disabled = true; }
  if (btnOpen)        { btnOpen.hidden = true; }
  if (btnClose)       { btnClose.hidden = true; }
  if (btnAddContact)  { btnAddContact.hidden = true; }
  if (btnBulkSelect)  { btnBulkSelect.hidden = true; btnBulkSelect.classList.remove('btn--filter-active'); btnBulkSelect.textContent = t('contacts.bulk_select'); }
  if (contactStats)   { contactStats.hidden = true; }
  if (bulkBar)        { bulkBar.hidden = true; }
  if (sortSelect)     { sortSelect.value = 'name-asc'; }
  if (filterBtn)      { filterBtn.classList.remove('btn--filter-active'); }
  if (addContactWrap) { addContactWrap.hidden = true; }
  if (panel) {
    panel.innerHTML = `
      <div class="panel__placeholder">
        <span class="panel__placeholder-icon">🔑</span>
        <p data-i18n="app.welcome"></p>
      </div>
    `;
    _applyI18n();
  }
}

// ---------------------------------------------------------------------------
// Contact list rendering
// ---------------------------------------------------------------------------

let _currentState = null;

export function renderContacts(state) {
  _currentState = state;

  const dropZone        = document.getElementById('drop-zone');
  const contactList     = document.getElementById('contact-list');
  const searchBar       = document.getElementById('search-bar');
  const btnSave         = document.getElementById('btn-save');
  const btnOpen         = document.getElementById('btn-open');
  const btnClose        = document.getElementById('btn-close');
  const btnAddContact   = document.getElementById('btn-add-contact');
  const btnBulkSelect   = document.getElementById('btn-bulk-select');
  const contactStats    = document.getElementById('contact-stats');

  if (dropZone)      dropZone.hidden      = true;
  if (searchBar)     searchBar.hidden     = false;
  if (contactList)   contactList.hidden   = false;
  if (btnSave)       btnSave.disabled     = false;
  if (btnOpen)       btnOpen.hidden       = false;
  if (btnClose)      btnClose.hidden      = false;
  if (btnAddContact) btnAddContact.hidden = _bulkMode;
  if (btnBulkSelect) btnBulkSelect.hidden = false;

  if (!contactList) return;

  // Pre-compute badge counts — O(n) instead of O(n²)
  const badgeCountMap = new Map();
  state.assignments.forEach(a =>
    badgeCountMap.set(a.memberId, (badgeCountMap.get(a.memberId) ?? 0) + 1)
  );

  // H — global stats bar
  _updateStats(state, badgeCountMap, contactStats);

  if (!state.contacts.length) {
    contactList.innerHTML = `
      <div class="contact-list__empty">
        <p data-i18n="contacts.empty"></p>
        <button class="btn btn--primary btn--sm" data-action="add-contact"
                data-i18n="contacts.add"></button>
      </div>
    `;
    _applyI18n();
    _syncPanel(state);
    return;
  }

  // C — filter: no fob
  let filtered = _filterNoFob
    ? state.contacts.filter(c => !badgeCountMap.has(c.id))
    : [...state.contacts];

  // G — search: name, surname, apt, block, floor
  const query = _searchQuery.trim().toLowerCase();
  if (query) {
    filtered = filtered.filter(c =>
      `${c.name} ${c.surname}`.toLowerCase().includes(query) ||
      c.apts.some(a =>
        (a.apt   ?? '').toLowerCase().includes(query) ||
        (a.block ?? '').toLowerCase().includes(query) ||
        (a.floor ?? '').toLowerCase().includes(query)
      )
    );
  }

  // A — counter
  _updateCounter(filtered.length, state.contacts.length);

  if (!filtered.length) {
    contactList.innerHTML = `
      <p class="contact-list__empty" data-i18n="contacts.noresults"></p>
    `;
    _applyI18n();
    _syncPanel(state);
    return;
  }

  // B — sort
  const sorted = _sortContacts(filtered, badgeCountMap);

  const prevScrollTop = contactList.scrollTop;

  // D — alphabetical dividers (only for A→Z sort)
  let prevLetter = null;

  contactList.innerHTML = sorted.map(contact => {
    const badgeCount = badgeCountMap.get(contact.id) ?? 0;
    const isSelected = contact.id === _selectedMemberId;
    const isChecked  = _bulkSelected.has(contact.id);
    const initials   = _initials(contact.name, contact.surname);

    let divider = '';
    if (_sortOrder === 'name-asc' || _sortOrder === 'name-desc') {
      const letter = (contact.surname || '?')[0].toUpperCase();
      if (letter !== prevLetter) {
        prevLetter = letter;
        divider = `<div class="alpha-divider" aria-hidden="true">${_esc(letter)}</div>`;
      }
    }

    // F — checkbox in bulk mode
    const checkbox = _bulkMode
      ? `<input type="checkbox" class="bulk-checkbox" tabindex="-1"
                data-member-id="${contact.id}"
                ${isChecked ? 'checked' : ''}
                aria-label="${_esc(contact.surname)}, ${_esc(contact.name)}">`
      : '';

    return divider + `
      <div class="contact-item
                  ${isSelected && !_bulkMode ? 'contact-item--active' : ''}
                  ${isChecked ? 'contact-item--checked' : ''}"
           data-member-id="${contact.id}"
           tabindex="0"
           role="${_bulkMode ? 'checkbox' : 'button'}"
           aria-${_bulkMode ? `checked="${isChecked}"` : `pressed="${isSelected}"`}>
        ${checkbox}
        <div class="contact-item__avatar">${initials}</div>
        <div class="contact-item__info">
          <span class="contact-item__name">
            ${_esc(contact.surname)}, ${_esc(contact.name)}
          </span>
          <span class="contact-item__meta">${_aptMeta(contact.apts)}</span>
        </div>
        ${badgeCount > 0 ? `
          <span class="badge-count">
            ${badgeCount} ${t('contacts.badge_count')}
          </span>` : ''}
      </div>
    `;
  }).join('');

  _applyI18n();

  const activeItem = contactList.querySelector('.contact-item--active');
  if (activeItem) {
    activeItem.scrollIntoView({ block: 'nearest' });
    if (_focusAfterRender) {
      activeItem.focus();
      _focusAfterRender = false;
    }
  } else {
    contactList.scrollTop = prevScrollTop;
  }

  _syncPanel(state);
}

// B — sort helper
function _sortContacts(contacts, badgeCountMap) {
  const copy = [...contacts];
  switch (_sortOrder) {
    case 'name-desc':
      return copy.sort((a, b) =>
        `${b.surname} ${b.name}`.localeCompare(`${a.surname} ${a.name}`)
      );
    case 'fobs-desc':
      return copy.sort((a, b) =>
        (badgeCountMap.get(b.id) ?? 0) - (badgeCountMap.get(a.id) ?? 0)
      );
    case 'fobs-asc':
      return copy.sort((a, b) =>
        (badgeCountMap.get(a.id) ?? 0) - (badgeCountMap.get(b.id) ?? 0)
      );
    default: // name-asc
      return copy.sort((a, b) =>
        `${a.surname} ${a.name}`.localeCompare(`${b.surname} ${b.name}`)
      );
  }
}

// A — update filtered counter
function _updateCounter(shown, total) {
  const el = document.getElementById('contact-counter');
  if (!el) return;
  if (shown === total) {
    el.textContent = _fmt('contacts.showing_all', { total });
  } else {
    el.textContent = _fmt('contacts.showing_filtered', { shown, total });
  }
}

// H — update stats bar
function _updateStats(state, badgeCountMap, el) {
  if (!el) return;
  el.hidden = false;
  const total      = state.contacts.length;
  const withFob    = state.contacts.filter(c => badgeCountMap.has(c.id)).length;
  const without    = total - withFob;
  const assignedIds = new Set(state.assignments.map(a => a.badgeId));
  const unassigned  = state.badges.filter(b => !assignedIds.has(b.id)).length;

  const parts = [
    `${total} ${t('contacts.stats.contacts')}`,
    `${withFob} ${t('contacts.stats.with_fob')}`,
    `${without} ${t('contacts.stats.without_fob')}`,
  ];
  if (unassigned > 0) parts.push(`${unassigned} ${t('contacts.stats.unassigned')}`);
  el.textContent = parts.join(' · ');
}

// i18n string with {placeholder} substitution
function _fmt(key, vars) {
  let str = t(key);
  Object.entries(vars).forEach(([k, v]) => { str = str.replace(`{${k}}`, v); });
  return str;
}

// Bind contact list delegation — attach once, not per render
function _bindContactListEvents() {
  const contactList = document.getElementById('contact-list');
  if (!contactList || contactList._delegated) return;
  contactList._delegated = true;

  contactList.addEventListener('click', e => {
    const item = e.target.closest('.contact-item');
    if (!item) return;
    if (_bulkMode) {
      _toggleBulkItem(item.dataset.memberId);
      return;
    }
    _selectedMemberId = item.dataset.memberId;
    renderContacts(_currentState);
  });

  // E — arrow key navigation
  contactList.addEventListener('keydown', e => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const items = [...contactList.querySelectorAll('.contact-item')];
      if (!items.length) return;
      const idx  = items.findIndex(el => el.dataset.memberId === _selectedMemberId);
      const next = e.key === 'ArrowDown'
        ? (idx < items.length - 1 ? idx + 1 : 0)
        : (idx > 0 ? idx - 1 : items.length - 1);
      if (_bulkMode) {
        items[next].focus();
      } else {
        _selectedMemberId = items[next].dataset.memberId;
        _focusAfterRender = true;
        renderContacts(_currentState);
      }
      return;
    }
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const item = e.target.closest('.contact-item');
    if (!item) return;
    e.preventDefault();
    if (_bulkMode) {
      _toggleBulkItem(item.dataset.memberId);
      return;
    }
    _selectedMemberId = item.dataset.memberId;
    renderContacts(_currentState);
  });
}

// F — toggle a single contact in bulk selection (no full re-render)
function _toggleBulkItem(memberId) {
  if (_bulkSelected.has(memberId)) {
    _bulkSelected.delete(memberId);
  } else {
    _bulkSelected.add(memberId);
  }

  // Update this item's DOM directly — avoid full re-render
  const contactList = document.getElementById('contact-list');
  if (contactList) {
    const item = contactList.querySelector(`[data-member-id="${CSS.escape(memberId)}"]`);
    if (item) {
      const checked = _bulkSelected.has(memberId);
      item.classList.toggle('contact-item--checked', checked);
      item.setAttribute('aria-checked', checked);
      const cb = item.querySelector('.bulk-checkbox');
      if (cb) cb.checked = checked;
    }
  }

  _updateBulkBar();
}

// F — update bulk bar visibility and count
function _updateBulkBar() {
  const bar   = document.getElementById('bulk-bar');
  const count = document.getElementById('bulk-count');
  const n     = _bulkSelected.size;
  if (bar)   bar.hidden   = n === 0;
  if (count) count.textContent = _fmt('contacts.bulk_n_selected', { n });
}

// B — sort selector
function _bindSortSelect() {
  document.addEventListener('change', e => {
    if (e.target.id !== 'sort-select') return;
    _sortOrder = e.target.value;
    if (_currentState) renderContacts(_currentState);
  });
}

// C — no-fob filter toggle
function _bindNoFobFilter() {
  document.addEventListener('click', e => {
    const btn = e.target.closest('#btn-filter-nofob');
    if (!btn) return;
    _filterNoFob = !_filterNoFob;
    btn.classList.toggle('btn--filter-active', _filterNoFob);
    if (_currentState) renderContacts(_currentState);
  });
}

function _exitBulkMode() {
  _bulkMode = false;
  _bulkSelected.clear();
  const btn = document.getElementById('btn-bulk-select');
  if (btn) {
    btn.textContent = t('contacts.bulk_select');
    btn.classList.remove('btn--filter-active');
  }
  const bar = document.getElementById('bulk-bar');
  if (bar) bar.hidden = true;
  if (_currentState) renderContacts(_currentState);
}

// F — bulk mode toggle + bulk actions
function _bindBulkMode() {
  document.addEventListener('click', e => {
    // Toggle bulk mode on/off
    if (e.target.closest('#btn-bulk-select')) {
      if (_bulkMode) { _exitBulkMode(); return; }
      _bulkMode = true;
      const btn = document.getElementById('btn-bulk-select');
      if (btn) {
        btn.textContent = t('contacts.bulk_cancel');
        btn.classList.add('btn--filter-active');
      }
      if (_currentState) renderContacts(_currentState);
      return;
    }

    // Bulk delete
    if (e.target.closest('#btn-bulk-delete')) {
      const n = _bulkSelected.size;
      if (!n) return;
      if (!window.confirm(_fmt('confirm.bulk_delete', { n }))) return;
      const result = _callbacks.onBulkDelete({ memberIds: [..._bulkSelected] });
      if (!result?.ok) { showSystemError('error.save'); return; }
      _exitBulkMode();
      return;
    }

    // Bulk assign badge
    if (e.target.closest('#btn-bulk-assign')) {
      const uidInput = document.getElementById('bulk-uid-input');
      const typeSelect = document.getElementById('bulk-type-select');
      if (!uidInput || !typeSelect) return;
      const uid  = uidInput.value.trim().toUpperCase();
      const type = parseInt(typeSelect.value, 10);
      if (uid.length !== 8) {
        showSystemError('error.bulk_uid');
        return;
      }
      const result = _callbacks.onBulkAssign({ memberIds: [..._bulkSelected], uid, type });
      if (!result?.ok) {
        showSystemError(result?.error ?? 'error.save');
      } else {
        uidInput.value = '';
        _bulkSelected.clear();
        _updateBulkBar();
      }
      return;
    }
  });
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
        <p data-i18n="contacts.select"></p>
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
          <span class="badge-panel__meta">${_aptMeta(contact.apts)}</span>
        </div>
        <div class="badge-panel__actions">
          <button class="btn btn--sm" id="btn-edit-contact"
                  data-i18n="contacts.edit"></button>
          <button class="btn btn--sm btn--danger" id="btn-delete-contact"
                  data-member-id="${_selectedMemberId}"
                  data-i18n="contacts.delete"></button>
        </div>
      </div>

      <div id="edit-contact-wrap" class="edit-contact-wrap" hidden>
        <form id="edit-contact-form" class="edit-contact-form" novalidate>
          <input type="hidden" name="memberId" value="${_selectedMemberId}">
          <div class="form-group">
            <label class="form-label" for="edit-contact-name"
                   data-i18n="contacts.name"></label>
            <input class="form-input" type="text" id="edit-contact-name"
                   name="name" value="${_esc(contact.name)}" autocomplete="off"
                   aria-describedby="error-edit-name">
            <span class="form-error" id="error-edit-name" hidden role="alert"></span>
          </div>
          <div class="form-group">
            <label class="form-label" for="edit-contact-surname"
                   data-i18n="contacts.surname"></label>
            <input class="form-input" type="text" id="edit-contact-surname"
                   name="surname" value="${_esc(contact.surname)}" autocomplete="off"
                   aria-describedby="error-edit-surname">
            <span class="form-error" id="error-edit-surname" hidden role="alert"></span>
          </div>
          <div class="form-group form-group--actions">
            <button type="submit" class="btn btn--primary btn--sm"
                    data-i18n="contacts.edit"></button>
            <button type="button" id="btn-cancel-edit-contact"
                    class="btn btn--sm" data-i18n="action.cancel"></button>
          </div>
        </form>
      </div>

      <div class="badge-panel__section">
        <h2 class="badge-panel__section-title" data-i18n="apartments.title"></h2>

        ${contact.apts.length === 0
          ? `<p class="badge-panel__empty" data-i18n="apartments.empty"></p>`
          : `<table class="badge-table">
              <thead>
                <tr>
                  <th data-i18n="apartments.apt"></th>
                  <th data-i18n="apartments.block"></th>
                  <th data-i18n="apartments.floor"></th>
                  <th data-i18n="apartments.scsaddr"></th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                ${contact.apts.map(apt => `
                  <tr>
                    <td>${_esc(apt.apt ?? '')}</td>
                    <td>${_esc(apt.block ?? '')}</td>
                    <td>${_esc(apt.floor ?? '')}</td>
                    <td class="badge-table__uid">${apt.scsAddr ?? ''}</td>
                    <td>
                      <button class="btn btn--danger btn--sm"
                              data-action="remove-apt"
                              data-member-id="${_selectedMemberId}"
                              data-apt-id="${apt.id}"
                              data-i18n="badges.remove">
                      </button>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
             </table>`
        }

        <form id="add-apt-form" class="add-badge-form" style="margin-top:16px" novalidate>
          <input type="hidden" name="memberId" value="${_selectedMemberId}">
          <div class="form-group">
            <label class="form-label" for="apt-apt"
                   data-i18n="apartments.apt"></label>
            <input class="form-input" type="text" id="apt-apt"
                   name="apt" maxlength="32" autocomplete="off">
          </div>
          <div class="form-group">
            <label class="form-label" for="apt-block"
                   data-i18n="apartments.block"></label>
            <input class="form-input" type="text" id="apt-block"
                   name="block" maxlength="32" autocomplete="off">
          </div>
          <div class="form-group">
            <label class="form-label" for="apt-floor"
                   data-i18n="apartments.floor"></label>
            <input class="form-input" type="text" id="apt-floor"
                   name="floor" maxlength="32" autocomplete="off">
          </div>
          <div class="form-group">
            <label class="form-label" for="apt-scsaddr"
                   data-i18n="apartments.scsaddr"></label>
            <input class="form-input form-input--mono" type="number"
                   id="apt-scsaddr" name="scsAddr"
                   min="0" max="9999" autocomplete="off"
                   aria-describedby="error-apt-scsaddr">
            <span class="form-error" id="error-apt-scsaddr" hidden role="alert"></span>
          </div>
          <div class="form-group form-group--actions">
            <button type="submit" class="btn btn--primary"
                    data-i18n="apartments.add"></button>
          </div>
        </form>
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
                   placeholder="A1B2C3D4"
                   aria-describedby="error-uid">
            <span class="form-error" id="error-uid" hidden role="alert"></span>
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
            <span class="form-error" id="error-assign" hidden role="alert"></span>
          </div>

        </form>
      </div>

    </div>
  `;

  _applyI18n();
  _bindBadgeFormEvents(panel);
  _bindContactPanelActions(panel);
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
  });
}

// ---------------------------------------------------------------------------
// Add contact button & form (left panel)
// ---------------------------------------------------------------------------

function _bindAddContactButton() {
  document.addEventListener('click', e => {
    if (e.target.id === 'btn-add-contact' || e.target.closest('#btn-add-contact') ||
        e.target.dataset.action === 'add-contact') {
      const wrap = document.getElementById('add-contact-wrap');
      if (!wrap) return;
      wrap.hidden = false;
      wrap.querySelector('input')?.focus();
      return;
    }
    if (e.target.id === 'btn-cancel-add-contact') {
      const wrap = document.getElementById('add-contact-wrap');
      if (!wrap) return;
      wrap.hidden = true;
      const form = wrap.querySelector('form');
      if (form) { form.reset(); _clearFormErrors(form); }
    }
  });

  document.addEventListener('submit', e => {
    if (e.target.id !== 'add-contact-form') return;
    e.preventDefault();
    const form = e.target;
    _clearFormErrors(form);
    const name    = form.querySelector('[name="name"]').value;
    const surname = form.querySelector('[name="surname"]').value;
    const result  = _callbacks.onAddContact({ name, surname });
    if (!result.ok) {
      if (result.field === 'system') {
        _showToast(t(result.error), 'toast--error');
      } else {
        const errorIds = { name: '#error-new-name', surname: '#error-new-surname' };
        const el = form.querySelector(errorIds[result.field]);
        if (el) { el.textContent = t(result.error); el.hidden = false; }
      }
      return;
    }
    form.reset();
    const wrap = document.getElementById('add-contact-wrap');
    if (wrap) wrap.hidden = true;
    showSuccess('success.contact.added');
  });
}

// ---------------------------------------------------------------------------
// Apartment remove button (global delegated handler)
// ---------------------------------------------------------------------------

function _bindApartmentRemoveButton() {
  document.addEventListener('click', e => {
    const btn = e.target.closest('[data-action="remove-apt"]');
    if (!btn) return;
    if (!window.confirm(t('confirm.delete_apartment'))) return;
    const memberId = btn.dataset.memberId;
    const aptId    = btn.dataset.aptId;
    const result   = _callbacks.onRemoveApartment?.({ memberId, aptId });
    if (result?.ok) {
      showSuccess('success.apartment.deleted');
    } else {
      showSystemError('error.save');
    }
  });
}

// ---------------------------------------------------------------------------
// Contact panel actions (bound per render)
// ---------------------------------------------------------------------------

function _bindContactPanelActions(panel) {
  const editWrap = panel.querySelector('#edit-contact-wrap');

  // Toggle edit form
  const btnEdit = panel.querySelector('#btn-edit-contact');
  if (btnEdit && editWrap) {
    btnEdit.addEventListener('click', () => {
      editWrap.hidden = !editWrap.hidden;
      if (!editWrap.hidden) editWrap.querySelector('input:not([type="hidden"])')?.focus();
    });
  }

  // Cancel edit
  const btnCancelEdit = panel.querySelector('#btn-cancel-edit-contact');
  if (btnCancelEdit && editWrap) {
    btnCancelEdit.addEventListener('click', () => {
      editWrap.hidden = true;
      const form = editWrap.querySelector('form');
      if (form) _clearFormErrors(form);
    });
  }

  // Submit edit form
  const editForm = panel.querySelector('#edit-contact-form');
  if (editForm) {
    editForm.addEventListener('submit', e => {
      e.preventDefault();
      _clearFormErrors(editForm);
      const memberId = editForm.querySelector('[name="memberId"]').value;
      const name     = editForm.querySelector('[name="name"]').value;
      const surname  = editForm.querySelector('[name="surname"]').value;
      const result   = _callbacks.onEditContact({ memberId, name, surname });
      if (!result.ok) {
        if (result.field === 'system') {
          _showToast(t(result.error), 'toast--error');
        } else {
          const errorIds = { name: '#error-edit-name', surname: '#error-edit-surname' };
          const el = editForm.querySelector(errorIds[result.field]);
          if (el) { el.textContent = t(result.error); el.hidden = false; }
        }
        return;
      }
      showSuccess('success.contact.updated');
    });
  }

  // Delete contact
  const btnDelete = panel.querySelector('#btn-delete-contact');
  if (btnDelete) {
    btnDelete.addEventListener('click', () => {
      if (!window.confirm(t('confirm.delete_contact'))) return;
      const memberId = btnDelete.dataset.memberId;
      const result   = _callbacks.onDeleteContact({ memberId });
      if (!result?.ok) showSystemError('error.save');
    });
  }

  // Add apartment form
  const aptForm = panel.querySelector('#add-apt-form');
  if (aptForm) {
    aptForm.addEventListener('submit', e => {
      e.preventDefault();
      _clearFormErrors(aptForm);
      const memberId = aptForm.querySelector('[name="memberId"]').value;
      const apt      = aptForm.querySelector('[name="apt"]').value;
      const block    = aptForm.querySelector('[name="block"]').value;
      const floor    = aptForm.querySelector('[name="floor"]').value;
      const scsAddr  = aptForm.querySelector('[name="scsAddr"]').value;
      const result   = _callbacks.onAddApartment({ memberId, apt, block, floor, scsAddr });
      if (!result.ok) {
        if (result.field === 'system') {
          _showToast(t(result.error), 'toast--error');
        } else if (result.field === 'scsaddr') {
          const el = aptForm.querySelector('#error-apt-scsaddr');
          if (el) { el.textContent = t(result.error); el.hidden = false; }
        }
        return;
      }
      aptForm.reset();
      showSuccess('success.apartment.added');
    });
  }
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
  const region = document.getElementById('toast-region');
  if (!region) return;
  region.innerHTML = `<div class="toast ${modifier}">${_esc(message)}</div>`;
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => { region.innerHTML = ''; }, 3500);
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

function _aptMeta(apts) {
  if (!apts || !apts.length) return '';
  const aptStr = apts.map(a => _esc(a.apt ?? '')).filter(Boolean).join(', ');
  const scsStr = apts.map(a => a.scsAddr ?? '').filter(v => v !== '' && v != null).join(', ');
  const parts = [];
  if (aptStr) parts.push(`APT ${aptStr}`);
  if (scsStr) parts.push(`SCS ${scsStr}`);
  return parts.join(' &middot; ');
}

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

// ---------------------------------------------------------------------------
// Theme toggle
// ---------------------------------------------------------------------------

function _bindThemeToggle() {
  const btn = document.getElementById('btn-theme');
  if (!btn) return;
  _updateThemeButton();
  btn.addEventListener('click', () => {
    const isLight = document.documentElement.getAttribute('data-theme') === 'light';
    if (isLight) {
      document.documentElement.removeAttribute('data-theme');
      localStorage.setItem('fobforge_theme', 'dark');
    } else {
      document.documentElement.setAttribute('data-theme', 'light');
      localStorage.setItem('fobforge_theme', 'light');
    }
    _updateThemeButton();
  });
}

function _updateThemeButton() {
  const btn = document.getElementById('btn-theme');
  if (!btn) return;
  const isLight = document.documentElement.getAttribute('data-theme') === 'light';
  btn.textContent = isLight ? '🌙' : '☀️';
  btn.setAttribute('aria-label', t(isLight ? 'a11y.theme.dark' : 'a11y.theme.light'));
  btn.title = t(isLight ? 'a11y.theme.dark' : 'a11y.theme.light');
}