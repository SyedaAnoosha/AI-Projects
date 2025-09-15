import React, { useState, useEffect, useRef } from 'react';
import './App.css';

function ChatMessage({ message }) {
    const isUser = message.role === 'user';
    return (
        <div className={`message ${isUser ? 'user' : 'assistant'}`}>
            <p>{message.content}</p>
        </div>
    );
}

function App() {
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const messagesEndRef = useRef(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const sendMessage = async () => {
        if (!input.trim()) return;

        const userMessage = { role: 'user', content: input };
        setMessages([...messages, userMessage]);
        setInput('');
        setIsLoading(true);
        setError(null);

        try {
            const response = await fetch('http://localhost:5000/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: input,
                    history: messages
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP error ${response.status}: ${await response.text()}`);
            }

            const data = await response.json();
            if (data.error) {
                throw new Error(data.error);
            }

            const assistantMessage = { role: 'assistant', content: data.reply || 'No response received' };
            setMessages(prev => [...prev, assistantMessage]);
        } catch (err) {
            console.error('Error:', err);
            setError(`Failed to get response: ${err.message}`);
        } finally {
            setIsLoading(false);
        }
    };

    const handleKeyPress = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    };

    return (
        <div className="chat-container">
            <div className="chat-header">
                <h1>Micro-Coach</h1>
                <p>Your daily decisions helper</p>
            </div>
            <div className="chat-body">
                {messages.map((msg, index) => (
                    <ChatMessage key={index} message={msg} />
                ))}
                {isLoading && (
                    <div className="loading">
                        <div className="loading-spinner"></div>
                    </div>
                )}
                {error && (
                    <div className="error">{error}</div>
                )}
                <div ref={messagesEndRef}></div>
            </div>
            <div className="chat-input">
                <div className="input-container">
                    <textarea
                        rows="2"
                        placeholder="Describe your small decision..."
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyPress={handleKeyPress}
                    />
                    
                    <button
                        onClick={sendMessage}
                        disabled={isLoading || !input.trim()}
                    >
                        <span>➤</span>
                    </button>
                </div>
            </div>
        </div>
    );
}

export default App;