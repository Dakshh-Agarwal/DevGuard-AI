const express = require("express");
const app = express();
const cors = require("cors");
require("dotenv").config();

const logger = require("./utils/logger");
const { requestContextMiddleware } = require("./middleware/requestContext");
const metricsMiddleware = require("./middleware/metricsMiddleware");

// ============================================================
// Global middleware (order matters)
// ============================================================

// 1. Request context (generates request_id, sets up AsyncLocalStorage)
app.use(requestContextMiddleware);

// 2. Metrics instrumentation (must be before routes)
app.use(metricsMiddleware);

// 3. Standard middleware
app.use(cors({
  origin: [
    'https://devguard.dakshagarwal.dev',
    'https://d79onb379axx.cloudfront.net'
  ],
  credentials: true
}));
app.use(express.json());

// ============================================================
// Routers
// ============================================================
const analyzeRoute = require("./routes/analyze");
const feedbackRoute = require("./routes/feedback");
const dashboardStats = require("./routes/dashboardStats");
const teamsRouter = require("./routes/teams");
const metricsRoute = require("./routes/metricsRoute");

app.use("/api/teams", teamsRouter);
app.use("/api/rejections", require("./routes/rejections"));
app.use("/api/github", require("./routes/github"));
app.use("/api/analyze", analyzeRoute);
app.use("/api/feedback", feedbackRoute);
app.use("/api/stats", dashboardStats);

// Metrics endpoint (basic auth protected)
app.use("/metrics", metricsRoute);

// ============================================================
// Unhandled exception & rejection handlers
// ============================================================
process.on('uncaughtException', (err) => {
  logger.error('Uncaught exception', {
    error: err.message,
    stack: err.stack,
    context: 'uncaughtException',
  });
  // Give logger time to flush, then exit
  setTimeout(() => process.exit(1), 1000);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled promise rejection', {
    error: reason instanceof Error ? reason.message : String(reason),
    stack: reason instanceof Error ? reason.stack : undefined,
    context: 'unhandledRejection',
  });
});

// ============================================================
// Start server
// ============================================================
const PORT = process.env.PORT;
app.listen(PORT, () => {
  logger.info(`Server running at http://localhost:${PORT}`, {
    port: PORT,
    node_env: process.env.NODE_ENV || 'development',
    context: 'startup',
  });
});
