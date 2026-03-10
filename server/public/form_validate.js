// Client-side validation for health coach register and login forms.
// Rules match server: name (non-empty string), email (valid format), password (min 8 chars).

// form_validate.js - client-side validation for health coach register and login forms.
// Will be necessary when we build frontend register/login pages.  - Collin

function checkType(x, type) {
  if (x === undefined || x === null) throw new Error('All fields must be filled.');
  if (typeof x !== type) throw new Error(`Input is not of expected type ${type}.`);
  if (type === 'string') {
    const trimmed = String(x).trim();
    if (trimmed.length === 0) throw new Error('Fields cannot be empty or only spaces.');
    return trimmed;
  }
  return x;
}

function checkEmailClient(email) {
  const str = checkType(email, 'string');
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(str)) throw new Error('Invalid email format.');
  return str;
}

function checkPasswordClient(password) {
  const str = checkType(password, 'string');
  if (str.length < 8) throw new Error('Password must be at least 8 characters long.');
  return str;
}

(function () {
  const loginForm = document.getElementById('signin-form');
  const registerForm = document.getElementById('signup-form');
  const errorEl = document.getElementById('error');

  if (loginForm && errorEl) {
    loginForm.addEventListener('submit', (event) => {
      event.preventDefault();
      try {
        const emailInput = document.getElementById('email');
        const passwordInput = document.getElementById('password');
        errorEl.hidden = true;
        checkEmailClient(emailInput.value);
        checkPasswordClient(passwordInput.value);
        loginForm.submit();
      } catch (e) {
        errorEl.textContent = e.message;
        errorEl.hidden = false;
        if (document.getElementById('email')) document.getElementById('email').focus();
      }
    });
  }

  if (registerForm && errorEl) {
    registerForm.addEventListener('submit', (event) => {
      event.preventDefault();
      try {
        const nameInput = document.getElementById('name');
        const emailInput = document.getElementById('email');
        const passwordInput = document.getElementById('password');
        const confirmInput = document.getElementById('confirmPassword');
        errorEl.hidden = true;

        const missing = [];
        if (!nameInput?.value?.trim()) missing.push('Name');
        if (!emailInput?.value?.trim()) missing.push('Email');
        if (!passwordInput?.value) missing.push('Password');
        if (!confirmInput?.value) missing.push('Confirm Password');
        if (missing.length > 0) throw new Error(`Missing fields: ${missing.join(', ')}`);

        const name = checkType(nameInput.value, 'string');
        checkEmailClient(emailInput.value);
        const password = checkPasswordClient(passwordInput.value);
        const confirmPassword = checkType(confirmInput.value, 'string');
        if (password !== confirmPassword) throw new Error('Password and Confirm Password do not match.');

        registerForm.submit();
      } catch (e) {
        errorEl.textContent = e.message;
        errorEl.hidden = false;
        if (document.getElementById('name')) document.getElementById('name').focus();
      }
    });
  }
})();
