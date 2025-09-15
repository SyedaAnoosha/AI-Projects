# Micro-Coach — Lightweight Decision Support Chatbot

Micro-Coach is a small web app that helps users make quick, everyday decisions by returning short, practical advice. It's split into a Flask backend that calls the Groq LLM endpoint and a React frontend that provides a simple chat UI.

This README covers getting the project running locally, how the backend API works, environment variables, and next steps for improvement.

## Quick highlights
- Purpose: short, actionable guidance for small, everyday choices.
- Backend: Flask (Python) with optional Groq API integration.
- Frontend: React (Create React App) chat UI.

---

## Requirements
- Python 3.10+ (for backend)
- Node.js 16+ and npm (for frontend)
- A Groq API key (optional for local development — the backend returns a mock reply when missing)

## Repository layout

- `backend/` — Flask app and API handlers (`app.py`)
- `frontend/` — React app (Create React App)

---

## Local setup — Backend

1. Create and activate a Python virtual environment (recommended):

	- Windows (PowerShell):

	  ```powershell
	  python -m venv .venv; .\.venv\Scripts\Activate.ps1
	  ```

	- macOS / Linux:

	  ```bash
	  python -m venv .venv; source .venv/bin/activate
	  ```

2. Install dependencies:

	```powershell
	pip install -r backend/requirements.txt
	```

3. Set environment variables. The only required variable for production calls is `GROQ_API_KEY`. If it is not set, the backend will return a mocked reply for local development.

	- Windows (PowerShell):

	  ```powershell
	  $env:GROQ_API_KEY = "your_real_groq_api_key"
	  ```

	- Or create a `.env` file in `backend/` with:

	  ```text
	  GROQ_API_KEY=your_real_groq_api_key
	  ```

4. Run the backend (default: http://localhost:5000):

	```powershell
	python backend/app.py
	```

5. Backend endpoint:

	- `POST /chat` — main chat endpoint. Accepts JSON: `{ "message": "...", "history": [...] }` and returns `{ "raw": <groq response>, "reply": "<assistant text>" }`.

---

## Local setup — Frontend

1. Change into the frontend folder and install dependencies:

	```powershell
	cd frontend; npm install
	```

2. Start the React dev server (default: http://localhost:3000):

	```powershell
	npm start
	```

3. The frontend expects the backend at `http://localhost:5000` (CORS is configured for this origin in `backend/app.py`). If you run the backend on a different host/port, update the fetch URL in `frontend/src/App.js`.

---

## API contract (backend)

- POST /chat
  - Request JSON: `{ "message": string, "history": Array }` (history is optional)
  - Response JSON: `{ "raw": <full groq response or mock>, "reply": string|null }`

Notes: when `GROQ_API_KEY` is missing the backend returns a `mock` result in `raw` and a short mock `reply` so the frontend remains functional during development.

---

## How Micro-Coach prompts the LLM

The Flask backend constructs a system prompt that encourages brief, practical answers and includes a few-shot format so the model replies in the expected style. The backend uses `llama-3.1-8b-instant` with moderate temperature and a token limit appropriate for short responses.

---

## Development notes & future work
- Persist chat history (database) so users can see past conversations.
- Improve multi-turn context handling and token management.
- Add mobile responsive styling and accessibility improvements.
- Add end-to-end tests and CI configuration.
