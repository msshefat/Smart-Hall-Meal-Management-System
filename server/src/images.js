const multer = require('multer');

const MAX_IMAGE_BYTES = 1024 * 1024;

function imageType(buffer) {
  if (!buffer || buffer.length < 8) return null;
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'image/jpeg';
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) return 'image/png';
  return null;
}

function checkImage(file) {
  if (!file || !file.buffer || !file.buffer.length) return { error: 'Choose a JPG or PNG picture.' };
  if (file.size > MAX_IMAGE_BYTES || file.buffer.length > MAX_IMAGE_BYTES) {
    return { error: 'Each picture must be 1 MB or smaller.' };
  }
  const contentType = imageType(file.buffer);
  if (!contentType) return { error: 'Use a JPG or PNG picture.' };
  return { contentType, data: file.buffer, bytes: file.buffer.length };
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_IMAGE_BYTES, files: 2, fields: 16 }
});

function acceptImages(fields) {
  const parser = upload.fields(fields);
  return (req, res, next) => {
    parser(req, res, (error) => {
      if (!error) return next();
      if (error.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ message: 'Each picture must be 1 MB or smaller.' });
      }
      return res.status(400).json({ message: 'The picture could not be read. Use a JPG or PNG under 1 MB.' });
    });
  };
}

module.exports = { MAX_IMAGE_BYTES, imageType, checkImage, acceptImages };
