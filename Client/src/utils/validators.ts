export const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const NAME = /^[A-Za-zÀ-ɏ][A-Za-zÀ-ɏ\s'-]*$/;
// Exact password policy is a team setting; this is length plus a letter and a digit.
export const isStrongPassword = (p: string) => p.length >= 8 && /[A-Za-z]/.test(p) && /\d/.test(p);