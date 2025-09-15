from flask import Flask, request, jsonify
from dotenv import load_dotenv
import os
import requests
import logging
import traceback

load_dotenv()
GROQ_API_KEY = os.getenv("GROQ_API_KEY")

app = Flask(__name__)
logging.basicConfig(level=logging.INFO)


@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok"})


@app.route("/debug", methods=["GET"])
def debug():
    return jsonify({
        "groq_api_key_set": bool(GROQ_API_KEY),
        "note": "This endpoint only confirms presence of env var, not its value."
    })


def call_groq_api(message, history=None):
    """Call Groq chat completions endpoint. Returns parsed JSON or raises RuntimeError."""
    # Dev fallback: return mock reply if key missing
    if not GROQ_API_KEY:
        logging.warning("GROQ_API_KEY not set. Returning mock response for local dev.")
        return {
            "choices": [
                {"message": {"content": "Mock Micro-Coach reply: GROQ_API_KEY not set. Set env var for real calls."}}
            ],
            "mock": True
        }

    url = "https://api.groq.com/openai/v1/chat/completions"

    headers = {
        "Authorization": f"Bearer {GROQ_API_KEY}",
        "Content-Type": "application/json",
    }

    system_prompt = {
        "role": "system",
        "content": (
            "You are Micro-Coach, a supportive chatbot that helps users make small, everyday decisions. "
            "Give structured, practical, non-judgmental guidance. Keep answers short, conversational and action-oriented. "
            "Avoid making medical, legal or financial decisions."
        ),
    }

    messages = [system_prompt]
    if history and isinstance(history, list):
        messages.extend(history)
    messages.append({"role": "user", "content": message})

    payload = {
        "model": "llama-3.1-8b-instant",
        "messages": messages,
        "temperature": 0.7,
        "max_tokens": 300,
    }

    try:
        resp = requests.post(url, json=payload, headers=headers, timeout=30)
    except requests.exceptions.RequestException as e:
        logging.exception("Network error calling Groq API")
        raise RuntimeError(f"Network error calling Groq API: {e}") from e

    # If Groq returns non-200, surface the body for debugging
    if resp.status_code != 200:
        logging.error("Groq API returned non-200: %s %s", resp.status_code, resp.text)
        raise RuntimeError(f"Groq API error {resp.status_code}: {resp.text}")

    try:
        return resp.json()
    except Exception as e:
        logging.exception("Failed to parse Groq response as JSON")
        raise RuntimeError(f"Invalid JSON from Groq: {e}; raw: {resp.text}") from e


@app.route("/chat", methods=["POST"])
def chat():
    try:
        body = request.get_json(force=True)
        message = body.get("message")
        history = body.get("history", [])
        if not message:
            return jsonify({"error": "message is required"}), 400

        data = call_groq_api(message, history=history)

        # Best-effort extraction
        assistant_text = None
        try:
            # common pattern: choices[0].message.content
            if isinstance(data, dict) and "choices" in data and len(data["choices"]) > 0:
                choice = data["choices"][0]
                if isinstance(choice.get("message"), dict):
                    assistant_text = choice["message"].get("content") or choice["message"].get("text")
                else:
                    assistant_text = choice.get("text")
            # fallback: check other possible shapes
            if not assistant_text and isinstance(data, dict) and "output" in data:
                # some APIs provide output array
                assistant_text = " ".join([str(x.get("content", "")) for x in data.get("output", [])])
        except Exception:
            logging.exception("Failed to extract assistant content")
            assistant_text = None

        return jsonify({"raw": data, "reply": assistant_text})
    except Exception as e:
        tb = traceback.format_exc()
        logging.error("Unhandled error in /chat: %s", tb)
        # return trace in JSON to speed debugging. Remove in production.
        return jsonify({"error": str(e), "traceback": tb}), 500


if __name__ == "__main__":
    # Set debug=True while developing; set to False in production
    app.run(host="0.0.0.0", port=5000, debug=True)
