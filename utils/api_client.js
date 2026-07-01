// 42 API safe wrapper with rate limit handling and request queueing.

class ApiClient {
  static async getToken() {
    return new Promise((resolve) => {
      chrome.storage.local.get(['api_token', 'api_token_expires', 'api_uid', 'api_secret'], async (res) => {
        if (!res.api_uid || !res.api_secret) {
          resolve(null); // No credentials at all
          return;
        }

        // Check if token doesn't exist, or is expired (with 1 min buffer)
        if (!res.api_token || (res.api_token_expires && Date.now() > res.api_token_expires - 60000)) {
          console.log('[ApiClient] Token missing or expired. Refreshing/Issuing...');
          const newToken = await this.refreshToken(res.api_uid, res.api_secret);
          resolve(newToken);
        } else {
          resolve(res.api_token);
        }
      });
    });
  }

  static async refreshToken(uid, secret) {
    try {
      const response = await fetch('https://api.intra.42.fr/oauth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'client_credentials',
          client_id: uid,
          client_secret: secret
        })
      });

      if (!response.ok) throw new Error('Token refresh failed');
      const data = await response.json();
      
      return new Promise((resolve) => {
        chrome.storage.local.set({
          api_token: data.access_token,
          api_token_expires: Date.now() + (data.expires_in * 1000)
        }, () => {
          resolve(data.access_token);
        });
      });
    } catch (e) {
      console.error('[ApiClient] Error refreshing token:', e);
      return null;
    }
  }

  static async fetch(endpoint, params = {}) {
    const token = await this.getToken();
    if (!token) {
      throw new Error('NO_TOKEN');
    }

    const url = new URL(`https://api.intra.42.fr${endpoint}`);
    Object.keys(params).forEach(key => url.searchParams.append(key, params[key]));

    const response = await fetch(url.toString(), {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (response.status === 429) {
      const retryAfter = response.headers.get('Retry-After');
      throw { status: 429, retryAfter: retryAfter ? parseInt(retryAfter, 10) : null };
    }
    
    if (!response.ok) {
      throw { status: response.status, message: response.statusText };
    }

    return response.json();
  }
}

// Export for Service Worker
if (typeof self !== 'undefined') {
  self.ApiClient = ApiClient;
}
