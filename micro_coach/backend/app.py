from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv
import os
import requests
import logging
import traceback

load_dotenv()
GROQ_API_KEY = os.getenv("GROQ_API_KEY")

app = Flask(__name__)

CORS(app, resources={r"/chat": {"origins": "http://localhost:3000"}})

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
            """You are Micro-Coach, a lightweight decision-support chatbot. 
            Your role is to guide users through small everyday choices quickly and practically.

            Greeting rule: Always begin the very first response with a friendly greeting such as 
            'Hi, I’m your Micro-Coach. Tell me your situation and I’ll help you think it through.' 
            When the user indicates they are done, always end with a warm goodbye such as 
            'Glad I could help. Take care!'

            Reasoning rule: For each response, silently think step by step about the decision 
            before giving the final answer. In your output, only show the short, clear advice 
            (no reasoning notes).

            Few-shot examples (follow this format):
            User: Should I eat out or cook at home tonight?
            Assistant: Cooking at home saves money and keeps you healthier. Go for that unless 
            you want a social outing.

            User: I can’t decide if I should study now or relax first.
            Assistant: Start with 30 minutes of study, then give yourself permission to relax. 
            That way you cover both.

            User: Should I buy this jacket now or wait?
            Assistant: If you need it for the current season, buy it now. If not urgent, wait 
            for a discount.

            Always be brief, practical, and supportive.
            """
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

        assistant_text = None
        try:
            if isinstance(data, dict) and "choices" in data and len(data["choices"]) > 0:
                choice = data["choices"][0]
                if isinstance(choice.get("message"), dict):
                    assistant_text = choice["message"].get("content") or choice["message"].get("text")
                else:
                    assistant_text = choice.get("text")

            if not assistant_text and isinstance(data, dict) and "output" in data:

                assistant_text = " ".join([str(x.get("content", "")) for x in data.get("output", [])])
        except Exception:
            logging.exception("Failed to extract assistant content")
            assistant_text = None

        return jsonify({"raw": data, "reply": assistant_text})
    except Exception as e:
        tb = traceback.format_exc()
        logging.error("Unhandled error in /chat: %s", tb)

        return jsonify({"error": str(e), "traceback": tb}), 500


if __name__ == "__main__":

    app.run(host="0.0.0.0", port=5000, debug=True)
