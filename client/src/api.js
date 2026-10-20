let csrf = ''

export async function api(path, options = {}) {
  const headers = { Accept: 'application/json', ...(options.headers || {}) }
  const method = options.method || 'GET'
  if (options.body !== undefined) headers['Content-Type'] = 'application/json'
  if (method !== 'GET' && csrf) headers['X-CSRF-Token'] = csrf
  const response = await fetch(path, {
    credentials: 'include',
    ...options,
    method,
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined
  })
  const next = response.headers.get('x-csrf-token')
  if (next) csrf = next
  const data = response.status === 204 ? null : await response.json().catch(() => ({}))
  if (!response.ok) {
    const error = new Error(data.message || 'The request could not be completed.')
    error.status = response.status
    throw error
  }
  return data
}

api.get = (path) => api(path)
api.post = (path, body) => api(path, { method: 'POST', body })
api.put = (path, body) => api(path, { method: 'PUT', body })
api.delete = (path) => api(path, { method: 'DELETE' })

api.upload = async (path, formData, method = 'POST') => {
  const headers = { Accept: 'application/json' }
  if (csrf) headers['X-CSRF-Token'] = csrf
  const response = await fetch(path, { method, credentials: 'include', headers, body: formData })
  const next = response.headers.get('x-csrf-token')
  if (next) csrf = next
  const data = response.status === 204 ? null : await response.json().catch(() => ({}))
  if (!response.ok) {
    const error = new Error(data.message || 'The request could not be completed.')
    error.status = response.status
    throw error
  }
  return data
}
