import { Router } from "express";
import mongoose from "mongoose";

const router = Router();

/**
 * @route   GET /health
 * @desc    Health check endpoint
 * @access  Public
 *
 * Returns:
 * - 200 if all systems operational
 * - 503 if any system is down
 *
 * Used by:
 * - Docker health checks
 * - Load balancers
 * - Kubernetes liveness/readiness probes
 * - Monitoring systems (Kubernetes, AWS ELB)
 */
router.get("/", async (_req, res) => {
  const health = {
    status: "ok",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(), // How long server has been running
    checks: {
      api: "ok",
      database: "unknown",
    },
  };

  try {
    // Check MongoDB connection
    if (mongoose.connection.readyState === 1) {
      // Ping database to ensure it's responsive
      if (mongoose.connection.db) {
        await mongoose.connection.db.admin().ping();
        health.checks.database = "ok";
      } else {
        health.checks.database = "error";
        health.status = "unhealthy";
      }
    } else {
      health.checks.database = "disconnected";
      health.status = "degraded";
    }
  } catch (error) {
    health.checks.database = "error";
    health.status = "unhealthy";
  }

  // Return appropriate status code
  const statusCode = health.status === "ok" ? 200 : 503;
  res.status(statusCode).json(health);
});

export default router;
