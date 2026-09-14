/* ==========================================================================
   FOR GEORGI — script.js
   --------------------------------------------------------------------------
   Vanilla JS. No frameworks, no build step. Open index.html directly.

   Sections:
   01. Config & helpers
   02. Screen navigation (next / prev / restart / progress)
   03. Background star field (canvas, layered parallax)
   04. Floating particles (canvas)
   05. Cursor trail (desktop only)
   06. Magnetic buttons & card tilt (desktop only)
   07. Parallax on mouse move (moon + stars)
   08. Screen 1 — intro
   09. Screen 2 — envelope + letter typewriter
   10. Screen 3 — constellation stars
   11. Screen 4 — photo card
   12. Screen 5 — distance line
   13. Screen 6 — heart
   14. Screen 7 — ambient mode
   15. Music toggle + volume
   16. Secret easter egg
   17. Init
   ========================================================================== */

'use strict';

/* ==========================================================================
   01. CONFIG & HELPERS
   ========================================================================== */

// CUSTOMIZATION: central place for text, counts, and behaviour.
const CONFIG = {
  totalScreens: 7,

  // Screen 2 — letter text (typewriter). Write your own sincere words here.
  letter:
    'Some nights I look up and the distance feels smaller. ' +
    'You feel closer than the stars make it seem. ' +
    'I hope this reaches you the way I meant it — gently, and always.',

  // Screen 3 — messages hidden inside stars (one per clickable message-star).
  starMessages: [
    'I hope this makes you smile.',
    'Some distances feel smaller at night.',
    'You crossed my mind again.',
    'Wish you were here.',
    'A little piece of this night is yours.',
    'Look at the sky for a second.',
  ],

  // Screen 3 — how many message-stars must be found to unlock the next stage.
  starsNeeded: 5,

  // Screen 6 — the final genuine message to Georgi.
  finalMessage: [
    'Okay, you clicked it.',
    'I wanted you to know that missing you has become its own kind of closeness. ' +
    'I carry the quiet moments with me — the ones that don\'t need words, ' +
    'the ones that stay long after the room goes still.',
    'Thank you for being someone worth looking for in every sky. ' +
    'I hope we get to share more of these nights.',
  ],

  typeSpeed: 34,        // ms per character for the typewriter
  typeSpeedFast: 12,    // faster typewriter for short reveals
};

const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const isFinePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

// Cached DOM references (all elements exist in index.html).
const $ = (id) => document.getElementById(id);

const screens = Array.from(document.querySelectorAll('.screen'));
const stage = $('stage');
const progressLabel = $('progressLabel');
const progressDots = $('progressDots');
const prevBtn = $('prevBtn');
const nextBtn = $('nextBtn');
const restartBtn = $('restartBtn');

let current = 0; // 0-based index of active screen

const wait = (ms) => new Promise((res) => setTimeout(res, ms));

function clamp(v, min, max) { return Math.min(max, Math.max(min, v)); }

// Simple character-by-character typewriter. Returns a promise that resolves when done.
async function typeText(el, text, speed = CONFIG.typeSpeed) {
  el.textContent = '';
  // Reduced-motion users get the text instantly instead of a character-by-character reveal.
  if (prefersReducedMotion) {
    el.textContent = text;
    return;
  }
  const chars = Array.from(text);
  for (let i = 0; i < chars.length; i++) {
    el.textContent += chars[i];
    await wait(speed);
  }
}

/* ==========================================================================
   02. SCREEN NAVIGATION
   ========================================================================== */

// Build the glowing progress dots once.
screens.forEach((screen, i) => {
  const dot = document.createElement('button');
  dot.type = 'button';
  dot.className = 'progress__dot';
  dot.setAttribute('aria-label', 'Go to section ' + (i + 1));
  dot.addEventListener('click', () => goTo(i));
  progressDots.appendChild(dot);
});

function updateProgress() {
  const label = String(current + 1).padStart(2, '0') + ' / ' + String(CONFIG.totalScreens).padStart(2, '0');
  progressLabel.textContent = label;

  const dots = progressDots.children;
  for (let i = 0; i < dots.length; i++) {
    dots[i].classList.toggle('is-active', i === current);
  }

  prevBtn.disabled = current === 0;
  nextBtn.disabled = current === CONFIG.totalScreens - 1;
}

function goTo(index) {
  index = clamp(index, 0, CONFIG.totalScreens - 1);
  if (index === current) return;

  const leaving = screens[current];
  const entering = screens[index];

  leaving.classList.remove('is-active');
  leaving.classList.add('is-leaving');

  // Clean up the leaving class after the transition.
  setTimeout(() => leaving.classList.remove('is-leaving'), 800);

  // Clear any stale "leaving" state before re-entering (prevents a rapid
  // back/forward click from leaving a screen stuck invisible).
  entering.classList.remove('is-leaving');
  entering.classList.add('is-active');
  current = index;
  updateProgress();

  // Re-trigger reveal animations when a screen becomes active.
  entering.querySelectorAll('[data-reveal]').forEach((el) => {
    el.style.animation = 'none';
    // Force reflow to restart the animation.
    void el.offsetWidth;
    el.style.animation = '';
  });

  onScreenEnter(index);
}

function next() { goTo(current + 1); }
function prev() { goTo(current - 1); }
function restart() { goTo(0); }

prevBtn.addEventListener('click', prev);
nextBtn.addEventListener('click', next);
restartBtn.addEventListener('click', restart);

// Per-screen setup when it becomes active.
function onScreenEnter(index) {
  switch (index) {
    case 2:
      // Keep the constellation pristine on revisit.
      buildConstellation();
      break;
    default:
      break;
  }
}

/* ==========================================================================
   03. BACKGROUND STAR FIELD (canvas)
   ========================================================================== */

const starCanvas = $('starField');
const starCtx = starCanvas.getContext('2d');
let starField = [];
let starW = 0;
let starH = 0;

function makeStars() {
  // CUSTOMIZATION: cap particle/star counts for performance (~150-250 total).
  const count = clamp(Math.floor((window.innerWidth * window.innerHeight) / 9000), 90, 220);
  starField = [];
  for (let i = 0; i < count; i++) {
    starField.push({
      x: Math.random(),
      y: Math.random(),
      r: Math.random() * 1.1 + 0.2,
      depth: Math.random() * 0.7 + 0.3,   // parallax layer
      twinkle: Math.random() * Math.PI * 2,
      speed: Math.random() * 0.6 + 0.2,
      alpha: Math.random() * 0.5 + 0.4,
    });
  }
}

function resizeStarCanvas() {
  starW = starCanvas.width = window.innerWidth;
  starH = starCanvas.height = window.innerHeight;
}

function drawStars(mouseX = 0, mouseY = 0, t = 0) {
  starCtx.clearRect(0, 0, starW, starH);
  const cx = (mouseX - starW / 2) * 0.01; // parallax offset
  const cy = (mouseY - starH / 2) * 0.01;

  for (const s of starField) {
    const px = (s.x * starW + cx * s.depth + starW) % starW;
    const py = (s.y * starH + cy * s.depth + starH) % starH;
    const tw = Math.sin(t * s.speed + s.twinkle) * 0.25 + 0.75;
    const a = s.alpha * tw;

    starCtx.beginPath();
    starCtx.arc(px, py, s.r, 0, Math.PI * 2);
    starCtx.fillStyle = 'rgba(245, 241, 232,' + a.toFixed(3) + ')';
    starCtx.fill();

    // Slight glow for the brightest stars.
    if (s.r > 1.0) {
      starCtx.beginPath();
      starCtx.arc(px, py, s.r * 2.6, 0, Math.PI * 2);
      starCtx.fillStyle = 'rgba(185, 174, 224,' + (a * 0.15).toFixed(3) + ')';
      starCtx.fill();
    }
  }
}

/* ==========================================================================
   04. FLOATING PARTICLES (canvas)
   ========================================================================== */

const particleCanvas = $('particles');
const pCtx = particleCanvas.getContext('2d');
let particles = [];
let pW = 0;
let pH = 0;

function makeParticles() {
  const count = prefersReducedMotion ? 0 : clamp(Math.floor(window.innerWidth / 16), 40, 90);
  particles = [];
  for (let i = 0; i < count; i++) {
    particles.push({
      x: Math.random(),
      y: Math.random(),
      r: Math.random() * 1.8 + 0.4,
      vy: Math.random() * 0.0004 + 0.00015, // upward drift
      sway: Math.random() * Math.PI * 2,
      swaySpeed: Math.random() * 0.001 + 0.0003,
      alpha: Math.random() * 0.4 + 0.12,
      hue: Math.random() > 0.85 ? 'pink' : 'lavender',
    });
  }
}

function resizeParticleCanvas() {
  pW = particleCanvas.width = window.innerWidth;
  pH = particleCanvas.height = window.innerHeight;
}

function drawParticles(mouseX = 0, mouseY = 0, t = 0) {
  pCtx.clearRect(0, 0, pW, pH);
  const nx = (mouseX - pW / 2) / (pW / 2); // -1..1
  const ny = (mouseY - pH / 2) / (pH / 2);

  for (const p of particles) {
    // gentle upward drift, wrap around.
    p.y -= p.vy;
    if (p.y < -0.02) { p.y = 1.02; p.x = Math.random(); }
    p.sway += p.swaySpeed;

    const px = (p.x + Math.sin(p.sway) * 0.008 + nx * 0.012) * pW;
    const py = (p.y + ny * 0.012) * pH;
    const color = p.hue === 'pink' ? '232, 169, 189' : '185, 174, 224';

    pCtx.beginPath();
    pCtx.arc(px, py, p.r, 0, Math.PI * 2);
    pCtx.fillStyle = 'rgba(' + color + ',' + p.alpha.toFixed(3) + ')';
    pCtx.fill();
  }
}

/* ==========================================================================
   05. CURSOR TRAIL (desktop only)
   ========================================================================== */

const trailLayer = document.querySelector('.cursor-trail');
let lastTrailX = 0;
let lastTrailY = 0;

function spawnTrailDot(x, y) {
  if (!isFinePointer || prefersReducedMotion) return;
  const dot = document.createElement('span');
  dot.className = 'cursor-trail__dot';
  dot.style.left = x + 'px';
  dot.style.top = y + 'px';
  trailLayer.appendChild(dot);
  // Remove the node after the animation to keep the DOM light.
  setTimeout(() => dot.remove(), 1500);
}

/* ==========================================================================
   06. MAGNETIC BUTTONS & CARD TILT (desktop only)
   ========================================================================== */

function setupMagneticButtons() {
  if (!isFinePointer) return;
  const buttons = document.querySelectorAll('.btn, .nav__btn, .music-toggle');

  buttons.forEach((btn) => {
    btn.addEventListener('mousemove', (e) => {
      const rect = btn.getBoundingClientRect();
      const dx = e.clientX - (rect.left + rect.width / 2);
      const dy = e.clientY - (rect.top + rect.height / 2);
      const strength = 0.35;
      btn.style.transform = 'translate(' + dx * strength + 'px,' + dy * strength + 'px)';
    });
    btn.addEventListener('mouseleave', () => {
      btn.style.transform = '';
    });
  });
}

function setupCardTilt() {
  if (!isFinePointer) return;
  const card = $('photoCard');
  if (!card) return;

  card.addEventListener('mousemove', (e) => {
    if (card.classList.contains('is-open')) return;
    const rect = card.getBoundingClientRect();
    const dx = (e.clientX - rect.left) / rect.width - 0.5;
    const dy = (e.clientY - rect.top) / rect.height - 0.5;
    card.style.transform = 'perspective(900px) rotateY(' + dx * 8 + 'deg) rotateX(' + -dy * 8 + 'deg)';
  });
  card.addEventListener('mouseleave', () => {
    if (!card.classList.contains('is-open')) card.style.transform = '';
  });
}

/* ==========================================================================
   07. PARALLAX (moon + stars follow the cursor subtly)
   ========================================================================== */

const moonWrap = document.querySelector('.sky__moon-wrap');
let mouseX = 0;
let mouseY = 0;

function setupParallax() {
  window.addEventListener('mousemove', (e) => {
    mouseX = e.clientX;
    mouseY = e.clientY;

    if (isFinePointer && !prefersReducedMotion) {
      const nx = (e.clientX / window.innerWidth - 0.5) * 2;
      const ny = (e.clientY / window.innerHeight - 0.5) * 2;
      moonWrap.style.transform = 'translate(' + nx * 14 + 'px,' + ny * 10 + 'px)';
    }

    if (Math.hypot(e.clientX - lastTrailX, e.clientY - lastTrailY) > 24) {
      spawnTrailDot(e.clientX, e.clientY);
      lastTrailX = e.clientX;
      lastTrailY = e.clientY;
    }
  });

  // On touch, gentle default drift for the moon (unless motion is reduced).
  if (!isFinePointer && !prefersReducedMotion) {
    moonWrap.style.transition = 'transform 6s ease-in-out';
    let drift = 0;
    setInterval(() => {
      drift += 0.5;
      moonWrap.style.transform = 'translate(' + Math.sin(drift) * 10 + 'px,' + Math.cos(drift) * 6 + 'px)';
    }, 3000);
  }
}

/* ==========================================================================
   08. SCREEN 1 — INTRO
   ========================================================================== */

const introOpenBtn = document.querySelector('.intro-open');

function particleBurst() {
  // A short, soft burst of particles near the center of the screen.
  if (prefersReducedMotion || !isFinePointer) return;
  const cx = window.innerWidth / 2;
  const cy = window.innerHeight / 2;
  for (let i = 0; i < 26; i++) {
    const dot = document.createElement('span');
    dot.className = 'cursor-trail__dot';
    const angle = (Math.PI * 2 * i) / 26;
    const dist = 40 + Math.random() * 90;
    dot.style.left = cx + Math.cos(angle) * dist + 'px';
    dot.style.top = cy + Math.sin(angle) * dist + 'px';
    dot.style.width = '6px';
    dot.style.height = '6px';
    dot.style.animationDuration = '1.6s';
    trailLayer.appendChild(dot);
    setTimeout(() => dot.remove(), 1700);
  }
}

if (introOpenBtn) {
  introOpenBtn.addEventListener('click', () => {
    // Soft transition: briefly brighten the moon.
    const moonGlow = document.querySelector('.sky__moon-glow');
    if (moonGlow) moonGlow.style.opacity = '1';
    particleBurst();
    setTimeout(next, 420);
  });
}

/* ==========================================================================
   09. SCREEN 2 — ENVELOPE + LETTER TYPEWRITER
   ========================================================================== */

const envelope = $('envelope');
const openLetterBtn = $('openLetterBtn');
const letterTextEl = $('letterText');
let letterOpened = false;

if (openLetterBtn) {
  openLetterBtn.addEventListener('click', async () => {
    if (letterOpened) return;
    letterOpened = true;
    openLetterBtn.disabled = true;
    openLetterBtn.style.opacity = '0.4';
    openLetterBtn.style.pointerEvents = 'none';

    envelope.classList.add('is-open');

    // Type the letter after the flap opens.
    await wait(prefersReducedMotion ? 200 : 1000);
    await typeText(letterTextEl, CONFIG.letter, CONFIG.typeSpeed);
  });
}

/* ==========================================================================
   10. SCREEN 3 — CONSTELLATION STARS
   ========================================================================== */

const constellation = $('constellation');
const foundCounter = $('foundCounter');
const stageMessage = $('stageMessage');
const toPhotoBtn = $('toPhotoBtn');
let foundCount = 0;
let foundMessages = new Set();

function buildConstellation() {
  if (!constellation) return;
  foundCount = 0;
  foundMessages = new Set();
  updateFoundCounter();
  stageMessage.textContent = '';
  toPhotoBtn.classList.add('is-hidden');
  constellation.innerHTML = '';

  // CUSTOMIZATION: number of stars to generate in the clickable sky.
  const totalStars = 16;
  const messageCount = CONFIG.starMessages.length; // 6

  // Randomly choose which stars hold hidden messages.
  const messageIndices = new Set();
  while (messageIndices.size < messageCount) {
    messageIndices.add(Math.floor(Math.random() * totalStars));
  }

  let msgIdx = 0;

  for (let i = 0; i < totalStars; i++) {
    const star = document.createElement('button');
    star.type = 'button';
    star.className = 'constellation__star';
    star.setAttribute('aria-label', 'A star in the sky');

    // Random, but avoid edges.
    const x = 8 + Math.random() * 84;      // % left
    const y = 10 + Math.random() * 80;     // % top
    star.style.left = x + '%';
    star.style.top = y + '%';

    // Some stars brighter than others.
    const bright = Math.random();
    if (bright > 0.7) {
      star.style.width = '8px';
      star.style.height = '8px';
      star.style.boxShadow = '0 0 14px rgba(245,241,232,1)';
    } else if (bright > 0.35) {
      star.style.width = '5px';
      star.style.height = '5px';
      star.style.boxShadow = '0 0 10px rgba(245,241,232,0.9)';
    } else {
      star.style.width = '3px';
      star.style.height = '3px';
      star.style.boxShadow = '0 0 6px rgba(245,241,232,0.7)';
    }

    // Store which message (if any) this star reveals.
    if (messageIndices.has(i)) {
      star.dataset.message = String(msgIdx);
      msgIdx++;
    } else {
      star.dataset.message = '';
    }

    star.addEventListener('click', () => handleStarClick(star));
    constellation.appendChild(star);
  }
}

function handleStarClick(star) {
  if (star.classList.contains('is-found')) return;

  star.classList.add('is-found', 'is-burst');
  setTimeout(() => star.classList.remove('is-burst'), 900);

  if (star.dataset.message !== '') {
    const idx = Number(star.dataset.message);
    if (!foundMessages.has(idx)) {
      foundMessages.add(idx);
      foundCount++;
      stageMessage.textContent = CONFIG.starMessages[idx];
    }
  } else {
    stageMessage.textContent = 'Just a little light.';
  }

  updateFoundCounter();

  if (foundCount >= CONFIG.starsNeeded) {
    unlockNextStage();
  }
}

function updateFoundCounter() {
  foundCounter.textContent = foundCount + ' / ' + CONFIG.starsNeeded;
}

let toPhotoBound = false;

function unlockNextStage() {
  stageMessage.textContent = 'You found them all.';
  toPhotoBtn.classList.remove('is-hidden');

  // Bind the button once so repeated star discoveries don't stack listeners.
  if (!toPhotoBound) {
    toPhotoBound = true;
    toPhotoBtn.addEventListener('click', () => next());
  }
}

/* ==========================================================================
   11. SCREEN 4 — PHOTO CARD
   ========================================================================== */

const photoCard = $('photoCard');
const photoImg = $('photoImg');
const photoMessage = $('photoMessage');
const photoFallback = photoCard ? photoCard.querySelector('.photo-card__fallback') : null;

// PUT GEORGI'S PHOTO AT: assets/georgi.jpg
// If the image loads, reveal it and hide the fallback placeholder.
if (photoImg) {
  const showLoadedPhoto = () => {
    photoImg.classList.add('is-loaded');
    if (photoFallback) photoFallback.classList.add('is-hidden');
  };

  // Handle images that already finished loading before this script attached
  // (common with cached images or fast file:// loads).
  if (photoImg.complete && photoImg.naturalWidth > 0) {
    showLoadedPhoto();
  } else {
    photoImg.addEventListener('load', showLoadedPhoto);
  }

  // If the photo is missing, the dreamy fallback remains visible.
  photoImg.addEventListener('error', () => {
    if (photoFallback) photoFallback.classList.remove('is-hidden');
  });
}

if (photoCard) {
  const togglePhoto = () => {
    photoCard.classList.toggle('is-open');
    if (photoCard.classList.contains('is-open')) {
      photoMessage.textContent = 'My favorite view tonight.';
      photoMessage.classList.add('is-visible');
      photoCard.style.transform = 'scale(1.05)';
    } else {
      photoMessage.classList.remove('is-visible');
      photoMessage.textContent = '';
      photoCard.style.transform = '';
    }
  };

  photoCard.addEventListener('click', togglePhoto);

  // The card is role="button" + tabindex, so it must respond to keyboard too.
  photoCard.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      togglePhoto();
    }
  });
}

/* ==========================================================================
   12. SCREEN 5 — DISTANCE LINE
   ========================================================================== */

const distance = $('distance');
const distanceLine = $('distanceLine');
const distanceMessage = $('distanceMessage');
let distanceClicked = false;

if (distanceLine) {
  distanceLine.addEventListener('click', () => {
    if (distanceClicked) return;
    distanceClicked = true;
    distance.classList.add('is-closing');

    setTimeout(() => {
      distanceMessage.innerHTML =
        '<span>Distance is real. So is the connection.</span>' +
        '<span>Some things don\'t need the same room.</span>';
      // Stagger reveal using CSS animation helper.
      const spans = distanceMessage.querySelectorAll('span');
      spans.forEach((s, i) => {
        s.style.opacity = '0';
        s.style.transform = 'translateY(8px)';
        s.style.transition = 'opacity 0.8s ease, transform 0.8s ease';
        setTimeout(() => {
          s.style.opacity = '1';
          s.style.transform = 'translateY(0)';
        }, 350 + i * 650);
      });
    }, 1400);
  });

  distanceLine.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      distanceLine.click();
    }
  });
}

/* ==========================================================================
   13. SCREEN 6 — HEART
   ========================================================================== */

const heartBtn = $('heartBtn');
const dontClickBtn = $('dontClickBtn');
const finalLetter = $('finalLetter');
let heartClicked = false;

function activateHeart() {
  if (heartClicked) return;
  heartClicked = true;

  heartBtn.classList.add('is-beating');
  particleBurst();
  if (dontClickBtn) {
    dontClickBtn.style.opacity = '0.4';
    dontClickBtn.style.pointerEvents = 'none';
  }

  // Reveal final letter (staggered paragraphs).
  finalLetter.innerHTML = '';
  CONFIG.finalMessage.forEach((para, i) => {
    const p = document.createElement('p');
    p.textContent = para;
    p.style.opacity = '0';
    p.style.transform = 'translateY(10px)';
    p.style.transition = 'opacity 1s ease, transform 1s ease';
    finalLetter.appendChild(p);

    setTimeout(() => {
      p.style.opacity = '1';
      p.style.transform = 'translateY(0)';
    }, 600 + i * 1200);
  });
}

if (heartBtn) heartBtn.addEventListener('click', activateHeart);
if (dontClickBtn) dontClickBtn.addEventListener('click', activateHeart);

/* ==========================================================================
   14. SCREEN 7 — AMBIENT MODE
   ========================================================================== */

const ambientBtn = $('ambientBtn');

if (ambientBtn) {
  ambientBtn.addEventListener('click', () => {
    document.body.classList.add('is-ambient');
    // Fade the button itself too.
    ambientBtn.style.opacity = '0';
    ambientBtn.style.pointerEvents = 'none';
  });
}

/* ==========================================================================
   15. MUSIC TOGGLE + VOLUME
   ========================================================================== */

const musicToggle = $('musicToggle');
const volumeWrap = $('volumeWrap');
const volumeSlider = $('volumeSlider');
const bgMusic = $('bgMusic');

let musicReady = false;

// PUT YOUR MUSIC AT: assets/music.mp3
// Music never autoplays (browser rules). It starts only after a user gesture.
if (musicToggle && bgMusic) {
  bgMusic.volume = volumeSlider ? Number(volumeSlider.value) : 0.6;

  // Reveal the volume slider when music actually starts.
  musicToggle.addEventListener('click', async () => {
    if (!musicReady) {
      try {
        // Attempt to play. If the file is missing, keep the UI calm (no errors).
        await bgMusic.play();
        musicReady = true;
      } catch (err) {
        // Missing file or blocked autoplay — remain silent, don't throw.
        console.info('Music not available yet (add assets/music.mp3).');
        return;
      }
      musicToggle.classList.add('is-playing');
      musicToggle.setAttribute('aria-pressed', 'true');
      musicToggle.querySelector('.music-toggle__label').textContent = 'pause';
      volumeWrap.hidden = false;
    } else {
      if (bgMusic.paused) {
        await bgMusic.play().catch(() => {});
        musicToggle.classList.add('is-playing');
        musicToggle.setAttribute('aria-pressed', 'true');
        musicToggle.querySelector('.music-toggle__label').textContent = 'pause';
      } else {
        bgMusic.pause();
        musicToggle.classList.remove('is-playing');
        musicToggle.setAttribute('aria-pressed', 'false');
        musicToggle.querySelector('.music-toggle__label').textContent = 'music';
      }
    }
  });
}

if (volumeSlider && bgMusic) {
  volumeSlider.addEventListener('input', () => {
    bgMusic.volume = Number(volumeSlider.value);
  });
}

/* ==========================================================================
   16. SECRET EASTER EGG
   --------------------------------------------------------------------------
   Undocumented interaction: click the moon three times.
   ========================================================================== */

let moonClicks = 0;
const secretToast = $('secretToast');

if (moonWrap && secretToast) {
  moonWrap.addEventListener('click', () => {
    moonClicks++;
    if (moonClicks >= 3) {
      moonClicks = 0;
      showSecret('Somewhere between the stars, I kept a wish. It had your name in it.');
    }
  });
}

function showSecret(text) {
  secretToast.textContent = text;
  secretToast.classList.add('is-visible');
  clearTimeout(secretToast._hideTimer);
  secretToast._hideTimer = setTimeout(() => {
    secretToast.classList.remove('is-visible');
  }, 4200);
}

/* ==========================================================================
   17. INIT
   ========================================================================== */

function init() {
  resizeStarCanvas();
  resizeParticleCanvas();
  makeStars();
  makeParticles();

  updateProgress();
  buildConstellation();
  setupParallax();
  setupMagneticButtons();
  setupCardTilt();

  // Background animation loop (rAF for canvas only).
  if (!prefersReducedMotion) {
    let raf;
    const start = performance.now();
    const loop = (now) => {
      const t = (now - start) / 1000;
      drawStars(mouseX, mouseY, t);
      drawParticles(mouseX, mouseY, t);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
  } else {
    // Reduced motion: render a static star field once.
    drawStars(0, 0, 0);
  }

  window.addEventListener('resize', () => {
    resizeStarCanvas();
    resizeParticleCanvas();
    makeStars();
    makeParticles();
  });
}

// Run once the DOM is ready.
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
