// This file adds polyfills for Node.js built-ins in the browser environment

import { Buffer } from 'buffer';
import process from 'process';

// Make Buffer available on window
window.Buffer = Buffer;

// Make process available globally
window.process = process;

// Ensure global is defined
if (typeof global === 'undefined') {
  window.global = window;
}
