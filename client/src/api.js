let onUnauthorized = null;

export function setOnUnauthorized(callback) {
  onUnauthorized = callback;
}

async function request(method, path, body = null) {
  const headers = { 'Content-Type': 'application/json' };
  const token = localStorage.getItem('token');
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const options = { method, headers };
  if (body) {
    options.body = JSON.stringify(body);
  }

  const res = await fetch(`/api${path}`, options);

  let data;
  try {
    data = await res.json();
  } catch {
    throw new Error('Server error — please try again');
  }

  if (res.status === 401 && onUnauthorized && token) {
    // Only trigger session expired for authenticated requests, not login attempts
    onUnauthorized();
    throw new Error('Session expired');
  }

  if (!res.ok) {
    throw new Error(data.error || 'Request failed');
  }

  return data;
}

const api = {
  get: (path) => request('GET', path),
  post: (path, body) => request('POST', path, body),
  patch: (path, body) => request('PATCH', path, body),
  del: (path) => request('DELETE', path),
};

export default api;
