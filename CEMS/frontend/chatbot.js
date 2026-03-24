// chatbot.js - Injected globally to provide a smart Assistant
document.addEventListener('DOMContentLoaded', () => {
    // Inject CSS
    const style = document.createElement('style');
    style.innerHTML = `
      #chat-widget {
        position: fixed;
        bottom: 20px;
        right: 20px;
        z-index: 1000;
        font-family: 'Inter', sans-serif;
      }
      #chat-trigger {
        width: 60px;
        height: 60px;
        border-radius: 50%;
        background-color: #10b981;
        color: white;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 28px;
        cursor: pointer;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        transition: transform 0.2s;
      }
      #chat-trigger:hover { transform: scale(1.05); }
      #chat-box {
        display: none;
        width: 350px;
        height: 450px;
        background: white;
        border-radius: 12px;
        box-shadow: 0 5px 20px rgba(0,0,0,0.2);
        flex-direction: column;
        overflow: hidden;
        border: 1px solid #e8ecf4;
        position: absolute;
        bottom: 75px;
        right: 0;
      }
      #chat-box.open { display: flex; }
      #chat-header {
        background: #10b981;
        color: white;
        padding: 15px;
        font-weight: 600;
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      #chat-close { cursor: pointer; font-size: 1.2rem; }
      #chat-messages {
        flex: 1;
        padding: 15px;
        overflow-y: auto;
        background: #f7f8fc;
        display: flex;
        flex-direction: column;
        gap: 10px;
      }
      .msg { padding: 10px 14px; border-radius: 8px; font-size: 0.85rem; max-width: 85%; }
      .msg.bot { background: white; align-self: flex-start; border: 1px solid #e8ecf4; }
      .msg.user { background: #10b981; color: white; align-self: flex-end; }
      #chat-input-area {
        display: flex;
        border-top: 1px solid #e8ecf4;
        padding: 10px;
        background: white;
      }
      #chat-input {
        flex: 1;
        border: 1px solid #e8ecf4;
        border-radius: 20px;
        padding: 8px 15px;
        outline: none;
        font-size: 0.85rem;
      }
      #chat-send {
        background: none;
        border: none;
        color: #10b981;
        font-weight: 600;
        cursor: pointer;
        padding: 0 10px;
      }
    `;
    document.head.appendChild(style);

    // Inject HTML
    const widget = document.createElement('div');
    widget.id = 'chat-widget';
    widget.innerHTML = `
      <div id="chat-box">
        <div id="chat-header">
          <span>🤖 EduEvents AI</span>
          <span id="chat-close">✖</span>
        </div>
        <div id="chat-messages">
          <div class="msg bot">Hello! I am the EduEvents Assistant. Need help registering for an event?</div>
        </div>
        <div id="chat-input-area">
          <input type="text" id="chat-input" placeholder="Type your message..." autocomplete="off" />
          <button id="chat-send">Send</button>
        </div>
      </div>
      <div id="chat-trigger">💬</div>
    `;
    document.body.appendChild(widget);

    // Logic
    const trigger = document.getElementById('chat-trigger');
    const box = document.getElementById('chat-box');
    const closeBtn = document.getElementById('chat-close');
    const sendBtn = document.getElementById('chat-send');
    const input = document.getElementById('chat-input');
    const messages = document.getElementById('chat-messages');

    trigger.addEventListener('click', () => box.classList.toggle('open'));
    closeBtn.addEventListener('click', () => box.classList.remove('open'));

    let chatHistory = [];

    const appendMsg = (text, sender) => {
        const el = document.createElement('div');
        el.className = 'msg ' + sender;
        el.innerText = text;
        messages.appendChild(el);
        messages.scrollTop = messages.scrollHeight;
    };

    const handleSend = async () => {
        const text = input.value.trim();
        if(!text) return;
        appendMsg(text, 'user');
        input.value = '';
        
        chatHistory.push({ role: 'user', content: text });

        // Show typing indicator
        const typingEl = document.createElement('div');
        typingEl.className = 'msg bot';
        typingEl.innerText = 'Thinking...';
        typingEl.id = 'typing-indicator';
        messages.appendChild(typingEl);
        messages.scrollTop = messages.scrollHeight;

        try {
            const res = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ messages: chatHistory })
            });
            const data = await res.json();
            
            document.getElementById('typing-indicator').remove();
            
            if(data.reply) {
                appendMsg(data.reply, 'bot');
                chatHistory.push({ role: 'assistant', content: data.reply });
            } else {
                appendMsg('Sorry, I encountered an error computing that.', 'bot');
            }
        } catch(e) {
            document.getElementById('typing-indicator').remove();
            appendMsg('Error connecting to AI service.', 'bot');
        }
    };

    sendBtn.addEventListener('click', handleSend);
    input.addEventListener('keypress', (e) => {
        if(e.key === 'Enter') handleSend();
    });
});
