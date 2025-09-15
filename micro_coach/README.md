# **Micro-Coach – Lightweight Decision Support Chatbot**

Micro-Coach is a lightweight web-based chatbot that helps users make quick, everyday decisions with concise, practical advice. It uses Groq’s LLaMA-3.1-8B-Instant model on the backend and a React chat interface on the frontend.

## **Features**

- **Decision Support** – Provides brief, practical advice for small daily choices.

- **LLM-powered Reasoning** – Uses Groq API with structured prompting (few-shot + chain-of-thought).

- **Chat Interface** – Clean React-based UI with chat bubbles, decision input box, and send button.

- **Greeting & Goodbye** – Hardcoded startup greeting and friendly closing messages.

- **Error Handling** – Fallback mock responses if API fails.

## **Tech Stack**

- **Backend: Python**, Flask, Groq API

- **Frontend**: React, Fetch API

- **Model**: llama-3.1-8b-instant (via Groq)

## **Future Improvements**

- Persistent chat history storage (database)

- Multi-turn context beyond current session

- Voice input/output integration

- Mobile-friendly UI