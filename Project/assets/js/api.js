/**
 * Klien API Sistem Akses WiFi Sekolah.
 *
 * Dipakai dari halaman admin/ dan user/:
 *   <script src="../assets/js/api.js"></script>
 *
 * Semua request memakai cookie sesi (credentials: same-origin) dan
 * mengirim X-CSRF-Token otomatis untuk POST/PATCH/DELETE.
 */
(function (global) {
    'use strict';

    var scriptTag = document.currentScript;
    var storageKey = 'wifi_csrf_token';

    function resolveBaseUrl() {
        if (global.API_BASE_URL) {
            return normalize(global.API_BASE_URL);
        }

        var meta = document.querySelector('meta[name="api-base"]');
        if (meta && meta.getAttribute('content')) {
            return normalize(meta.getAttribute('content'));
        }

        if (scriptTag && scriptTag.src) {
            return normalize(new URL('../../api/', scriptTag.src).toString());
        }

        return normalize('/api/');
    }

    function normalize(url) {
        return String(url).replace(/\/+$/, '') + '/';
    }

    function readToken() {
        try {
            return global.sessionStorage.getItem(storageKey) || null;
        } catch (error) {
            return null;
        }
    }

    function writeToken(token) {
        memoryToken = token || null;

        try {
            if (token) {
                global.sessionStorage.setItem(storageKey, token);
            } else {
                global.sessionStorage.removeItem(storageKey);
            }
        } catch (error) {
            /* sessionStorage bisa diblokir; token tetap tersimpan di memori. */
        }
    }

    var memoryToken = readToken();
    var baseUrl = resolveBaseUrl();

    function ApiError(status, message, errors, payload) {
        this.name = 'ApiError';
        this.status = status || 0;
        this.message = message || 'Terjadi kesalahan.';
        this.errors = errors || null;
        this.payload = payload || null;
    }

    ApiError.prototype = Object.create(Error.prototype);
    ApiError.prototype.constructor = ApiError;

    function buildUrl(path, query) {
        var url = /^https?:\/\//i.test(path) ? path : baseUrl + String(path).replace(/^\/+/, '');

        if (query && typeof query === 'object') {
            var params = [];

            Object.keys(query).forEach(function (key) {
                var value = query[key];

                if (value === null || value === undefined || value === '') {
                    return;
                }

                params.push(encodeURIComponent(key) + '=' + encodeURIComponent(value));
            });

            if (params.length) {
                url += (url.indexOf('?') === -1 ? '?' : '&') + params.join('&');
            }
        }

        return url;
    }

    function parseResponse(response) {
        var contentType = response.headers.get('content-type') || '';

        if (response.status === 204) {
            return Promise.resolve({ payload: null, response: response });
        }

        if (contentType.indexOf('application/json') !== -1) {
            return response.json().then(function (payload) {
                return { payload: payload, response: response };
            }).catch(function () {
                return { payload: null, response: response };
            });
        }

        return response.text().then(function (text) {
            return { payload: text ? { message: text } : null, response: response };
        });
    }

    function toError(result) {
        var payload = result.payload || {};
        var message = payload.message || ('Permintaan gagal (HTTP ' + result.response.status + ').');

        return new ApiError(result.response.status, message, payload.errors || null, payload);
    }

    function rawRequest(method, path, body, options) {
        options = options || {};

        var headers = {
            Accept: 'application/json',
            'X-Requested-With': 'XMLHttpRequest'
        };

        var payloadBody;
        var isFormData = typeof FormData !== 'undefined' && body instanceof FormData;

        if (body !== undefined && body !== null) {
            if (isFormData) {
                payloadBody = body;
            } else {
                headers['Content-Type'] = 'application/json';
                payloadBody = JSON.stringify(body);
            }
        }

        if (memoryToken && method !== 'GET' && method !== 'HEAD') {
            headers['X-CSRF-Token'] = memoryToken;
        }

        var requestOptions = {
            method: method,
            headers: headers,
            credentials: 'same-origin',
            cache: 'no-store'
        };

        if (payloadBody !== undefined) {
            requestOptions.body = payloadBody;
        }

        return fetch(buildUrl(path, options.query), requestOptions)
            .then(parseResponse)
            .then(function (result) {
                var payload = result.payload;

                if (!result.response.ok || (payload && payload.success === false)) {
                    throw toError(result);
                }

                return payload;
            })
            .catch(function (error) {
                if (error instanceof ApiError) {
                    throw error;
                }

                throw new ApiError(
                    0,
                    'Tidak bisa menghubungi server API. Pastikan server Node.js berjalan dan halaman dibuka lewat http://localhost:8090, bukan file://.',
                    null,
                    null
                );
            });
    }

    function csrf() {
        if (memoryToken) {
            return Promise.resolve(memoryToken);
        }

        return rawRequest('GET', 'auth/csrf').then(function (payload) {
            var token = payload && payload.data ? payload.data.token : null;
            writeToken(token);
            return token;
        });
    }

    function request(method, path, body, options) {
        options = options || {};

        var mutating = method !== 'GET' && method !== 'HEAD';
        var ready = mutating && !options.skipCsrf ? csrf() : Promise.resolve(memoryToken);

        return ready.then(function () {
            return rawRequest(method, path, body, options);
        }).catch(function (error) {
            // Token kedaluwarsa: ambil token baru lalu ulangi sekali.
            if (error instanceof ApiError && error.status === 419 && !options.retried) {
                writeToken(null);
                return csrf().then(function () {
                    options.retried = true;
                    return rawRequest(method, path, body, options);
                });
            }

            throw error;
        });
    }

    var Api = {
        baseUrl: baseUrl,
        Error: ApiError,

        csrf: csrf,

        setCsrfToken: function (token) {
            writeToken(token);
            return Api;
        },

        getToken: function () {
            return memoryToken;
        },

        get: function (path, query) {
            return request('GET', path, null, { query: query });
        },

        post: function (path, body, options) {
            return request('POST', path, body, options);
        },

        patch: function (path, body) {
            return request('PATCH', path, body);
        },

        put: function (path, body) {
            return request('PUT', path, body);
        },

        del: function (path, body) {
            return request('DELETE', path, body);
        },

        request: request,

        login: function (credentials, password) {
            var payload;

            if (typeof credentials === 'string') {
                payload = { nipd: credentials, password: password };
            } else {
                payload = credentials || {};
            }

            return Api.post('auth/login', payload, { skipCsrf: true }).then(function (response) {
                if (response && response.data && response.data.csrf_token) {
                    writeToken(response.data.csrf_token);
                }

                return response;
            });
        },

        register: function (data) {
            return Api.post('auth/register', data, { skipCsrf: true });
        },

        logout: function () {
            return Api.post('auth/logout', {}).then(function (response) {
                writeToken(null);
                return response;
            }).catch(function (error) {
                writeToken(null);
                throw error;
            });
        },

        me: function () {
            return Api.get('auth/me').then(function (response) {
                if (response && response.data && response.data.csrf_token) {
                    writeToken(response.data.csrf_token);
                }

                return response;
            });
        }
    };

    global.Api = Api;
})(window);
