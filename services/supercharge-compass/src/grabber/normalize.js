// src/grabber/normalize.js
export function formatAddress(parts) {
  return parts.filter(Boolean).join(', ');
}
