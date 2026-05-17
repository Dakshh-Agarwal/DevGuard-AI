const express = require("express");
const app = express();
const cors = require("cors");
require("dotenv").config();

// Middleware first
app.use(cors());
app.use(express.json());

// Routers
const analyzeRoute = require("./routes/analyze");
const feedbackRoute = require("./routes/feedback");
const dashboardStats = require("./routes/dashboardStats");
const teamsRouter = require("./routes/teams");

app.use("/api/teams", teamsRouter);
app.use("/api/rejections", require("./routes/rejections"));
app.use("/api/github", require("./routes/github"));
app.use("/api/analyze", analyzeRoute);
app.use("/api/feedback", feedbackRoute);
app.use("/api/stats", dashboardStats);

const PORT = process.env.PORT ;
app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));
