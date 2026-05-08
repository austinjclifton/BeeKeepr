"use strict";

/**
 * Express Application Setup
 *
 * Responsibilities:
 * - Configure global middleware
 * - Mount all HTTP routes
 * - Register Swagger UI
 * - Serve built frontend
 * - Provide centralized error handling
 */

const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const path = require("path");

// ----- Route Imports -----
const healthRoutes = require("./routes/health.routes");
const authRoutes = require("./routes/auth.routes");
const sessionRoutes = require("./routes/sessions.routes");
const hiveRoutes = require("./routes/hives.routes");
const deviceRoutes = require("./routes/devices.routes");
const readingRoutes = require("./routes/readings.routes");
const ingestRoutes = require("./routes/ingest.routes");
const externalRoutes = require("./routes/externalConditions.routes.js");
const locationsRoutes = require("./routes/locations.routes.js");
const alertsRoutes = require("./routes/alerts.routes.js");

// ----- Swagger -----
const { setupSwagger } = require("./utils/swagger.js");

const app = express();
const frontendDistPath = path.resolve(__dirname, "../../frontend/dist");

/* ================================================================
 * Global Middleware
 * ================================================================ */

app.set("trust proxy", 1);

app.use(express.json());

app.use((req, res, next) => {
  console.log(`${req.method} ${req.path}`);
  next();
});

app.use(
  cors({
    origin: true,
    credentials: true,
  }),
);

app.use(cookieParser());

/* ================================================================
 * API Routes
 * ================================================================ */

app.use("/api/health", healthRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/sessions", sessionRoutes);
app.use("/api/hives", hiveRoutes);
app.use("/api/devices", deviceRoutes);
app.use("/api/readings", readingRoutes);
app.use("/api/external-conditions", externalRoutes);
app.use("/api/locations", locationsRoutes);
app.use("/api/alerts", alertsRoutes);

app.use("/ingest", ingestRoutes);

/* ================================================================
 * Swagger UI
 * ================================================================ */

setupSwagger(app);

/* ================================================================
 * Frontend Static Build
 * ================================================================ */

app.use(express.static(frontendDistPath));

app.get("*", (req, res, next) => {
  if (
    req.path.startsWith("/api") ||
    req.path.startsWith("/ingest") ||
    req.path.startsWith("/docs")
  ) {
    return next();
  }

  return res.sendFile(path.join(frontendDistPath, "index.html"));
});

/* ================================================================
 * Error Handling
 * ================================================================ */

app.use((err, req, res, next) => {
  console.error(err);

  return res.status(err.status || 500).json({
    error: err.message || "Internal server error",
  });
});

app.use((req, res) => {
  return res.status(404).json({ error: "Not found" });
});

module.exports = app;
