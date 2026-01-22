import express, { Application } from "express";
import cors from "cors";
import "express-async-errors"; // Automatically catches async errors
import routes from "./routes";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler";
import { correlationIdMiddleware } from "./middleware/correlationId";
import logger from "./config/logger";
import { healthRoutes } from "./routes";

/**
 * Create and configure Express application
 *
 * This file:
 * - Configures Express middleware
 * - Sets up routes
 * - Configures error handling
 * - Does NOT start the server (server.ts does that)
 *
 * Why separate from server.ts?
 * - Testing: Can import app without starting server
 * - Flexibility: Can use same app in different contexts (tests, serverless)
 */

const createApp = (): Application => {
  const app: Application = express();

  // ============================================
  // MIDDLEWARE - ORDER MATTERS!
  // ============================================

  /**
   * 1. Correlation ID - Must be first
   * Generates unique ID for each request for tracing
   */
  app.use(correlationIdMiddleware);

  /**
   * 2. CORS - Cross-Origin Resource Sharing
   * Allows frontend (port 5173) to call backend (port 3000)
   */
  app.use(
    cors({
      origin: process.env.CORS_ORIGIN || "http://localhost:5173",
      credentials: true, // Allow cookies
      methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization", "X-Correlation-ID"],
    }),
  );

  /**
   * 3. JSON Body Parser
   * Parses incoming JSON requests (req.body)
   */
  app.use(express.json({ limit: "10mb" }));

  /**
   * 4. URL-encoded Body Parser
   * Parses form submissions
   */
  app.use(express.urlencoded({ extended: true, limit: "10mb" }));

  /**
   * 5. Request Logging Middleware
   * Log every incoming request
   */
  app.use((req, _res, next) => {
    const correlationId = req.headers["x-correlation-id"];
    logger.info("Incoming request", {
      correlationId,
      method: req.method,
      path: req.path,
      query: req.query,
      ip: req.ip,
    });
    next();
  });

  // ============================================
  // ROUTES
  // ============================================

  /**
   * Health check endpoint (root level)
   * Used by Docker, Kubernetes, load balancers
   */
  app.use("/health", healthRoutes);

  /**
   * API routes (all prefixed with /api)
   * - /api/appointments
   * - /api/availability
   * - /api/doctors
   * - /api/patients
   */
  app.use("/api", routes);

  /**
   * Root endpoint - API information
   */
  app.get("/", (_req, res) => {
    res.json({
      name: "Appointment Booking API",
      version: "1.0.0",
      status: "running",
      endpoints: {
        health: "/health",
        api: "/api",
        docs: "/api-docs", // Would be Swagger UI
      },
    });
  });

  // ============================================
  // ERROR HANDLING - MUST BE LAST!
  // ============================================

  /**
   * 404 Handler - Catches routes that don't exist
   * Must be after all other routes
   */
  app.use(notFoundHandler);

  /**
   * Error Handler - Catches all errors
   * Must be the very last middleware
   */
  app.use(errorHandler);

  return app;
};

export default createApp;
