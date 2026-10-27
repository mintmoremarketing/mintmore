/**
 * Opaque-Box HTTP Client for E2E Testing
 * Zero-dependency: Uses Node.js native `fetch` and `node:assert/strict`
 */

const assert = require('node:assert/strict');

class HttpClient {
  constructor(baseUrl) {
    this.baseUrl = (baseUrl || 'http://127.0.0.1:5000').replace(/\/+$/, '');
  }

  setBaseUrl(baseUrl) {
    this.baseUrl = (baseUrl || 'http://127.0.0.1:5000').replace(/\/+$/, '');
  }

  normalizeUrl(path) {
    let cleanBase = this.baseUrl;
    let cleanPath = path.startsWith('/') ? path : '/' + path;

    // Avoid double /api/v1
    if (cleanBase.endsWith('/api/v1') && cleanPath.startsWith('/api/v1')) {
      cleanPath = cleanPath.slice(7);
    } else if (!cleanBase.includes('/api/v1') && !cleanPath.startsWith('/api/v1') && !cleanPath.startsWith('/health')) {
      cleanPath = '/api/v1' + cleanPath;
    }

    return `${cleanBase}${cleanPath}`;
  }

  async request(path, {
    method = 'GET',
    token = null,
    body = null,
    query = null,
    headers = {},
    expected = [200, 201],
  } = {}) {
    let url = this.normalizeUrl(path);

    if (query && typeof query === 'object') {
      const searchParams = new URLSearchParams();
      for (const [k, v] of Object.entries(query)) {
        if (v !== undefined && v !== null) {
          searchParams.append(k, String(v));
        }
      }
      const qs = searchParams.toString();
      if (qs) {
        url += (url.includes('?') ? '&' : '?') + qs;
      }
    }

    const reqHeaders = {
      'Accept': 'application/json',
      ...headers,
    };

    if (body !== null && body !== undefined && !(body instanceof FormData)) {
      reqHeaders['Content-Type'] = 'application/json';
    }

    if (token) {
      reqHeaders['Authorization'] = `Bearer ${token}`;
    }

    const fetchOptions = {
      method: method.toUpperCase(),
      headers: reqHeaders,
    };

    if (body !== null && body !== undefined) {
      fetchOptions.body = typeof body === 'string' ? body : JSON.stringify(body);
    }

    const res = await fetch(url, fetchOptions);
    const text = await res.text();
    let json = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = null;
    }

    const expectedArr = Array.isArray(expected) ? expected : [expected];
    if (expectedArr.length > 0 && !expectedArr.includes(res.status)) {
      const errMsg = `[HTTP ${res.status}] Expected [${expectedArr.join(', ')}] on ${method.toUpperCase()} ${path}. Response: ${text.slice(0, 300)}`;
      const err = new Error(errMsg);
      err.status = res.status;
      err.responseJson = json;
      err.responseText = text;
      throw err;
    }

    return {
      status: res.status,
      headers: res.headers,
      json,
      text,
      data: json?.data ?? json,
      ok: res.ok,
    };
  }

  get(path, options = {}) {
    return this.request(path, { ...options, method: 'GET' });
  }

  post(path, body, options = {}) {
    return this.request(path, { ...options, method: 'POST', body });
  }

  patch(path, body, options = {}) {
    return this.request(path, { ...options, method: 'PATCH', body });
  }

  put(path, body, options = {}) {
    return this.request(path, { ...options, method: 'PUT', body });
  }

  del(path, options = {}) {
    return this.request(path, { ...options, method: 'DELETE' });
  }
}

module.exports = { HttpClient };
