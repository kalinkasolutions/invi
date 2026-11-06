import { isTokenRejection } from './auth';

describe('isTokenRejection', () => {
  it('signs out only on the messages Invidious gives for a token it will not take', () => {
    expect(isTokenRejection(403, 'Invalid signature')).toBe(true);
    expect(isTokenRejection(403, 'Token is expired, please try again')).toBe(true);
  });

  it('keeps you signed in when something else failed inside the request', () => {
    expect(isTokenRejection(403, 'Deleted or invalid channel')).toBe(false);
    expect(isTokenRejection(403, 'Invalid scope')).toBe(false);
    expect(isTokenRejection(403, undefined)).toBe(false);
    expect(isTokenRejection(500, 'Invalid signature')).toBe(false);
  });
});
