import { describe, it, expect } from 'vitest';
import {
  validateUID, validateAssignment,
  validateMemberName, validateMemberSurname, validateApartmentScsAddr,
} from '../js/validate.js';

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

describe('validateMemberName', () => {
  it('accepts a non-empty name', () => {
    expect(validateMemberName('John')).toEqual({ valid: true });
  });

  it('rejects empty string', () => {
    expect(validateMemberName('')).toMatchObject({ valid: false, error: 'error.member.name.required' });
  });

  it('rejects whitespace-only string', () => {
    expect(validateMemberName('   ')).toMatchObject({ valid: false, error: 'error.member.name.required' });
  });

  it('rejects null', () => {
    expect(validateMemberName(null)).toMatchObject({ valid: false, error: 'error.member.name.required' });
  });
});

describe('validateMemberSurname', () => {
  it('accepts a non-empty surname', () => {
    expect(validateMemberSurname('Doe')).toEqual({ valid: true });
  });

  it('rejects empty string', () => {
    expect(validateMemberSurname('')).toMatchObject({ valid: false, error: 'error.member.surname.required' });
  });

  it('rejects whitespace-only string', () => {
    expect(validateMemberSurname('   ')).toMatchObject({ valid: false, error: 'error.member.surname.required' });
  });

  it('rejects null', () => {
    expect(validateMemberSurname(null)).toMatchObject({ valid: false, error: 'error.member.surname.required' });
  });
});

describe('validateApartmentScsAddr', () => {
  it('accepts a valid positive number', () => {
    expect(validateApartmentScsAddr(42)).toEqual({ valid: true });
  });

  it('accepts 0', () => {
    expect(validateApartmentScsAddr(0)).toEqual({ valid: true });
  });

  it('accepts empty string (optional field not filled in)', () => {
    expect(validateApartmentScsAddr('')).toEqual({ valid: true });
  });

  it('accepts undefined', () => {
    expect(validateApartmentScsAddr(undefined)).toEqual({ valid: true });
  });

  it('accepts null', () => {
    expect(validateApartmentScsAddr(null)).toEqual({ valid: true });
  });

  it('rejects NaN', () => {
    expect(validateApartmentScsAddr(NaN)).toMatchObject({ valid: false, error: 'error.apartment.scsaddr.numeric' });
  });

  it('rejects a non-numeric string', () => {
    expect(validateApartmentScsAddr('abc')).toMatchObject({ valid: false, error: 'error.apartment.scsaddr.numeric' });
  });
});
