import mongoose from "mongoose";
import logger from "./logger";

const connectDatabase = async (): Promise<void> => {
  try {
    const mongoUri =
      process.env.MONGODB_URI || "mongodb://localhost:27017/appointments";

    await mongoose.connect(mongoUri);

    logger.info("MongoDB connected successfully", {
      host: mongoose.connection.host,
      database: mongoose.connection.name,
    });

    // Handle connection events
    mongoose.connection.on("error", (error) => {
      logger.error("MongoDB connection error:", error);
    });

    mongoose.connection.on("disconnected", () => {
      logger.warn("MongoDB disconnected");
    });

    // Graceful shutdown
    process.on("SIGINT", async () => {
      await mongoose.connection.close();
      logger.info("MongoDB connection closed due to app termination");
      process.exit(0);
    });
  } catch (error) {
    logger.error("Failed to connect to MongoDB:", error);
    process.exit(1); // Exit if database connection fails
  }
};

export default connectDatabase;
