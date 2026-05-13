# FobForge

> Web tool for managing RFID badges in BTicino TiSferaDesign `.prj` files.

**FobForge** allows field technicians to add and manage RFID transponder badges
in BTicino/Legrand Sfera New & Robur door entry systems, without needing to be
physically connected to the reader hardware.

---

## The problem it solves

BTicino's official software (TiSferaDesign) can manage contacts, apartments and
access codes - but **cannot register new RFID badges without a USB connection to
the physical reader module**. This forces technicians to carry a laptop to the
installation site every time a new badge needs to be added.

FobForge solves this by allowing technicians to edit the `.prj` file directly,
adding badge UIDs manually (the UID code is printed on every transponder).

---

## Features (v1 - MVP)

- Load an existing `.prj` file
- View contacts and residents
- Create a new RFID badge by entering its UID manually
- Assign a badge to a contact
- Remove a badge from a contact
- Save the modified `.prj` file
- English / Spanish interface

---

## How it works

FobForge runs entirely in the browser. No data is sent to any server.
The `.prj` file never leaves your device.

Internally, a `.prj` file is a double-encrypted ZIP archive containing
a SQLite database (`Device_contacts.db3`) where contacts and badge assignments
are stored. FobForge reads, modifies and rewrites this structure client-side.

---

## Compatibility

Tested with:
- BTicino Sfera New
- BTicino Sfera Robur

Software version: TiSferaDesign (any version generating `.prj` files)

---

## Legal

FobForge is an independent open source tool and is not affiliated with,
endorsed by, or in any way officially connected to BTicino S.p.A. or
Legrand Group.

The `.prj` file format was analyzed for interoperability purposes under
EU Directive 2009/24/EC (Software Directive).

FobForge does not distribute any BTicino software or copyrighted material.

---

## Tech stack

- Vanilla HTML / CSS / JavaScript (no frameworks, no build tools)
- [sql.js](https://github.com/sql-js/sql.js/) - SQLite compiled to WebAssembly
- Hosted on GitHub Pages

---

## Feedback & Support

- **Report issues or suggest features:** [GitHub Issues](https://github.com/MRGN79/fobforge/issues/new)
- **Usage stats:** [GoatCounter analytics](https://mrgn79.goatcounter.com) (public)

---

## License

MIT © 2026 [MRGN79](https://github.com/MRGN79)