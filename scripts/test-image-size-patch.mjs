import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const imageSize = require('image-size');
const { findBox } = require('image-size/dist/types/utils');

const zeroSizedBox = Uint8Array.from([
  0x00, 0x00, 0x00, 0x00,
  0x6a, 0x78, 0x6c, 0x63,
]);
assert.equal(
  findBox(zeroSizedBox, 'jxlc', 0),
  undefined,
  'zero-sized ISO BMFF boxes must be rejected',
);

const maliciousIcns = new Uint8Array(16);
maliciousIcns.set([0x69, 0x63, 0x6e, 0x73], 0); // "icns"
maliciousIcns.set([0x00, 0x00, 0x00, 0x10], 4); // total length: 16
maliciousIcns.set([0x69, 0x63, 0x31, 0x30], 8); // "ic10"
// Entry length at bytes 12-15 intentionally remains zero.
assert.throws(
  () => imageSize(maliciousIcns),
  /Invalid ICNS entry length/,
  'zero-sized ICNS entries must terminate with an error',
);

console.log('image-size malformed-box guards verified');
