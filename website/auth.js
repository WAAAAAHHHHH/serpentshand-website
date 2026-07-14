/**
 * Shared authentication UI logic.
 * Include this on every page (index.html, login.html, signup.html, profile.html).
 * It is intentionally separate from script.js so the existing
 * ambient/nav/forum behavior in script.js is untouched.
 */
(() => {
  'use strict';

  /* ----------------------------------------------------------
     Nav auth state — replaces/augments the nav with
     Login/Signup or Account/Logout depending on session state.
  ---------------------------------------------------------- */
  const authNavSlot = document.getElementById('nav-auth-slot');

  async function fetchSession() {
    try {
      const res = await fetch('/api/auth/me', { credentials: 'same-origin' });
      if (!res.ok) return null;
      const data = await res.json();
      return data.user || null;
    } catch (err) {
      console.error('Failed to check session:', err);
      return null;
    }
  }

  function renderNavAuthSlot(user) {
    if (!authNavSlot) return;
    authNavSlot.innerHTML = '';

    if (user) {
      const accountLink = document.createElement('a');
      accountLink.href = '/profile.html';
      accountLink.textContent = 'Account';
      authNavSlot.appendChild(accountLink);
    } else {
      const loginLink = document.createElement('a');
      loginLink.href = '/login.html';
      loginLink.textContent = 'Log In';

      const signupLink = document.createElement('a');
      signupLink.href = '/signup.html';
      signupLink.textContent = 'Sign Up';

      authNavSlot.appendChild(loginLink);
      authNavSlot.appendChild(signupLink);
    }
  }

  async function initNavAuthSlot() {
    if (!authNavSlot) return;
    const user = await fetchSession();
    renderNavAuthSlot(user);
  }

  initNavAuthSlot();

  /* ----------------------------------------------------------
     Generic form-error helper
  ---------------------------------------------------------- */
  function setFormMessage(el, message, isError = true) {
    if (!el) return;
    el.textContent = message || '';
    el.classList.toggle('is-visible', Boolean(message));
    el.classList.toggle('is-error', isError);
  }

  /* ----------------------------------------------------------
     Signup form (signup.html)
  ---------------------------------------------------------- */
  const signupForm = document.getElementById('signup-form');
  if (signupForm) {
    const hint = document.getElementById('signup-hint');
    signupForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = signupForm.querySelector('#signup-email').value.trim();
      const password = signupForm.querySelector('#signup-password').value;
      const confirm = signupForm.querySelector('#signup-confirm').value;

      if (!email || !password) {
        setFormMessage(hint, 'Please enter an email and a password.');
        return;
      }
      if (password.length < 8) {
        setFormMessage(hint, 'Password must be at least 8 characters.');
        return;
      }
      if (password !== confirm) {
        setFormMessage(hint, 'Passwords do not match.');
        return;
      }

      const submitBtn = signupForm.querySelector('button[type="submit"]');
      submitBtn.disabled = true;
      setFormMessage(hint, '');

      try {
        const res = await fetch('/api/auth/signup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify({ email, password }),
        });
        const data = await res.json().catch(() => ({}));

        if (res.ok && data.success) {
          window.location.href = '/profile.html';
        } else {
          setFormMessage(hint, data.error || 'Failed to create account. Please try again.');
        }
      } catch (err) {
        console.error('Signup error:', err);
        setFormMessage(hint, 'A network error occurred. Please try again.');
      } finally {
        submitBtn.disabled = false;
      }
    });
  }

  /* ----------------------------------------------------------
     Login form (login.html)
  ---------------------------------------------------------- */
  const loginForm = document.getElementById('login-form');
  if (loginForm) {
    const hint = document.getElementById('login-hint');
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = loginForm.querySelector('#login-email').value.trim();
      const password = loginForm.querySelector('#login-password').value;

      if (!email || !password) {
        setFormMessage(hint, 'Please enter your email and password.');
        return;
      }

      const submitBtn = loginForm.querySelector('button[type="submit"]');
      submitBtn.disabled = true;
      setFormMessage(hint, '');

      try {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify({ email, password }),
        });
        const data = await res.json().catch(() => ({}));

        if (res.ok && data.success) {
          window.location.href = '/profile.html';
        } else {
          setFormMessage(hint, data.error || 'Invalid email or password.');
        }
      } catch (err) {
        console.error('Login error:', err);
        setFormMessage(hint, 'A network error occurred. Please try again.');
      } finally {
        submitBtn.disabled = false;
      }
    });
  }

  /* ----------------------------------------------------------
     Profile page (profile.html) — load user, handle logout
  ---------------------------------------------------------- */
  const profileEmailEl = document.getElementById('profile-email');
  const profileCreatedEl = document.getElementById('profile-created');
  const profileLoggedOutEl = document.getElementById('profile-logged-out');
  const profileContentEl = document.getElementById('profile-content');

  if (profileEmailEl || profileLoggedOutEl) {
    (async () => {
      const user = await fetchSession();
      if (user) {
        if (profileEmailEl) profileEmailEl.textContent = user.email;
        if (profileCreatedEl && user.created_at) {
          const d = new Date(user.created_at.replace(' ', 'T') + 'Z');
          profileCreatedEl.textContent = isNaN(d) ? '' : d.toLocaleDateString(undefined, {
            year: 'numeric', month: 'short', day: 'numeric',
          });
        }
        if (profileContentEl) profileContentEl.hidden = false;
        if (profileLoggedOutEl) profileLoggedOutEl.hidden = true;
      } else {
        if (profileContentEl) profileContentEl.hidden = true;
        if (profileLoggedOutEl) profileLoggedOutEl.hidden = false;
      }
    })();
  }

  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      logoutBtn.disabled = true;
      try {
        await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' });
      } catch (err) {
        console.error('Logout error:', err);
      } finally {
        window.location.href = '/';
      }
    });
  }
})();
