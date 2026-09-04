import { cn, formatCurrency } from '../utils';

describe('cn', () => {
  it('merges class names and resolves Tailwind conflicts', () => {
    expect(cn('px-2 py-1', 'px-4')).toBe('py-1 px-4');
  });

  it('drops falsy values', () => {
    expect(cn('text-sm', false && 'hidden', undefined, 'font-medium')).toBe(
      'text-sm font-medium'
    );
  });
});

describe('formatCurrency', () => {
  it('formats a number as INR with no decimal places', () => {
    expect(formatCurrency(1500)).toBe('₹1,500');
  });

  it('accepts a numeric string', () => {
    expect(formatCurrency('2500')).toBe('₹2,500');
  });
});
