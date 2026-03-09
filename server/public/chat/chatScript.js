 const chatWindow = document.getElementById('chatWindow');
    const messageInput = document.getElementById('messageInput');
    const sendBtn = document.getElementById('sendBtn');
    const emptyState = document.getElementById('emptyState');

    const USER_ID = 'test-user-id';

    messageInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    });

    function addMessage(text, role) {
      if (emptyState){
        emptyState.remove(); //removes placeholder (Ask me anything)
    }

      const wrapper = document.createElement('div'); //new div for messages
      wrapper.className = `message ${role}`; //ai or user

      const label = document.createElement('div');
      label.className = 'label';
      label.textContent = role === 'user' ? 'You' : 'Coach'; //sets display name

      const bubble = document.createElement('div');
      bubble.className = 'bubble';
      bubble.textContent = text;

      //text bubble
      wrapper.appendChild(label);
      wrapper.appendChild(bubble);
      chatWindow.appendChild(wrapper);
      chatWindow.scrollTop = chatWindow.scrollHeight;
    }
    //ADD TYPING BUBBLES LATER

    async function sendMessage() {
      const message = messageInput.value.trim(); //from message box, trims it 
      if (!message) return; //stops if no message

      addMessage(message, 'user');
      messageInput.value = '';
      sendBtn.disabled = true;

      try {
        const res = await fetch('/api/health-coach/chat', { //sends post req
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message, userId: USER_ID })
        });
        const data = await res.json();
        

        if (data.success) { //ai response
          addMessage(data.message, 'ai');
        } else {
          addMessage('Sorry, something went wrong. Please try again.', 'ai');
        }
      } catch (e) {
        console.error(e);
        addMessage('Unable to connect. Please check your server.', 'ai');
      } finally {
        sendBtn.disabled = false;
        messageInput.focus();
      }
    }