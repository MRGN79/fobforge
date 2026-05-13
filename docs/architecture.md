# FobForge — Architecture Document

**Version:** 1.0  
**Date:** 2026-05-07  
**Author:** MRGN79  
**Status:** Approved

---

## 1. Overview

FobForge is a single-page web application that runs entirely in the browser.
No backend, no server, no database. All processing happens client-side.

---

## 2. Tech stack

| Layer | Technology | Reason |
|-------|-----------|--------|
| Structure | HTML5 | Standard, no framework needed |
| Styles | CSS3 (vanilla) | No framework — full control, no dependencies |
| Logic | JavaScript ES6+ (vanilla) | No framework — readable, maintainable, no build step |
| SQLite | sql.js (WebAssembly) | Only external dependency — official SQLite compiled to WASM |
| Hosting | GitHub Pages | Free, zero configuration for static sites |
| Version control | Git / GitHub | Standard, integrates with GitHub Pages |

---

## 3. Project structure

    fobforge/
    │
    ├── index.html              # Application entry point
    ├── README.md               # Project overview
    ├── LICENSE                 # MIT License
    │
    ├── css/
    │   └── main.css            # All styles
    │
    ├── js/
    │   ├── app.js              # Application bootstrap and state management
    │   ├── prj.js              # .prj file read/write (ZIP + encryption layers)
    │   ├── db.js               # SQLite read/write via sql.js
    │   ├── ui.js               # DOM rendering and event handlers
    │   ├── i18n.js             # Internationalization system
    │   └── validate.js         # Input validation (including validateUID())
    │
    └── docs/
        ├── requirements.md     # Functional and non-functional requirements
        └── architecture.md     # This document

---

## 4. Data flow

### 4.1 Loading a .prj file

    User selects .prj file
            |
            v
    FileReader API (ArrayBuffer)
            |
            v
    prj.js — decompress outer ZIP (key: see NFR-04)
            |
            v
    prj.js — decompress inner .xtz files (key: see NFR-04)
            |
            v
    db.js — load Device_contacts.db3 into sql.js
            |
            v
    db.js — query all tables into app state
            |
            v
    ui.js — render contact list

### 4.2 Adding a badge and saving

    User enters UID
            |
            v
    validate.js — validateUID()
            |
            v
    app.js — update in-memory state
            |
            v
    User clicks Save
            |
            v
    db.js — serialize state back to SQLite (sql.js export)
            |
            v
    prj.js — repack inner ZIP with encryption
            |
            v
    prj.js — repack outer ZIP with encryption
            |
            v
    Browser download API — user receives .prj file

---

## 5. Module responsibilities

### 5.1 app.js

- Application entry point
- Initializes sql.js (WebAssembly load)
- Holds the single in-memory state object
- Coordinates communication between modules
- No DOM manipulation (delegated to ui.js)
- No file I/O (delegated to prj.js and db.js)

State object structure:

    {
      loaded: false,
      fileName: '',
      contacts: [],    // from MEMBER + MEMBER_APT + APT
      badges: [],      // from BADGE
      assignments: [], // from MEMBER_BADGE
      rawXtz0: null,   // 0.xtz raw bytes (kept as-is)
      rawXtz1: null,   // 1.xtz raw bytes (kept as-is)
    }

### 5.2 prj.js

- Reads .prj file (outer ZIP, ZipCrypto decryption)
- Extracts .xtz files (inner ZIP, ZipCrypto decryption)
- Isolates Device_contacts.db3 bytes
- On save: repacks everything in reverse order
- ZipCrypto implemented in pure JS (no external library)
- Keys managed as per NFR-04

### 5.3 db.js

- Receives raw SQLite bytes from prj.js
- Loads them into sql.js
- Exposes clean read functions:
  - getContacts()
  - getBadges()
  - getAssignments()
- Exposes clean write functions:
  - addBadge(uid, type, note)
  - assignBadge(memberId, badgeId)
  - removeBadge(memberId, badgeId)
- Exports modified database as Uint8Array for prj.js

### 5.4 ui.js

- All DOM manipulation lives here
- Renders contact list
- Renders badge list per contact
- Handles all user events (clicks, input, drag & drop)
- Calls validate.js before any write operation
- Calls app.js to update state
- No business logic

### 5.5 i18n.js

- Contains all user-facing strings in English and Spanish
- Exposes a single t(key) function
- Language stored in localStorage
- All UI text goes through t() — no hardcoded strings in ui.js

Usage example:

    // i18n.js
    const strings = {
      en: {
        'badge.add': 'Add badge',
        'badge.uid': 'Badge UID',
        'error.uid.length': 'UID must be exactly 8 characters',
      },
      es: {
        'badge.add': 'Añadir badge',
        'badge.uid': 'UID del badge',
        'error.uid.length': 'El UID debe tener exactamente 8 caracteres',
      }
    };

    export function t(key) {
      return strings[currentLang][key] || strings['en'][key] || key;
    }

### 5.6 validate.js

- Centralized validation logic
- Designed to be extended in future versions

Core function:

    export function validateUID(uid, existingBadges) {
      if (uid.length !== 8)
        return { valid: false, error: t('error.uid.length') };
      if (!/^[0-9A-F]+$/.test(uid))
        return { valid: false, error: t('error.uid.chars') };
      if (existingBadges.find(b => b.id === uid))
        return { valid: false, error: t('error.uid.duplicate') };
      return { valid: true };
    }

---

## 6. Security decisions

### 6.1 Cryptographic keys (NFR-04)

The .prj format uses two hardcoded ZipCrypto keys. These keys are not secret 
in any meaningful sense — they are identical across all .prj files and apply to 
the legacy ZIP encryption scheme used in the format.

To avoid publishing them in plain text in a public repository, they are stored 
obfuscated in prj.js and decoded at runtime. This is a cosmetic measure, not a 
security guarantee.

### 6.2 Client-side only

No data ever leaves the user's browser. There is no backend, no API,
no analytics. The tool works fully offline once loaded.

---

## 7. Internationalization

All user-facing strings are managed by i18n.js.
No text is hardcoded in HTML or other JS modules.
Language preference is persisted in localStorage.
The language selector is always visible in the UI header.

Supported languages: English (en), Spanish (es)

---

## 8. External dependency: sql.js

- Repository: https://github.com/sql-js/sql.js
- License: MIT
- Why: Reading and writing SQLite binary format correctly
  requires the actual SQLite engine. A hand-written parser
  risks corrupting user files.
- How it is loaded: Via CDN in index.html, with a specific
  pinned version to avoid unexpected breaking changes.
- Fallback: If sql.js fails to load, the application shows
  an error and does not proceed.

---

## 9. Hosting and deployment

- Platform: GitHub Pages
- URL: https://mrgn79.github.io/fobforge
- Branch: main
- Activation: Settings > Pages > Source: main / root
- Deploy: Automatic on every push to main

No build step required. GitHub Pages serves static files directly.

---

*This document is part of the FobForge project.*  
*Repository: https://github.com/MRGN79/fobforge*