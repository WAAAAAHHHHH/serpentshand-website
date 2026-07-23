(() => {
  'use strict';

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ----------------------------------------------------------
     Preloader
  ---------------------------------------------------------- */
  const preloader = document.getElementById('preloader');
  const hidePreloader = () => {
    if (!preloader) return;
    preloader.classList.add('is-hidden');
    setTimeout(() => preloader.remove(), 800);
  };
  window.addEventListener('load', () => setTimeout(hidePreloader, 400));
  setTimeout(hidePreloader, 2500);

  /* ----------------------------------------------------------
     Footer year
  ---------------------------------------------------------- */
  const yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  /* ----------------------------------------------------------
     Nav: translucent on scroll + mobile toggle
  ---------------------------------------------------------- */
  const nav       = document.getElementById('site-nav');
  const navToggle = document.getElementById('nav-toggle');
  const navLinks  = document.getElementById('nav-links');

  const onScroll = () => {
    if (window.scrollY > 40) nav.classList.add('is-scrolled');
    else nav.classList.remove('is-scrolled');
  };
  document.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  if (navToggle && navLinks) {
    navToggle.addEventListener('click', () => {
      const isOpen = navLinks.classList.toggle('is-open');
      navToggle.setAttribute('aria-expanded', String(isOpen));
    });
    navLinks.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => {
        navLinks.classList.remove('is-open');
        navToggle.setAttribute('aria-expanded', 'false');
      });
    });
  }

  /* ----------------------------------------------------------
     Smooth scroll for in-page anchors
  ---------------------------------------------------------- */
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', e => {
      const targetId = anchor.getAttribute('href');
      if (!targetId || targetId === '#') return;
      const target = document.querySelector(targetId);
      if (!target) return;
      e.preventDefault();
      target.scrollIntoView({ behavior: prefersReducedMotion ? 'auto' : 'smooth', block: 'start' });
      target.setAttribute('tabindex', '-1');
      target.focus({ preventScroll: true });
    });
  });

  /* ----------------------------------------------------------
     Scroll reveal via IntersectionObserver
  ---------------------------------------------------------- */
  const revealEls = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window && revealEls.length) {
    const io = new IntersectionObserver(
      entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15, rootMargin: '0px 0px -60px 0px' }
    );
    revealEls.forEach(el => io.observe(el));
  } else {
    revealEls.forEach(el => el.classList.add('is-visible'));
  }

  /* ----------------------------------------------------------
     Mouse light effect
  ---------------------------------------------------------- */
  const mouseLight = document.getElementById('mouse-light');
  if (mouseLight && window.matchMedia('(hover: hover)').matches) {
    window.addEventListener('pointermove', e => {
      mouseLight.style.setProperty('--mx', `${e.clientX}px`);
      mouseLight.style.setProperty('--my', `${e.clientY}px`);
    });
  }

  /* ----------------------------------------------------------
     Floating dust particles (canvas)
  ---------------------------------------------------------- */
  const canvas = document.getElementById('dust-canvas');
  if (canvas && !prefersReducedMotion) {
    const ctx = canvas.getContext('2d');
    let width, height, particles;
    const PARTICLE_COUNT = window.innerWidth < 768 ? 35 : 70;

    const resize = () => {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };

    const makeParticle = () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      r: Math.random() * 1.6 + 0.4,
      speedY: Math.random() * 0.25 + 0.05,
      speedX: (Math.random() - 0.5) * 0.15,
      alpha: Math.random() * 0.5 + 0.15,
      flicker: Math.random() * 0.02 + 0.005,
    });

    const init = () => {
      resize();
      particles = Array.from({ length: PARTICLE_COUNT }, makeParticle);
    };

    let rafId;
    const draw = () => {
      ctx.clearRect(0, 0, width, height);
      particles.forEach(p => {
        p.y -= p.speedY;
        p.x += p.speedX;
        p.alpha += (Math.random() - 0.5) * p.flicker;
        p.alpha = Math.max(0.05, Math.min(0.65, p.alpha));

        if (p.y < -10) { p.y = height + 10; p.x = Math.random() * width; }
        if (p.x < -10) p.x = width + 10;
        if (p.x > width + 10) p.x = -10;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(120, 220, 170, ${p.alpha})`;
        ctx.shadowBlur = 6;
        ctx.shadowColor = 'rgba(79, 217, 154, 0.6)';
        ctx.fill();
      });
      rafId = requestAnimationFrame(draw);
    };

    init();
    draw();

    let resizeTimeout;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => { cancelAnimationFrame(rafId); init(); draw(); }, 200);
    });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) cancelAnimationFrame(rafId);
      else draw();
    });
  }

  /* ----------------------------------------------------------
     Bulletin — cycling announcements, dismissible for the visit
  ---------------------------------------------------------- */
  const ANNOUNCEMENTS = [
    'New artifact catalogued: Verdigris (SH‑0004) — status Active.',
    'The Reading Room is open below. Entries are visible to everyone.',
    'Maintenance note: the fog generator was recalibrated. Nothing to report.',
    'Sealed Channels updated — Threads correspondence now accepted.',
  ];

  (() => {
    const bulletin    = document.getElementById('bulletin');
    const bulletinText = document.getElementById('bulletin-text');
    const dismissBtn  = document.getElementById('bulletin-dismiss');
    if (!bulletin || !bulletinText || !dismissBtn) return;

    const DISMISS_KEY = 'archive_bulletin_dismissed';
    let dismissed = false;
    try { dismissed = sessionStorage.getItem(DISMISS_KEY) === '1'; } catch { dismissed = false; }

    if (dismissed) {
      bulletin.classList.add('is-dismissed');
      bulletin.setAttribute('aria-hidden', 'true');
    } else {
      let i = 0;
      bulletinText.textContent = ANNOUNCEMENTS[0];
      if (!prefersReducedMotion && ANNOUNCEMENTS.length > 1) {
        setInterval(() => {
          bulletinText.classList.add('is-fading');
          setTimeout(() => {
            i = (i + 1) % ANNOUNCEMENTS.length;
            bulletinText.textContent = ANNOUNCEMENTS[i];
            bulletinText.classList.remove('is-fading');
          }, 350);
        }, 6000);
      }
    }

    dismissBtn.addEventListener('click', () => {
      bulletin.classList.add('is-dismissed');
      bulletin.setAttribute('aria-hidden', 'true');
      try { sessionStorage.setItem(DISMISS_KEY, '1'); } catch { /* unavailable */ }
    });
  })();

  /* ===========================================================
     AUTH — initialise user state
  =========================================================== */

  /** Global: the currently logged-in user, or null. */
  window.__currentUser = null;

  /**
   * Fetch the current session from the server.
   * Populates window.__currentUser and updates the nav UI.
   * @returns {Promise<object|null>}
   */
  async function initAuth() {
    try {
      const res = await fetch('/api/auth/me');
      if (res.ok) {
        const data = await res.json();
        window.__currentUser = data.user;
      }
    } catch {
      // Network error — treat as logged out
    }
    renderNavAuth(window.__currentUser);
    return window.__currentUser;
  }

  /**
   * Render the auth portion of the navigation bar.
   * When logged in: avatar thumbnail + display name + dropdown (Profile, Sign Out).
   * When logged out: Sign In and Sign Up pill buttons.
   * @param {object|null} user
   */
  function renderNavAuth(user) {
    const area = document.getElementById('nav-user-area');
    if (!area) return;

    if (user) {
      const initials = (user.display_name || user.username || '?').charAt(0).toUpperCase();
      area.innerHTML = `
        <div class="nav__user" id="nav-user-menu">
          <button class="nav__user-btn" id="nav-user-btn" aria-haspopup="true" aria-expanded="false" aria-label="User menu for ${user.display_name || user.username}">
            ${user.avatar_url
              ? `<img src="${user.avatar_url}" alt="" class="nav__user-avatar" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">`
              : ''}
            <span class="nav__user-initials" style="${user.avatar_url ? 'display:none' : ''}">${initials}</span>
            <span class="nav__user-name">${user.display_name || user.username}</span>
            <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true"><path d="M1 3l4 4 4-4" stroke="currentColor" stroke-width="1.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </button>
          <div class="nav__user-dropdown" id="nav-user-dropdown" role="menu" hidden>
            <a href="/profile.html" class="nav__user-item" role="menuitem">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>
              Profile &amp; Settings
            </a>
            <button class="nav__user-item nav__user-item--logout" id="nav-logout-btn" role="menuitem">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
              Sign Out
            </button>
          </div>
        </div>
      `;

      // Toggle dropdown
      const userBtn      = document.getElementById('nav-user-btn');
      const userDropdown = document.getElementById('nav-user-dropdown');
      userBtn.addEventListener('click', e => {
        e.stopPropagation();
        const open = userDropdown.hidden;
        userDropdown.hidden = !open;
        userBtn.setAttribute('aria-expanded', String(open));
      });
      document.addEventListener('click', () => {
        userDropdown.hidden = true;
        userBtn.setAttribute('aria-expanded', 'false');
      });

      // Logout
      document.getElementById('nav-logout-btn').addEventListener('click', async () => {
        try { await fetch('/api/auth/logout', { method: 'POST' }); } catch { /* best effort */ }
        window.__currentUser = null;
        window.location.reload();
      });
    } else {
      area.innerHTML = `
        <div class="nav__auth-btns">
          <a href="/login.html" class="nav__auth-btn nav__auth-btn--in">Sign In</a>
          <a href="/signup.html" class="nav__auth-btn nav__auth-btn--up">Sign Up</a>
        </div>
      `;
    }
  }

  /* ===========================================================
     FORUM — "The Reading Room"
  =========================================================== */
  (() => {
    const threadList    = document.getElementById('forum-threads');
    const emptyState    = document.getElementById('forum-empty');
    const newThreadForm = document.getElementById('forum-new-thread');
    const guestNotice   = document.getElementById('forum-guest-notice');
    const formHint      = document.getElementById('forum-form-hint');
    const authorPreview = document.getElementById('forum-author-preview');

    if (!threadList) return;

    let threads       = [];
    let searchQuery   = '';

    // ------------------------------------------------------------------
    // Show / hide posting form based on auth state
    // ------------------------------------------------------------------
    function updateForumUI(user) {
      if (!newThreadForm || !guestNotice) return;
      if (user) {
        newThreadForm.hidden = false;
        guestNotice.hidden   = true;
        // Show author preview inside the form
        if (authorPreview) {
          const initials = (user.display_name || user.username || '?').charAt(0).toUpperCase();
          authorPreview.innerHTML = `
            <div class="forum__author forum__author--preview">
              ${user.avatar_url
                ? `<img src="${user.avatar_url}" alt="" class="forum__author-avatar" onerror="this.style.display='none'">`
                : `<div class="forum__author-initials">${initials}</div>`
              }
              <span class="forum__author-name">Posting as <strong>${user.display_name || user.username}</strong></span>
            </div>
          `;
        }
      } else {
        newThreadForm.hidden = true;
        guestNotice.hidden   = false;
      }
    }

    // ------------------------------------------------------------------
    // Load threads from API
    // ------------------------------------------------------------------
    const loadThreads = async () => {
      try {
        const response = await fetch('/api/messages');
        if (response.ok) {
          threads = await response.json();
          render();
        } else {
          console.error('Failed to load threads from server.');
        }
      } catch (err) {
        console.error('Network error loading threads:', err);
      }
    };

    // ------------------------------------------------------------------
    // Search
    // ------------------------------------------------------------------
    const searchInput = document.getElementById('forum-search-input');
    if (searchInput) {
      searchInput.addEventListener('input', e => {
        searchQuery = e.target.value.toLowerCase();
        render();
      });
    }

    // ------------------------------------------------------------------
    // Helpers
    // ------------------------------------------------------------------
    const formatTime = ts => {
      const d = new Date(ts);
      const now = Date.now();
      const diffMin = Math.round((now - ts) / 60000);
      if (diffMin < 1) return 'just now';
      if (diffMin < 60) return `${diffMin}m ago`;
      const diffHr = Math.round(diffMin / 60);
      if (diffHr < 24) return `${diffHr}h ago`;
      const diffDay = Math.round(diffHr / 24);
      if (diffDay < 7) return `${diffDay}d ago`;
      return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
    };

    const sanitizeInput = value => value.trim().slice(0, 600);

    /**
     * Build the author avatar element for a post.
     * @param {object|null} author  Author object from the API, or null for anonymous.
     * @param {string} fallbackName  Name string to show if no author object.
     * @returns {HTMLElement}
     */
    function buildAuthorEl(author, fallbackName) {
      const wrap = document.createElement('div');
      wrap.className = 'forum__author';

      if (author) {
        const initials = (author.display_name || author.username || '?').charAt(0).toUpperCase();
        if (author.avatar_url) {
          const img = document.createElement('img');
          img.src = author.avatar_url;
          img.alt = '';
          img.className = 'forum__author-avatar';
          img.onerror = () => img.replaceWith(makeInitialsEl(initials));
          wrap.appendChild(img);
        } else {
          wrap.appendChild(makeInitialsEl(initials));
        }
        const nameEl = document.createElement('span');
        nameEl.className = 'forum__author-name';
        const strong = document.createElement('strong');
        strong.textContent = author.display_name || author.username;
        nameEl.appendChild(strong);
        if (author.username) {
          const handle = document.createElement('span');
          handle.className = 'forum__author-handle';
          handle.textContent = '@' + author.username;
          nameEl.appendChild(handle);
        }
        wrap.appendChild(nameEl);
      } else {
        // Anonymous / legacy post
        wrap.appendChild(makeInitialsEl('?'));
        const nameEl = document.createElement('span');
        nameEl.className = 'forum__author-name';
        const strong = document.createElement('strong');
        strong.textContent = fallbackName || 'Anonymous';
        nameEl.appendChild(strong);
        wrap.appendChild(nameEl);
      }
      return wrap;
    }

    function makeInitialsEl(letter) {
      const el = document.createElement('div');
      el.className = 'forum__author-initials';
      el.textContent = letter;
      return el;
    }

    // ------------------------------------------------------------------
    // Render all threads
    // ------------------------------------------------------------------
    const render = () => {
      threadList.innerHTML = '';
      const user = window.__currentUser;

      if (!threads.length) {
        emptyState.hidden = false;
        return;
      }
      emptyState.hidden = true;

      const sorted = [...threads].sort((a, b) => b.time - a.time);

      sorted.forEach(thread => {
        if (searchQuery) {
          const matchName    = thread.name.toLowerCase().includes(searchQuery);
          const matchSubject = thread.subject.toLowerCase().includes(searchQuery);
          const matchBody    = thread.body.toLowerCase().includes(searchQuery);
          if (!matchName && !matchSubject && !matchBody) return;
        }

        const li = document.createElement('li');
        li.className = 'forum__thread';
        li.dataset.id = thread.id;

        // ---- Thread header ----
        const head = document.createElement('div');
        head.className = 'forum__thread-head';

        const subject = document.createElement('h3');
        subject.className = 'forum__thread-subject';
        subject.textContent = thread.subject;

        const timeMeta = document.createElement('span');
        timeMeta.className = 'forum__thread-time';
        timeMeta.textContent = formatTime(thread.time);

        head.appendChild(subject);
        head.appendChild(timeMeta);

        // ---- Author row ----
        const authorEl = buildAuthorEl(thread.author, thread.name);

        // ---- Body ----
        const body = document.createElement('p');
        body.className = 'forum__thread-body';
        body.textContent = thread.body;

        // ---- Action buttons (edit/delete — own posts only) ----
        const isOwner = user && thread.author && thread.author.id === user.id;
        let actionsEl = null;
        if (isOwner) {
          actionsEl = document.createElement('div');
          actionsEl.className = 'forum__actions';

          const editBtn = document.createElement('button');
          editBtn.type = 'button';
          editBtn.className = 'forum__action-btn forum__action-btn--edit';
          editBtn.setAttribute('aria-label', 'Edit post');
          editBtn.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4Z"/></svg><span>Edit</span>`;
          editBtn.addEventListener('click', () => startEdit(li, thread, body));

          const deleteBtn = document.createElement('button');
          deleteBtn.type = 'button';
          deleteBtn.className = 'forum__action-btn forum__action-btn--delete';
          deleteBtn.setAttribute('aria-label', 'Delete post');
          deleteBtn.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg><span>Delete</span>`;
          deleteBtn.addEventListener('click', () => deleteThread(thread.id, li));

          actionsEl.appendChild(editBtn);
          actionsEl.appendChild(deleteBtn);
        }

        // ---- Reply toggle ----
        const toggle = document.createElement('button');
        toggle.type = 'button';
        toggle.className = 'forum__toggle';
        toggle.setAttribute('aria-expanded', 'false');
        const replyCount = thread.replies ? thread.replies.length : 0;
        toggle.innerHTML = `<span>${replyCount === 1 ? '1 reply' : `${replyCount} replies`}</span>
          <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true"><path d="M1 3l4 4 4-4" stroke="currentColor" stroke-width="1.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

        // ---- Replies section ----
        const repliesWrap = document.createElement('div');
        repliesWrap.className = 'forum__replies';

        (thread.replies || []).forEach(reply => {
          repliesWrap.appendChild(buildReplyEl(reply));
        });

        // ---- Reply form (auth-gated) ----
        if (user) {
          const replyForm = buildReplyForm(thread, repliesWrap, toggle);
          repliesWrap.appendChild(replyForm);
        } else {
          const signInPrompt = document.createElement('p');
          signInPrompt.className = 'forum__reply-signin';
          signInPrompt.innerHTML = `<a href="/login.html?next=/#forum">Sign in to reply</a>`;
          repliesWrap.appendChild(signInPrompt);
        }

        toggle.addEventListener('click', () => {
          const isOpen = repliesWrap.classList.toggle('is-open');
          toggle.setAttribute('aria-expanded', String(isOpen));
        });

        li.appendChild(head);
        li.appendChild(authorEl);
        li.appendChild(body);
        if (actionsEl) li.appendChild(actionsEl);
        li.appendChild(toggle);
        li.appendChild(repliesWrap);
        threadList.appendChild(li);
      });
    };

    // ------------------------------------------------------------------
    // Build a single reply element
    // ------------------------------------------------------------------
    function buildReplyEl(reply) {
      const replyEl = document.createElement('div');
      replyEl.className = 'forum__reply';

      const replyAuthor = buildAuthorEl(reply.author || null, reply.name);
      replyAuthor.classList.add('forum__reply-author');

      const replyTimeMeta = document.createElement('span');
      replyTimeMeta.className = 'forum__reply-time';
      replyTimeMeta.textContent = formatTime(reply.time);
      replyAuthor.appendChild(replyTimeMeta);

      const replyBody = document.createElement('p');
      replyBody.className = 'forum__reply-body';
      replyBody.textContent = reply.body;

      replyEl.appendChild(replyAuthor);
      replyEl.appendChild(replyBody);
      return replyEl;
    }

    // ------------------------------------------------------------------
    // Build a reply form for an authenticated user
    // ------------------------------------------------------------------
    function buildReplyForm(thread, repliesWrap, toggle) {
      const replyForm = document.createElement('form');
      replyForm.className = 'forum__reply-form';
      replyForm.setAttribute('aria-label', `Reply to ${thread.subject}`);
      replyForm.innerHTML = `
        <textarea rows="2" maxlength="400" placeholder="Write a reply…" required aria-label="Reply text"></textarea>
        <button type="submit" class="forum__reply-submit">Reply</button>
      `;

      replyForm.addEventListener('submit', async e => {
        e.preventDefault();
        const bodyInput = replyForm.querySelector('textarea');
        const replyBody = sanitizeInput(bodyInput.value);
        if (!replyBody) return;

        const submitBtn = replyForm.querySelector('button[type="submit"]');
        submitBtn.disabled = true;
        submitBtn.textContent = 'Sending...';

        try {
          const response = await fetch(`/api/messages/${thread.id}/reply`, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ body: replyBody }),
          });

          if (response.ok) {
            const result = await response.json();
            if (result.success) {
              const target = threads.find(t => t.id === thread.id);
              if (target) {
                if (!target.replies) target.replies = [];
                target.replies.push(result.reply);
              }
              // Insert the new reply element before the form
              const newReplyEl = buildReplyEl(result.reply);
              repliesWrap.insertBefore(newReplyEl, replyForm);
              // Update reply count on toggle button
              const newCount = (thread.replies || []).length;
              toggle.querySelector('span').textContent = newCount === 1 ? '1 reply' : `${newCount} replies`;
              bodyInput.value = '';
            }
          } else if (response.status === 401) {
            window.location.href = '/login.html?next=/#forum';
          } else {
            alert('Failed to send reply. Please try again.');
          }
        } catch (err) {
          console.error('Error posting reply:', err);
          alert('A network error occurred.');
        } finally {
          submitBtn.disabled = false;
          submitBtn.textContent = 'Reply';
        }
      });

      return replyForm;
    }

    // ------------------------------------------------------------------
    // Edit a thread (inline)
    // ------------------------------------------------------------------
    function startEdit(li, thread, bodyEl) {
      // Prevent double-edit
      if (li.querySelector('.forum__edit-form')) return;

      const editForm = document.createElement('form');
      editForm.className = 'forum__edit-form';
      editForm.innerHTML = `
        <textarea class="forum__edit-textarea" rows="3" maxlength="600" aria-label="Edit entry">${thread.body}</textarea>
        <div class="forum__edit-actions">
          <button type="submit" class="forum__action-btn forum__action-btn--save">Save</button>
          <button type="button" class="forum__action-btn forum__action-btn--cancel">Cancel</button>
        </div>
      `;

      bodyEl.hidden = true;
      li.insertBefore(editForm, bodyEl.nextSibling);

      editForm.querySelector('[type=button]').addEventListener('click', () => {
        editForm.remove();
        bodyEl.hidden = false;
      });

      editForm.addEventListener('submit', async e => {
        e.preventDefault();
        const newBody = sanitizeInput(editForm.querySelector('textarea').value);
        if (!newBody) return;

        const saveBtn = editForm.querySelector('[type=submit]');
        saveBtn.disabled = true;
        saveBtn.textContent = 'Saving…';

        try {
          const res = await fetch(`/api/messages/${thread.id}`, {
            method:  'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ body: newBody }),
          });
          if (res.ok) {
            thread.body = newBody;
            bodyEl.textContent = newBody;
            bodyEl.hidden = false;
            editForm.remove();
          } else {
            const data = await res.json().catch(() => ({}));
            alert(data.error || 'Edit failed.');
            saveBtn.disabled = false;
            saveBtn.textContent = 'Save';
          }
        } catch {
          alert('A network error occurred.');
          saveBtn.disabled = false;
          saveBtn.textContent = 'Save';
        }
      });
    }

    // ------------------------------------------------------------------
    // Delete a thread
    // ------------------------------------------------------------------
    async function deleteThread(threadId, li) {
      if (!confirm('Delete this entry? This cannot be undone.')) return;
      try {
        const res = await fetch(`/api/messages/${threadId}`, { method: 'DELETE' });
        if (res.ok) {
          threads = threads.filter(t => t.id !== threadId);
          li.style.transition = 'opacity 300ms ease, transform 300ms ease';
          li.style.opacity = '0';
          li.style.transform = 'translateX(-10px)';
          setTimeout(() => {
            li.remove();
            if (!threads.length) emptyState.hidden = false;
          }, 310);
        } else {
          const data = await res.json().catch(() => ({}));
          alert(data.error || 'Delete failed.');
        }
      } catch {
        alert('A network error occurred.');
      }
    }

    // ------------------------------------------------------------------
    // New thread form submission
    // ------------------------------------------------------------------
    if (newThreadForm) {
      newThreadForm.addEventListener('submit', async e => {
        e.preventDefault();
        const subject = sanitizeInput(newThreadForm.querySelector('#thread-subject').value).slice(0, 80);
        const body    = sanitizeInput(newThreadForm.querySelector('#thread-body').value);

        if (!subject || !body) {
          if (formHint) {
            formHint.textContent = 'Fill in a subject and an entry before submitting.';
            formHint.classList.add('is-visible');
          }
          return;
        }
        if (formHint) { formHint.textContent = ''; formHint.classList.remove('is-visible'); }

        const submitBtn = document.getElementById('forum-submit-btn');
        if (submitBtn) submitBtn.disabled = true;
        const btnSpan = submitBtn ? submitBtn.querySelector('span') : null;
        if (btnSpan) btnSpan.textContent = 'Sending...';

        try {
          const response = await fetch('/api/messages', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ subject, body }),
          });

          if (response.ok) {
            const result = await response.json();
            if (result.success && result.thread) {
              threads.push(result.thread);
              newThreadForm.reset();
              render();
            }
          } else if (response.status === 401) {
            window.location.href = '/login.html?next=/#forum';
          } else {
            const errorData = await response.json().catch(() => ({}));
            if (formHint) {
              formHint.textContent = errorData.error || 'Failed to submit entry. Please try again.';
              formHint.classList.add('is-visible');
            }
          }
        } catch (err) {
          console.error('Error posting thread:', err);
          if (formHint) {
            formHint.textContent = 'A network error occurred. Please try again.';
            formHint.classList.add('is-visible');
          }
        } finally {
          if (submitBtn) submitBtn.disabled = false;
          if (btnSpan) btnSpan.textContent = 'Leave Entry';
        }
      });
    }

    // ------------------------------------------------------------------
    // Bootstrap: init auth, then load threads
    // ------------------------------------------------------------------
    initAuth().then(user => {
      updateForumUI(user);
      loadThreads();
    });

  })(); // end Forum IIFE

  /* ===========================================================
     PROJECTS
  =========================================================== */
  (() => {
    const path = window.location.pathname;
    
    // Utilities
    const formatDate = (iso) => {
      if (!iso) return '—';
      return new Date(iso).toLocaleDateString(undefined, {
        year: 'numeric', month: 'short', day: 'numeric'
      });
    };

    // Wait for auth to initialize before doing auth-dependent UI
    const runAfterAuth = (callback) => {
      if (window.__currentUser !== undefined) {
        callback();
      } else {
        setTimeout(() => runAfterAuth(callback), 100);
      }
    };

    // 1. Projects listing
    if (path.includes('projects.html')) {
      const grid = document.getElementById('projects-grid');
      const searchInput = document.getElementById('projects-search-input');
      const createBtn = document.getElementById('create-project-btn');
      const emptyState = document.getElementById('projects-empty');

      const fetchProjects = async (query = '') => {
        try {
          const res = await fetch(`/api/projects\${query ? '?q=' + encodeURIComponent(query) : ''}`);
          const projects = await res.json();
          grid.innerHTML = '';
          if (projects.length === 0) {
            emptyState.hidden = false;
          } else {
            emptyState.hidden = true;
            projects.forEach(p => {
              grid.innerHTML += \`
                <a href="/project.html?slug=\${p.slug}" class="project-card" style="display: block; background: #111; padding: 1.5rem; border-radius: 8px; text-decoration: none; border: 1px solid #222; transition: border-color 0.2s;">
                  \${p.icon_url ? \`<img src="\${p.icon_url}" style="width: 64px; height: 64px; border-radius: 12px; object-fit: cover; margin-bottom: 1rem;">\` : ''}
                  <h3 style="color: #fff; margin: 0 0 0.5rem 0; font-family: 'Inter', sans-serif;">\${p.title}</h3>
                  <p style="color: #888; font-size: 0.9rem; margin: 0 0 1rem 0; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden;">\${p.description_short}</p>
                  <div style="display: flex; justify-content: space-between; font-size: 0.8rem; font-family: 'JetBrains Mono', monospace; color: #555;">
                    <span>\${p.status}</span>
                    <span>\${p.progress}%</span>
                  </div>
                  <div class="progress-bar" style="width: 100%; height: 4px; background: #222; margin-top: 0.5rem; border-radius: 2px; overflow: hidden;">
                    <div class="progress-fill" style="width: \${p.progress}%; height: 100%; background: #00ff88;"></div>
                  </div>
                </a>
              \`;
            });
          }
        } catch (e) {
          console.error(e);
        }
      };

      if (searchInput) {
        searchInput.addEventListener('input', (e) => fetchProjects(e.target.value));
      }
      fetchProjects();

      runAfterAuth(() => {
        if (window.__currentUser) createBtn.style.display = 'inline-block';
      });
    }

    // 2. Create Project
    if (path.includes('create-project.html')) {
      runAfterAuth(() => {
        if (window.__currentUser === null) {
          window.location.replace('/login.html?next=/create-project.html');
        }
      });

      const form = document.getElementById('create-project-form');
      if (form) {
        form.addEventListener('submit', async (e) => {
          e.preventDefault();
          const hint = document.getElementById('cp-hint');
          hint.textContent = '';
          
          const payload = {
            title: document.getElementById('cp-title').value,
            description_short: document.getElementById('cp-desc-short').value,
            description_full: document.getElementById('cp-desc-full').value,
            category: document.getElementById('cp-category').value,
            tags: document.getElementById('cp-tags').value,
            banner_url: document.getElementById('cp-banner').value,
            icon_url: document.getElementById('cp-icon').value,
            visibility: document.getElementById('cp-visibility').value
          };

          const btn = document.getElementById('cp-submit-btn');
          btn.disabled = true;

          try {
            const res = await fetch('/api/projects', {
              method: 'POST',
              headers: {'Content-Type': 'application/json'},
              body: JSON.stringify(payload)
            });
            const data = await res.json();
            if (res.ok) {
              window.location.href = \`/project.html?slug=\${data.slug}\`;
            } else {
              hint.textContent = data.error || 'Failed to create project.';
              btn.disabled = false;
            }
          } catch (err) {
            hint.textContent = 'Network error.';
            btn.disabled = false;
          }
        });
      }
    }

    // 3. Project Page
    if (path.includes('project.html')) {
      const params = new URLSearchParams(window.location.search);
      const slug = params.get('slug');
      if (!slug) return window.location.replace('/projects.html');

      const loadProject = async () => {
        try {
          const res = await fetch(\`/api/projects/\${slug}\`);
          if (!res.ok) return window.location.replace('/projects.html');
          const p = await res.json();
          
          document.title = p.title + ' — Kiwi';
          document.getElementById('proj-title').textContent = p.title;
          document.getElementById('proj-owner').textContent = p.owner_display_name;
          document.getElementById('proj-category').textContent = p.category;
          document.getElementById('proj-status').textContent = p.status;
          document.getElementById('proj-desc-full').textContent = p.description_full;
          document.getElementById('proj-tags').textContent = p.tags ? p.tags.split(',').map(t => '#' + t.trim()).join(' ') : '';
          document.getElementById('proj-progress-text').textContent = p.progress + '%';
          document.getElementById('proj-progress-fill').style.width = p.progress + '%';

          if (p.banner_url) {
            const b = document.getElementById('proj-banner');
            b.src = p.banner_url;
            b.style.display = 'block';
          }
          if (p.icon_url) {
            const i = document.getElementById('proj-icon');
            i.src = p.icon_url;
            i.style.display = 'block';
          }

          // Members
          const membersList = document.getElementById('proj-members');
          membersList.innerHTML = p.members.map(m => \`
            <li style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem;">
              \${m.avatar_url ? \`<img src="\${m.avatar_url}" style="width:24px;height:24px;border-radius:50%">\` : ''}
              <strong>\${m.display_name}</strong> <span style="color:#888;font-size:0.8rem">(\${m.role})</span>
            </li>
          \`).join('');

          // Devlog
          const devlogContainer = document.getElementById('proj-devlog');
          if (p.updates && p.updates.length > 0) {
            devlogContainer.innerHTML = p.updates.map(u => \`
              <div class="devlog-post">
                <h4>\${u.title}</h4>
                <span class="date">\${formatDate(u.created_at)}</span>
                <p style="white-space: pre-wrap; font-size: 0.95rem; color: #ccc;">\${u.content}</p>
                \${u.image_url ? \`<img src="\${u.image_url}" alt="Update image">\` : ''}
              </div>
            \`).join('');
          } else {
            devlogContainer.innerHTML = '<p class="forum__empty">No updates yet.</p>';
          }

          // Gallery
          const gallery = document.getElementById('proj-gallery');
          if (p.gallery && p.gallery.length > 0) {
            gallery.innerHTML = p.gallery.map(g => \`<a href="\${g.image_url}" target="_blank"><img src="\${g.image_url}" alt="Gallery image"></a>\`).join('');
          }

          // Downloads
          const downloads = document.getElementById('proj-downloads');
          if (p.downloads && p.downloads.length > 0) {
            downloads.innerHTML = p.downloads.map(d => \`
              <a href="\${d.url}" class="download-item" target="_blank">
                <strong>\${d.name}</strong>
                <p>\${d.description || ''}</p>
              </a>
            \`).join('');
          }

          // Roadmap
          const roadmap = document.getElementById('proj-roadmap');
          if (p.roadmap && p.roadmap.length > 0) {
            roadmap.innerHTML = p.roadmap.map(r => {
              const sClass = r.status.toLowerCase().replace(' ', '-');
              return \`
                <div class="roadmap-item">
                  <div style="display: flex; justify-content: space-between; margin-bottom: 0.3rem;">
                    <strong>\${r.title}</strong>
                    <span class="roadmap-status status-\${sClass}">\${r.status}</span>
                  </div>
                  <p style="margin:0; font-size: 0.85rem; color: #aaa;">\${r.description || ''}</p>
                </div>
              \`;
            }).join('');
          }

          // Owner features
          runAfterAuth(() => {
            if (window.__currentUser && window.__currentUser.id === p.owner_id) {
              document.getElementById('owner-actions').style.display = 'flex';
              document.getElementById('btn-add-download').style.display = 'inline-block';
              document.getElementById('btn-add-roadmap').style.display = 'inline-block';
              document.getElementById('btn-add-gallery').style.display = 'inline-block';
            }
          });
        } catch(e) { console.error(e); }
      };

      loadProject();

      // Form toggles
      const setupToggle = (btnId, formId) => {
        const btn = document.getElementById(btnId);
        const form = document.getElementById(formId);
        if(btn && form) {
          btn.addEventListener('click', () => {
            form.classList.toggle('active');
          });
        }
      };
      setupToggle('btn-add-update', 'devlog-form-container');
      setupToggle('btn-add-download', 'download-form-container');
      setupToggle('btn-add-roadmap', 'roadmap-form-container');
      setupToggle('btn-add-gallery', 'gallery-form-container');

      // Handlers
      const submitForm = async (btnId, endpoint, payloadFn) => {
        const btn = document.getElementById(btnId);
        if(!btn) return;
        btn.addEventListener('click', async () => {
          btn.disabled = true;
          try {
            const res = await fetch(\`/api/projects/\${slug}/\${endpoint}\`, {
              method: 'POST',
              headers: {'Content-Type': 'application/json'},
              body: JSON.stringify(payloadFn())
            });
            if(res.ok) {
              window.location.reload();
            } else {
              alert('Failed to save.');
              btn.disabled = false;
            }
          } catch {
            alert('Error.');
            btn.disabled = false;
          }
        });
      };

      submitForm('btn-submit-devlog', 'updates', () => ({
        title: document.getElementById('devlog-title').value,
        content: document.getElementById('devlog-content').value,
        image_url: document.getElementById('devlog-image').value
      }));
      submitForm('btn-submit-download', 'downloads', () => ({
        name: document.getElementById('download-name').value,
        description: document.getElementById('download-desc').value,
        url: document.getElementById('download-url').value
      }));
      submitForm('btn-submit-roadmap', 'roadmap', () => ({
        title: document.getElementById('roadmap-title').value,
        description: document.getElementById('roadmap-desc').value,
        status: document.getElementById('roadmap-status').value
      }));
      submitForm('btn-submit-gallery', 'gallery', () => ({
        image_url: document.getElementById('gallery-url').value,
        display_order: 0
      }));
    }
  })(); // end Projects IIFE

})();
