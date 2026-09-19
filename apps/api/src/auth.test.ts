import { describe, expect, it } from 'vitest';
import { generateInviteCode, inviteCodeHash, registrationInput } from './auth.js';

describe('SaaS authentication inputs', () => {
  it('normalizes emails, usernames, and invite codes safely', () => {
    const parsed = registrationInput.parse({
      email: ' Student@Example.COM ',
      username: ' Student.One ',
      displayName: 'Student One',
      password: 'a-secure-password',
      inviteCode: ' nzm-example ',
    });
    expect(parsed.email).toBe('student@example.com');
    expect(parsed.username).toBe('student.one');
    expect(inviteCodeHash(parsed.inviteCode!)).toBe(inviteCodeHash('NZM-EXAMPLE'));
  });

  it('rejects weak passwords and malformed usernames', () => {
    expect(() => registrationInput.parse({ email: 'a@example.com', username: 'bad name', displayName: 'A User', password: 'short' })).toThrow();
  });

  it('generates non-repeating high-entropy invite codes', () => {
    const codes = new Set(Array.from({ length: 50 }, generateInviteCode));
    expect(codes.size).toBe(50);
    expect([...codes].every((code) => code.startsWith('NZM-'))).toBe(true);
  });
});
