# Conversational AI Bot

This repository contains a small voice-to-voice conversational bot demonstration. It includes:

- backend/: FastAPI backend that handles audio transcription, response generation (via GROQ), and text-to-speech (gTTS).
- frontend/: Streamlit demo app that uploads an audio file, sends it to the backend, and plays the generated reply.

## Features

- Transcribe uploaded audio to text (/transcribe)
- Generate a short reply using GROQ chat completions (/respond)
- Convert text reply to MP3 base64 (/tts)
- Convenience endpoint that does the full pipeline (transcribe -> respond -> tts) (/converse)

## Backend endpoints

The backend runs a FastAPI app (default port 5000). Available endpoints:
- POST /transcribe
	- Accepts multipart form file upload under the `file` field (standard multipart/form-data).
	- Returns JSON: {"text": "transcribed text"}

- POST /respond
	- Accepts JSON body: {"text": "user text"}
	- Optional query param `max_tokens` (integer) to override server max tokens for the model.
	- Returns JSON: {"text": "model reply"}

- POST /tts
	- Accepts JSON body: {"text": "text to speak"}
	- Returns JSON: {"audio_base64": "<base64-encoded-mp3>"}

- POST /converse
	- Accepts multipart form file upload under the `file` field.
	- Runs transcription -> model -> tts and returns JSON: {"text": "reply text", "audio_base64": "<base64 mp3>"}

Notes:
- The /transcribe and /converse endpoints expect an audio file readable by the speech_recognition AudioFile wrapper (wav, flac, etc.).
- Responses from the GROQ model are returned as plain text. The backend falls back to a simple echo-style response if GROQ fails.

## Environment variables

Create a `.env` file in `backend/`  with the following as needed:

- GROQ_API_KEY - API key for the Groq client
- BACKEND_URL - URL of the running backend, e.g. `http://localhost:5000`. If not set, edit the frontend to point to your backend.

## Quick start (Windows PowerShell)

1) Start the backend

```powershell
cd "./Conversational-AI-Bot/backend"
python -m pip install -r requirements.txt
# create a .env next to app.py with GROQ_API_KEY and other settings if you want real model replies
python app.py
```

The backend will default to port 5000. You can also set `PORT` in the environment or `.env`.

2) Start the frontend (Streamlit demo)

```powershell
cd "./Conversational-AI-Bot/frontend"
python -m pip install -r requirements.txt
# optionally set BACKEND_URL if your backend is not at http://localhost:5000
#$env:BACKEND_URL = 'http://localhost:5000'
streamlit run app.py
```

## Example usage (curl)

Transcribe an audio file:

```bash
curl -X POST -F "file=@/path/to/audio.wav" http://localhost:5000/transcribe
```

Get a model response:

```bash
curl -X POST -H "Content-Type: application/json" -d '{"text":"Hello, how are you?"}' http://localhost:5000/respond
```

Create TTS from text:

```bash
curl -X POST -H "Content-Type: application/json" -d '{"text":"Hello back!"}' http://localhost:5000/tts
```

Converse (upload audio and receive reply + base64 MP3):

```bash
curl -X POST -F "file=@/path/to/audio.wav" http://localhost:5000/converse
```

Note: On Windows PowerShell you can use the same curl examples if curl is available, otherwise use Invoke-WebRequest or a tool like Postman.

## Implementation notes

- Transcription uses the `speech_recognition` library and Google Web Speech (offline/local use may be limited by library capabilities).
- Text-to-speech is produced using `gTTS` and returned as a base64-encoded MP3.
- Model responses use the `groq` Python client when `GROQ_API_KEY` is set; otherwise the server returns a fallback echo response.

## License / Attribution

This is a small demo project; adapt and reuse as you like. If you publish changes that depend on external APIs (GROQ), follow their licensing and usage terms.