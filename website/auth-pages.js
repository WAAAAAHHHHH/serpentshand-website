(() => {
  'use strict';

  const setHint = (el, message, isSuccess = false) => {
    if (!el) return;
    el.textContent = message || '';
    el.classList.toggle('is-visible', !!message);
    el.classList.toggle('is-success', !!isSuccess);
  };

  /* ----------------------------------------------------------
     Login page
  ---------------------------------------------------------- */
  const loginForm = document.getElementById('login-form');
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const identifier = document.getElementById('login-identifier').value.trim();
      const password = document.getElementById('login-password').value;
      const hint = document.getElementById('login-hint');
      const submitBtn = loginForm.querySelector('button[type="submit"]');

      if (!identifier || !password) {
        setHint(hint, 'Please fill in both fields.');
        return;
      }

      submitBtn.disabled = true;
      setHint(hint, '');

      try {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ identifier, password })
        });
        const data = await res.json().catch(() => ({}));

        if (res.ok && data.success) {
          if (window.SHAuth) window.SHAuth.clearCache();
          window.location.href = '/';
        } else {
          setHint(hint, data.error || 'Failed to sign in.');
        }
      } catch (err) {
        setHint(hint, 'A network error occurred. Please try again.');
      } finally {
        submitBtn.disabled = false;
      }
    });
  }

  /* ----------------------------------------------------------
     Signup page
  ---------------------------------------------------------- */
  const signupForm = document.getElementById('signup-form');
  if (signupForm) {
    signupForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const username = document.getElementById('signup-username').value.trim();
      const email = document.getElementById('signup-email').value.trim();
      const password = document.getElementById('signup-password').value;
      const hint = document.getElementById('signup-hint');
      const submitBtn = signupForm.querySelector('button[type="submit"]');

      if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
        setHint(hint, 'Username must be 3-20 characters: letters, numbers, underscores only.');
        return;
      }
      if (password.length < 8) {
        setHint(hint, 'Password must be at least 8 characters.');
        return;
      }

      submitBtn.disabled = true;
      setHint(hint, '');

      try {
        const res = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, email, password })
        });
        const data = await res.json().catch(() => ({}));

        if (res.ok && data.success) {
          if (window.SHAuth) window.SHAuth.clearCache();
          window.location.href = '/';
        } else {
          setHint(hint, data.error || 'Failed to create account.');
        }
      } catch (err) {
        setHint(hint, 'A network error occurred. Please try again.');
      } finally {
        submitBtn.disabled = false;
      }
    });
  }

  /* ----------------------------------------------------------
     Profile / settings page
  ---------------------------------------------------------- */
  const profileContent = document.getElementById('profile-content');
  if (profileContent && window.SHAuth) {
    const signedOutMsg = document.getElementById('profile-signed-out');

    const fallbackAvatar = window.SHAuth.fallbackAvatar;

    const populate = (user) => {
      document.getElementById('profile-avatar-img').src = user.avatar_url || fallbackAvatar;
      document.getElementById('profile-display-name').textContent = user.display_name;
      document.getElementById('profile-username-handle').textContent = `@${user.username}`;
      document.getElementById('profile-post-count').textContent = user.post_count ?? 0;

      const joined = user.created_at ? new Date(user.created_at) : null;
      document.getElementById('profile-joined-date').textContent = joined
        ? joined.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
        : '—';

      document.getElementById('profile-display-name-input').value = user.display_name || '';
      document.getElementById('profile-username-input').value = user.username || '';
      document.getElementById('profile-description-input').value = user.description || '';
    };

    window.SHAuth.fetchMe().then(({ user }) => {
      if (!user) {
        signedOutMsg.hidden = false;
        return;
      }
      profileContent.hidden = false;
      populate(user);
    });

    // Edit profile fields
    const profileForm = document.getElementById('profile-form');
    profileForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const hint = document.getElementById('profile-form-hint');
      const submitBtn = profileForm.querySelector('button[type="submit"]');
      submitBtn.disabled = true;
      setHint(hint, '');

      const payload = {
        display_name: document.getElementById('profile-display-name-input').value.trim(),
        username: document.getElementById('profile-username-input').value.trim(),
        description: document.getElementById('profile-description-input').value.trim()
      };

      try {
        const res = await fetch('/api/profile/update', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const data = await res.json().catch(() => ({}));

        if (res.ok && data.success) {
          window.SHAuth.clearCache();
          setHint(hint, 'Saved.', true);
          populate({ ...data.user, post_count: document.getElementById('profile-post-count').textContent });
          // Nav still shows the old name until reload; refresh it in place.
          window.SHAuth.renderNav();
        } else {
          setHint(hint, data.error || 'Failed to save changes.');
        }
      } catch (err) {
        setHint(hint, 'A network error occurred. Please try again.');
      } finally {
        submitBtn.disabled = false;
      }
    });

    // Avatar update — URL fallback always available; file upload only
    // if the deployment has configured an R2 bucket (server tells us
    // via the error message if it hasn't, but we default to URL mode).
    const avatarForm = document.getElementById('avatar-form');
    document.getElementById('avatar-mode-note').textContent =
      'Paste a link to an image hosted elsewhere (https://…). File uploads are available if this deployment has R2 storage configured.';

    avatarForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const hint = document.getElementById('avatar-form-hint');
      const submitBtn = avatarForm.querySelector('button[type="submit"]');
      const url = document.getElementById('avatar-url-input').value.trim();

      if (!url) {
        setHint(hint, 'Enter an image URL.');
        return;
      }

      submitBtn.disabled = true;
      setHint(hint, '');

      try {
        const res = await fetch('/api/profile/avatar', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ avatar_url: url })
        });
        const data = await res.json().catch(() => ({}));

        if (res.ok && data.success) {
          window.SHAuth.clearCache();
          document.getElementById('profile-avatar-img').src = data.avatar_url;
          setHint(hint, 'Avatar updated.', true);
          window.SHAuth.renderNav();
        } else {
          setHint(hint, data.error || 'Failed to update avatar.');
        }
      } catch (err) {
        setHint(hint, 'A network error occurred. Please try again.');
      } finally {
        submitBtn.disabled = false;
      }
    });

    // Logout
    const logoutBtn = document.getElementById('profile-logout-btn');
    logoutBtn.addEventListener('click', async () => {
      try {
        await fetch('/api/auth/logout', { method: 'POST' });
      } finally {
        window.SHAuth.clearCache();
        window.location.href = '/';
      }
    });
  }
})();
