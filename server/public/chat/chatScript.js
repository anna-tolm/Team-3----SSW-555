const PROFILE_USER_ID_KEY = 'healthCoachProfileUserId';

function resolveSignedInUserId() {
  const params = new URLSearchParams(window.location.search);
  const fromQuery = params.get('userId') || params.get('id');
  if (fromQuery) {
    try {
      sessionStorage.setItem(PROFILE_USER_ID_KEY, fromQuery);
    } catch (e) {}
    return fromQuery;
  }
  try {
    return sessionStorage.getItem(PROFILE_USER_ID_KEY);
  } catch (e) {
    return null;
  }
}

function wireChatNav(userId) {
  const profileLink = document.getElementById('chatProfileLink');
  const selfLink = document.getElementById('chatSelfLink');
  const createGoalLink = document.getElementById('createGoalLink');
  if (!profileLink) return;
  if (userId) {
    profileLink.href = '/profile.html?id=' + encodeURIComponent(userId);
    profileLink.hidden = false;
    if (selfLink) {
      selfLink.href = '/chat/chat.html?userId=' + encodeURIComponent(userId);
    }
    if (createGoalLink) {
      createGoalLink.href = '/create-goal.html?userId=' + encodeURIComponent(userId);
    }
  } else {
    profileLink.removeAttribute('href');
    profileLink.hidden = true;
    if (selfLink) {
      selfLink.href = '/chat/chat.html';
    }
    if (createGoalLink) {
      createGoalLink.href = '/create-goal.html';
    }
  }
}

const signedInUserId = resolveSignedInUserId();
wireChatNav(signedInUserId);

const chatWindow = document.getElementById('chatWindow');
const messageInput = document.getElementById('messageInput');
const sendBtn = document.getElementById('sendBtn');
const emptyState = document.getElementById('emptyState');

const USER_ID = signedInUserId || 'test-user-id';

    messageInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    });

    function renderAiMarkdown(markdown) {
      if (typeof marked !== 'undefined' && typeof DOMPurify !== 'undefined') {
        try {
          const raw = marked.parse(markdown, { gfm: true, breaks: true });
          return DOMPurify.sanitize(raw);
        } catch (e) {
          console.error(e);
        }
      }
      const fallback = document.createElement('div');
      fallback.textContent = markdown;
      return fallback.innerHTML;
    }

    function addMessage(text, role) {
      const wrapper = document.createElement('div');
      wrapper.className = `message ${role}`;

      const label = document.createElement('div');
      label.className = 'label';
      label.textContent = role === 'user' ? 'You' : 'Coach';

      const bubble = document.createElement('div');
      bubble.className = 'bubble';
      if (role === 'ai') {
        bubble.classList.add('bubble-md');
        bubble.innerHTML = renderAiMarkdown(text);
      } else {
        bubble.textContent = text;
      }

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