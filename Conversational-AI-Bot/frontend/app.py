import os
import base64
import requests
import streamlit as st
from dotenv import load_dotenv

load_dotenv()

BACKEND_URL = os.getenv("BACKEND_URL") or os.getenv("BACKEND_URL")

st.set_page_config(page_title="Conversational AI Bot", layout="centered")

st.markdown(
    "<style>\n    .stApp { background-color: #fff0f6; }\n    h1, h2, h3 { color: #ff2d95; }\n    .stButton>button { background-color: #ff69b4; }</style>",
    unsafe_allow_html=True,
)

st.markdown("# 🎙️ Conversational AI Bot")
st.markdown("Record your voice, upload it here, and get a response from an AI model!")

st.sidebar.title("Controls")

max_tokens = st.sidebar.slider("Max tokens (reply length)", min_value=50, max_value=10000, value=500, step=50)

uploaded = st.file_uploader("Upload a WAV/FLAC/AIFF audio file (or record elsewhere)", type=["wav", "flac", "aiff", "mp3"])

if uploaded is not None:
    st.write("Uploaded file:", uploaded.name)
    if st.button("Send and get response"):
        with st.spinner("Processing..."):
            files = {"file": (uploaded.name, uploaded.getvalue())}
            try:

                data = {"max_tokens": str(max_tokens)}
                r = requests.post(f"{BACKEND_URL}/converse", files=files, data=data, timeout=120)
                r.raise_for_status()
                data = r.json()
                st.subheader("Reply")
                st.write(data.get("text"))
                audio_b64 = data.get("audio_base64")
                if audio_b64:
                    audio_bytes = base64.b64decode(audio_b64)
                    st.audio(audio_bytes, format="audio/mp3")
            except Exception as e:
                st.error(f"Error: {e}")
