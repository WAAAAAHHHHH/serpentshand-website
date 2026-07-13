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
    'The Reading Room is open below. Entries are visible to everyone.',
    'Maintenance note: the fog generator was recalibrated. Nothing to report.',
    'Sealed Channels updated — Threads correspondence now accepted.',
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
     Forum — "The Reading Room"
     Client-side only: threads persist in this browser via
     localStorage. There is no shared backend, so entries are
     not visible to other visitors.
  ---------------------------------------------------------- */
  (() => {
    const threadList = document.getElementById('forum-threads');
    const emptyState = document.getElementById('forum-empty');
    const newThreadForm = document.getElementById('forum-new-thread');
    const formHint = document.getElementById('forum-form-hint');
    if (!threadList || !newThreadForm) return;

    let threads = [];
    
    const loadThreads = async () => {
      try {
        const response = await fetch('/api/threads');
        if (response.ok) {
          threads = await response.json();
          render();
        } else {
          console.error("Failed to load threads from server.");
          storageAvailable = false;
        }
      } catch (err) {
        console.error("Network error loading threads:", err);
        storageAvailable = false;
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

    const escapeForDisplay = (str) => str; // textContent used everywhere; no HTML injection risk

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

    const render = () => {
      threadList.innerHTML = '';

      if (!threads.length) {
        emptyState.hidden = false;
        return;
      }
      emptyState.hidden = true;

      // newest first
      const sorted = [...threads].sort((a, b) => b.time - a.time);

      sorted.forEach((thread) => {
        if (searchQuery) {
          const matchName = thread.name.toLowerCase().includes(searchQuery);
          const matchSubject = thread.subject.toLowerCase().includes(searchQuery);
          const matchBody = thread.body.toLowerCase().includes(searchQuery);
          if (!matchName && !matchSubject && !matchBody) return;
        }
        const li = document.createElement('li');
        li.className = 'forum__thread';

        const head = document.createElement('div');
        head.className = 'forum__thread-head';

        const subject = document.createElement('h3');
        subject.className = 'forum__thread-subject';
        subject.textContent = thread.subject;

        const meta = document.createElement('span');
        meta.className = 'forum__thread-meta';
        const strong = document.createElement('strong');
        strong.textContent = thread.name;
        meta.appendChild(strong);
        meta.appendChild(document.createTextNode(` · ${formatTime(thread.time)}`));

        head.appendChild(subject);
        head.appendChild(meta);

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

        const repliesWrap = document.createElement('div');
        repliesWrap.className = 'forum__replies';

        (thread.replies || []).forEach((reply) => {
          const replyEl = document.createElement('div');
          replyEl.className = 'forum__reply';

          const replyMeta = document.createElement('p');
          replyMeta.className = 'forum__reply-meta';
          const replyStrong = document.createElement('strong');
          replyStrong.textContent = reply.name;
          replyMeta.appendChild(replyStrong);
          replyMeta.appendChild(document.createTextNode(` · ${formatTime(reply.time)}`));

          const replyBody = document.createElement('p');
          replyBody.className = 'forum__reply-body';
          replyBody.textContent = reply.body;

          replyEl.appendChild(replyMeta);
          replyEl.appendChild(replyBody);
          repliesWrap.appendChild(replyEl);
        });

        // reply form
        const replyForm = document.createElement('form');
        replyForm.className = 'forum__reply-form';
        replyForm.setAttribute('aria-label', `Reply to ${thread.subject}`);
        replyForm.innerHTML = `
          <input type="text" maxlength="40" placeholder="Your name" required aria-label="Your name">
          <textarea rows="2" maxlength="400" placeholder="Write a reply…" required aria-label="Reply text"></textarea>
          <button type="submit" class="forum__reply-submit">Reply</button>
        `;
        replyForm.addEventListener('submit', async (e) => {
          e.preventDefault();
          const [nameInput, bodyInput] = replyForm.querySelectorAll('input, textarea');
          const name = sanitizeInput(nameInput.value || 'Anonymous').slice(0, 40) || 'Anonymous';
          const replyBody = sanitizeInput(bodyInput.value);
          if (!replyBody) return;

          const submitBtn = replyForm.querySelector('button[type="submit"]');
          submitBtn.disabled = true;
          submitBtn.textContent = 'Sending...';

          try {
            const response = await fetch(`/api/threads/${thread.id}/reply`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ name, body: replyBody })
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

        repliesWrap.appendChild(replyForm);

        toggle.addEventListener('click', () => {
          const isOpen = repliesWrap.classList.toggle('is-open');
          toggle.setAttribute('aria-expanded', String(isOpen));
        });

        li.appendChild(head);
        li.appendChild(body);
        li.appendChild(toggle);
        li.appendChild(repliesWrap);
        threadList.appendChild(li);
      });
    };

    newThreadForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = sanitizeInput(newThreadForm.querySelector('#thread-name').value).slice(0, 40);
      const subject = sanitizeInput(newThreadForm.querySelector('#thread-subject').value).slice(0, 80);
      const body = sanitizeInput(newThreadForm.querySelector('#thread-body').value);

      if (!name || !subject || !body) {
        if (formHint) {
          formHint.textContent = 'Fill in a name, a subject, and an entry before submitting.';
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
        const response = await fetch('/api/threads', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, subject, body })
        });

        if (response.ok) {
          const result = await response.json();
          if (result.success && result.thread) {
            // Append the new thread to the local array so we don't have to refetch everything
            // Note: Our render function sorts them by time anyway.
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

    // Initial load
    loadThreads();
  })();
})();
