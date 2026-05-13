/**
 * api.js — SheDrive HTTP client
 * Thin fetch wrapper with base URL, JSON defaults, and typed error handling.
 * All methods throw ApiError on non-2xx responses or network failure.
 */

import { API_BASE_URL } from './config.js';
import { auth } from './auth.js';

export class ApiError extends Error {
  /**
   * @param {string} message
   * @param {number} status  HTTP status code (0 for network errors)
   * @param {unknown} body   Parsed response body if available
   */
  constructor(message, status = 0, body = null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
  }
}

async function request(path, options = {}) {
  const session = auth.getSession();
  const headers = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    ...(session ? { Authorization: `Bearer mock-token-${session.role}` } : {}),
    ...(options.headers ?? {}),
  };

  let response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      headers,
    });
  } catch (networkErr) {
    throw new ApiError('Network error — please check your connection.', 0, null);
  }

  let body = null;
  try {
    body = await response.json();
  } catch {
    // Non-JSON body is fine for some endpoints
  }

  if (!response.ok) {
    const message =
      (body && (body.message || body.error)) ||
      `Request failed with status ${response.status}`;
    throw new ApiError(message, response.status, body);
  }

  return body;
}

export const api = {
  get(path, options = {}) {
    return request(path, { ...options, method: 'GET' });
  },

  post(path, data, options = {}) {
    return request(path, {
      ...options,
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  put(path, data, options = {}) {
    return request(path, {
      ...options,
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  patch(path, data, options = {}) {
    return request(path, {
      ...options,
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  delete(path, options = {}) {
    return request(path, { ...options, method: 'DELETE' });
  },
};
