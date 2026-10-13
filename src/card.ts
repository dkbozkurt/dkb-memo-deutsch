import { els, targetEl } from './dom';
import type { Lang, Result, Word } from './types';
import { replayClass } from './util';
import { faceHTML, germanPlain, otherLang } from './words';

/** Duration of the fly-away animation; also exposed to CSS as --fly-ms. */
export const FLY_MS = 320;
document.documentElement.style.setProperty('--fly-ms', `${FLY_MS}ms`);

const TAP_SLOP_PX = 8;

export function renderCard(word: Word, front: Lang, animate: boolean): void {
  const back = otherLang(front);
  els.faceFront.className = `face face--front face--${front}`;
  els.faceBack.className = `face face--back face--${back}`;
  els.faceFront.innerHTML = faceHTML(word, front);
  els.faceBack.innerHTML = faceHTML(word, back);

  // Show the front again without playing the flip animation backwards.
  els.card.classList.add('no-anim');
  els.card.classList.remove('is-flipped');
  void els.card.offsetWidth;
  els.card.classList.remove('no-anim');
  els.card.setAttribute('aria-label', `Flash card: ${front === 'de' ? germanPlain(word) : word.en}. Press to flip.`);

  if (animate) replayClass(els.shell, 'is-entering');
}

/** Pre-render the next card underneath, so it is ready the moment the top card flies off. */
export function renderGhost(word: Word | undefined, front: Lang): void {
  if (!word) return;
  els.ghostFace.className = `face face--${front}`;
  els.ghostFace.innerHTML = faceHTML(word, front);
}

export function flip(): void {
  els.card.classList.toggle('is-flipped');
}

export function visibleLang(front: Lang): Lang {
  return els.card.classList.contains('is-flipped') ? otherLang(front) : front;
}

function setStamps(progress: number): void {
  els.stampCorrect.style.opacity = String(Math.max(0, Math.min(1, progress)));
  els.stampWrong.style.opacity = String(Math.max(0, Math.min(1, -progress)));
}

/**
 * Throw the top card off screen while the waiting card slides forward.
 * `swap` runs once the waiting card sits exactly where the top card was: it must
 * render the next word into the (now reset) top card, which makes the swap invisible.
 */
export function flyOut(result: Result, swap: () => void): void {
  const dir = result ? 1 : -1;
  const { shell, ghost } = els;
  setStamps(dir);
  shell.classList.remove('is-entering');
  shell.style.transition = `transform ${FLY_MS}ms cubic-bezier(.4, 0, .9, .6)`;
  shell.style.transform = `translate(${dir * (window.innerWidth * 0.75 + 200)}px, -30px) rotate(${dir * 24}deg)`;
  ghost.classList.remove('is-refilled');
  ghost.classList.add('is-promoting');

  window.setTimeout(() => {
    shell.style.transition = 'none';
    shell.style.transform = '';
    setStamps(0);
    swap();
    // Drop the waiting card back underneath (no transition) and fade in its new word.
    ghost.classList.remove('is-promoting');
    ghost.classList.add('is-refilled');
  }, FLY_MS);
}

function snapBack(): void {
  els.shell.style.transition = 'transform .35s cubic-bezier(.2, .9, .3, 1.25)';
  els.shell.style.transform = '';
  setStamps(0);
}

interface SwipeHandlers {
  canStart: () => boolean;
  onTap: () => void;
  onSwipe: (result: Result) => void;
  onInfo: (lang: Lang) => void;
}

interface Drag {
  pointerId: number;
  x: number;
  y: number;
  dx: number;
  dy: number;
  moved: boolean;
  threshold: number;
}

export function attachSwipe({ canStart, onTap, onSwipe, onInfo }: SwipeHandlers): void {
  const { shell } = els;
  let drag: Drag | null = null;
  let frame = 0;

  // pointermove can fire far more often than the screen refreshes; write styles once per frame.
  const paint = () => {
    frame = 0;
    if (!drag) return;
    shell.style.transform = `translate3d(${drag.dx}px, ${drag.dy * 0.25}px, 0) rotate(${drag.dx * 0.05}deg)`;
    setStamps(drag.dx / drag.threshold);
  };

  shell.addEventListener('pointerdown', (e) => {
    if (!canStart() || (e.pointerType === 'mouse' && e.button !== 0)) return;
    if (targetEl(e).closest('[data-info]')) return;
    drag = {
      pointerId: e.pointerId,
      x: e.clientX,
      y: e.clientY,
      dx: 0,
      dy: 0,
      moved: false,
      threshold: Math.min(120, els.deck.offsetWidth * 0.3),
    };
    shell.setPointerCapture(e.pointerId);
  });

  shell.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.pointerId) return;
    drag.dx = e.clientX - drag.x;
    drag.dy = e.clientY - drag.y;
    if (!drag.moved && Math.hypot(drag.dx, drag.dy) > TAP_SLOP_PX) {
      drag.moved = true;
      shell.classList.remove('is-entering');
      shell.style.transition = 'none';
    }
    if (drag.moved && !frame) frame = requestAnimationFrame(paint);
  });

  const end = (e: PointerEvent) => {
    if (!drag || e.pointerId !== drag.pointerId) return;
    const d = drag;
    drag = null;
    cancelAnimationFrame(frame);
    frame = 0;
    // pointercancel, or capture lost without a pointerup (e.g. a system gesture took over)
    if (e.type !== 'pointerup') return snapBack();
    if (!d.moved) return onTap();
    if (Math.abs(d.dx) > d.threshold) onSwipe(d.dx > 0 ? 1 : 0);
    else snapBack();
  };
  shell.addEventListener('pointerup', end);
  shell.addEventListener('pointercancel', end);
  shell.addEventListener('lostpointercapture', end);

  els.card.addEventListener('click', (e) => {
    const info = targetEl(e).closest<HTMLElement>('[data-info]');
    if (info) onInfo(info.dataset.info === 'en' ? 'en' : 'de');
  });
}
