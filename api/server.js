const dotenv = require('dotenv');
const cors = require('@fastify/cors');
const helmet = require('@fastify/helmet');
const rateLimit = require('@fastify/rate-limit');
const contactRoutes = require('./contact');
const counterRoutes = require('./counter');
const subscribeRoutes = require('./subscribe');

dotenv.config();

async function app (fastify, opts) {
  // Register rate limiting (global default)
  await fastify.register(rateLimit, {
    max: 100,
    timeWindow: '1 minute',
    keyGenerator: (request) => {
      return request.headers['x-forwarded-for']?.split(',')[0]?.trim()
        || request.headers['x-real-ip']
        || request.ip;
    }
  });

  // Register security plugins
  await fastify.register(helmet, {
    // Enable all security headers including CSP
    // Since this is an API-only server, we can use strict CSP
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'none'"],  // Deny everything by default
        frameAncestors: ["'none'"],  // Prevent embedding in iframes
      }
    },
    crossOriginEmbedderPolicy: true,
    crossOriginOpenerPolicy: true,
    crossOriginResourcePolicy: { policy: "same-site" },
    hsts: {
      maxAge: 15552000,  // 180 days
      includeSubDomains: true,
      preload: true
    }
  });

  // Register CORS plugin
  await fastify.register(cors, {
    origin: [
      'https://activistchecklist.org',
      'https://localhost:3000',
      'https://localhost:3001'
    ],
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type'],
    credentials: true
  });

  // Register all routes under /api prefix
  fastify.register(async function (fastify, opts) {
    // Tester route
    fastify.get('/hello', async (request, reply) => {
      return { message: 'Hello World' }; // Automatically serialized to JSON
    });

    // Register routes
    await fastify.register(contactRoutes);
    await fastify.register(counterRoutes);
    await fastify.register(subscribeRoutes);
    
  }, { prefix: '/api-server' });
}

module.exports = app;

// Export options if needed
module.exports.options = {
  logger: true
};