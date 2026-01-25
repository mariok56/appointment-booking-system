import createApp from "./app";
import connectDatabase from "./config/database";
import logger from "./config/logger";

const PORT = parseInt(process.env.PORT || "3000", 10);
const NODE_ENV = process.env.NODE_ENV || "development";

/**
 * Start the server
 */
const startServer = async (): Promise<void> => {
  try {
    // Step 1: Connect to database first
    logger.info("Connecting to database...");
    await connectDatabase();
    logger.info("Database connected successfully");

    // Step 2: Create Express app
    const app = createApp();

    // Step 3: Start listening for requests
    const server = app.listen(PORT, () => {
      logger.info("Server started successfully", {
        port: PORT,
        environment: NODE_ENV,
        nodeVersion: process.version,
        timestamp: new Date().toISOString(),
      });

      // Log all available endpoints
      logger.info("Available endpoints", {
        health: `http://localhost:${PORT}/health`,
        api: `http://localhost:${PORT}/api`,
        doctors: `http://localhost:${PORT}/api/doctors`,
        patients: `http://localhost:${PORT}/api/patients`,
        appointments: `http://localhost:${PORT}/api/appointments`,
        availability: `http://localhost:${PORT}/api/availability`,
      });
    });

    // ============================================
    // GRACEFUL SHUTDOWN HANDLERS
    // ============================================

    /**
     * Handle SIGTERM (Kubernetes, Docker stop)
     * This is sent when container is being stopped
     */
    process.on("SIGTERM", async () => {
      logger.info("SIGTERM signal received: closing HTTP server");

      server.close(() => {
        logger.info("HTTP server closed");
      });

      // Give ongoing requests time to complete
      setTimeout(() => {
        logger.warn("Forcing shutdown after timeout");
        process.exit(0);
      }, 10000); // 10 second timeout
    });

    /**
     * Handle SIGINT (Ctrl+C in terminal)
     * This is sent when you press Ctrl+C
     */
    process.on("SIGINT", async () => {
      logger.info("SIGINT signal received: closing HTTP server");

      server.close(() => {
        logger.info("HTTP server closed");
        process.exit(0);
      });
    });

    /**
     * Handle uncaught exceptions
     * Errors that weren't caught anywhere
     */
    process.on("uncaughtException", (error: Error) => {
      logger.error("Uncaught Exception", {
        error: error.message,
        stack: error.stack,
      });

      // Uncaught exceptions are serious - exit process
      process.exit(1);
    });

    /**
     * Handle unhandled promise rejections
     * Promises that rejected but weren't caught
     */
    process.on("unhandledRejection", (reason: any) => {
      logger.error("Unhandled Promise Rejection", {
        reason: reason instanceof Error ? reason.message : reason,
        stack: reason instanceof Error ? reason.stack : undefined,
      });

      // In production, you might want to exit here too
      // process.exit(1);
    });
  } catch (error) {
    logger.error("Failed to start server", {
      error: error instanceof Error ? error.message : "Unknown error",
      stack: error instanceof Error ? error.stack : undefined,
    });

    // Exit if can't start
    process.exit(1);
  }
};

// Start the server
startServer();
