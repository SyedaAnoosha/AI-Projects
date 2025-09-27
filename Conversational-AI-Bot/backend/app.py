import os
import io
import base64
from fastapi import FastAPI, UploadFile, File, HTTPException, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from dotenv import load_dotenv
import speech_recognition as sr
from gtts import gTTS

load_dotenv()

app = FastAPI(title="Conversational AI Bot - Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def transcribe_file_bytes(file_bytes: bytes) -> str:
    r = sr.Recognizer()
    with sr.AudioFile(io.BytesIO(file_bytes)) as source:
        audio = r.record(source)
    try:
        return r.recognize_google(audio, language="en-US")
    except sr.UnknownValueError:
        return "Could not understand audio"
    except sr.RequestError as e:
        raise RuntimeError(f"Speech API error: {e}")


@app.post("/transcribe")
async def transcribe(file: UploadFile = File(...)):
    contents = await file.read()
    try:
        text = transcribe_file_bytes(contents)
        return {"text": text}
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/respond")
async def respond(payload: dict, max_tokens: int | None = None):
    text = payload.get("text")
    if not text:
        raise HTTPException(status_code=400, detail="Missing 'text' in payload")

    try:

        from groq import Groq

        client = Groq(api_key=os.getenv("GROQ_API_KEY"))

        env_default = 500
        token_limit = max_tokens if (max_tokens is not None) else env_default

        chat_completion = client.chat.completions.create(
            messages=[
            {"role": "system", "content": "You are a helpful assistant. Respond concisely and in English."},
            {"role": "user", "content": text.strip()},
            ],
            model="meta-llama/llama-4-scout-17b-16e-instruct",
            max_tokens=token_limit,
            temperature=0.7,
            top_p=1.0,
        )

        choice = chat_completion.choices[0]
        reply = getattr(choice.message, "content", None) or choice.message.content if hasattr(choice, 'message') else getattr(choice, 'text', '')
        return {"text": reply}
    except Exception as e:
        print(f"GROQ error: {e}")
        return {"text": f"(fallback) I heard: {text}"}


def text_to_mp3_bytes(text: str) -> bytes:
    mp3_io = io.BytesIO()
    tts = gTTS(text=text, lang="en")
    tts.write_to_fp(mp3_io)
    mp3_io.seek(0)
    return mp3_io.read()


@app.post("/tts")
async def tts_endpoint(payload: dict):
    text = payload.get("text")
    if not text:
        raise HTTPException(status_code=400, detail="Missing 'text' in payload")
    try:
        mp3_bytes = text_to_mp3_bytes(text)
        mp3_b64 = base64.b64encode(mp3_bytes).decode("utf-8")
        return {"audio_base64": mp3_b64}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/converse")
async def converse(file: UploadFile = File(...)):
    contents = await file.read()
    try:
        user_text = transcribe_file_bytes(contents)
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))

    resp = await respond({"text": user_text})
    reply_text = resp.get("text", "")

    try:
        mp3_bytes = text_to_mp3_bytes(reply_text)
        mp3_b64 = base64.b64encode(mp3_bytes).decode("utf-8")
    except Exception as e:
        mp3_b64 = ""
        print(f"TTS error: {e}")

    return JSONResponse({"text": reply_text, "audio_base64": mp3_b64})


if __name__ == "__main__":
    import uvicorn

    port = int(os.getenv("PORT", "5000"))
    uvicorn.run("app:app", host="0.0.0.0", port=port, reload=True)
