(() => {
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const header = document.querySelector('.site-header');
  const toggle = document.querySelector('.menu-toggle');
  const menu = document.querySelector('#mobile-menu');
  const year = document.querySelector('#year');

  if (typeof SITE_CONTENT !== 'undefined') {
    document.querySelectorAll('[data-image]').forEach(image => {
      const source = SITE_CONTENT.images?.[image.dataset.image];
      if (source) image.src = source;
    });
    const email = document.querySelector('.big-cta');
    if (email && SITE_CONTENT.teacher?.email) {
      email.href = `mailto:${SITE_CONTENT.teacher.email}`;
      email.firstChild.textContent = `${SITE_CONTENT.teacher.email} `;
    }
  }
  if (year) year.textContent = new Date().getFullYear();

  // Native modal provides focus trapping and makes the page behind it inert.
  let menuAnimation;
  let closingMenu = false;
  let previousOverflow = '';
  const openMenu = () => {
    if (menu.open) return;
    previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    menu.showModal();
    header.classList.add('menu-open');
    toggle.setAttribute('aria-expanded', 'true');
    toggle.setAttribute('aria-label', 'Close navigation');
    menu.querySelector('a').focus({ preventScroll: true });
    if (!reducedMotion.matches) {
      menuAnimation = menu.animate([
        { opacity: 0, transform: 'translateY(-14px) scale(.98)' },
        { opacity: 1, transform: 'translateY(0) scale(1)' }
      ], { duration: 320, easing: 'cubic-bezier(.22,1,.36,1)' });
    }
    document.dispatchEvent(new Event('navigationchange'));
  };
  const closeMenu = async (animate = true) => {
    if (!menu.open || closingMenu) return;
    closingMenu = true;
    menuAnimation?.cancel();
    header.classList.remove('menu-open');
    toggle.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-label', 'Open navigation');
    if (animate && !reducedMotion.matches) {
      menu.classList.add('is-closing');
      menuAnimation = menu.animate([
        { opacity: 1, transform: 'translateY(0) scale(1)' },
        { opacity: 0, transform: 'translateY(-8px) scale(.98)' }
      ], { duration: 180, easing: 'ease-in', fill: 'forwards' });
      await menuAnimation.finished.catch(() => {});
    }
    menu.close();
    menuAnimation?.cancel();
    menu.classList.remove('is-closing');
    document.body.style.overflow = previousOverflow;
    closingMenu = false;
    document.dispatchEvent(new Event('navigationchange'));
  };
  toggle.addEventListener('click', () => menu.open ? closeMenu() : openMenu());
  menu.querySelector('.menu-close').addEventListener('click', () => closeMenu());
  menu.addEventListener('cancel', event => {
    event.preventDefault();
    closeMenu();
  });
  menu.addEventListener('click', event => {
    // Backdrop clicks are retargeted to the dialog; ignore padding inside it.
    if (event.target !== menu) return;
    const rect = menu.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right ||
        event.clientY < rect.top || event.clientY > rect.bottom) closeMenu();
  });
  menu.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', async event => {
      event.preventDefault();
      if (closingMenu) return;
      await closeMenu();
      const target = document.querySelector(link.hash);
      if (!target) return;
      history.pushState(null, '', link.hash);
      target.scrollIntoView({ behavior: reducedMotion.matches ? 'instant' : 'smooth' });
      target.setAttribute('tabindex', '-1');
      target.focus({ preventScroll: true });
    });
  });
  window.matchMedia('(min-width: 1051px)').addEventListener('change', event => {
    if (event.matches) closeMenu(false);
  });
  reducedMotion.addEventListener('change', () => {
    if (closingMenu) menuAnimation?.finish();
    else menuAnimation?.cancel();
  });

  // Details stays open until its closing animation ends, so content never snaps.
  const faqStates = [];
  document.querySelectorAll('.faq-list details').forEach((details, index) => {
    const summary = details.querySelector('summary');
    const answer = details.querySelector('p');
    answer.id = `faq-answer-${index + 1}`;
    summary.setAttribute('aria-controls', answer.id);
    summary.setAttribute('aria-expanded', String(details.open));
    const state = { details, summary, animation: null, expanded: details.open };
    faqStates.push(state);
    const settle = () => {
      state.animation?.cancel();
      state.animation = null;
      details.open = state.expanded;
      details.style.height = '';
      details.classList.remove('is-animating');
    };
    state.settle = settle;
    summary.addEventListener('click', event => {
      event.preventDefault();
      const from = details.getBoundingClientRect().height;
      state.animation?.cancel();
      state.expanded = !state.expanded;
      summary.setAttribute('aria-expanded', String(state.expanded));
      details.dataset.expanded = String(state.expanded);
      if (reducedMotion.matches || !details.animate) return settle();
      // Remove the previous inline height before measuring the new natural height.
      details.style.height = '';
      details.open = state.expanded;
      const to = details.getBoundingClientRect().height;
      details.open = true;
      details.style.height = `${from}px`;
      details.classList.add('is-animating');
      const animation = details.animate([{ height: `${from}px` }, { height: `${to}px` }], {
        duration: 340, easing: 'cubic-bezier(.22,1,.36,1)', fill: 'forwards'
      });
      state.animation = animation;
      animation.finished.then(() => {
        if (state.animation === animation) settle();
      }).catch(() => {});
    });
  });
  window.addEventListener('resize', () => faqStates.forEach(state => {
    if (state.animation) state.settle();
  }), { passive: true });
  reducedMotion.addEventListener('change', () => faqStates.forEach(state => state.settle()));

  // Progressive enhancement: content remains visible when JavaScript is absent.
  const revealItems = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window && !reducedMotion.matches) {
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      });
    }, { threshold: 0.08 });
    revealItems.forEach(item => {
      item.classList.add('reveal-ready');
      observer.observe(item);
    });
    reducedMotion.addEventListener('change', () => {
      if (reducedMotion.matches) {
        revealItems.forEach(item => item.classList.add('is-visible'));
        observer.disconnect();
      }
    });
  }

  // CSS supplies sticky positioning. Only active, visible stacks need a frame.
  const stack = document.querySelector('.lesson-grid');
  const cards = [...stack.querySelectorAll('.lesson-card')];
  const stackMedia = window.matchMedia('(min-width: 1051px)');
  let stackVisible = false;
  let stackFrame = 0;
  const paintStack = () => {
    stackFrame = 0;
    if (!stackVisible || !stack.classList.contains('is-stacking')) return;
    cards.forEach((card, index) => {
      const next = cards[index + 1];
      const distance = next ? next.getBoundingClientRect().top - (110 + index * 18) : Infinity;
      const progress = Math.max(0, Math.min(1, 1 - distance / 420));
      card.style.setProperty('--stack-scale', String(1 - progress * .045));
      card.style.setProperty('--stack-opacity', String(1 - progress * .16));
    });
  };
  const requestStackFrame = () => {
    if (!stackFrame && stackVisible && stackMedia.matches && !reducedMotion.matches) {
      stackFrame = requestAnimationFrame(paintStack);
    }
  };
  const configureStack = () => {
    const enabled = stackMedia.matches && !reducedMotion.matches && window.innerHeight >= 650;
    stack.classList.toggle('is-stacking', enabled);
    cards.forEach(card => {
      card.style.removeProperty('--stack-scale');
      card.style.removeProperty('--stack-opacity');
    });
    requestStackFrame();
  };
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(entries => {
      stackVisible = entries[0].isIntersecting;
      stack.classList.toggle('is-active', stackVisible);
      requestStackFrame();
    }, { rootMargin: '100px' }).observe(stack);
  }
  window.addEventListener('scroll', requestStackFrame, { passive: true });
  window.addEventListener('resize', configureStack, { passive: true });
  stackMedia.addEventListener('change', configureStack);
  reducedMotion.addEventListener('change', configureStack);
  configureStack();

  // An inline SVG companion belongs to this website, with independently editable phrases.
  const mascot = document.querySelector('.mascot');
  const mascotButton = mascot.querySelector('.mascot-button');
  const bubble = mascot.querySelector('.mascot-bubble');
  const motionButton = mascot.querySelector('.mascot-motion');
  const phrases = typeof MASCOT_PHRASES !== 'undefined' ? MASCOT_PHRASES.filter(p => typeof p === 'string' && p.trim()) : [];
  let speaking = false;
  let manuallyPaused = false;
  let keyboardFocus = false;
  let hoveringMascot = false;
  let keyboardInput = false;
  let speechTimer;
  let previousPhrase = -1;
  const syncMascot = () => {
    const paused = speaking || manuallyPaused || keyboardFocus || hoveringMascot || menu.open || document.hidden || reducedMotion.matches;
    mascot.classList.toggle('is-paused', paused);
    motionButton.setAttribute('aria-pressed', String(manuallyPaused));
    motionButton.setAttribute('aria-label', manuallyPaused ? 'Resume companion movement' : 'Pause companion movement');
    motionButton.textContent = manuallyPaused ? '▷' : 'Ⅱ';
    motionButton.hidden = reducedMotion.matches;
  };
  const resumeMascot = () => {
    clearTimeout(speechTimer);
    speaking = false;
    mascot.classList.remove('is-speaking');
    bubble.textContent = '';
    mascotButton.setAttribute('aria-expanded', 'false');
    mascotButton.setAttribute('aria-label', 'Pause owl and show an English phrase');
    syncMascot();
  };
  mascotButton.addEventListener('click', () => {
    if (speaking) return resumeMascot();
    if (!phrases.length) return;
    let phrase = Math.floor(Math.random() * phrases.length);
    if (phrase === previousPhrase && phrases.length > 1) phrase = (phrase + 1) % phrases.length;
    previousPhrase = phrase;
    speaking = true;
    bubble.textContent = phrases[phrase];
    mascot.classList.add('is-speaking');
    mascotButton.setAttribute('aria-expanded', 'true');
    mascotButton.setAttribute('aria-label', 'Dismiss phrase and resume owl');
    syncMascot();
    speechTimer = setTimeout(resumeMascot, 6500);
  });
  motionButton.addEventListener('click', () => {
    manuallyPaused = !manuallyPaused;
    syncMascot();
  });
  mascot.querySelector('.mascot-dismiss').addEventListener('click', () => {
    resumeMascot();
    mascot.hidden = true;
    try { sessionStorage.setItem('english-companion-hidden', 'true'); } catch { /* Storage is optional. */ }
  });
  document.addEventListener('keydown', event => {
    keyboardInput = true;
    if (event.key === 'Escape' && speaking) resumeMascot();
  });
  document.addEventListener('pointerdown', () => { keyboardInput = false; }, { passive: true });
  mascot.addEventListener('pointerenter', event => {
    if (event.pointerType === 'mouse') { hoveringMascot = true; syncMascot(); }
  });
  mascot.addEventListener('pointerleave', () => { hoveringMascot = false; syncMascot(); });
  mascot.addEventListener('focusin', () => { keyboardFocus = keyboardInput; syncMascot(); });
  mascot.addEventListener('focusout', event => {
    if (!mascot.contains(event.relatedTarget)) { keyboardFocus = false; syncMascot(); }
  });
  const sizeMascotPath = () => {
    mascot.style.setProperty('--mascot-travel', `${-Math.min(220, Math.max(0, window.innerWidth - 276))}px`);
  };
  document.addEventListener('visibilitychange', syncMascot);
  document.addEventListener('navigationchange', syncMascot);
  reducedMotion.addEventListener('change', syncMascot);
  window.addEventListener('resize', sizeMascotPath, { passive: true });
  try { mascot.hidden = sessionStorage.getItem('english-companion-hidden') === 'true'; }
  catch { mascot.hidden = false; }
  if (!phrases.length) mascot.hidden = true;
  sizeMascotPath();
  syncMascot();

  // Transform-only cursor; no continuous frame loop once the ring catches up.
  const dot = document.querySelector('.cursor-dot');
  const ring = document.querySelector('.cursor-ring');
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');
  const touchPointer = window.matchMedia('(any-pointer: coarse)');
  let mouseX = 0, mouseY = 0, ringX = 0, ringY = 0;
  let cursorFrame = 0;
  let cursorVisible = false;
  const cursorEnabled = () => finePointer.matches && !touchPointer.matches && !reducedMotion.matches && !menu.open;
  const hideCursor = () => {
    cursorVisible = false;
    document.documentElement.classList.remove('custom-cursor-active');
    dot.classList.remove('is-visible');
    ring.classList.remove('is-visible');
    cancelAnimationFrame(cursorFrame);
    cursorFrame = 0;
  };
  const paintCursor = () => {
    cursorFrame = 0;
    if (!cursorVisible) return;
    ringX += (mouseX - ringX) * .24;
    ringY += (mouseY - ringY) * .24;
    const target = document.elementFromPoint(mouseX, mouseY);
    const dark = target?.closest('[data-cursor-theme]')?.dataset.cursorTheme === 'dark';
    const interactive = !!target?.closest('a, button, summary, .magnetic-card');
    [dot, ring].forEach(cursor => {
      cursor.classList.toggle('is-dark', dark);
      cursor.classList.toggle('is-link', interactive);
    });
    dot.style.transform = `translate3d(${mouseX}px, ${mouseY}px, 0)`;
    ring.style.transform = `translate3d(${ringX}px, ${ringY}px, 0)`;
    if (Math.abs(mouseX - ringX) + Math.abs(mouseY - ringY) > .2) cursorFrame = requestAnimationFrame(paintCursor);
  };
  const requestCursorFrame = () => {
    if (cursorVisible && !cursorFrame) cursorFrame = requestAnimationFrame(paintCursor);
  };
  window.addEventListener('pointermove', event => {
    if (!cursorEnabled() || event.pointerType !== 'mouse') return hideCursor();
    mouseX = event.clientX; mouseY = event.clientY;
    if (!cursorVisible) {
      ringX = mouseX; ringY = mouseY;
      cursorVisible = true;
      document.documentElement.classList.add('custom-cursor-active');
      dot.classList.add('is-visible'); ring.classList.add('is-visible');
    }
    requestCursorFrame();
  }, { passive: true });
  window.addEventListener('scroll', requestCursorFrame, { passive: true });
  document.documentElement.addEventListener('pointerleave', hideCursor);
  window.addEventListener('blur', hideCursor);
  document.addEventListener('navigationchange', hideCursor);
  document.addEventListener('visibilitychange', () => { if (document.hidden) hideCursor(); });
  document.addEventListener('keydown', event => { if (event.key === 'Tab') hideCursor(); });
  [finePointer, touchPointer, reducedMotion].forEach(media => media.addEventListener('change', hideCursor));
})();
