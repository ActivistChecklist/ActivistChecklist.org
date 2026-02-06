const ListmonkClient = require('../lib/listmonk');

async function addSubscriber(request) {
  const { email, name } = request.body;

  try {
    const listmonk = new ListmonkClient();
    
    const result = await listmonk.addSubscriber({
      email,
      name: name || '',
    });

    return result;
  } catch (error) {
    console.error('Listmonk subscription error:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

async function subscribePlugin(fastify, options) {
  fastify.addContentTypeParser('application/json', { parseAs: 'string' }, function (req, body, done) {
    try {
      done(null, JSON.parse(body));
    } catch (err) {
      err.statusCode = 400;
      done(err, undefined);
    }
  });

  fastify.post('/subscribe', {
    config: {
      rateLimit: {
        max: 5,
        timeWindow: '15 minutes'
      }
    },
    schema: {
      body: {
        type: 'object',
        required: ['email'],
        properties: {
          email: { type: 'string' },
          name: { type: 'string' }
        }
      }
    }
  }, async (request, reply) => {
    return addSubscriber(request);
  });
}

module.exports = subscribePlugin;
