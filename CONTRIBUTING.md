# Contributing to DevGuard-AI

## Local Development Setup

```bash
# Clone the repo
git clone https://github.com/Daksh-Devguard/DevGuard-AI.git
cd DevGuard-AI

# Install dependencies
cd server && npm install
cd ../client && npm install

# Configure environment
cp server/.env.example server/.env
# Fill in your API keys

# Start development servers
cd server && node index.js      # Terminal 1
cd client && npm run dev         # Terminal 2
```

## Code Style

- **Backend**: CommonJS modules (`require`/`module.exports`), Express 5 router patterns
- **Frontend**: ES modules, React functional components with hooks
- **Logging**: Always use `logger.info/warn/error` from `server/utils/logger.js` — never `console.log`
- **Metrics**: Define new metrics in `server/utils/metrics.js`, import and use in route handlers
- **Error handling**: Every route handler must have try/catch with structured error logging

## Adding a New Language Analyzer

1. **Create the analyzer** in `server/utils/`:

```javascript
// server/utils/analyzeRust.js
const logger = require("./logger");

async function analyzeRust(code) {
  const analysisStart = process.hrtime.bigint();
  const suggestions = [];

  // Your analysis logic here
  // Can be: subprocess (like Pylint), AST (like Tree-sitter), or regex-based

  const analysisSec = Number(process.hrtime.bigint() - analysisStart) / 1e9;
  logger.info("Rust analysis completed", {
    duration_sec: analysisSec.toFixed(3),
    suggestionsCount: suggestions.length,
    context: 'analyze.rust',
  });

  return suggestions;
}

module.exports = analyzeRust;
```

2. **Add a timing metric** in `server/utils/metrics.js`:

```javascript
const rustDuration = new client.Histogram({
  name: 'devguard_rust_duration_seconds',
  help: 'Rust analyzer execution time',
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 5],
  registers: [register],
});
```

3. **Register in the analysis pipeline** (`server/routes/analyze.js`):

```javascript
const analyzeRust = require("../utils/analyzeRust");

// In the detectLanguage function:
if (ext === 'rs') return 'rust';

// In the processSingleFileAnalysis function:
} else if (language === "rust") {
  staticSuggestions = await analyzeRust(code);
}
```

4. **Test it**: Submit Rust code through the editor and verify suggestions appear.

## Adding a New Metric

See [MONITORING.md](MONITORING.md) for step-by-step instructions on adding Prometheus metrics and Grafana panels.

## Pull Request Guidelines

- Include structured logging for any new routes or services
- Add Prometheus metrics for any new external service calls
- Test with both single-file and multi-file review flows
- Verify `/metrics` endpoint still returns valid Prometheus format
