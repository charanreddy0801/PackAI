PACKAI – HINDSIGHT MEMORY EDITION

This version keeps the existing PackAI frontend, recommendation engine, SQLite persistence, packaging details and authentication, and adds a Hindsight memory layer for the hackathon.

FOLDER STRUCTURE
- frontend/index.html
- frontend/style.css
- frontend/script.js
- backend/server.js
- backend/database.js
- backend/hindsight.js
- backend/groq.js (Groq LLM client: streaming + fallback)
- backend/test-groq.js
- backend/.env.example
- backend/package.json
- backend/packai.db (created automatically when backend starts)

HOW TO RUN
1. Install Node.js (LTS).
2. Open a terminal in the PackAI folder.
3. cd backend
4. npm install
5. Copy .env.example to .env and add your Hindsight Cloud API key.
6. npm start
7. Open http://localhost:5000

HINDSIGHT SETUP
- Create/login to Hindsight Cloud.
- Create an API key from the Connect page.
- Put it in backend/.env as HINDSIGHT_API_KEY=hsk_...
- The app uses bank ID packai-memory by default and will create/update that bank automatically.
- You can change HINDSIGHT_BANK_ID if needed.

HINDSIGHT FEATURES IN PACKAI
- Retains each packaging recommendation as a memory.
- Retains explicit user preferences such as recyclable packaging, lower cost, and longer shelf life.
- Recalls relevant packaging memories before a new recommendation.
- Displays recalled memories in the Hindsight Memory section.
- Personalizes the recommendation presentation using recalled preferences without replacing the technical recommendation engine.
- Includes a memory status indicator so the live demo can visibly prove Hindsight is connected.

SQLITE
SQLite continues to store users and recommendation records. Hindsight is the persistent AI memory layer; SQLite remains the application's transactional history.

DEMO FLOW
1. Login.
2. Click "Prefer Recyclable" in the Hindsight Memory section.
3. Run a packaging analysis.
4. Show the recommendation and memory being stored.
5. Analyze another food/product.
6. Show PackAI recalling the previous preference and displaying a personalized insight.

SECURITY
Do not commit backend/.env or expose HINDSIGHT_API_KEY in frontend code.


GROQ LLM (AI ADVISOR) - LIVE / REAL-TIME
- After every recommendation, PackAI streams a Groq-written explanation into the "Groq AI Advisor" card, word by word.
- Steps to enable:
    1. Get a free key at https://console.groq.com/keys
    2. In backend/, copy .env.example to .env and set GROQ_API_KEY=gsk_...
    3. (optional) run "npm run test:groq" inside backend/ to confirm the key works
    4. npm start
- Default model: openai/gpt-oss-20b. If it is rate-limited, unavailable or returns an empty answer, PackAI automatically retries with GROQ_FALLBACK_MODEL (default llama-3.3-70b-versatile).
- The key stays server-side and is never exposed in frontend code.
- Endpoints:
    GET  /api/groq/status   - is Groq configured?
    POST /api/groq/stream   - real-time Server-Sent Events stream (used by the UI)
    POST /api/groq/advice   - plain JSON answer (automatic fallback if streaming fails)

ONE-CLICK START
- Windows: double-click START.bat      - macOS/Linux: ./START.sh
  (first run creates backend/.env; paste your keys into it and run again)
- Requires Node.js 18 or newer.

TROUBLESHOOTING
- Badge says "Not configured": backend/.env is missing, or GROQ_API_KEY is still the placeholder. Restart the server after editing .env.
- "Groq rejected the API key": the key is wrong or revoked - create a new one.
- Always open http://localhost:5000, not index.html directly.
- Hindsight is optional: without HINDSIGHT_API_KEY the app and Groq advisor still work (just without stored memories).

GROQ + HINDSIGHT DEMO
1. Hindsight recalls the user's prior packaging preferences.
2. PackAI generates its technical recommendation.
3. Groq streams an explanation using the technical inputs plus the recalled preferences.
