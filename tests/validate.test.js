import { describe, it, expect } from 'vitest';
import { validateUID, validateAssignment } from '../js/validate.js';

describe('validateUID', () => {
  it('accepts a valid 8-char uppercase hex UID', () => {
    expect(validateUID('AABBCCDD', [])).toEqual({ valid: true });
  });

  it('accepts all-numeric UID', () => {
    expect(validateUID('12345678', [])).toEqual({ valid: true });
  });

  it('rejects null', () => {
    expect(validateUID(null, [])).toMatchObject({ valid: false, error: 'error.uid.length' });
  });

  it('rejects empty string', () => {
    expect(validateUID('', [])).toMatchObject({ valid: false, error: 'error.uid.length' });
  });

  it('rejects UID shorter than 8 chars', () => {
    expect(validateUID('AABBCC', [])).toMatchObject({ valid: false, error: 'error.uid.length' });
  });

  it('rejects UID longer than 8 chars', () => {
    expect(validateUID('AABBCCDD00', [])).toMatchObject({ valid: false, error: 'error.uid.length' });
  });

  it('rejects lowercase hex', () => {
    expect(validateUID('aabbccdd', [])).toMatchObject({ valid: false, error: 'error.uid.chars' });
  });

  it('rejects non-hex characters', () => {
    expect(validateUID('AABBCCZZ', [])).toMatchObject({ valid: false, error: 'error.uid.chars' });
  });

  it('rejects UID already in the badges list', () => {
    const existing = [{ id: 'AABBCCDD' }];
    expect(validateUID('AABBCCDD', existing)).toMatchObject({ valid: false, error: 'error.uid.duplicate' });
  });

  it('accepts UID not in the badges list', () => {
    const existing = [{ id: '11223344' }];
    expect(validateUID('AABBCCDD', existing)).toEqual({ valid: true });
  });

  it('uses default empty array when no badge list supplied', () => {
    expect(validateUID('AABBCCDD')).toEqual({ valid: true });
  });
});

describe('validateAssignment', () => {
  it('accepts a fresh assignment', () => {
    expect(validateAssignment('m1', 'AABBCCDD', [])).toEqual({ valid: true });
  });

  it('rejects badge already assigned to the same member', () => {
    const existing = [{ memberId: 'm1', badgeId: 'AABBCCDD' }];
    expect(validateAssignment('m1', 'AABBCCDD', existing))
      .toMatchObject({ valid: false, error: 'error.badge.assigned' });
  });

  it('rejects badge assigned to a different member', () => {
    const existing = [{ memberId: 'm2', badgeId: 'AABBCCDD' }];
    expect(validateAssignment('m1', 'AABBCCDD', existing))
      .toMatchObject({ valid: false, error: 'error.badge.taken' });
  });

  it('allows same member to get a different badge', () => {
    const existing = [{ memberId: 'm1', badgeId: '11223344' }];
    expect(validateAssignment('m1', 'AABBCCDD', existing)).toEqual({ valid: true });
  });

  it('uses default empty array when no assignment list supplied', () => {
    expect(validateAssignment('m1', 'AABBCCDD')).toEqual({ valid: true });
  });
});
