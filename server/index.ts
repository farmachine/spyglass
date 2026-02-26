import express, { type Request, Response, NextFunction } from "express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { generateRequestId, createLogger } from "./logger";

const serverLogger = createLogger('server');
const isProduction = process.env.NODE_ENV === 'production';

const app = express();

app.set('trust proxy', 1);

// Security headers (ISO 27001 A.14)
app.use(helmet({
  contentSecurityPolicy: isProduction ? {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "blob:", "https:"],
      connectSrc: ["'self'", "https://*.extrapl.io", "https://generativelanguage.googleapis.com"],
      fontSrc: ["'self'", "data:"],
      objectSrc: ["'none'"],
      frameAncestors: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
    },
  } : false,
  crossOriginEmbedderPolicy: false,
  hsts: isProduction ? {
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: true,
  } : false,
}));

// CORS: restrict origins in production
if (isProduction) {
  const allowedOrigins = process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(',')
    : [];
  // Add wildcard subdomain matching for extrapl.io
  app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (origin) {
      const isAllowed = allowedOrigins.some(o => origin === o) ||
        /^https:\/\/[a-z0-9-]+\.extrapl\.io$/.test(origin) ||
        origin === 'https://extrapl.io';
      if (isAllowed) {
        res.header('Access-Control-Allow-Origin', origin);
        res.header('Access-Control-Allow-Credentials', 'true');
        res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
        res.header('Access-Control-Allow-Headers', 'Content-Type,Authorization');
      }
    }
    if (req.method === 'OPTIONS') {
      return res.sendStatus(204);
    }
    next();
  });
}

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  message: { message: 'Too many requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => !req.path.startsWith('/api') || req.path === '/api/health',
});
app.use(apiLimiter);

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,
  message: { message: 'Too many login attempts, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);

app.use((req: Request & { requestId?: string }, _res, next) => {
  req.requestId = generateRequestId();
  next();
});

app.use((req, res, next) => {
  if (req.path.includes('/ai-extraction') || req.path.includes('/gemini-extraction')) {
    req.setTimeout(300000);
    res.setTimeout(300000);
  } else {
    req.setTimeout(120000);
    res.setTimeout(120000);
  }
  next();
});

// Reduced body size limit: documents go through presigned URL uploads, not request body
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: false, limit: '10mb' }));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      // Filter out noisy requests that spam the console
      if (path.includes("/validations") && req.method === "GET" && res.statusCode === 304) {
        return; // Skip these frequent validation checks
      }

      // Skip health check HEAD requests to /api
      if (path === "/api" && req.method === "HEAD") {
        return; // Skip external health check requests
      }

      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;

      // Only show JSON response for non-GET requests or errors
      if (capturedJsonResponse && (req.method !== "GET" || res.statusCode >= 400)) {
        // Truncate long JSON responses to keep logs readable
        const jsonStr = JSON.stringify(capturedJsonResponse);
        if (jsonStr.length > 100) {
          logLine += ` :: [JSON response - ${jsonStr.length} chars]`;
        } else {
          logLine += ` :: ${jsonStr}`;
        }
      }

      if (logLine.length > 120) {
        logLine = logLine.slice(0, 117) + "…";
      }

      log(logLine);
    }
  });

  next();
});

// Block debug endpoints in production (ISO 27001 A.14)
if (isProduction) {
  app.use('/debug-*', (_req, res) => {
    res.status(404).json({ message: 'Not found' });
  });
  app.use('/api/dev/*', (_req, res) => {
    res.status(404).json({ message: 'Not found' });
  });
}

(async () => {
  const server = await registerRoutes(app);

  // Set server timeout for long-running requests
  server.setTimeout(300000); // 5 minutes

  // Error handler - never leak stack traces in production
  app.use((err: any, req: Request & { requestId?: string }, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    const requestId = req.requestId || 'unknown';

    serverLogger.error(`Request failed`, {
      requestId,
      method: req.method,
      path: req.path,
      status,
      error: message,
      stack: isProduction ? undefined : err.stack,
    });

    if (!res.headersSent) {
      res.status(status).json({ message, requestId });
    }
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const port = parseInt(process.env.PORT || '5000', 10);
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port}`);
  });

  // Graceful shutdown for ECS task draining (ISO 27001 A.17 - operational resilience)
  const shutdown = (signal: string) => {
    serverLogger.info(`Received ${signal}, starting graceful shutdown`);
    server.close(() => {
      serverLogger.info('HTTP server closed');
      process.exit(0);
    });
    // Force exit after 30 seconds if graceful shutdown doesn't complete
    setTimeout(() => {
      serverLogger.error('Graceful shutdown timed out, forcing exit');
      process.exit(1);
    }, 30000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
})();
