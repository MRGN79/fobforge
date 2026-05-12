// FobForge — i18n.js
// Internationalization module
// All user-facing strings live here. No text is hardcoded elsewhere.
// Usage: t('key') returns the string in the current language.

const SUPPORTED_LANGS = ['en', 'es'];
const DEFAULT_LANG = 'en';
const STORAGE_KEY = 'fobforge_lang';

const strings = {
  en: {
    // App
    'app.title':                'FobForge',
    'app.subtitle':             'RFID Badge Manager for BTicino Sfera .prj files',
    'app.loading':              'Loading...',

    // Language selector
    'lang.en':                  'English',
    'lang.es':                  'Spanish',

    // File loading
    'file.drop':                'Drop a .prj file here',
    'file.or':                  'or',
    'file.browse':              'Browse file',
    'file.loaded':              'File loaded',
    'file.open':                'Open .prj',
    'file.save':                'Save .prj',

    // Contacts
    'contacts.title':           'Contacts',
    'contacts.empty':           'No contacts found in this project',
    'contacts.badge_count':     'badges',

    // Badges
    'badges.title':             'Badges',
    'badges.empty':             'No badges assigned',
    'badges.uid':               'Badge UID',
    'badges.type':              'Type',
    'badges.note':              'Note (optional)',
    'badges.add':               'Add badge',
    'badges.assign':            'Assign to contact',
    'badges.remove':            'Remove',
    'badges.type.0':            'Resident',
    'badges.type.1':            'Passepartout',
    'badges.type.2':            'Master Apt.',

    // Validation errors
    'error.uid.length':         'UID must be exactly 8 characters',
    'error.uid.chars':          'UID must contain only hexadecimal characters (0-9, A-F)',
    'error.uid.duplicate':      'This UID already exists in the project',
    'error.badge.assigned':     'This badge is already assigned to this contact',

    // System errors
    'error.file.invalid':       'Invalid or unreadable .prj file',
    'error.file.load':          'Error loading file',
    'error.save':               'Error saving file',
    'error.sqljsload':          'Error loading SQL engine. Check your connection and reload.',

    // Success messages
    'success.badge.added':      'Badge added successfully',
    'success.badge.removed':    'Badge removed',
    'success.file.saved':       'File saved successfully',
  },

  es: {
    // App
    'app.title':                'FobForge',
    'app.subtitle':             'Gestor de badges RFID para ficheros .prj de BTicino Sfera',
    'app.loading':              'Cargando...',

    // Language selector
    'lang.en':                  'Inglés',
    'lang.es':                  'Español',

    // File loading
    'file.drop':                'Arrastra un fichero .prj aquí',
    'file.or':                  'o',
    'file.browse':              'Seleccionar fichero',
    'file.loaded':              'Fichero cargado',
    'file.open':                'Abrir .prj',
    'file.save':                'Guardar .prj',

    // Contacts
    'contacts.title':           'Contactos',
    'contacts.empty':           'No se encontraron contactos en este proyecto',
    'contacts.badge_count':     'badges',

    // Badges
    'badges.title':             'Badges',
    'badges.empty':             'Sin badges asignados',
    'badges.uid':               'UID del badge',
    'badges.type':              'Tipo',
    'badges.note':              'Nota (opcional)',
    'badges.add':               'Añadir badge',
    'badges.assign':            'Asignar a contacto',
    'badges.remove':            'Eliminar',
    'badges.type.0':            'Residente',
    'badges.type.1':            'Passepartout',
    'badges.type.2':            'Master Apto.',

    // Validation errors
    'error.uid.length':         'El UID debe tener exactamente 8 caracteres',
    'error.uid.chars':          'El UID solo puede contener caracteres hexadecimales (0-9, A-F)',
    'error.uid.duplicate':      'Este UID ya existe en el proyecto',
    'error.badge.assigned':     'Este badge ya está asignado a este contacto',

    // System errors
    'error.file.invalid':       'Fichero .prj inválido o ilegible',
    'error.file.load':          'Error al cargar el fichero',
    'error.save':               'Error al guardar el fichero',
    'error.sqljsload':          'Error al cargar el motor SQL. Comprueba tu conexión y recarga.',

    // Success messages
    'success.badge.added':      'Badge añadido correctamente',
    'success.badge.removed':    'Badge eliminado',
    'success.file.saved':       'Fichero guardado correctamente',
  }
};

// Current language — read from localStorage or use default
let currentLang = DEFAULT_LANG;

export function initI18n() {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored && SUPPORTED_LANGS.includes(stored)) {
    currentLang = stored;
  } else {
    // Try to detect browser language
    const browserLang = navigator.language?.slice(0, 2);
    if (SUPPORTED_LANGS.includes(browserLang)) {
      currentLang = browserLang;
    }
  }
}

export function setLang(lang) {
  if (!SUPPORTED_LANGS.includes(lang)) return;
  currentLang = lang;
  localStorage.setItem(STORAGE_KEY, lang);
}

export function getLang() {
  return currentLang;
}

export function t(key) {
  return strings[currentLang]?.[key]
    ?? strings[DEFAULT_LANG]?.[key]
    ?? key;
}