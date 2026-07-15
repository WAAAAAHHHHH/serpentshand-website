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
  // Safety net in case 'load' is delayed
  setTimeout(hidePreloader, 2500);

  /* ----------------------------------------------------------
     Footer year
  ---------------------------------------------------------- */
  const yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  /* ----------------------------------------------------------
     Nav: translucent on scroll + mobile toggle
  ---------------------------------------------------------- */
  const nav = document.getElementById('site-nav');
  const navToggle = document.getElementById('nav-toggle');
  const navLinks = document.getElementById('nav-links');

  const onScroll = () => {
    if (!nav) return;
    if (window.scrollY > 40) {
      nav.classList.add('is-scrolled');
    } else {
      nav.classList.remove('is-scrolled');
    }
  };
  document.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  if (navToggle && navLinks) {
    navToggle.addEventListener('click', () => {
      const isOpen = navLinks.classList.toggle('is-open');
      navToggle.setAttribute('aria-expanded', String(isOpen));
    });
    navLinks.querySelectorAll('a').forEach((link) => {
      link.addEventListener('click', () => {
        navLinks.classList.remove('is-open');
        navToggle.setAttribute('aria-expanded', 'false');
      });
    });
  }

  /* ----------------------------------------------------------
     Smooth scroll for in-page anchors
  ---------------------------------------------------------- */
  document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
    anchor.addEventListener('click', (e) => {
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
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15, rootMargin: '0px 0px -60px 0px' }
    );
    revealEls.forEach((el) => io.observe(el));
  } else {
    revealEls.forEach((el) => el.classList.add('is-visible'));
  }

  /* ----------------------------------------------------------
     Mouse light effect
  ---------------------------------------------------------- */
  const mouseLight = document.getElementById('mouse-light');
  if (mouseLight && window.matchMedia('(hover: hover)').matches) {
    window.addEventListener('pointermove', (e) => {
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
      particles.forEach((p) => {
        p.y -= p.speedY;
        p.x += p.speedX;
        p.alpha += (Math.random() - 0.5) * p.flicker;
        p.alpha = Math.max(0.05, Math.min(0.65, p.alpha));

        if (p.y < -10) {
          p.y = height + 10;
          p.x = Math.random() * width;
        }
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
      resizeTimeout = setTimeout(() => {
        cancelAnimationFrame(rafId);
        init();
        draw();
      }, 200);
    });

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        cancelAnimationFrame(rafId);
      } else {
        draw();
      }
    });
  }

  /* ----------------------------------------------------------
     Bulletin — cycling announcements, dismissible for the visit
  ---------------------------------------------------------- */
  const ANNOUNCEMENTS = [
    'New artifact catalogued: Verdigris (SH‑0004) — status Active.',
    'The Reading Room is open below. Sign in to leave an entry.',
    'Maintenance note: the fog generator was recalibrated. Nothing to report.',
    'Accounts are open — create a profile to post in the Reading Room.',
  ];

  (() => {
    const bulletin = document.getElementById('bulletin');
    const bulletinText = document.getElementById('bulletin-text');
    const dismissBtn = document.getElementById('bulletin-dismiss');
    if (!bulletin || !bulletinText || !dismissBtn) return;

    const DISMISS_KEY = 'archive_bulletin_dismissed';

    let dismissed = false;
    try {
      dismissed = sessionStorage.getItem(DISMISS_KEY) === '1';
    } catch (err) {
      dismissed = false;
    }

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
      try {
        sessionStorage.setItem(DISMISS_KEY, '1');
      } catch (err) {
        /* storage unavailable — dismissal just won't persist across reloads */
      }
    });
  })();

  /* ----------------------------------------------------------
     Auth — nav user area (present on every page)
     Fetches /api/auth/me once and renders either:
       - an avatar + display name with a dropdown (profile/logout), or
       - Sign In / Sign Up buttons
  ---------------------------------------------------------- */
  const Auth = (() => {
    let cached = null; // { user } | null while unresolved
    let inflight = null;

    const fetchMe = async () => {
      if (cached) return cached;
      if (inflight) return inflight;
      inflight = fetch('/api/auth/me')
        .then((r) => (r.ok ? r.json() : { user: null }))
        .catch(() => ({ user: null }))
        .then((data) => {
          cached = data;
          return data;
        });
      return inflight;
    };

    const clearCache = () => { cached = null; inflight = null; };

    const fallbackAvatar =
      'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"%3E%3Crect width="40" height="40" rx="20" fill="%23161b16"/%3E%3Ccircle cx="20" cy="16" r="7" fill="%232f9e6b" opacity="0.7"/%3E%3Cpath d="M6 36c0-9 6-14 14-14s14 5 14 14" fill="%232f9e6b" opacity="0.7"/%3E%3C/svg%3E';

    const renderNav = async () => {
      const container = document.getElementById('nav-auth');
      if (!container) return null;

      const { user } = await fetchMe();

      if (!user) {
        container.innerHTML = `
          <div class="nav__guest-buttons">
            <a href="/login.html" class="btn btn--ghost btn--small"><span>Sign In</span></a>
            <a href="/signup.html" class="btn btn--glow btn--small"><span>Sign Up</span></a>
          </div>`;
        return user;
      }

      container.innerHTML = `
        <div class="nav__user">
          <button type="button" class="nav__user-trigger" id="nav-user-trigger" aria-haspopup="true" aria-expanded="false">
            <img class="nav__user-avatar" src="${user.avatar_url || fallbackAvatar}" alt="" onerror="this.onerror=null;this.src='${fallbackAvatar}';">
            <span class="nav__user-name"></span>
          </button>
          <div class="nav__user-menu" id="nav-user-menu">
            <a href="/profile.html">Profile &amp; Settings</a>
            <button type="button" id="nav-logout-btn">Sign Out</button>
          </div>
        </div>`;

      // textContent, not innerHTML, for the untrusted display name
      container.querySelector('.nav__user-name').textContent = user.display_name;

      const trigger = document.getElementById('nav-user-trigger');
      const menu = document.getElementById('nav-user-menu');
      trigger.addEventListener('click', (e) => {
        e.stopPropagation();
        const isOpen = menu.classList.toggle('is-open');
        trigger.setAttribute('aria-expanded', String(isOpen));
      });
      document.addEventListener('click', (e) => {
        if (!menu.classList.contains('is-open')) return;
        if (menu.contains(e.target) || trigger.contains(e.target)) return;
        menu.classList.remove('is-open');
        trigger.setAttribute('aria-expanded', 'false');
      });

      document.getElementById('nav-logout-btn').addEventListener('click', async () => {
        try {
          await fetch('/api/auth/logout', { method: 'POST' });
        } catch (err) {
          console.error('Logout failed:', err);
        } finally {
          clearCache();
          window.location.href = '/';
        }
      });

      return user;
    };

    return { fetchMe, renderNav, clearCache, fallbackAvatar };
  })();

  window.SHAuth = Auth;

  document.addEventListener('DOMContentLoaded', () => {
    Auth.renderNav();
  });

  /* ----------------------------------------------------------
     Forum — "The Reading Room"
     Threads are stored server-side (D1) and visible to everyone.
     Posting/replying/editing/deleting requires an authenticated
     account; guests can read but the composer is gated.
  ---------------------------------------------------------- */
  (() => {
    const threadList = document.getElementById('forum-threads');
    const emptyState = document.getElementById('forum-empty');
    const newThreadForm = document.getElementById('forum-new-thread');
    const formHint = document.getElementById('forum-form-hint');
    const gate = document.getElementById('forum-gate');
    if (!threadList) return;

    let threads = [];
    let currentUser = null;

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

    let searchQuery = '';
    const searchInput = document.getElementById('forum-search-input');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        searchQuery = e.target.value.toLowerCase();
        render();
      });
    }

    const formatTime = (ts) => {
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

    const sanitizeInput = (value) => value.trim().slice(0, 600);

    const applyAuthGating = () => {
      if (!newThreadForm || !gate) return;
      if (currentUser) {
        newThreadForm.hidden = false;
        gate.hidden = true;
      } else {
        newThreadForm.hidden = true;
        gate.hidden = false;
      }
    };

    const authorAvatar = (author) =>
      (author && author.avatar_url) || (window.SHAuth ? window.SHAuth.fallbackAvatar : '');

    const render = () => {
      threadList.innerHTML = '';

      if (!threads.length) {
        if (emptyState) emptyState.hidden = false;
        return;
      }
      if (emptyState) emptyState.hidden = true;

      const sorted = [...threads].sort((a, b) => b.time - a.time);

      sorted.forEach((thread) => {
        if (searchQuery) {
          const authorName = (thread.author && thread.author.display_name) || '';
          const matchName = authorName.toLowerCase().includes(searchQuery);
          const matchSubject = thread.subject.toLowerCase().includes(searchQuery);
          const matchBody = thread.body.toLowerCase().includes(searchQuery);
          if (!matchName && !matchSubject && !matchBody) return;
        }

        const li = document.createElement('li');
        li.className = 'forum__thread';

        // Author byline
        const authorRow = document.createElement('div');
        authorRow.className = 'forum__thread-author';
        const authorImg = document.createElement('img');
        authorImg.src = authorAvatar(thread.author);
        authorImg.alt = '';
        authorImg.onerror = function () {
          this.onerror = null;
          this.src = window.SHAuth ? window.SHAuth.fallbackAvatar : '';
        };
        const authorMeta = document.createElement('span');
        const authorStrong = document.createElement('strong');
        authorStrong.textContent = (thread.author && thread.author.display_name) || 'Anonymous';
        authorMeta.appendChild(authorStrong);
        // Username is shown alongside display name so readers can tell
        // accounts apart even if two people pick the same display name.
        if (thread.author && thread.author.username) {
          const usernameEl = document.createElement('span');
          usernameEl.className = 'forum__thread-author-handle';
          usernameEl.textContent = ` @${thread.author.username}`;
          authorMeta.appendChild(usernameEl);
        }
        const timeEl = document.createElement('time');
        timeEl.textContent = ` · ${formatTime(thread.time)}`;
        timeEl.title = new Date(thread.time).toLocaleString(undefined, {
          year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
        });
        try { timeEl.dateTime = new Date(thread.time).toISOString(); } catch (e) { /* ignore */ }
        authorMeta.appendChild(timeEl);
        authorRow.appendChild(authorImg);
        authorRow.appendChild(authorMeta);

        const head = document.createElement('div');
        head.className = 'forum__thread-head';

        const subject = document.createElement('h3');
        subject.className = 'forum__thread-subject';
        subject.textContent = thread.subject;
        head.appendChild(subject);

        const body = document.createElement('p');
        body.className = 'forum__thread-body';
        body.textContent = thread.body;

        const toggle = document.createElement('button');
        toggle.type = 'button';
        toggle.className = 'forum__toggle';
        toggle.setAttribute('aria-expanded', 'false');
        const replyCount = thread.replies ? thread.replies.length : 0;
        toggle.innerHTML = `<span>${replyCount === 1 ? '1 reply' : `${replyCount} replies`}</span>
          <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true"><path d="M1 3l4 4 4-4" stroke="currentColor" stroke-width="1.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

        // Owner actions: edit / delete
        const isOwner = currentUser && thread.author && thread.author.id === currentUser.id;
        let actionsRow = null;
        if (isOwner) {
          actionsRow = document.createElement('div');
          actionsRow.className = 'forum__thread-actions';

          const editBtn = document.createElement('button');
          editBtn.type = 'button';
          editBtn.textContent = 'Edit';

          const deleteBtn = document.createElement('button');
          deleteBtn.type = 'button';
          deleteBtn.className = 'is-danger';
          deleteBtn.textContent = 'Delete';

          editBtn.addEventListener('click', () => startEdit());
          deleteBtn.addEventListener('click', async () => {
            if (!confirm('Delete this entry? This cannot be undone.')) return;
            try {
              const res = await fetch(`/api/messages/${thread.id}`, { method: 'DELETE' });
              if (res.ok) {
                threads = threads.filter((t) => t.id !== thread.id);
                render();
              } else {
                const err = await res.json().catch(() => ({}));
                alert(err.error || 'Failed to delete entry.');
              }
            } catch (err) {
              alert('A network error occurred.');
            }
          });

          actionsRow.appendChild(editBtn);
          actionsRow.appendChild(deleteBtn);
        }

        const startEdit = () => {
          body.innerHTML = '';
          const editForm = document.createElement('form');
          editForm.className = 'forum__reply-form';
          editForm.innerHTML = `
            <input type="text" maxlength="80" value="" aria-label="Subject" required>
            <textarea rows="3" maxlength="600" aria-label="Entry" required></textarea>
            <div style="display:flex; gap:0.6rem;">
              <button type="submit" class="forum__reply-submit">Save</button>
              <button type="button" class="forum__reply-submit" data-cancel style="background:transparent;">Cancel</button>
            </div>`;
          const [subjectInput, bodyInput] = editForm.querySelectorAll('input, textarea');
          subjectInput.value = thread.subject;
          bodyInput.value = thread.body;
          editForm.querySelector('[data-cancel]').addEventListener('click', () => render());
          editForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const newSubject = sanitizeInput(subjectInput.value).slice(0, 80);
            const newBody = sanitizeInput(bodyInput.value);
            if (!newSubject || !newBody) return;
            try {
              const res = await fetch(`/api/messages/${thread.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ subject: newSubject, body: newBody })
              });
              if (res.ok) {
                thread.subject = newSubject;
                thread.body = newBody;
                render();
              } else {
                const err = await res.json().catch(() => ({}));
                alert(err.error || 'Failed to save changes.');
              }
            } catch (err) {
              alert('A network error occurred.');
            }
          });
          body.appendChild(editForm);
        };

        const repliesWrap = document.createElement('div');
        repliesWrap.className = 'forum__replies';

        (thread.replies || []).forEach((reply) => {
          const replyEl = document.createElement('div');
          replyEl.className = 'forum__reply';

          const replyMeta = document.createElement('p');
          replyMeta.className = 'forum__reply-meta';

          const replyAuthorWrap = document.createElement('span');
          replyAuthorWrap.className = 'forum__reply-author';
          const replyImg = document.createElement('img');
          replyImg.src = authorAvatar(reply.author);
          replyImg.alt = '';
          replyImg.onerror = function () {
            this.onerror = null;
            this.src = window.SHAuth ? window.SHAuth.fallbackAvatar : '';
          };
          const replyStrong = document.createElement('strong');
          replyStrong.textContent = (reply.author && reply.author.display_name) || reply.name || 'Anonymous';
          replyAuthorWrap.appendChild(replyImg);
          replyAuthorWrap.appendChild(replyStrong);
          if (reply.author && reply.author.username) {
            const replyHandle = document.createElement('span');
            replyHandle.className = 'forum__thread-author-handle';
            replyHandle.textContent = ` @${reply.author.username}`;
            replyAuthorWrap.appendChild(replyHandle);
          }

          replyMeta.appendChild(replyAuthorWrap);
          const replyTimeEl = document.createElement('time');
          replyTimeEl.textContent = ` · ${formatTime(reply.time)}`;
          replyTimeEl.title = new Date(reply.time).toLocaleString(undefined, {
            year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
          });
          try { replyTimeEl.dateTime = new Date(reply.time).toISOString(); } catch (e) { /* ignore */ }
          replyMeta.appendChild(replyTimeEl);

          const replyBody = document.createElement('p');
          replyBody.className = 'forum__reply-body';
          replyBody.textContent = reply.body;

          replyEl.appendChild(replyMeta);
          replyEl.appendChild(replyBody);
          repliesWrap.appendChild(replyEl);
        });

        // Reply form — only rendered for signed-in users
        if (currentUser) {
          const replyForm = document.createElement('form');
          replyForm.className = 'forum__reply-form';
          replyForm.setAttribute('aria-label', `Reply to ${thread.subject}`);
          replyForm.innerHTML = `
            <textarea rows="2" maxlength="400" placeholder="Write a reply…" required aria-label="Reply text"></textarea>
            <button type="submit" class="forum__reply-submit">Reply</button>
          `;
          replyForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const bodyInput = replyForm.querySelector('textarea');
            const replyBody = sanitizeInput(bodyInput.value);
            if (!replyBody) return;

            const submitBtn = replyForm.querySelector('button[type="submit"]');
            submitBtn.disabled = true;
            submitBtn.textContent = 'Sending...';

            try {
              const response = await fetch(`/api/messages/${thread.id}/reply`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ body: replyBody })
              });

              if (response.ok) {
                const result = await response.json();
                if (result.success) {
                  const target = threads.find((t) => t.id === thread.id);
                  if (target) {
                    if (!target.replies) target.replies = [];
                    target.replies.push(result.reply);
                    render();
                  }
                }
              } else {
                const err = await response.json().catch(() => ({}));
                alert(err.error || 'Failed to send reply. Please try again.');
              }
            } catch (err) {
              console.error('Error posting reply:', err);
              alert('A network error occurred.');
            } finally {
              submitBtn.disabled = false;
              submitBtn.textContent = 'Reply';
            }
          });
          repliesWrap.appendChild(replyForm);
        } else {
          // Guests can read every reply above, but posting is gated —
          // same friendly wording/style as the "leave an entry" gate,
          // scoped to this thread's reply box instead of the whole page.
          const signInPrompt = document.createElement('p');
          signInPrompt.className = 'forum__gate forum__gate--inline';
          signInPrompt.innerHTML =
            '<a href="/login.html">Sign in</a> or <a href="/signup.html">create an account</a> to reply to this entry.';
          repliesWrap.appendChild(signInPrompt);
        }

        toggle.addEventListener('click', () => {
          const isOpen = repliesWrap.classList.toggle('is-open');
          toggle.setAttribute('aria-expanded', String(isOpen));
        });

        li.appendChild(authorRow);
        li.appendChild(head);
        li.appendChild(body);
        if (actionsRow) li.appendChild(actionsRow);
        li.appendChild(toggle);
        li.appendChild(repliesWrap);
        threadList.appendChild(li);
      });
    };

    if (newThreadForm) {
      newThreadForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const subject = sanitizeInput(newThreadForm.querySelector('#thread-subject').value).slice(0, 80);
        const body = sanitizeInput(newThreadForm.querySelector('#thread-body').value);

        if (!subject || !body) {
          if (formHint) {
            formHint.textContent = 'Fill in a subject and an entry before submitting.';
            formHint.classList.add('is-visible');
          }
          return;
        }
        if (formHint) {
          formHint.textContent = '';
          formHint.classList.remove('is-visible');
        }

        const submitBtn = newThreadForm.querySelector('button[type="submit"]');
        submitBtn.disabled = true;
        const btnSpan = submitBtn.querySelector('span');
        if (btnSpan) btnSpan.textContent = 'Sending...';

        try {
          const response = await fetch('/api/messages', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ subject, body })
          });

          if (response.ok) {
            const result = await response.json();
            if (result.success && result.thread) {
              threads.push(result.thread);
              newThreadForm.reset();
              render();
            }
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
          submitBtn.disabled = false;
          if (btnSpan) btnSpan.textContent = 'Leave Entry';
        }
      });
    }

    // Resolve auth state, then gate the composer and load threads.
    (window.SHAuth ? window.SHAuth.fetchMe() : Promise.resolve({ user: null })).then(({ user }) => {
      currentUser = user;
      applyAuthGating();
      loadThreads();
    });
  })();
})();
