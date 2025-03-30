const dotenv = require('dotenv');
const https = require('https');
const http = require('http'); // Added to support http if needed
const crypto = require('crypto'); // Added for timestamp hashing
const { createGeoPreservingAnonymousIP } = require('./utils/ip-anonymization');
dotenv.config();

async function sendUmamiEvent(payload, userAgent) {
  // Self-hosted configuration
  const websiteId = process.env.UMAMI_WEBSITE_ID;
  const userId = process.env.UMAMI_API_CLIENT_USER_ID;
  const appSecret = process.env.UMAMI_API_CLIENT_SECRET;
  const umamiHost = process.env.UMAMI_HOST;
  const useHttps = umamiHost.startsWith('https://');

  if (!websiteId || !userId || !appSecret || !umamiHost) {
    console.error('Missing required environment variables:', {
      hasWebsiteId: !!websiteId,
      hasUserId: !!userId,
      hasAppSecret: !!appSecret,
      hasUmamiHost: !!umamiHost
    });
    return {
      success: false,
      error: 'Missing required configuration',
      details: {
        message: 'UMAMI_WEBSITE_ID, UMAMI_API_CLIENT_USER_ID, UMAMI_API_CLIENT_SECRET, and UMAMI_HOST must be set'
      }
    };
  }

  // Extract hostname without protocol
  const urlObj = new URL(umamiHost);
  const hostname = urlObj.hostname;
  const port = urlObj.port || (useHttps ? 443 : 80);
  
  // Create the endpoint path
  const endpointPath = '/api/send';
  
  payload.website = websiteId;
  
  const data = {
    type: "event",
    payload
  }

  const postData = JSON.stringify(data);
  
  // Generate authentication header using timestamp and hash
  const timestamp = Date.now();
  const hash = crypto
    .createHash('sha256')
    .update(`${timestamp}:${userId}:${appSecret}`)
    .digest('hex');
  
  return new Promise((resolve, reject) => {
    const options = {
      hostname: hostname,
      port: port,
      path: endpointPath,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
        'User-Agent': userAgent || 'Mozilla/5.0 (compatible; UmamiTest/1.0)',
        'x-umami-timestamp': timestamp.toString(),
        'x-umami-hash': hash,
        'x-umami-id': userId
      }
    };

    const requestLib = useHttps ? https : http;
    const req = requestLib.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve({ success: true, response: data });
        } else {
          console.error('Umami API error:', {
            status: res.statusCode,
            statusText: res.statusMessage,
            data,
            headers: res.headers
          });
          resolve({
            success: false,
            httpCode: res.statusCode,
            response: data,
            statusText: res.statusMessage
          });
        }
      });
    });

    req.on('error', (error) => {
      console.error('Error sending Umami event:', error);
      resolve({ success: false, error: error.message });
    });

    req.write(postData);
    req.end();
  });
}

// Rest of your code remains the same
async function sendEvent(request) {
  const userAgent = request.body.userAgent || request.headers['user-agent'] || '';
  
  // Get client IP from request headers
  
  // X-Forwarded-For contains the original client IP when behind proxies/load balancers
  const forwardedFor = request.headers['x-forwarded-for'];
  
  // Extract the actual client IP address:
  // 1. If X-Forwarded-For exists, use the first IP (original client) from the comma-separated list
  // 2. Otherwise fall back to X-Real-IP header (used by some proxies)
  // 3. Last resort: use the direct connecting IP (request.ip)
  // This ensures we get the actual user's IP rather than the proxy/CDN IP
  const clientIP = forwardedFor ? forwardedFor.split(',')[0] : request.headers['x-real-ip'] || request.ip;
  
  // Anonymize the IP address
  const anonymizedIP = createGeoPreservingAnonymousIP(clientIP);

  const payload = {
    url: request.body.url || request.raw.url,
    hostname: request.body.hostname || request.headers.host,
    referrer: request.body.referrer || request.headers.referer || '',
    title: request.body.title || '',
    language: request.body.language || '',
    screen: request.body.screen || '',
    name: request.body.name || '',
    data: request.body.data,
    ip: anonymizedIP,
  };

  if (process.env.NODE_ENV === 'development') {
    console.log("payload", payload);
  }

  return sendUmamiEvent(payload, userAgent);
}

async function counterPlugin(fastify, options) {
  fastify.addContentTypeParser('application/json', { parseAs: 'string' }, function (req, body, done) {
    try {
      done(null, JSON.parse(body));
    } catch (err) {
      err.statusCode = 400;
      done(err, undefined);
    }
  });

  fastify.post('/counter', {
    schema: {
      body: {
        type: 'object',
        required: ['hostname', 'url'],
        properties: {
          hostname: { type: 'string' },
          url: { type: 'string' },
          referrer: { type: 'string' },
          title: { type: 'string' },
          language: { type: 'string' },
          screen: { type: 'string' },
          userAgent: { type: 'string' },
          name: { type: 'string' },
          data: { type: 'object' }
        },
        additionalProperties: true,
      }
    }
  }, async (request, reply) => {
    return sendEvent(request);
  });
}

module.exports = counterPlugin;