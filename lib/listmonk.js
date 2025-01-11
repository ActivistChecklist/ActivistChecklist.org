const dotenv = require('dotenv');
const https = require('https');
const url = require('url');
dotenv.config();

class ListmonkClient {
  constructor(config = {}) {
    this.baseUrl = config.baseUrl || process.env.LISTMONK_API_URL;
    this.apiUser = config.apiUser || process.env.LISTMONK_API_USER;
    this.apiToken = config.apiToken || process.env.LISTMONK_API_TOKEN;
    this.useTokenAuth = config.useTokenAuth || process.env.LISTMONK_USE_TOKEN_AUTH === 'true';
    this.defaultListId = parseInt(config.defaultListId || process.env.LISTMONK_DEFAULT_LIST_ID || '3', 10);

    console.log('ListmonkClient initialized with:', {
      baseUrl: this.baseUrl,
      useTokenAuth: this.useTokenAuth,
      hasApiUser: !!this.apiUser,
      hasApiToken: !!this.apiToken,
      defaultListId: this.defaultListId
    });

    if (!this.baseUrl) {
      throw new Error('Listmonk API URL is required');
    }
    if (!this.apiUser || !this.apiToken) {
      throw new Error('Listmonk API credentials are required');
    }
  }

  getAuthHeaders() {
    if (this.useTokenAuth) {
      return {
        'Authorization': `token ${this.apiUser}:${this.apiToken}`
      };
    }
    return {
      'Authorization': 'Basic ' + Buffer.from(`${this.apiUser}:${this.apiToken}`).toString('base64')
    };
  }

  async addSubscriber({ email, name, status = 'enabled', lists = undefined, attribs = {}, preconfirm_subscriptions = true }) {
    if (!email) {
      return {
        success: false,
        status: 400,
        error: 'Email is required'
      };
    }

    // Get name from email if not provided
    const subscriberName = name || email.split('@')[0];
    
    // Use default list if none provided, ensure all list IDs are integers
    const subscriberLists = (lists || [this.defaultListId]).map(id => parseInt(id));

    const payload = {
      email,
      name: subscriberName,
      status,
      lists: subscriberLists,
      attribs,
      preconfirm_subscriptions
    };

    const postData = JSON.stringify(payload);
    const parsedUrl = new url.URL(`${this.baseUrl}/api/subscribers`);

    console.log('Attempting to add subscriber:', {
      endpoint: parsedUrl.toString(),
      payload,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': '[REDACTED]',
      }
    });

    return new Promise((resolve, reject) => {
      const options = {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || 443,
        path: parsedUrl.pathname + parsedUrl.search,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData),
          ...this.getAuthHeaders()
        }
      };

      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => data += chunk);
        res.on('end', () => {
          try {
            const parsedData = JSON.parse(data);
            console.log('Listmonk API response:', {
              status: res.statusCode,
              ok: res.statusCode >= 200 && res.statusCode < 300,
              data: parsedData
            });

            if (res.statusCode >= 200 && res.statusCode < 300 || res.statusCode === 409) {
              resolve({
                success: true,
                status: 200,
                data: parsedData.data || {}
              });
            } else {
              console.error('Listmonk API error:', {
                status: res.statusCode,
                data: parsedData,
                endpoint: parsedUrl.toString()
              });
              resolve({
                success: false,
                status: res.statusCode,
                error: parsedData.message || 'Unknown error occurred'
              });
            }
          } catch (error) {
            console.error('Error parsing Listmonk API response:', error);
            resolve({
              success: false,
              status: 500,
              error: 'Failed to parse API response'
            });
          }
        });
      });

      req.on('error', (error) => {
        console.error('Listmonk API request failed:', {
          error: error.message,
          endpoint: parsedUrl.toString()
        });
        resolve({
          success: false,
          status: 500,
          error: error.message
        });
      });

      req.write(postData);
      req.end();
    });
  }
}

module.exports = ListmonkClient;
