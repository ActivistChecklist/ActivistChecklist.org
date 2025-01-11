const dotenv = require('dotenv');
const https = require('https');
dotenv.config();

async function sendUmamiEvent(payload, userAgent) {
  const websiteId = process.env.UMAMI_WEBSITE_ID;
  const apiKey = process.env.UMAMI_API_KEY;

  if (!websiteId || !apiKey) {
    console.error('Missing required environment variables:', {
      hasWebsiteId: !!websiteId,
      hasApiKey: !!apiKey
    });
    return {
      success: false,
      error: 'Missing required configuration',
      details: {
        message: 'UMAMI_WEBSITE_ID and UMAMI_API_KEY must be set'
      }
    };
  }

  const url = "https://cloud.umami.is/api/send";

  payload.website = process.env.UMAMI_WEBSITE_ID;

  const data = {
    type: "event",
    payload
  }

  const postData = JSON.stringify(data);
  
  return new Promise((resolve, reject) => {
    const options = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
        'x-umami-api-key': apiKey,
        'User-Agent': userAgent || 'Mozilla/5.0 (compatible; UmamiTest/1.0)'
      }
    };

    const req = https.request(url, options, (res) => {
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


async function sendEvent(request) {
  const userAgent = request.body.userAgent || request.headers['user-agent'] || '';

  const payload = {
    url: request.body.url || request.raw.url,
    hostname: request.body.hostname || request.headers.host,
    referrer: request.body.referrer || request.headers.referer || '',
    title: request.body.title || '',
    language: request.body.language || '',
    screen: request.body.screen || '',
    name: request.body.name || '',
    data: request.body.data,
  };

  console.log("payload", payload);

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