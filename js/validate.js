// FobForge — validate.js
// Centralized validation logic.
// All validation goes through this module — never inline in ui.js or app.js.
// Designed to be extended in future versions.

import { t } from './i18n.js';

// UID validation rules:
// - Exactly 8 characters
// - Hexadecimal only (0-9, A-F)
// - Must not already exist in the project
//
// Returns: { valid: true } or { valid: false, error: 'message' }

export function validateUID(uid, existingBadges = []) {
  if (!uid || uid.length !== 8) {
    return { valid: false, error: t('error.uid.length') };
  }

  if (!/^[0-9A-F]+$/.test(uid)) {
    return { valid: false, error: t('error.uid.chars') };
  }

  if (existingBadges.find(b => b.id === uid)) {
    return { valid: false, error: t('error.uid.duplicate') };
  }

  return { valid: true };
}

// Badge assignment validation:
// - Badge must not already be assigned to the same contact
//
// Returns: { valid: true } or { valid: false, error: 'message' }

export function validateAssignment(memberId, badgeId, existingAssignments = []) {
  const alreadyAssigned = existingAssignments.find(
    a => a.memberId === memberId && a.badgeId === badgeId
  );

  if (alreadyAssigned) {
    return { valid: false, error: t('error.badge.assigned') };
  }

  return { valid: true };
}