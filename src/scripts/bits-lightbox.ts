type BitImage = { src: string; width: number; height: number; alt?: string };

const dialog = document.getElementById('bits-lightbox') as HTMLDialogElement | null;
const imageEl = dialog?.querySelector<HTMLImageElement>('[data-bits-lightbox-image]') ?? null;
const countEl = dialog?.querySelector<HTMLElement>('[data-bits-lightbox-count]') ?? null;
const dotsEl = dialog?.querySelector<HTMLElement>('[data-bits-lightbox-dots]') ?? null;
const closeBtn = dialog?.querySelector<HTMLButtonElement>('[data-bits-lightbox-close]') ?? null;
const prevBtn = dialog?.querySelector<HTMLButtonElement>('[data-bits-lightbox-prev]') ?? null;
const nextBtn = dialog?.querySelector<HTMLButtonElement>('[data-bits-lightbox-next]') ?? null;

let currentImages: BitImage[] = [];
let currentIndex = 0;
const imagesCache = new WeakMap<HTMLElement, BitImage[]>();
let dotsTotal = 0;
let touchStartX = 0;
let touchStartY = 0;
let touchLastX = 0;
let touchLastY = 0;
let isTouching = false;
let pinchStartDistance = 0;
let pinchStartScale = 1;
let pinchStartTranslateX = 0;
let pinchStartTranslateY = 0;
let scale = 1;
let translateX = 0;
let translateY = 0;
let dragOffsetY = 0;
let panStartX = 0;
let panStartY = 0;
let panBaseX = 0;
let panBaseY = 0;
let gestureMode: 'swipe' | 'pan' | 'pinch' | null = null;
let scrollLocked = false;
let baseWidth = 0;
let baseHeight = 0;
let containerWidth = 0;
let containerHeight = 0;
const scrollState = {
  top: 0,
  bodyOverflow: '',
  bodyPosition: '',
  bodyTop: '',
  bodyWidth: '',
  bodyPaddingRight: '',
  docOverflow: ''
};

const showDialog = () => {
  if (!dialog) return;
  dialog.removeAttribute('hidden');
  dialog.setAttribute('aria-hidden', 'false');
};

const hideDialog = () => {
  if (!dialog) return;
  dialog.setAttribute('hidden', '');
  dialog.setAttribute('aria-hidden', 'true');
};

const clampIndex = (value: number, length: number) => {
  if (length <= 0) return 0;
  return Math.max(0, Math.min(value, length - 1));
};

const clampScale = (value: number) => Math.max(1, Math.min(value, 3));

const syncMetrics = () => {
  if (!dialog || !imageEl) return;
  const rect = imageEl.getBoundingClientRect();
  const dialogRect = dialog.getBoundingClientRect();
  if (rect.width > 0 && rect.height > 0) {
    baseWidth = rect.width / scale;
    baseHeight = rect.height / scale;
  }
  containerWidth = dialogRect.width;
  containerHeight = dialogRect.height;
};

const clampTranslate = () => {
  if (!baseWidth || !baseHeight || !containerWidth || !containerHeight) return;
  const scaledWidth = baseWidth * scale;
  const scaledHeight = baseHeight * scale;
  const maxX = Math.max(0, (scaledWidth - containerWidth) / 2);
  const maxY = Math.max(0, (scaledHeight - containerHeight) / 2);
  translateX = Math.min(maxX, Math.max(-maxX, translateX));
  translateY = Math.min(maxY, Math.max(-maxY, translateY));
};

const applyTransform = () => {
  if (!imageEl) return;
  const y = translateY + dragOffsetY;
  imageEl.style.transform = `translate(${translateX}px, ${y}px) scale(${scale})`;
};

const resetZoom = () => {
  scale = 1;
  translateX = 0;
  translateY = 0;
  dragOffsetY = 0;
  applyTransform();
  dialog?.style.removeProperty('--lb-backdrop');
};

const updateView = () => {
  const image = currentImages[currentIndex];
  if (!image || !imageEl) return;
  imageEl.src = image.src;
  imageEl.alt = image.alt ?? '';
  imageEl.width = image.width;
  imageEl.height = image.height;
  resetZoom();
  if (countEl) {
    countEl.textContent = `${currentIndex + 1} / ${currentImages.length}`;
  }
  updateDots();
  window.requestAnimationFrame(() => {
    syncMetrics();
    clampTranslate();
    applyTransform();
  });
};

const updateNav = () => {
  if (prevBtn) prevBtn.disabled = currentIndex <= 0;
  if (nextBtn) nextBtn.disabled = currentIndex >= currentImages.length - 1;
};

const updateDots = () => {
  if (!dotsEl) return;
  const total = currentImages.length;
  if (total !== dotsTotal) {
    dotsEl.textContent = '';
    const fragment = document.createDocumentFragment();
    for (let i = 0; i < total; i += 1) {
      const dot = document.createElement('span');
      dot.className = 'bits-lightbox-dot';
      fragment.appendChild(dot);
    }
    dotsEl.appendChild(fragment);
    dotsTotal = total;
  }
  const dots = Array.from(dotsEl.querySelectorAll<HTMLElement>('.bits-lightbox-dot'));
  dots.forEach((dot, index) => {
    dot.classList.toggle('is-active', index === currentIndex);
  });
};

const stepIndex = (delta: number) => {
  if (currentImages.length === 0) return;
  const next = currentIndex + delta;
  if (next < 0 || next >= currentImages.length) return;
  currentIndex = next;
  updateView();
  updateNav();
};

const resetDrag = () => {
  dragOffsetY = 0;
  applyTransform();
  dialog?.style.removeProperty('--lb-backdrop');
};

const lockScroll = () => {
  if (scrollLocked) return;
  const body = document.body;
  const doc = document.documentElement;
  scrollState.top = window.scrollY || doc.scrollTop || 0;
  scrollState.bodyOverflow = body.style.overflow;
  scrollState.bodyPosition = body.style.position;
  scrollState.bodyTop = body.style.top;
  scrollState.bodyWidth = body.style.width;
  scrollState.bodyPaddingRight = body.style.paddingRight;
  scrollState.docOverflow = doc.style.overflow;
  const scrollbarWidth = window.innerWidth - doc.clientWidth;
  if (scrollbarWidth > 0) {
    body.style.paddingRight = `${scrollbarWidth}px`;
  }
  body.style.overflow = 'hidden';
  body.style.position = 'fixed';
  body.style.top = `-${scrollState.top}px`;
  body.style.width = '100%';
  doc.style.overflow = 'hidden';
  scrollLocked = true;
};

const unlockScroll = () => {
  if (!scrollLocked) return;
  const body = document.body;
  const doc = document.documentElement;
  body.style.overflow = scrollState.bodyOverflow;
  body.style.position = scrollState.bodyPosition;
  body.style.top = scrollState.bodyTop;
  body.style.width = scrollState.bodyWidth;
  body.style.paddingRight = scrollState.bodyPaddingRight;
  doc.style.overflow = scrollState.docOverflow;
  window.scrollTo(0, scrollState.top);
  scrollLocked = false;
};

const openDialog = (images: BitImage[], index: number) => {
  if (!dialog || images.length === 0) return;
  currentImages = images;
  currentIndex = clampIndex(index, images.length);
  updateView();
  updateNav();
  showDialog();
  if (!dialog.open) {
    if (typeof dialog.showModal === 'function') {
      dialog.showModal();
    } else {
      dialog.setAttribute('open', '');
    }
  }
  dialog.focus();
  lockScroll();
};

const closeDialog = () => {
  if (!dialog) return;
  if (dialog.open) {
    if (typeof dialog.close === 'function') {
      dialog.close();
    } else {
      dialog.removeAttribute('open');
    }
    resetDrag();
    unlockScroll();
  }
  hideDialog();
};

const parseImages = (card: HTMLElement) => {
  const cached = imagesCache.get(card);
  if (cached) return cached;
  const script = card.querySelector<HTMLScriptElement>('script[data-bit-images]');
  if (!script?.textContent) return null;
  try {
    const parsed = JSON.parse(script.textContent) as BitImage[];
    if (!Array.isArray(parsed)) return null;
    imagesCache.set(card, parsed);
    return parsed;
  } catch {
    return null;
  }
};

const handleOpen = (button: HTMLButtonElement, index: number) => {
  const card = button.closest<HTMLElement>('[data-bit]');
  if (!card) return;
  const images = parseImages(card);
  if (!images || images.length === 0) return;
  openDialog(images, index);
};

const init = () => {
  if (!dialog) return;
  window.addEventListener('resize', () => {
    if (!dialog.open) return;
    syncMetrics();
    clampTranslate();
    applyTransform();
  });
  document.addEventListener('click', (event) => {
    const target = event.target as HTMLElement | null;
    if (!target) return;
    const hiddenTrigger = target.closest<HTMLElement>('[data-bit-image-open-hidden]');
    if (hiddenTrigger) {
      const button = hiddenTrigger.closest<HTMLButtonElement>('[data-bit-image-button]');
      if (!button) return;
      const hiddenIndex = Number(hiddenTrigger.getAttribute('data-bit-image-open-hidden') ?? '0');
      handleOpen(button, hiddenIndex);
      return;
    }
    const button = target.closest<HTMLButtonElement>('[data-bit-image-button]');
    if (!button) return;
    const index = Number(button.getAttribute('data-bit-image-index') ?? '0');
    handleOpen(button, index);
  });

  prevBtn?.addEventListener('click', () => stepIndex(-1));
  nextBtn?.addEventListener('click', () => stepIndex(1));

  closeBtn?.addEventListener('click', closeDialog);
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) closeDialog();
  });
  dialog.addEventListener('cancel', closeDialog);
  dialog.addEventListener('keydown', (event) => {
    if (!dialog.open) return;
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      stepIndex(-1);
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      stepIndex(1);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      closeDialog();
    }
  });

  if (imageEl) {
    imageEl.addEventListener('load', () => {
      syncMetrics();
      clampTranslate();
      applyTransform();
    });

    imageEl.addEventListener('touchstart', (event) => {
      if (!dialog.open) return;
      if (event.touches.length === 2) {
        const touchA = event.touches.item(0);
        const touchB = event.touches.item(1);
        if (!touchA || !touchB) return;
        const dx = touchA.clientX - touchB.clientX;
        const dy = touchA.clientY - touchB.clientY;
        pinchStartDistance = Math.hypot(dx, dy);
        pinchStartScale = scale;
        pinchStartTranslateX = translateX;
        pinchStartTranslateY = translateY;
        gestureMode = 'pinch';
        isTouching = true;
        return;
      }
      if (event.touches.length !== 1) return;
      const touch = event.touches.item(0);
      if (!touch) return;
      touchStartX = touch.clientX;
      touchStartY = touch.clientY;
      touchLastX = touchStartX;
      touchLastY = touchStartY;
      if (scale > 1.01) {
        gestureMode = 'pan';
        panStartX = touchStartX;
        panStartY = touchStartY;
        panBaseX = translateX;
        panBaseY = translateY;
      } else {
        gestureMode = 'swipe';
      }
      isTouching = true;
    }, { passive: true });

    imageEl.addEventListener('touchmove', (event) => {
      if (!isTouching) return;
      if (gestureMode === 'pinch' && event.touches.length === 2) {
        const touchA = event.touches.item(0);
        const touchB = event.touches.item(1);
        if (!touchA || !touchB) return;
        const dx = touchA.clientX - touchB.clientX;
        const dy = touchA.clientY - touchB.clientY;
        const distance = Math.hypot(dx, dy);
        if (pinchStartDistance > 0) {
          const dialogRect = dialog.getBoundingClientRect();
          const centerX = (touchA.clientX + touchB.clientX) / 2 - (dialogRect.left + dialogRect.width / 2);
          const centerY = (touchA.clientY + touchB.clientY) / 2 - (dialogRect.top + dialogRect.height / 2);
          const nextScale = clampScale(pinchStartScale * (distance / pinchStartDistance));
          const ratio = nextScale / pinchStartScale;
          translateX = centerX - (centerX - pinchStartTranslateX) * ratio;
          translateY = centerY - (centerY - pinchStartTranslateY) * ratio;
          scale = nextScale;
          syncMetrics();
          clampTranslate();
          applyTransform();
        }
        return;
      }
      if (event.touches.length !== 1) return;
      const touch = event.touches.item(0);
      if (!touch) return;
      touchLastX = touch.clientX;
      touchLastY = touch.clientY;
      const dx = touchLastX - touchStartX;
      const dy = touchLastY - touchStartY;
      if (gestureMode === 'pan') {
        translateX = panBaseX + (touchLastX - panStartX);
        translateY = panBaseY + (touchLastY - panStartY);
        syncMetrics();
        clampTranslate();
        applyTransform();
        return;
      }
      if (gestureMode === 'swipe') {
        if (Math.abs(dy) > Math.abs(dx) && dy > 0) {
          dragOffsetY = dy;
          applyTransform();
          const dim = Math.max(0.4, 0.85 - dy / 420);
          dialog.style.setProperty('--lb-backdrop', String(dim));
        }
      }
    }, { passive: true });

    imageEl.addEventListener('touchend', (event) => {
      if (!isTouching) return;
      if (event.touches.length > 0) {
        if (gestureMode === 'pinch' && event.touches.length === 1) {
          gestureMode = scale > 1.01 ? 'pan' : 'swipe';
        }
        return;
      }
      const dx = touchLastX - touchStartX;
      const dy = touchLastY - touchStartY;
      isTouching = false;
      if (gestureMode === 'pinch') {
        if (scale <= 1.01) {
          scale = 1;
          translateX = 0;
          translateY = 0;
          applyTransform();
        } else {
          syncMetrics();
          clampTranslate();
          applyTransform();
        }
        gestureMode = null;
        return;
      }
      if (gestureMode === 'pan') {
        syncMetrics();
        clampTranslate();
        applyTransform();
        gestureMode = null;
        return;
      }
      if (gestureMode === 'swipe') {
        if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) && scale <= 1.01) {
          stepIndex(dx > 0 ? -1 : 1);
          resetDrag();
          gestureMode = null;
          return;
        }
        if (dy > 80 && dy > Math.abs(dx) && scale <= 1.01) {
          closeDialog();
          gestureMode = null;
          return;
        }
        resetDrag();
      }
      gestureMode = null;
    });

    imageEl.addEventListener('touchcancel', () => {
      isTouching = false;
      gestureMode = null;
      resetDrag();
    });
  }
};

init();
