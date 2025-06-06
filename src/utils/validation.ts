import { User } from '@supabase/supabase-js';

// Type definitions for validation results
export interface ValidationResult {
  isValid: boolean;
  error?: string | null;
}

// UUID validation regex
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Validates game ID format (must be a valid UUID)
 */
export function validateGameId(gameId: string): ValidationResult {
  if (!gameId || typeof gameId !== 'string') {
    return {
      isValid: false,
      error: 'Game ID is required'
    };
  }

  if (!UUID_REGEX.test(gameId)) {
    return {
      isValid: false,
      error: 'Invalid game ID format'
    };
  }

  return {
    isValid: true,
    error: null
  };
}

/**
 * Validates card selection
 */
export function validateCardSelection(
  selectedCards: string[],
  availableCards: string[],
  maxCards: number
): ValidationResult {
  // Check for duplicates
  const uniqueCards = [...new Set(selectedCards)];
  if (uniqueCards.length !== selectedCards.length) {
    return {
      isValid: false,
      error: 'Duplicate cards in selection'
    };
  }

  // Check max limit
  if (selectedCards.length > maxCards) {
    return {
      isValid: false,
      error: 'Too many cards selected'
    };
  }

  // Check if all selected cards are available
  const invalidCards = selectedCards.filter(card => !availableCards.includes(card));
  if (invalidCards.length > 0) {
    return {
      isValid: false,
      error: 'Invalid card selection'
    };
  }

  return {
    isValid: true,
    error: null
  };
}

/**
 * Validates authentication state
 */
export function validateAuthState(user: User | null): ValidationResult {
  if (!user) {
    return {
      isValid: false,
      error: 'User not authenticated'
    };
  }

  if (!user.email) {
    return {
      isValid: false,
      error: 'Invalid user data'
    };
  }

  return {
    isValid: true,
    error: null
  };
}

/**
 * Sanitizes input by removing dangerous HTML tags
 */
export function sanitizeInput(input: string): string {
  if (typeof input !== 'string') {
    return '';
  }

  // Remove script, iframe, object, embed, and style tags
  return input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
    .replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, '')
    .replace(/<embed\b[^<]*(?:(?!<\/embed>)<[^<]*)*<\/embed>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');
}

/**
 * Rate limiter class
 */
class RateLimiter {
  private requests: number[] = [];
  private maxRequests: number;
  private windowMs: number;

  constructor(maxRequests: number, windowMs: number) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
  }

  canProceed(): boolean {
    const now = Date.now();
    
    // Remove old requests outside the window
    this.requests = this.requests.filter(time => now - time < this.windowMs);
    
    // Check if we can make a new request
    if (this.requests.length < this.maxRequests) {
      this.requests.push(now);
      return true;
    }
    
    return false;
  }

  getRemainingRequests(): number {
    const now = Date.now();
    this.requests = this.requests.filter(time => now - time < this.windowMs);
    return Math.max(0, this.maxRequests - this.requests.length);
  }

  getTimeUntilReset(): number {
    if (this.requests.length === 0) return 0;
    const oldest = Math.min(...this.requests);
    return Math.max(0, this.windowMs - (Date.now() - oldest));
  }
}

/**
 * Creates a new rate limiter instance
 */
export function createRateLimiter(maxRequests: number, windowMs: number): RateLimiter {
  return new RateLimiter(maxRequests, windowMs);
}

// Pre-configured rate limiters
export const gameUpdateLimiter = createRateLimiter(5, 10000); // 5 requests per 10 seconds
export const selectionLimiter = createRateLimiter(20, 60000); // 20 requests per minute