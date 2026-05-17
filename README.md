# 🔍 LogicLens — AI-Powered Code Review Bot with Adaptive Learning

> **An intelligent code review assistant that combines static analysis with Google Gemini's semantic AI to automate reviews, learn from developer feedback, and provide team-wide analytics.**

![Node.js](https://img.shields.io/badge/Node.js-v18+-339933?logo=node.js&logoColor=white)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)
![Gemini](https://img.shields.io/badge/Google%20Gemini-AI-4285F4?logo=google&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-3FCF8E?logo=supabase&logoColor=white)
![License](https://img.shields.io/badge/License-ISC-blue)

---

## 🚀 What Is LogicLens?

LogicLens is a full-stack web application that acts as an intelligent code review assistant. It goes beyond traditional linters by combining three layers of analysis:

1. **Static Analysis** — Rule-based linting (Pylint for Python, Tree-sitter for C/C++, custom checks for JS)
2. **AI Semantic Analysis** — Google Gemini API understands code *intent*, *logic*, and *architecture*
3. **Adaptive Learning** — Learns from developer Accept/Reject decisions to suppress unwanted suggestions over time

---

## 💡 The Problem

| Challenge | Impact |
|---|---|
| Manual reviews are **time-consuming** | Senior devs spend hours on PRs instead of building features |
| Feedback is **inconsistent** | Quality depends on who reviews — different reviewers, different standards |
| Static tools are **rigid** | ESLint/Pylint catch syntax errors but miss logic flaws and security context |
| No **adaptability** | Rejected suggestions keep appearing — tools never learn |

## ✅ How LogicLens Solves It

- **Automates 70%+** of review work via AI — results in under 30 seconds
- **Consistent standards** — one AI reviewer for the entire team
- **Semantic understanding** — Gemini catches architectural flaws, not just syntax
- **Feedback loop** — rejected suggestions are stored and suppressed in future reviews
- **Team dashboards** — analytics for code quality trends and member performance

---

## 🏗️ Architecture

```
┌───────────────────────────────────────────────────────┐
│              FRONTEND (React + Vite + Vercel)         │
│  Home │ Code Editor │ Teams │ Leader/Member Dashboard │
│                        │                              │
│              API Utility Layer (Bearer JWT Auth)      │
└────────────────────────┼──────────────────────────────┘
                         │ REST API (HTTPS)
┌────────────────────────▼──────────────────────────────┐
│              BACKEND (Node.js + Express + Render)     │
│                                                       │
│  /api/analyze ──► Static Analyzers + Gemini AI        │
│  /api/feedback ──► Accept/Reject Storage              │
│  /api/teams ──► Team CRUD + Analytics                 │
│  /api/github ──► OAuth Token Exchange                 │
│  /api/stats ──► Admin Dashboard Data                  │
│                         │                             │
│              ┌──────────▼───────────┐                 │
│              │   Google Gemini API  │                  │
│              │  (Semantic Analysis) │                  │
│              └─────────────────────┘                  │
└───────────────────────┬───────────────────────────────┘
                        │
┌───────────────────────▼───────────────────────────────┐
│              DATABASE (Supabase PostgreSQL)            │
│  profiles │ teams │ team_members │ feedback │ peer_fb │
└───────────────────────────────────────────────────────┘
```

---

## ✨ Key Features

### 🤖 AI-Powered Code Review
- Supports **Python, JavaScript, Java, C, C++**
- Gemini understands code semantics — catches logic errors, security flaws, performance issues
- Model fallback chain: `gemini-2.5-flash` → `gemini-2.5-pro` → `gemini-1.0-pro`
- Forced JSON output with automatic retry on malformed responses

### 🔄 Adaptive Learning System
- Every Accept/Reject decision is stored in the database
- Future reviews query past rejections and include them in the AI prompt
- Non-critical suggestions (style, best-practice) on rejected lines are auto-filtered
- Critical suggestions (syntax, logic, security) are **never suppressed**

### 📊 Team Dashboards
- **Leader Dashboard** — Team-wide feedback, member stats, acceptance rates
- **Member Dashboard** — Personal stats + full team code review visibility
- **Admin Dashboard** — Global analytics across all teams with error type breakdowns

### 🔐 Authentication & Security
- GitHub OAuth via Supabase Auth
- JWT-based API authentication (Bearer token middleware)
- Team-based access control (Owner, Member roles)
- Server-side validation on all protected routes

### 📁 Multi-File Project Analysis
- Upload multiple files for project-level review
- Cross-file context sent to Gemini (detects coupling, duplication, architecture issues)
- Request queue prevents server overload during heavy analysis

---

## 🛠️ Tech Stack

| Layer | Technologies |
|---|---|
| **Frontend** | React 19, Vite, CodeMirror 6, Recharts, Tailwind CSS, React Router v7 |
| **Backend** | Node.js, Express 5, Multer, Axios |
| **AI Engine** | Google Generative AI SDK (Gemini API) |
| **Static Analysis** | Tree-sitter (C/C++), Pylint (Python), Custom JS Analyzer |
| **Database** | Supabase (PostgreSQL) |
| **Auth** | Supabase Auth (GitHub OAuth, JWT) |
| **Deployment** | Vercel (frontend), Render (backend), Supabase Cloud (DB) |

---

## 📂 Project Structure

```
Logic-Lens/
├── client/                          # React frontend
│   ├── src/
│   │   ├── components/
│   │   │   ├── CodeEditor.jsx       # CodeMirror wrapper with syntax highlighting
│   │   │   ├── ResultPanel.jsx      # Displays AI suggestions with Accept/Reject
│   │   │   ├── AdminDashboard.jsx   # Global admin analytics
│   │   │   ├── ErrorStatsDashboard  # Error type breakdown charts
│   │   │   └── Layout/Header/Footer # App shell components
│   │   ├── pages/
│   │   │   ├── Editor.jsx           # Main code analysis page
│   │   │   ├── LeaderDashboard.jsx  # Team lead view
│   │   │   ├── MemberDashboard.jsx  # Member view
│   │   │   ├── Teams.jsx            # Team listing
│   │   │   └── Login/Signup.jsx     # Auth pages
│   │   ├── utils/
│   │   │   ├── api.js               # Centralized API layer with auth
│   │   │   └── parseGeminiReview.js # Gemini response parser
│   │   └── supabaseClient.js        # Supabase client config
│   └── vite.config.js
│
├── server/                          # Express backend
│   ├── routes/
│   │   ├── analyze.js               # Code analysis endpoints (single + multi-file)
│   │   ├── feedback.js              # Accept/reject feedback storage
│   │   ├── teams.js                 # Team CRUD, members, analytics
│   │   ├── dashboardStats.js        # Admin stats aggregation
│   │   ├── github.js                # GitHub OAuth callback
│   │   └── rejections.js            # Past rejection queries
│   ├── utils/
│   │   ├── geminiReview.js          # Gemini API integration with retry & fallback
│   │   ├── analyzeJS.js             # JavaScript static analyzer
│   │   ├── analyzeJava.js           # Java Checkstyle integration
│   │   ├── analyzeCpp.js            # C/C++ Tree-sitter AST analyzer
│   │   ├── auth.js                  # JWT verification middleware
│   │   └── supabaseClient.js        # Supabase server client
│   ├── python/
│   │   └── analyze_python.py        # Pylint integration script
│   └── index.js                     # Express server entry point
└── package.json
```

---

## 🚀 Getting Started

### Prerequisites
- **Node.js** v18+
- **Python** 3.8+ (with `pylint` installed)
- **Supabase** account (free tier works)
- **Google Gemini API** key ([Get one here](https://ai.google.dev))

### 1. Clone & Setup

```bash
git clone https://github.com/ABDULKAREEM-010/Logic-Lens.git
cd Logic-Lens
```

### 2. Backend Setup

```bash
cd server
npm install
```

Create a `.env` file:
```env
PORT=5000
GEMINI_API_KEY=your_gemini_api_key
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key
GITHUB_CLIENT_ID=your_github_oauth_client_id
GITHUB_CLIENT_SECRET=your_github_oauth_client_secret
VITE_FRONTEND_URL=http://localhost:5173
```

Start the server:
```bash
npm start
```

### 3. Frontend Setup

```bash
cd ../client
npm install
npm run dev
```

### 4. Open Application
Navigate to `http://localhost:5173`

---

## 📊 API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/analyze` | Analyze single file (code + language) |
| `POST` | `/api/analyze/multi` | Analyze multiple uploaded files |
| `POST` | `/api/feedback` | Store accept/reject decision |
| `GET` | `/api/feedback/all` | Get all feedback (admin) |
| `POST` | `/api/teams` | Create a new team |
| `GET` | `/api/teams/:id/join` | Join a team |
| `GET` | `/api/teams/:id/members` | List team members with stats |
| `GET` | `/api/teams/:id/analytics` | Team analytics |
| `GET` | `/api/stats` | Admin dashboard statistics |
| `POST` | `/api/github/callback` | GitHub OAuth token exchange |

---

## 🔮 Future Enhancements

- 🔌 **IDE Plugins** — VS Code and IntelliJ extensions
- ⚙️ **CI/CD Integration** — GitHub Actions, Jenkins pipeline hooks
- 📡 **WebSocket Real-time** — Live dashboard updates
- 🌐 **Offline AI Mode** — Local model for reviews without cloud API
- 🛡️ **Security Scanning** — Dedicated SQL injection and XSS detection modules
- 📈 **Advanced Visualizations** — Heatmaps and improvement trend tracking

---

---

## 📄 License

ISC
