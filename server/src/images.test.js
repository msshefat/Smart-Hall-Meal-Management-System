const assert = require('assert');
const { imageType, checkImage, MAX_IMAGE_BYTES } = require('./images');

const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01]);

assert.strictEqual(imageType(png), 'image/png');
assert.strictEqual(imageType(jpeg), 'image/jpeg');
assert.strictEqual(imageType(Buffer.from('not a picture')), null);
assert.strictEqual(checkImage({ buffer: png, size: png.length }).contentType, 'image/png');
assert.strictEqual(checkImage({ buffer: Buffer.from('hello'), size: 5 }).error, 'Use a JPG or PNG picture.');

const oversized = Buffer.alloc(MAX_IMAGE_BYTES + 1, 0);
oversized[0] = 0xff;
oversized[1] = 0xd8;
oversized[2] = 0xff;
assert.strictEqual(checkImage({ buffer: oversized, size: oversized.length }).error, 'Each picture must be 1 MB or smaller.');

console.log('image checks ok');
