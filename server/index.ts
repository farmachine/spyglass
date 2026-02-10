import express, { type Request, Response, NextFunction } from "express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { generateRequestId, createLogger } from "./logger";

const serverLogger = createLogger('server');

const app = express();

app.set('trust proxy', 1);

app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
}));

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  message: { message: 'Too many requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => !req.path.startsWith('/api'),
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

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: false, limit: '50mb' }));

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

(async () => {
  const server = await registerRoutes(app);

  // Set server timeout for long-running requests
  server.setTimeout(300000); // 5 minutes

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
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
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

  // ALWAYS serve the app on port 5000
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = 5000;
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port}`);
  });
})();
