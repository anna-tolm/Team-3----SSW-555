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

function wireNav(userId) {
  const profileLink = document.getElementById('goalProfileLink');
  const selfLink = document.getElementById('createGoalSelfLink');
  const chatLink = document.getElementById('goalChatLink');

  if (userId) {
    if (profileLink) profileLink.href = '/profile.html?id=' + encodeURIComponent(userId);
    if (selfLink) selfLink.href = '/create-goal.html?userId=' + encodeURIComponent(userId);
    if (chatLink) chatLink.href = '/chat/chat.html?userId=' + encodeURIComponent(userId);
  } else {
    if (profileLink) profileLink.removeAttribute('href');
    if (chatLink) chatLink.href = '/chat/chat.html';
  }
}

const USER_ID = resolveSignedInUserId();
wireNav(USER_ID);

const chatWindow = document.getElementById('chatWindow');
const messageInput = document.getElementById('messageInput');
const sendBtn = document.getElementById('sendBtn');

const goalJsonCard = document.getElementById('goalJsonCard');
const goalJsonCode = document.getElementById('goalJsonCode');
const approveBtn = document.getElementById('approveBtn');
const copyJsonBtn = document.getElementById('copyJsonBtn');
const saveStatus = document.getElementById('saveStatus');

let lastGoalJson = null;

// Match chat.html / chatScript.js markdown behavior (saved goal JSON is never passed through this).
if (typeof marked !== 'undefined' && typeof marked.setOptions === 'function') {
  marked.setOptions({ gfm: true, breaks: true });
}

/** While streaming, hide everything from the opening ```json fence so chat stays readable. */
function displayTextWithoutJsonBlock(raw) {
  if (typeof raw !== 'string') return '';
  const m = raw.match(/```json\s*/i);
  if (m && m.index !== undefined) {
    return raw.slice(0, m.index).trimEnd();
  }
  return raw;
}

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

function addStreamingAiMessage() {
  const wrapper = document.createElement('div');
  wrapper.className = 'message ai';

  const label = document.createElement('div');
  label.className = 'label';
  label.textContent = 'Coach';

  const bubble = document.createElement('div');
  bubble.className = 'bubble bubble-md';
  bubble.innerHTML = renderAiMarkdown('...');

  wrapper.appendChild(label);
  wrapper.appendChild(bubble);
  chatWindow.appendChild(wrapper);
  chatWindow.scrollTop = chatWindow.scrollHeight;

  return {
    setText: (markdown) => {
      bubble.innerHTML = renderAiMarkdown(markdown);
      chatWindow.scrollTop = chatWindow.scrollHeight;
    }
  };
}

function showGoalJson(goalJson) {
  lastGoalJson = goalJson;
  goalJsonCode.textContent = JSON.stringify(goalJson, null, 2);
  goalJsonCard.style.display = 'block';
  approveBtn.disabled = false;
  copyJsonBtn.disabled = false;
  saveStatus.textContent = '';
  requestAnimationFrame(() => {
    goalJsonCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
}

function hideGoalJson() {
  lastGoalJson = null;
  goalJsonCard.style.display = 'none';
  approveBtn.disabled = true;
  copyJsonBtn.disabled = true;
  saveStatus.textContent = '';
}

async function sendGoalMessage() {
  const message = messageInput.value.trim();
  if (!message) return;
  if (!USER_ID) {
    addMessage('No user loaded. Please log in and open this page from your profile.', 'ai');
    return;
  }

  addMessage(message, 'user');
  messageInput.value = '';
  sendBtn.disabled = true;
  hideGoalJson();

  try {
    const streamMsg = addStreamingAiMessage();
    let accumulated = '';

    const res = await fetch('/api/health-coach/create-goal/stream', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, userId: USER_ID })
    });

    if (!res.ok || !res.body) {
      const text = await res.text().catch(() => '');
      streamMsg.setText(text || 'Sorry, something went wrong.');
      return;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      // Parse SSE events separated by blank line.
      const parts = buffer.split('\n\n');
      buffer = parts.pop() || '';

      for (const evt of parts) {
        const line = evt.split('\n').find((l) => l.startsWith('data: '));
        if (!line) continue;
        let payload;
        try {
          payload = JSON.parse(line.slice(6));
        } catch (e) {
          continue;
        }

        if (payload.type === 'delta' && typeof payload.text === 'string') {
          accumulated += payload.text;
          streamMsg.setText(displayTextWithoutJsonBlock(accumulated));
        } else if (payload.type === 'status' && typeof payload.message === 'string') {
          saveStatus.textContent = payload.message;
        } else if (payload.type === 'done') {
          if (typeof payload.displayText === 'string' && payload.displayText.trim()) {
            accumulated = payload.displayText;
            streamMsg.setText(accumulated);
          } else if (typeof payload.fullText === 'string') {
            accumulated = displayTextWithoutJsonBlock(payload.fullText);
            streamMsg.setText(accumulated);
          }
          saveStatus.textContent = '';
          if (payload.goalJson && typeof payload.goalJson === 'object') {
            showGoalJson(payload.goalJson);
          } else {
            saveStatus.textContent =
              'Could not build a valid Goal JSON (including all 7 days). Try sending your request again.';
          }
        } else if (payload.type === 'error') {
          streamMsg.setText('Sorry, something went wrong: ' + (payload.message || 'unknown error'));
        }
      }
    }
  } catch (e) {
    console.error(e);
    addMessage('Unable to connect. Please check your server.', 'ai');
  } finally {
    sendBtn.disabled = false;
    messageInput.focus();
  }
}

async function approveAndSave() {
  if (!USER_ID || !lastGoalJson) return;
  saveStatus.textContent = 'Saving...';
  approveBtn.disabled = true;

  try {
    // Goal schema requires userId + the exact fields we asked the model to produce.
    const payload = { userId: USER_ID, ...lastGoalJson };

    const res = await fetch('/goals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    if (!res.ok) {
      saveStatus.textContent = 'Save failed: ' + (data?.error || res.status);
      approveBtn.disabled = false;
      return;
    }

    saveStatus.textContent = 'Saved goal successfully.';
  } catch (e) {
    console.error(e);
    saveStatus.textContent = 'Save failed: network error.';
    approveBtn.disabled = false;
  }
}

async function copyJson() {
  if (!lastGoalJson) return;
  const text = JSON.stringify(lastGoalJson, null, 2);
  try {
    await navigator.clipboard.writeText(text);
    saveStatus.textContent = 'Copied JSON to clipboard.';
  } catch (e) {
    saveStatus.textContent = 'Copy failed (clipboard not available).';
  }
}

messageInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendGoalMessage();
  }
});

sendBtn.addEventListener('click', sendGoalMessage);
approveBtn.addEventListener('click', approveAndSave);
copyJsonBtn.addEventListener('click', copyJson);

