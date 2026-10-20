export const MAX_PICTURE_BYTES = 1024 * 1024

export function pictureError(file) {
  if (!file) return ''
  if (file.size > MAX_PICTURE_BYTES) return 'Each picture must be 1 MB or smaller.'
  if (!['image/jpeg', 'image/png'].includes(file.type)) return 'Use a JPG or PNG picture.'
  return ''
}
