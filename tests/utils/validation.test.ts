// Tests for validation utilities
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  validateGameId,
  validateCardSelection,
  validateAuthState,
  gameUpdateLimiter,
  selectionLimiter,
  debounce,
  isValidUUID,
  sanitizeInput,
  createRateLimiter
} from '../../src/utils/validation.js';

describe('Validation Utilities', () => {
  describe('validateGameId', () => {
    it('should validate correct UUID format', () => {
      const validUUID = '123e4567-e89b-12d3-a456-426614174000';
      const result = validateGameId(validUUID);
      
      expect(result.isValid).toBe(true);
      expect(result.error).toBeNull();
    });

    it('should reject invalid UUID format', () => {
      const invalidUUID = 'not-a-uuid';
      const result = validateGameId(invalidUUID);
      
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Invalid game ID format');
    });

    it('should reject null or undefined', () => {
      expect(validateGameId(null).isValid).toBe(false);
      expect(validateGameId(undefined).isValid).toBe(false);
    });

    it('should reject empty string', () => {
      const result = validateGameId('');
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Game ID is required');
    });
  });

  describe('validateCardSelection', () => {
    it('should validate correct selection', () => {
      const selection = ['card1', 'card2', 'card3'];
      const availableCards = ['card1', 'card2', 'card3', 'card4'];
      const result = validateCardSelection(selection, availableCards, 3);
      
      expect(result.isValid).toBe(true);
      expect(result.error).toBeNull();
    });

    it('should reject selection exceeding max count', () => {
      const selection = ['card1', 'card2', 'card3', 'card4'];
      const availableCards = ['card1', 'card2', 'card3', 'card4'];
      const result = validateCardSelection(selection, availableCards, 3);
      
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Too many cards selected');
    });

    it('should reject selection with unavailable cards', () => {
      const selection = ['card1', 'card5'];
      const availableCards = ['card1', 'card2', 'card3', 'card4'];
      const result = validateCardSelection(selection, availableCards, 3);
      
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Invalid card selection');
    });

    it('should handle empty selection', () => {
      const selection: string[] = [];
      const availableCards = ['card1', 'card2'];
      const result = validateCardSelection(selection, availableCards, 3);
      
      expect(result.isValid).toBe(true);
    });

    it('should reject duplicate cards in selection', () => {
      const selection = ['card1', 'card1', 'card2'];
      const availableCards = ['card1', 'card2', 'card3'];
      const result = validateCardSelection(selection, availableCards, 3);
      
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Duplicate cards in selection');
    });
  });

  describe('validateAuthState', () => {
    it('should validate authenticated user', () => {
      const user = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        email: 'test@example.com'
      };
      const result = validateAuthState(user);
      
      expect(result.isValid).toBe(true);
      expect(result.error).toBeNull();
    });

    it('should reject null user', () => {
      const result = validateAuthState(null);
      
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('User not authenticated');
    });

    it('should reject user without valid ID', () => {
      const user = {
        id: 'invalid-id',
        email: 'test@example.com'
      };
      const result = validateAuthState(user);
      
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Invalid user ID');
    });

    it('should reject user without email', () => {
      const user = {
        id: '123e4567-e89b-12d3-a456-426614174000'
      };
      const result = validateAuthState(user);
      
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Invalid user data');
    });
  });

  describe('isValidUUID', () => {
    it('should validate correct UUID v4 format', () => {
      const validUUIDs = [
        '123e4567-e89b-12d3-a456-426614174000',
        'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
        '00000000-0000-4000-8000-000000000000'
      ];
      
      validUUIDs.forEach(uuid => {
        expect(isValidUUID(uuid)).toBe(true);
      });
    });

    it('should reject invalid UUID formats', () => {
      const invalidUUIDs = [
        'not-a-uuid',
        '123e4567-e89b-12d3-a456',
        '123e4567-e89b-12d3-a456-426614174000-extra',
        '',
        '123e4567e89b12d3a456426614174000', // Missing hyphens
        '123e4567-e89b-12d3-a456-42661417400g' // Invalid character
      ];
      
      invalidUUIDs.forEach(uuid => {
        expect(isValidUUID(uuid)).toBe(false);
      });
    });
  });

  describe('sanitizeInput', () => {
    it('should remove script tags', () => {
      const input = 'Hello <script>alert("xss")</script> World';
      const result = sanitizeInput(input);
      expect(result).toBe('Hello  World');
    });

    it('should trim whitespace', () => {
      const input = '  hello world  ';
      const result = sanitizeInput(input);
      expect(result).toBe('hello world');
    });

    it('should handle null and undefined', () => {
      expect(sanitizeInput(null)).toBe('');
      expect(sanitizeInput(undefined)).toBe('');
    });

    it('should remove multiple dangerous tags', () => {
      const input = '<script>bad</script><iframe>also bad</iframe>Safe content<style>css</style>';
      const result = sanitizeInput(input);
      expect(result).toBe('Safe content');
    });
  });

  describe('Rate Limiters', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    describe('gameUpdateLimiter', () => {
      it('should allow requests within limit', () => {
        // Should allow up to 5 requests
        for (let i = 0; i < 5; i++) {
          expect(gameUpdateLimiter.canProceed()).toBe(true);
        }
      });

      it('should block requests exceeding limit', () => {
        // Use up the limit
        for (let i = 0; i < 5; i++) {
          gameUpdateLimiter.canProceed();
        }
        
        // Next request should be blocked
        expect(gameUpdateLimiter.canProceed()).toBe(false);
      });

      it('should reset after time window', () => {
        // Use up the limit
        for (let i = 0; i < 5; i++) {
          gameUpdateLimiter.canProceed();
        }
        
        expect(gameUpdateLimiter.canProceed()).toBe(false);
        
        // Fast forward past the window
        vi.advanceTimersByTime(31000); // 31 seconds
        
        expect(gameUpdateLimiter.canProceed()).toBe(true);
      });
    });

    describe('selectionLimiter', () => {
      it('should allow requests within limit', () => {
        // Should allow up to 20 requests
        for (let i = 0; i < 20; i++) {
          expect(selectionLimiter.canProceed()).toBe(true);
        }
      });

      it('should block requests exceeding limit', () => {
        // Use up the limit
        for (let i = 0; i < 20; i++) {
          selectionLimiter.canProceed();
        }
        
        // Next request should be blocked
        expect(selectionLimiter.canProceed()).toBe(false);
      });
    });

    describe('createRateLimiter', () => {
      it('should create custom rate limiter with specified limits', () => {
        const customLimiter = createRateLimiter(3, 10000); // 3 requests per 10 seconds
        
        // Should allow up to 3 requests
        for (let i = 0; i < 3; i++) {
          expect(customLimiter.canProceed()).toBe(true);
        }
        
        // 4th request should be blocked
        expect(customLimiter.canProceed()).toBe(false);
        
        // Should reset after window
        vi.advanceTimersByTime(11000);
        expect(customLimiter.canProceed()).toBe(true);
      });
    });
  });

  describe('debounce', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should debounce function calls', () => {
      const mockFn = vi.fn();
      const debouncedFn = debounce(mockFn, 1000);
      
      // Call multiple times rapidly
      debouncedFn('arg1');
      debouncedFn('arg2');
      debouncedFn('arg3');
      
      // Function should not have been called yet
      expect(mockFn).not.toHaveBeenCalled();
      
      // Fast forward past debounce delay
      vi.advanceTimersByTime(1000);
      
      // Function should be called once with the last arguments
      expect(mockFn).toHaveBeenCalledTimes(1);
      expect(mockFn).toHaveBeenCalledWith('arg3');
    });

    it('should reset debounce timer on subsequent calls', () => {
      const mockFn = vi.fn();
      const debouncedFn = debounce(mockFn, 1000);
      
      debouncedFn('arg1');
      
      // Advance time but not past debounce delay
      vi.advanceTimersByTime(500);
      
      // Call again, which should reset the timer
      debouncedFn('arg2');
      
      // Advance another 500ms (total 1000ms from first call, but only 500ms from second)
      vi.advanceTimersByTime(500);
      
      // Function should not have been called yet
      expect(mockFn).not.toHaveBeenCalled();
      
      // Advance final 500ms to complete debounce from second call
      vi.advanceTimersByTime(500);
      
      // Now function should be called
      expect(mockFn).toHaveBeenCalledTimes(1);
      expect(mockFn).toHaveBeenCalledWith('arg2');
    });
  });
});
