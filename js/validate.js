// FobForge — validate.js
// Centralized validation logic.
// All validation goes through this module — never inline in ui.js or app.js.
// Designed to be extended in future versions.
// Returns i18n keys (not translated strings) so callers can re-translate on language change.

// UID validation rules:
// - Exactly 8 characters
// - Hexadecimal only (0-9, A-F)
// - Must not already exist in the project
//
// Returns: { valid: true } or { valid: false, error: 'i18n-key' }

export function validateUID(uid, existingBadges = []) {
  if (!uid || uid.length !== 8) {
    return { valid: false, error: 'error.uid.length' };
  }

  if (!/^[0-9A-F]+$/.test(uid)) {
    return { valid: false, error: 'error.uid.chars' };
  }

  if (existingBadges.find(b => b.id === uid)) {
    return { valid: false, error: 'error.uid.duplicate' };
  }

  return { valid: true };
}

// Badge assignment validation:
// - Badge must not already be assigned to any contact
//
// Returns: { valid: true } or { valid: false, error: 'i18n-key' }

export function validateAssignment(memberId, badgeId, existingAssignments = []) {
  const assignedToSelf = existingAssignments.find(
    a => a.memberId === memberId && a.badgeId === badgeId
  );
  if (assignedToSelf) {
    return { valid: false, error: 'error.badge.assigned' };
  }

  const assignedToOther = existingAssignments.find(
    a => a.badgeId === badgeId && a.memberId !== memberId
  );
  if (assignedToOther) {
    return { valid: false, error: 'error.badge.taken' };
  }

  return { valid: true };
}

// Contact validation

export function validateMemberName(name) {
  if (!name || name.trim().length === 0) {
    return { valid: false, error: 'error.member.name.required' };
  }
  return { valid: true };
}

export function validateMemberSurname(surname) {
  if (!surname || surname.trim().length === 0) {
    return { valid: false, error: 'error.member.surname.required' };
  }
  return { valid: true };
}

// Apartment validation (most fields optional, only validate SCS address format if provided)

export function validateApartmentScsAddr(scsAddr) {
  if (scsAddr !== undefined && scsAddr !== null && scsAddr !== '') {
    if (isNaN(scsAddr)) {
      return { valid: false, error: 'error.apartment.scsaddr.numeric' };
    }
  }
  return { valid: true };
}