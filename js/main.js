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
  const updateYear = () => { if (year) year.textContent = new Date().getFullYear(); };
  updateYear();
  // Also refresh a tab left open over New Year, including after waking from sleep.
  setInterval(updateYear, 60000);
  document.addEventListener('visibilitychange', updateYear);

  // Two identical, viewport-wide groups make -50% an exact, seamless repeat.
  const marquee = document.querySelector('.marquee-track');
  const marqueeSource = [...marquee.querySelector('.marquee-group').children].map(item => item.cloneNode(true));
  const fillMarquee = () => {
    const group = document.createElement('div');
    group.className = 'marquee-group';
    group.append(...marqueeSource.map(item => item.cloneNode(true)));
    marquee.replaceChildren(group);
    const cycleWidth = group.getBoundingClientRect().width;
    if (!cycleWidth) return;
    const repeats = Math.max(1, Math.ceil((marquee.parentElement.clientWidth + 1) / cycleWidth));
    for (let repeat = 1; repeat < repeats; repeat++) {
      group.append(...marqueeSource.map(item => item.cloneNode(true)));
    }
    marquee.append(group.cloneNode(true));
    marquee.style.setProperty('--marquee-duration', `${group.getBoundingClientRect().width / 55}s`);
    marquee.classList.add('is-ready');
  };
  fillMarquee();
  if ('ResizeObserver' in window) new ResizeObserver(fillMarquee).observe(marquee.parentElement);
  else window.addEventListener('resize', fillMarquee, { passive: true });
  document.fonts?.ready.then(fillMarquee);
  document.fonts?.addEventListener('loadingdone', fillMarquee);

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

  // Each header remains exposed. Reserve room for the entire final card and exit.
  const stack = document.querySelector('.lesson-grid');
  const cards = [...stack.querySelectorAll('.lesson-card')];
  const stackMedia = window.matchMedia('(min-width: 1051px)');
  const configureStack = () => {
    const firstTop = Math.max(110, Math.ceil(header.getBoundingClientRect().bottom + 20));
    const peek = 84;
    const lastTop = firstTop + (cards.length - 1) * peek;
    const availableHeight = window.innerHeight - lastTop - 24;
    const enabled = stackMedia.matches && !reducedMotion.matches && availableHeight >= 410;
    stack.classList.toggle('is-stacking', enabled);
    cards.forEach((card, index) => {
      card.style.setProperty('--stack-top', `${firstTop + index * peek}px`);
      card.style.setProperty('--stack-index', String(index + 1));
      card.style.setProperty('--stack-card-height', `${Math.min(480, availableHeight)}px`);
    });
  };
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(entries => {
      stack.classList.toggle('is-active', entries[0].isIntersecting);
    }, { rootMargin: '100px' }).observe(stack);
  }
  window.addEventListener('resize', configureStack, { passive: true });
  stackMedia.addEventListener('change', configureStack);
  reducedMotion.addEventListener('change', configureStack);
  configureStack();

  // SVG pupils, pointer capture and viewport coordinates keep the dog interactive.
  const mascot = document.querySelector('.mascot');
  const mascotButton = mascot.querySelector('.mascot-button');
  const bubble = mascot.querySelector('.mascot-bubble');
  const motionButton = mascot.querySelector('.mascot-motion');
  const house = document.querySelector('.doghouse');
  const pupils = [...mascot.querySelectorAll('.dog-pupil')];
  const phrases = typeof MASCOT_PHRASES !== 'undefined' ? MASCOT_PHRASES.filter(p => typeof p === 'string' && p.trim()) : [];
  let speaking = false;
  let manuallyPaused = false;
  let speechTimer;
  let introTimer;
  let travel = null;
  let journey = 0;
  let out = true;
  let position = { x: 0, y: 0 };
  let drag = null;
  let suppressClickUntil = 0;
  let eyeFrame = 0;
  let pointer = null;
  let previousPhrase = -1;
  const syncMascot = () => {
    const paused = manuallyPaused || menu.open || document.hidden || reducedMotion.matches;
    mascot.classList.toggle('is-paused', paused);
    motionButton.setAttribute('aria-pressed', String(manuallyPaused));
    motionButton.setAttribute('aria-label', manuallyPaused ? 'Resume companion animation' : 'Pause companion animation');
    motionButton.textContent = manuallyPaused ? '▷' : 'Ⅱ';
    motionButton.hidden = reducedMotion.matches;
    if (travel) {
      if (menu.open || document.hidden) travel.pause();
      else travel.play();
    }
  };
  const resumeMascot = () => {
    clearTimeout(speechTimer);
    speaking = false;
    mascot.classList.remove('is-speaking');
    bubble.textContent = '';
    mascotButton.setAttribute('aria-expanded', 'false');
    mascotButton.setAttribute('aria-label', 'Pet the dog and show an English phrase');
    syncMascot();
  };
  const speak = (phrase, duration = 6500) => {
    clearTimeout(speechTimer);
    speaking = true;
    bubble.textContent = phrase;
    mascot.classList.add('is-speaking');
    mascotButton.setAttribute('aria-expanded', 'true');
    mascotButton.setAttribute('aria-label', 'Dismiss the dog’s English phrase');
    speechTimer = setTimeout(resumeMascot, duration);
  };
  const clampPosition = point => ({
    x: Math.max(8, Math.min(document.documentElement.clientWidth - mascot.offsetWidth - 8, point.x)),
    y: Math.max(8, Math.min(window.innerHeight - mascot.offsetHeight - 8, point.y))
  });
  const layoutBubble = () => {
    const width = document.documentElement.clientWidth;
    const bubbleX = Math.max(8, Math.min(width - 238, position.x - 57));
    mascot.style.setProperty('--bubble-left', `${bubbleX - position.x}px`);
    const controlsWidth = window.innerWidth <= 800 ? 92 : 76;
    let controlsX = position.x + 116;
    const houseRect = house.getBoundingClientRect();
    if (controlsX + controlsWidth > width - 8 ||
        (controlsX + controlsWidth > houseRect.left && position.y + 144 > houseRect.top)) {
      controlsX = position.x - controlsWidth - 4;
    }
    controlsX = Math.max(8, Math.min(width - controlsWidth - 8, controlsX));
    mascot.style.setProperty('--controls-left', `${controlsX - position.x}px`);
    mascot.classList.toggle('bubble-below', position.y < 285);
  };
  const place = point => {
    position = clampPosition(point);
    mascot.style.transform = `translate3d(${position.x}px, ${position.y}px, 0)`;
    layoutBubble();
    requestEyes();
  };
  const centerPosition = () => ({ x: (document.documentElement.clientWidth - mascot.offsetWidth) / 2,
    y: window.innerHeight - mascot.offsetHeight - 14 });
  const housePosition = () => {
    const rect = house.getBoundingClientRect();
    return { x: rect.left + (rect.width - mascot.offsetWidth) / 2, y: rect.bottom - mascot.offsetHeight };
  };
  const stopTravel = () => {
    clearTimeout(introTimer);
    journey++;
    if (travel) {
      const rect = mascot.getBoundingClientRect();
      travel.cancel();
      travel = null;
      place({ x: rect.left, y: rect.top });
    }
    mascot.classList.remove('is-walking', 'is-greeting');
  };
  const walkTo = async (target, enteringHouse = false) => {
    stopTravel();
    const currentJourney = journey;
    target = clampPosition(target);
    if (!reducedMotion.matches) {
      mascot.classList.add('is-walking');
      const distance = Math.hypot(target.x - position.x, target.y - position.y);
      travel = mascot.animate([
        { transform: `translate3d(${position.x}px, ${position.y}px, 0)`, opacity: 1 },
        { transform: `translate3d(${target.x}px, ${target.y}px, 0)`, opacity: enteringHouse ? 0 : 1 }
      ], { duration: Math.max(350, Math.min(1600, distance * 2.3)), easing: 'ease-in-out', fill: 'forwards' });
      syncMascot();
      await travel.finished.catch(() => {});
      if (currentJourney !== journey) return;
      travel.cancel();
      travel = null;
    }
    place(target);
    mascot.classList.remove('is-walking');
    mascot.dataset.state = enteringHouse ? 'home' : 'idle';
    if (enteringHouse) mascot.hidden = true;
  };
  const syncHouse = () => {
    house.setAttribute('aria-expanded', String(out));
    house.setAttribute('aria-label', out ? 'Send the dog to its house' : 'Call the dog out of its house');
    house.querySelector('.doghouse-label').textContent = out ? 'Go home' : 'Come out!';
  };
  const goHome = () => {
    out = false;
    syncHouse();
    resumeMascot();
    if (mascot.contains(document.activeElement)) house.focus({ preventScroll: true });
    mascot.dataset.state = 'returning';
    walkTo(housePosition(), true);
  };
  const comeOut = () => {
    stopTravel();
    out = true;
    syncHouse();
    const wasHidden = mascot.hidden;
    mascot.hidden = false;
    if (wasHidden) place(housePosition());
    mascot.dataset.state = 'walking';
    speak('Woof! Ready for a little English?');
    walkTo(centerPosition());
  };
  mascotButton.addEventListener('click', () => {
    if (performance.now() < suppressClickUntil) return;
    if (speaking) return resumeMascot();
    if (!phrases.length) return;
    let phrase = Math.floor(Math.random() * phrases.length);
    if (phrase === previousPhrase && phrases.length > 1) phrase = (phrase + 1) % phrases.length;
    previousPhrase = phrase;
    speak(phrases[phrase]);
  });
  motionButton.addEventListener('click', () => {
    manuallyPaused = !manuallyPaused;
    syncMascot();
  });
  mascot.querySelector('.mascot-home').addEventListener('click', goHome);
  house.addEventListener('click', () => out ? goHome() : comeOut());
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && speaking) resumeMascot();
  });
  const paintEyes = () => {
    eyeFrame = 0;
    if (!pointer || mascot.hidden || manuallyPaused || menu.open || document.hidden || reducedMotion.matches) return;
    const rect = mascot.querySelector('.dog-art').getBoundingClientRect();
    pupils.forEach(pupil => {
      const dx = (pointer.x - rect.left) * 140 / rect.width - Number(pupil.dataset.eyeX);
      const dy = (pointer.y - rect.top) * 180 / rect.height - Number(pupil.dataset.eyeY);
      const distance = Math.hypot(dx, dy);
      const radius = Math.min(7, distance * .08);
      pupil.setAttribute('transform', `translate(${distance ? dx / distance * radius : 0} ${distance ? dy / distance * radius : 0})`);
    });
  };
  const requestEyes = () => { if (!eyeFrame) eyeFrame = requestAnimationFrame(paintEyes); };
  window.addEventListener('pointermove', event => {
    pointer = { x: event.clientX, y: event.clientY };
    requestEyes();
  }, { passive: true });
  mascotButton.addEventListener('pointerdown', event => {
    if (!event.isPrimary || event.button !== 0) return;
    const rect = mascot.getBoundingClientRect();
    drag = { id: event.pointerId, x: event.clientX, y: event.clientY, start: { x: rect.left, y: rect.top }, moved: false };
    mascotButton.setPointerCapture(event.pointerId);
  });
  mascotButton.addEventListener('pointermove', event => {
    if (!drag || event.pointerId !== drag.id) return;
    const dx = event.clientX - drag.x, dy = event.clientY - drag.y;
    if (!drag.moved && Math.hypot(dx, dy) < 6) return;
    if (!drag.moved) {
      stopTravel();
      out = true;
      syncHouse();
    }
    drag.moved = true;
    resumeMascot();
    mascot.classList.add('is-dragging');
    mascot.dataset.state = 'dragging';
    place({ x: drag.start.x + dx, y: drag.start.y + dy });
    requestEyes();
  });
  const finishDrag = event => {
    if (!drag || event.pointerId !== drag.id) return;
    const moved = drag.moved;
    drag = null;
    mascot.classList.remove('is-dragging');
    if (mascotButton.hasPointerCapture(event.pointerId)) mascotButton.releasePointerCapture(event.pointerId);
    if (moved) {
      suppressClickUntil = performance.now() + 500;
      goHome();
    }
  };
  ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(type => mascotButton.addEventListener(type, finishDrag));
  const resizeMascot = () => {
    if (mascot.hidden) return;
    stopTravel();
    if (drag) place(position);
    else if (out) { place(centerPosition()); mascot.dataset.state = 'idle'; }
    else goHome();
  };
  document.addEventListener('visibilitychange', syncMascot);
  document.addEventListener('navigationchange', () => {
    if (menu.open && drag) finishDrag({ pointerId: drag.id });
    syncMascot();
  });
  reducedMotion.addEventListener('change', () => {
    pupils.forEach(pupil => pupil.removeAttribute('transform'));
    resizeMascot();
    syncMascot();
  });
  window.addEventListener('resize', resizeMascot, { passive: true });
  mascot.hidden = false;
  house.hidden = false;
  syncHouse();
  place(reducedMotion.matches ? centerPosition() : housePosition());
  mascot.dataset.state = reducedMotion.matches ? 'idle' : 'greeting';
  mascot.classList.toggle('is-greeting', !reducedMotion.matches);
  speak('Hi there! I’m your English buddy. Nice to meet you!');
  if (!reducedMotion.matches) introTimer = setTimeout(() => {
    mascot.dataset.state = 'walking';
    walkTo(centerPosition());
  }, 1700);
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
