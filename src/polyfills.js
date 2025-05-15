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

// TextEncoder/TextDecoder for environments that might not have it
if (typeof TextEncoder === 'undefined') {
  window.TextEncoder = function TextEncoder() {};
  window.TextEncoder.prototype.encode = function encode() { return new Uint8Array(); };
}

if (typeof TextDecoder === 'undefined') {
  window.TextDecoder = function TextDecoder() {};
  window.TextDecoder.prototype.decode = function decode() { return ''; };
}

// Make crypto available
if (window.crypto && !window.crypto.subtle && window.crypto.webkitSubtle) {
  window.crypto.subtle = window.crypto.webkitSubtle;
}
