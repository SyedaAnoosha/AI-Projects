import os
import base64
import requests
import streamlit as st
from dotenv import load_dotenv
from audio_recorder_streamlit import audio_recorder

load_dotenv()

BACKEND_URL = os.getenv("BACKEND_URL") or os.getenv("BACKEND_URL")

st.set_page_config(page_title="Conversational AI Bot", layout="centered")

st.markdown(
    "<style>\n    .stApp { background-color: #fff0f6; }\n    h1, h2, h3 { color: #ff2d95; }\n    .stButton>button { background-color: #ff69b4; }</style>",
    unsafe_allow_html=True,
)

st.markdown("# 🎙️ Conversational AI Bot")
st.markdown("Record your voice or upload an audio file, and get a response from an AI model!")

st.sidebar.title("Controls")

max_tokens = st.sidebar.slider("Max tokens (reply length)", min_value=50, max_value=10000, value=500, step=50)

tab1, tab2 = st.tabs(["🎤 Record Audio", "📁 Upload Audio"])

with tab1:
    st.markdown("### Record your voice")
    st.markdown("Click the microphone button below to start/stop recording")
    
    audio_bytes = audio_recorder(
        recording_color="#ff2d95",
        neutral_color="#6aa36f",
        icon_name="microphone",
        icon_size="3x",
    )
    
    if audio_bytes:
        st.audio(audio_bytes, format="audio/wav")
        
        if st.button("Send Recording and Get Response", key="record_send"):
            with st.spinner("Processing your recording..."):
                files = {"file": ("recording.wav", audio_bytes)}
                try:
                    data = {"max_tokens": str(max_tokens)}
                    r = requests.post(f"{BACKEND_URL}/converse", files=files, data=data, timeout=120)
                    r.raise_for_status()
                    data = r.json()
                    st.subheader("✨ AI Reply")
                    st.write(data.get("text"))
                    audio_b64 = data.get("audio_base64")
                    if audio_b64:
                        audio_bytes_reply = base64.b64decode(audio_b64)
                        st.audio(audio_bytes_reply, format="audio/mp3")
                except Exception as e:
                    st.error(f"Error: {e}")

with tab2:
    st.markdown("### Upload an audio file")
    uploaded = st.file_uploader("Upload a WAV/FLAC/AIFF audio file", type=["wav", "flac", "aiff", "mp3"])
    
    if uploaded is not None:
        st.write("Uploaded file:", uploaded.name)
        st.audio(uploaded)
        
        if st.button("Send Upload and Get Response", key="upload_send"):
            with st.spinner("Processing your upload..."):
                files = {"file": (uploaded.name, uploaded.getvalue())}
                try:
                    data = {"max_tokens": str(max_tokens)}
                    r = requests.post(f"{BACKEND_URL}/converse", files=files, data=data, timeout=120)
                    r.raise_for_status()
                    data = r.json()
                    st.subheader("✨ AI Reply")
                    st.write(data.get("text"))
                    audio_b64 = data.get("audio_base64")
                    if audio_b64:
                        audio_bytes_reply = base64.b64decode(audio_b64)
                        st.audio(audio_bytes_reply, format="audio/mp3")
                except Exception as e:
                    st.error(f"Error: {e}")
