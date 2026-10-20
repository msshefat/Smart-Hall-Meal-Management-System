const PREFIX = 'HALLMEAL:'

export function mealQrPayload(studentCode) {
  const code = validId(studentCode)
  return code ? `${PREFIX}${code}` : ''
}

export function idFromMealQr(raw) {
  const text = String(raw || '').replace(/^\uFEFF/, '').trim()
  if (!text) return ''
  const prefixed = text.match(/^hallmeal:\s*(\S+)\s*$/i)
  if (prefixed) return validId(prefixed[1])
  return validId(text)
}

function validId(value) {
  const code = String(value || '').trim()
  if (!/^[A-Za-z0-9][A-Za-z0-9-]{1,39}$/.test(code)) return ''
  return code
}
