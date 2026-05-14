// FobForge — i18n.js
// Internationalization module
// All user-facing strings live here. No text is hardcoded elsewhere.
// Usage: t('key') returns the string in the current language.

const SUPPORTED_LANGS = ['en', 'es'];
const DEFAULT_LANG = 'en';
const STORAGE_KEY = 'fobforge_lang';

const strings = {
  en: {
    // Accessibility
    'a11y.skip':                'Skip to main content',
    'a11y.theme.toggle':        'Switch theme',
    'a11y.theme.dark':          'Dark',
    'a11y.theme.light':         'Light',

    // App
    'app.title':                'FobForge',
    'app.subtitle':             'RFID Badge Manager for BTicino Sfera .prj files',
    'app.loading':              'Loading...',
    'app.welcome':              'Open a .prj file to get started',

    // Language selector
    'lang.en':                  'English',
    'lang.es':                  'Spanish',

    // File loading
    'file.drop':                'Drop a .prj file here',
    'file.or':                  'or',
    'file.browse':              'Browse file',
    'file.new':                 'New empty project',
    'file.open':                'Open .prj',
    'file.close':               'Close',
    'file.save':                'Save .prj',

    // Contacts
    'contacts.title':           'Contacts',
    'contacts.search':          'Search contacts…',
    'contacts.empty':           'No contacts yet — add your first one',
    'contacts.noresults':       'No contacts match your search',
    'contacts.select':          'Select a contact from the list',
    'contacts.badge_count':     'badges',

    // Badges
    'badges.title':             'Badges',
    'badges.empty':             'No badges assigned',
    'badges.uid':               'Badge UID',
    'badges.type':              'Type',
    'badges.note':              'Note (optional)',
    'badges.add':               'Add badge',
    'badges.remove':            'Remove',
    'badges.type.0':            'Resident',
    'badges.type.1':            'Passepartout',
    'badges.type.2':            'Master Apt.',

    // Validation errors
    'error.uid.length':         'UID must be exactly 8 characters',
    'error.uid.chars':          'UID must contain only hexadecimal characters (0-9, A-F)',
    'error.uid.duplicate':      'This UID already exists in the project',
    'error.badge.assigned':     'This badge is already assigned to this contact',
    'error.badge.taken':        'This badge is already assigned to another contact',

    // System errors
    'error.file.invalid':       'Invalid or unreadable .prj file',
    'error.file.load':          'Error loading file',
    'error.file.toobig':        'File too large (max 20 MB)',
    'error.save':               'Error saving file',
    'error.sqljsload':          'Error loading SQL engine. Check your connection and reload.',

    // Confirmations
    'confirm.close':            'You have unsaved changes. Close anyway?',
    'confirm.delete_badge':     'Remove this badge? This cannot be undone.',

    // Success messages
    'success.badge.added':      'Badge added successfully',
    'success.badge.removed':    'Badge removed',
    'success.file.saved':       'File saved successfully',

    // Actions
    'action.cancel':            'Cancel',

    // Contact management
    'contacts.add':             'Add contact',
    'contacts.edit':            'Edit contact',
    'contacts.delete':          'Delete contact',
    'contacts.name':            'Name',
    'contacts.surname':         'Surname',
    'error.member.name.required': 'Name is required',
    'error.member.surname.required': 'Surname is required',
    'success.contact.added':    'Contact added successfully',
    'success.contact.updated':  'Contact updated',
    'success.contact.deleted':  'Contact deleted',
    'confirm.delete_contact':   'Delete this contact? (all badges will be removed)',

    // Feedback
    'feedback.link':            'Feedback',
    'feedback.title':           'Report a bug or suggest a feature',

    // Disclaimer
    'disclaimer.text':          '⚠ FobForge modifies .prj files directly. Always back up your files before use. The author is not liable for any data loss or corruption.',

    // Apartment management
    'apartments.title':         'Apartments',
    'apartments.empty':         'No apartments assigned',
    'apartments.add':           'Add apartment',
    'apartments.apt':           'Apartment',
    'apartments.scsaddr':       'SCS Address',
    'apartments.block':         'Block',
    'apartments.floor':         'Floor',
    'error.apartment.scsaddr.numeric': 'SCS address must be numeric',
    'success.apartment.added':  'Apartment added',
    'success.apartment.updated': 'Apartment updated',
    'success.apartment.deleted': 'Apartment removed',
    'confirm.delete_apartment': 'Remove this apartment?',
  },

  es: {
    // Accessibility
    'a11y.skip':                'Saltar al contenido principal',
    'a11y.theme.toggle':        'Cambiar tema',
    'a11y.theme.dark':          'Oscuro',
    'a11y.theme.light':         'Claro',

    // App
    'app.title':                'FobForge',
    'app.subtitle':             'Gestor de badges RFID para ficheros .prj de BTicino Sfera',
    'app.loading':              'Cargando...',
    'app.welcome':              'Abre un fichero .prj para comenzar',

    // Language selector
    'lang.en':                  'Inglés',
    'lang.es':                  'Español',

    // File loading
    'file.drop':                'Arrastra un fichero .prj aquí',
    'file.or':                  'o',
    'file.browse':              'Seleccionar fichero',
    'file.new':                 'Nuevo proyecto vacío',
    'file.open':                'Abrir .prj',
    'file.close':               'Cerrar',
    'file.save':                'Guardar .prj',

    // Contacts
    'contacts.title':           'Contactos',
    'contacts.search':          'Buscar contactos…',
    'contacts.empty':           'Sin contactos aún — añade el primero',
    'contacts.noresults':       'Ningún contacto coincide con la búsqueda',
    'contacts.select':          'Selecciona un contacto de la lista',
    'contacts.badge_count':     'badges',

    // Badges
    'badges.title':             'Badges',
    'badges.empty':             'Sin badges asignados',
    'badges.uid':               'UID del badge',
    'badges.type':              'Tipo',
    'badges.note':              'Nota (opcional)',
    'badges.add':               'Añadir badge',
    'badges.remove':            'Eliminar',
    'badges.type.0':            'Residente',
    'badges.type.1':            'Passepartout',
    'badges.type.2':            'Master Apto.',

    // Validation errors
    'error.uid.length':         'El UID debe tener exactamente 8 caracteres',
    'error.uid.chars':          'El UID solo puede contener caracteres hexadecimales (0-9, A-F)',
    'error.uid.duplicate':      'Este UID ya existe en el proyecto',
    'error.badge.assigned':     'Este badge ya está asignado a este contacto',
    'error.badge.taken':        'Este badge ya está asignado a otro contacto',

    // System errors
    'error.file.invalid':       'Fichero .prj inválido o ilegible',
    'error.file.load':          'Error al cargar el fichero',
    'error.file.toobig':        'Fichero demasiado grande (máx. 20 MB)',
    'error.save':               'Error al guardar el fichero',
    'error.sqljsload':          'Error al cargar el motor SQL. Comprueba tu conexión y recarga.',

    // Confirmations
    'confirm.close':            'Tienes cambios sin guardar. ¿Cerrar igualmente?',
    'confirm.delete_badge':     '¿Eliminar este badge? Esta acción no se puede deshacer.',

    // Success messages
    'success.badge.added':      'Badge añadido correctamente',
    'success.badge.removed':    'Badge eliminado',
    'success.file.saved':       'Fichero guardado correctamente',

    // Actions
    'action.cancel':            'Cancelar',

    // Contact management
    'contacts.add':             'Añadir contacto',
    'contacts.edit':            'Editar contacto',
    'contacts.delete':          'Eliminar contacto',
    'contacts.name':            'Nombre',
    'contacts.surname':         'Apellido',
    'error.member.name.required': 'El nombre es requerido',
    'error.member.surname.required': 'El apellido es requerido',
    'success.contact.added':    'Contacto añadido correctamente',
    'success.contact.updated':  'Contacto actualizado',
    'success.contact.deleted':  'Contacto eliminado',
    'confirm.delete_contact':   '¿Eliminar este contacto? (se eliminarán todos sus badges)',

    // Feedback
    'feedback.link':            'Feedback',
    'feedback.title':           'Reportar un error o sugerir una mejora',

    // Disclaimer
    'disclaimer.text':          '⚠ FobForge modifica ficheros .prj directamente. Realiza siempre una copia de seguridad antes de usar la herramienta. El autor no se hace responsable de pérdidas de datos ni corrupciones.',

    // Apartment management
    'apartments.title':         'Apartamentos',
    'apartments.empty':         'Sin apartamentos asignados',
    'apartments.add':           'Añadir apartamento',
    'apartments.apt':           'Apartamento',
    'apartments.scsaddr':       'Dirección SCS',
    'apartments.block':         'Bloque',
    'apartments.floor':         'Piso',
    'error.apartment.scsaddr.numeric': 'La dirección SCS debe ser numérica',
    'success.apartment.added':  'Apartamento añadido',
    'success.apartment.updated': 'Apartamento actualizado',
    'success.apartment.deleted': 'Apartamento eliminado',
    'confirm.delete_apartment': '¿Eliminar este apartamento?',
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