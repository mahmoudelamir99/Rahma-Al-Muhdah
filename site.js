(() => {
  let toastTimer = null;

  const STORAGE_KEYS = {
    session: 'rahmaAuthSession',
    applicationProfile: 'rahmaApplicationProfile',
    applications: 'rahmaJobApplications',
    socialDraft: 'rahmaSocialDraft',
    bookmarkedJobs: 'rahmaBookmarkedJobs',
  };
  const COMPANY_DASHBOARD_FEEDBACK_STORAGE_KEY = 'rahmaCompanyDashboardFeedback';
  const PUBLIC_SITE_BUILD = '20260410-2';
  const PUBLIC_SITE_BUILD_MARKER_KEY = 'rahmaPublicBuildMarker';
  const SESSION_TTL_MS = 12 * 60 * 60 * 1000;
  let publicJobsCoverflowSwiper = null;
  let publicCountersObserver = null;
  /** Re-bound inside `initJobsSearch` so `renderPublicJobsPage` can re-apply filters after DOM rebuild (e.g. Firebase). */
  let refreshPublicJobsListingFilters = () => {};

  const ensureToast = () => {
    let toast = document.querySelector('.site-toast');
    if (toast) return toast;

    toast = document.createElement('div');
    toast.className = 'site-toast';
    toast.style.position = 'fixed';
    toast.style.bottom = '24px';
    toast.style.insetInlineStart = '24px';
    toast.style.zIndex = '9999';
    toast.style.padding = '12px 18px';
    toast.style.borderRadius = '14px';
    toast.style.background = 'rgba(17, 24, 39, 0.95)';
    toast.style.color = '#fff';
    toast.style.fontFamily = "'Cairo', sans-serif";
    toast.style.fontSize = '14px';
    toast.style.boxShadow = '0 10px 30px rgba(0,0,0,0.2)';
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(8px)';
    toast.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
    document.body.appendChild(toast);
    return toast;
  };

  const showToast = (message) => {
    if (!message) return;

    const toast = ensureToast();
    toast.textContent = repairLegacyMojibakeText(message);
    toast.dir = 'rtl';

    if (toastTimer) {
      clearTimeout(toastTimer);
    }

    requestAnimationFrame(() => {
      toast.style.opacity = '1';
      toast.style.transform = 'translateY(0)';
    });

    toastTimer = setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(8px)';
    }, 2200);
  };

  function normalize(value) {
    return repairLegacyMojibakeText((value || '').toString()).trim().toLowerCase();
  }
  const normalizeEasternArabicDigits = (value = '') =>
    String(value || '')
      .replace(/[٠-٩]/g, (digit) => String(digit.charCodeAt(0) - 1632))
      .replace(/[۰-۹]/g, (digit) => String(digit.charCodeAt(0) - 1776));
  const parseNumericTextValue = (value = '') =>
    Number.parseInt(normalizeEasternArabicDigits(String(value || '')).replace(/[^\d-]/g, ''), 10);
  const formatArabicInteger = (value) =>
    new Intl.NumberFormat('ar-EG').format(Math.max(0, Math.round(Number(value) || 0)));
  const prefersReducedMotion = () => {
    try {
      return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch (error) {
      return false;
    }
  };
  const supportsFinePointerInteractions = () => {
    if (prefersReducedMotion()) return false;
    try {
      return window.matchMedia('(pointer: fine)').matches;
    } catch (error) {
      return false;
    }
  };
  const shouldEnableHeavyPublicEffects = () => {
    if (!supportsFinePointerInteractions()) return false;

    try {
      const deviceMemory = Number(window.navigator?.deviceMemory || 0);
      const hardwareConcurrency = Number(window.navigator?.hardwareConcurrency || 0);

      if ((Number.isFinite(deviceMemory) && deviceMemory > 0 && deviceMemory <= 4) ||
          (Number.isFinite(hardwareConcurrency) && hardwareConcurrency > 0 && hardwareConcurrency <= 4)) {
        return false;
      }

      if (window.innerWidth < 992) {
        return false;
      }
    } catch (error) {
      return false;
    }

    return true;
  };
  const normalizeSearchTokens = (value = '') =>
    normalize(value)
      .split(/\s+/)
      .map((token) => token.trim())
      .filter(Boolean);
  const matchesSearchQuery = (query, ...parts) => {
    const tokens = normalizeSearchTokens(query);
    if (!tokens.length) return true;

    const haystack = normalize(parts.filter(Boolean).join(' '));
    if (!haystack) return false;

    return tokens.every((token) => haystack.includes(token));
  };
  const queryPublicInteractiveTargets = (root, selector) => {
    const searchRoot = root instanceof Document || root instanceof Element ? root : document;
    return Array.from(searchRoot.querySelectorAll(selector)).filter((element) => element instanceof HTMLElement);
  };
  const requestPublicMotionRefresh = () => {
    if (typeof window.RahmaRefreshMotion !== 'function') return;
    window.requestAnimationFrame(() => {
      window.RahmaRefreshMotion();
    });
  };
  const ensureInteractiveInnerShell = (element, className = 'interactive-shell__inner') => {
    const existingInner = Array.from(element.children || []).find(
      (child) => child instanceof HTMLElement && child.classList.contains(className),
    );
    if (existingInner instanceof HTMLElement) {
      return existingInner;
    }

    const inner = document.createElement('span');
    inner.className = className;
    while (element.firstChild) {
      inner.appendChild(element.firstChild);
    }
    element.appendChild(inner);
    return inner;
  };
  const initPublicSpotlightSurfaces = (root = document) => {
    const targets = queryPublicInteractiveTargets(
      root,
      '.page-card, .hero-card, .home-live-card, .listing-job-card, .directory-company-card, .jobs-coverflow-card, .job-demand-card, .home-cinematic-visual__panel',
    );

    targets.forEach((element) => {
      element.classList.add('spotlight-surface');
    });

    if (!shouldEnableHeavyPublicEffects()) {
      targets.forEach((element) => {
        element.style.removeProperty('--spotlight-active');
      });
      return;
    }

    targets.slice(0, 12).forEach((element) => {
      if (element.dataset.spotlightBound === 'true') return;
      element.dataset.spotlightBound = 'true';

      const updateSpotlight = (event) => {
        const rect = element.getBoundingClientRect();
        const x = ((event.clientX - rect.left) / Math.max(rect.width, 1)) * 100;
        const y = ((event.clientY - rect.top) / Math.max(rect.height, 1)) * 100;
        element.style.setProperty('--spotlight-x', `${Math.min(100, Math.max(0, x))}%`);
        element.style.setProperty('--spotlight-y', `${Math.min(100, Math.max(0, y))}%`);
      };

      element.addEventListener('pointerenter', (event) => {
        element.style.setProperty('--spotlight-active', '1');
        updateSpotlight(event);
      });
      element.addEventListener('pointermove', updateSpotlight);
      element.addEventListener('pointerleave', () => {
        element.style.setProperty('--spotlight-active', '0');
      });
    });
  };
  const initPublicMagneticButtons = (root = document) => {
    queryPublicInteractiveTargets(
      root,
      '.site-action, .listing-job-card__actions a, .directory-company-card__actions .site-action, .jobs-coverflow-card__actions a, .home-search-card button, .jobs-search-panel button, .directory-filters button, .jobs-coverflow-shell__arrow',
    ).forEach((element) => {
      element.classList.add('magnetic-shell');
      const inner = ensureInteractiveInnerShell(element);

      if (element.dataset.magneticBound === 'true') return;
      element.dataset.magneticBound = 'true';

      const reset = () => {
        inner.style.transform = 'translate3d(0px, 0px, 0px)';
      };

      if (!supportsFinePointerInteractions()) {
        reset();
        return;
      }

      element.addEventListener('pointermove', (event) => {
        const rect = element.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        const deltaX = event.clientX - centerX;
        const deltaY = event.clientY - centerY;
        const threshold = Math.max(rect.width, rect.height) * 0.72;
        const distance = Math.hypot(deltaX, deltaY);

        if (distance > threshold) {
          reset();
          return;
        }

        const translateX = deltaX * 0.16;
        const translateY = deltaY * 0.16;
        inner.style.transform = `translate3d(${translateX}px, ${translateY}px, 0)`;
      });

      element.addEventListener('pointerleave', reset);
      element.addEventListener('blur', reset, true);
    });
  };
  const initPublicTiltSurfaces = (root = document) => {
    const targets = queryPublicInteractiveTargets(
      root,
      '.site-brand__mark, .home-cinematic-visual__panel, .listing-job-card, .directory-company-card, .jobs-coverflow-card, .page-card, .home-live-card, .bento-card',
    );

    targets.forEach((element) => {
      element.classList.add('tilt-surface');
    });

    if (!shouldEnableHeavyPublicEffects() || typeof window.VanillaTilt?.init !== 'function') {
      return;
    }

    targets.slice(0, 14).forEach((element) => {
      if (element.vanillaTilt) return;
      window.VanillaTilt.init(element, {
        max: Number(element.dataset.tiltMax || 4),
        speed: 500,
        scale: 1,
        glare: false,
        perspective: 1200,
        gyroscope: false,
      });
    });
  };
  const animatePublicCounter = (element) => {
    if (!(element instanceof HTMLElement)) return;
    if (element.dataset.countupStarted === 'true') return;

    const targetValue = Number.parseInt(element.dataset.countupTarget || '', 10);
    if (!Number.isFinite(targetValue)) return;

    element.dataset.countupStarted = 'true';
    if (prefersReducedMotion()) {
      element.textContent = formatArabicInteger(targetValue);
      return;
    }

    const duration = Math.min(1800, 600 + targetValue * 40);
    const startedAt = performance.now();

    const frame = (now) => {
      const progress = Math.min(1, (now - startedAt) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      element.textContent = formatArabicInteger(targetValue * eased);
      if (progress < 1) {
        window.requestAnimationFrame(frame);
      } else {
        element.textContent = formatArabicInteger(targetValue);
      }
    };

    window.requestAnimationFrame(frame);
  };
  const initPublicScrollCounters = (root = document) => {
    const counters = queryPublicInteractiveTargets(root, '[data-countup]');
    if (!counters.length) return;

    counters.forEach((element) => {
      const fallbackTarget = parseNumericTextValue(element.dataset.countupTarget || element.textContent || '0');
      if (Number.isFinite(fallbackTarget)) {
        element.dataset.countupTarget = String(fallbackTarget);
      }
    });

    if (typeof window.IntersectionObserver !== 'function' || prefersReducedMotion()) {
      counters.forEach((element) => {
        const targetValue = Number.parseInt(element.dataset.countupTarget || '', 10);
        if (Number.isFinite(targetValue)) {
          element.textContent = formatArabicInteger(targetValue);
          element.dataset.countupStarted = 'true';
        }
      });
      return;
    }

    if (!publicCountersObserver) {
      publicCountersObserver = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (!entry.isIntersecting) return;
            animatePublicCounter(entry.target);
            publicCountersObserver?.unobserve(entry.target);
          });
        },
        {
          rootMargin: '0px 0px -12% 0px',
          threshold: 0.35,
        },
      );
    }

    counters.forEach((element) => {
      if (element.dataset.countupStarted === 'true') return;
      publicCountersObserver.observe(element);
    });
  };
  const buildJobsCoverflowCardMarkup = (jobData = {}) => {
    const applyDisabledAttributes = jobData.filled
      ? 'aria-disabled="true" data-disabled-message="اكتمل العدد المطلوب لهذه الوظيفة أو تم إغلاق التقديم عليها."'
      : '';
    return `
      <div class="swiper-slide jobs-coverflow__slide">
        <article class="jobs-coverflow-card">
          <div class="jobs-coverflow-card__media">
            <img src="${escapeHtml(jobData.companyImage || COMPANY_PLACEHOLDER_IMAGE)}" alt="شعار ${escapeHtml(jobData.jobCompany || 'الشركة')}"/>
          </div>
          <div class="jobs-coverflow-card__body">
            <div class="jobs-coverflow-card__top">
              <span class="jobs-coverflow-card__type">${escapeHtml(jobData.jobType || 'فرصة وظيفية')}</span>
              ${jobData.jobFeatured ? '<span class="jobs-coverflow-card__featured">مميزة</span>' : ''}
            </div>
            <h3>${escapeHtml(jobData.jobTitle || 'وظيفة بدون عنوان')}</h3>
            <p class="jobs-coverflow-card__company">${escapeHtml(jobData.jobCompany || 'شركة غير محددة')}</p>
            <div class="jobs-coverflow-card__meta">
              <span>${escapeHtml(jobData.jobLocation || 'الموقع غير مضاف')}</span>
              <span>${escapeHtml(jobData.jobSalary || 'الراتب غير مضاف')}</span>
            </div>
            <p class="jobs-coverflow-card__summary">${escapeHtml(jobData.jobSummary || 'لا توجد تفاصيل مضافة لهذه الوظيفة حتى الآن.')}</p>
            <div class="jobs-coverflow-card__demand">
              <span>مطلوب ${escapeHtml(String(jobData.positionsCount || 1))}</span>
              <span>${escapeHtml(jobData.filled ? 'اكتمل العدد المطلوب' : `باقي ${jobData.remainingCount || 0}`)}</span>
            </div>
            <div class="jobs-coverflow-card__actions">
              <a href="${escapeHtml(buildApplyUrl(jobData))}" class="jobs-coverflow-card__primary" ${applyDisabledAttributes}>${jobData.filled ? 'اكتمل العدد' : 'قدّم الآن'}</a>
              <a href="${escapeHtml(buildJobDetailsUrl(jobData))}" class="jobs-coverflow-card__secondary">التفاصيل</a>
            </div>
          </div>
        </article>
      </div>
    `;
  };
  const getJobsCoverflowMetaFromCard = (card) => {
    if (!(card instanceof HTMLElement)) return null;
    return {
      jobId: String(card.dataset.jobId || '').trim(),
      jobTitle: String(card.dataset.jobTitle || '').trim(),
      jobCompany: String(card.dataset.jobCompany || '').trim(),
      jobLocation: String(card.dataset.jobLocation || '').trim(),
      jobType: String(card.dataset.jobType || '').trim(),
      jobSalary: String(card.dataset.jobSalary || '').trim(),
      jobPosted: String(card.dataset.jobPosted || '').trim(),
      jobSummary: String(card.dataset.jobSummary || '').trim(),
      jobSector: String(card.dataset.jobSector || '').trim(),
      jobFeatured: card.dataset.jobFeatured === 'true',
      companyImage: String(card.dataset.jobCompanyImage || '').trim() || COMPANY_PLACEHOLDER_IMAGE,
      positionsCount: Number.parseInt(card.dataset.jobPositions || '1', 10) || 1,
      applicantsCount: Number.parseInt(card.dataset.jobApplicants || '0', 10) || 0,
      remainingCount: Number.parseInt(card.dataset.jobRemaining || '0', 10) || 0,
      filled: card.dataset.jobFilled === 'true',
    };
  };
  const syncJobsCoverflow = (cards = []) => {
    const shell = document.querySelector('[data-jobs-swiper-shell]');
    const swiperElement = document.querySelector('[data-jobs-swiper]');
    const wrapper = document.querySelector('[data-jobs-swiper-wrapper]');
    const paginationElement = document.querySelector('[data-jobs-swiper-pagination]');
    const nextButton = document.querySelector('[data-jobs-swiper-next]');
    const prevButton = document.querySelector('[data-jobs-swiper-prev]');

    if (!(shell instanceof HTMLElement) || !(swiperElement instanceof HTMLElement) || !(wrapper instanceof HTMLElement)) return;

    const jobCards = Array.isArray(cards) ? cards.map(getJobsCoverflowMetaFromCard).filter(Boolean) : [];

    if (publicJobsCoverflowSwiper && typeof publicJobsCoverflowSwiper.destroy === 'function') {
      publicJobsCoverflowSwiper.destroy(true, true);
      publicJobsCoverflowSwiper = null;
    }

    if (!jobCards.length) {
      wrapper.innerHTML = '';
      shell.classList.add('hidden');
      shell.hidden = true;
      return;
    }

    shell.classList.remove('hidden');
    shell.hidden = false;
    wrapper.innerHTML = jobCards.slice(0, 12).map((job) => buildJobsCoverflowCardMarkup(job)).join('');
    initPublicExperienceEnhancements(wrapper);

    if (typeof window.Swiper === 'function') {
      publicJobsCoverflowSwiper = new window.Swiper(swiperElement, {
        effect: 'coverflow',
        centeredSlides: true,
        slidesPerView: 'auto',
        grabCursor: true,
        loop: jobCards.length > 2,
        spaceBetween: 18,
        coverflowEffect: {
          rotate: 0,
          stretch: 0,
          depth: 180,
          modifier: 1.12,
          scale: 0.9,
          slideShadows: false,
        },
        pagination: paginationElement ? { el: paginationElement, clickable: true } : undefined,
        navigation:
          nextButton && prevButton
            ? {
                nextEl: nextButton,
                prevEl: prevButton,
              }
            : undefined,
        breakpoints: {
          0: { spaceBetween: 12 },
          768: { spaceBetween: 18 },
          1200: { spaceBetween: 26 },
        },
      });
    }

    requestPublicMotionRefresh();
  };
  const initPublicExperienceEnhancements = (root = document) => {
    initPublicSpotlightSurfaces(root);
    initPublicMagneticButtons(root);
    initPublicTiltSurfaces(root);
    initPublicScrollCounters(root);
  };
  const syncPublicSeoMeta = () => {
    const currentPage = window.location.pathname.split('/').pop() || 'index.html';
    if (['job-details.html', 'company-details.html'].includes(currentPage)) return;

    const canonicalLink = document.querySelector('link[rel="canonical"]');
    if (canonicalLink instanceof HTMLLinkElement) {
      const canonicalHref = canonicalLink.getAttribute('href') || window.location.pathname;
      canonicalLink.href = new URL(canonicalHref, window.location.origin).toString();
    }

    const ogUrl = document.querySelector('meta[property="og:url"]');
    if (ogUrl instanceof HTMLMetaElement) {
      ogUrl.content = new URL(window.location.pathname, window.location.origin).toString();
    }
  };
  const ensurePublicFavicon = () => {
    const faviconHref = new URL('logo-mark.png', window.location.origin).toString();
    let favicon = document.querySelector('link[rel="icon"]');

    if (!(favicon instanceof HTMLLinkElement)) {
      favicon = document.createElement('link');
      favicon.rel = 'icon';
      document.head.appendChild(favicon);
    }

    favicon.type = 'image/png';
    favicon.href = faviconHref;
  };
  const LEGACY_MOJIBAKE_PATTERN =
    /[\u00a1-\u00bf\u0192\u0152\u0153\u0161\u0178\u017e\u02c6\u200c\u201a\u201e\u2020\u2021\u2026\u2030\u2039\u203a\u06af\u06ba\u06be\u0679\u067e\u0686\u0691]/;
  const LEGACY_MOJIBAKE_FRAGMENT_PATTERN =
    /(?:(?:ط|ظ)[\u0600-\u06ff]){2,}|[\u00a1-\u00bf\u0192\u0152\u0153\u0161\u0178\u017e\u02c6\u200c\u201a\u201e\u2020\u2021\u2026\u2030\u2039\u203a]{2,}/g;
  const REPLACEMENT_CHAR_PATTERN = /\uFFFD/;
  let cp1256EncodingMap = null;

  const countLegacyMojibakeChars = (value) =>
    Array.from(String(value || '')).reduce((total, character) => total + Number(LEGACY_MOJIBAKE_PATTERN.test(character)), 0);
  const countLegacyMojibakePairs = (value) =>
    (String(value || '').match(/(?:ط[اأإآء-ي]|ظ[اأإآء-ي])/g) || []).length;
  const countReplacementChars = (value) => (String(value || '').match(/\uFFFD/g) || []).length;
  const getLegacySignalScore = (value) =>
    countLegacyMojibakeChars(value) * 3 + countLegacyMojibakePairs(value) + countReplacementChars(value) * 6;
  const shouldAttemptLegacyDecode = (value) => {
    const rawValue = String(value ?? '');
    return (
      LEGACY_MOJIBAKE_PATTERN.test(rawValue) ||
      countLegacyMojibakePairs(rawValue) >= 2 ||
      REPLACEMENT_CHAR_PATTERN.test(rawValue)
    );
  };

  const sanitizeReplacementGlyphs = (value) => {
    const rawValue = String(value ?? '');
    if (!REPLACEMENT_CHAR_PATTERN.test(rawValue)) return rawValue;

    const cleaned = rawValue.replace(/\uFFFD+/g, ' ').replace(/\s{2,}/g, ' ').trim();
    if (!cleaned) return '';

    return cleaned;
  };

  const getCp1256EncodingMap = () => {
    if (cp1256EncodingMap) return cp1256EncodingMap;

    try {
      const decoder = new TextDecoder('windows-1256', { fatal: false });
      const nextMap = new Map();

      for (let byte = 0; byte <= 255; byte += 1) {
        const character = decoder.decode(new Uint8Array([byte]));
        if (character && character !== '\uFFFD' && !nextMap.has(character)) {
          nextMap.set(character, byte);
        }
      }

      cp1256EncodingMap = nextMap;
    } catch (error) {
      cp1256EncodingMap = new Map();
    }

    return cp1256EncodingMap;
  };

  const decodeLegacyMojibakeCandidate = (value, encoderMap) => {
    const rawValue = String(value ?? '');
    if (!shouldAttemptLegacyDecode(rawValue) || !encoderMap.size) return rawValue;

    const bytes = [];

    for (const character of rawValue) {
      const codePoint = character.charCodeAt(0);
      if (codePoint <= 0x7f) {
        bytes.push(codePoint);
        continue;
      }

      const mappedByte = encoderMap.get(character);
      if (mappedByte === undefined) {
        return rawValue;
      }
      bytes.push(mappedByte);
    }

    try {
      const fixedValue = new TextDecoder('utf-8', { fatal: true }).decode(new Uint8Array(bytes));
      return getLegacySignalScore(fixedValue) < getLegacySignalScore(rawValue) ? fixedValue : rawValue;
    } catch (error) {
      return rawValue;
    }
  };

  const repairLegacyMojibakeFragments = (value, encoderMap) =>
    String(value ?? '').replace(LEGACY_MOJIBAKE_FRAGMENT_PATTERN, (fragment) => {
      const fixedFragment = decodeLegacyMojibakeCandidate(fragment, encoderMap);
      return fixedFragment;
    });

  const repairLegacyMojibakeText = (value) => {
    const rawValue = String(value ?? '');
    const sanitizedRawValue = sanitizeReplacementGlyphs(rawValue);
    if (!shouldAttemptLegacyDecode(rawValue)) return sanitizedRawValue;

    const encoderMap = getCp1256EncodingMap();
    if (!encoderMap.size) return sanitizedRawValue;

    let bestValue = sanitizedRawValue;
    let bestScore = getLegacySignalScore(sanitizedRawValue);

    const considerCandidate = (candidate) => {
      if (typeof candidate !== 'string' || candidate === bestValue) return;

      const normalizedCandidate = sanitizeReplacementGlyphs(candidate);
      const candidateScore = getLegacySignalScore(normalizedCandidate);
      if (candidateScore < bestScore) {
        bestValue = normalizedCandidate;
        bestScore = candidateScore;
      }
    };

    considerCandidate(decodeLegacyMojibakeCandidate(rawValue, encoderMap));

    considerCandidate(
      rawValue
        .split(/(\s+)/)
        .map((segment) => (/^\s+$/.test(segment) ? segment : decodeLegacyMojibakeCandidate(segment, encoderMap)))
        .join(''),
    );

    considerCandidate(repairLegacyMojibakeFragments(rawValue, encoderMap));

    let previousValue = '';
    while (bestValue !== previousValue) {
      previousValue = bestValue;

      considerCandidate(
        bestValue
          .split(/(\s+)/)
          .map((segment) => (/^\s+$/.test(segment) ? segment : decodeLegacyMojibakeCandidate(segment, encoderMap)))
          .join(''),
      );

      considerCandidate(repairLegacyMojibakeFragments(bestValue, encoderMap));
    }

    return sanitizeReplacementGlyphs(bestValue);
  };

  const repairLegacyStoredValue = (value) => {
    if (typeof value === 'string') {
      const nextValue = repairLegacyMojibakeText(value);
      return {
        value: nextValue,
        changed: nextValue !== value,
      };
    }

    if (Array.isArray(value)) {
      let changed = false;
      const nextValue = value.map((entry) => {
        const repaired = repairLegacyStoredValue(entry);
        if (repaired.changed) changed = true;
        return repaired.value;
      });
      return { value: nextValue, changed };
    }

    if (value && typeof value === 'object') {
      let changed = false;
      const nextValue = Object.fromEntries(
        Object.entries(value).map(([key, entry]) => {
          const repaired = repairLegacyStoredValue(entry);
          if (repaired.changed) changed = true;
          return [key, repaired.value];
        }),
      );
      return { value: nextValue, changed };
    }

    return { value, changed: false };
  };

  const LEGACY_MOJIBAKE_TEXT_ATTRIBUTE_NAMES = [
    'title',
    'placeholder',
    'aria-label',
    'aria-description',
    'aria-placeholder',
    'alt',
    'data-toast',
  ];
  const LEGACY_MOJIBAKE_SKIPPED_TAGS = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEXTAREA']);
  let legacyMojibakeDomObserver = null;
  let legacyMojibakeRepairFrame = null;

  const repairLegacyMojibakeElementAttributes = (element) => {
    if (!(element instanceof Element)) return;

    LEGACY_MOJIBAKE_TEXT_ATTRIBUTE_NAMES.forEach((attributeName) => {
      if (!element.hasAttribute(attributeName)) return;
      const rawValue = element.getAttribute(attributeName);
      const fixedValue = repairLegacyMojibakeText(rawValue);
      if (fixedValue !== rawValue) {
        element.setAttribute(attributeName, fixedValue);
      }
    });
  };

  const repairLegacyMojibakeTextNode = (node) => {
    if (!node || node.nodeType !== Node.TEXT_NODE) return;

    const parentTagName = node.parentElement?.tagName;
    if (parentTagName && LEGACY_MOJIBAKE_SKIPPED_TAGS.has(parentTagName)) return;

    const rawValue = node.nodeValue;
    const fixedValue = repairLegacyMojibakeText(rawValue);
    if (fixedValue !== rawValue) {
      node.nodeValue = fixedValue;
    }
  };

  const repairLegacyMojibakeSubtree = (root) => {
    if (!root) return;

    const startNode =
      root.nodeType === Node.DOCUMENT_NODE
        ? root.documentElement
        : root.nodeType === Node.TEXT_NODE
          ? root.parentElement
          : root;

    if (!(startNode instanceof Element)) return;

    repairLegacyMojibakeElementAttributes(startNode);
    startNode.querySelectorAll('*').forEach((element) => {
      repairLegacyMojibakeElementAttributes(element);
    });

    const walker = document.createTreeWalker(startNode, NodeFilter.SHOW_TEXT);
    let currentTextNode = walker.nextNode();
    while (currentTextNode) {
      repairLegacyMojibakeTextNode(currentTextNode);
      currentTextNode = walker.nextNode();
    }

    if (document.title) {
      const fixedTitle = repairLegacyMojibakeText(document.title);
      if (fixedTitle !== document.title) {
        document.title = fixedTitle;
      }
    }
  };

  const queueLegacyMojibakeDomRepair = () => {
    if (legacyMojibakeRepairFrame) return;

    legacyMojibakeRepairFrame = window.requestAnimationFrame(() => {
      legacyMojibakeRepairFrame = null;
      if (!document.documentElement) return;
      repairLegacyMojibakeSubtree(document);
    });
  };

  const shouldEnableLegacyMojibakeObserver = () => {
    try {
      const bodySample = document.body?.innerText?.slice(0, 5000) || '';
      const titleSample = document.title || '';
      const attributeSample = Array.from(
        document.querySelectorAll('[title],[placeholder],[aria-label],[alt]'),
      )
        .slice(0, 36)
        .map((element) =>
          LEGACY_MOJIBAKE_TEXT_ATTRIBUTE_NAMES.map((attributeName) => element.getAttribute(attributeName) || '')
            .join(' ')
            .trim(),
        )
        .join(' ');

      return shouldAttemptLegacyDecode(`${titleSample} ${bodySample} ${attributeSample}`);
    } catch (error) {
      return false;
    }
  };

  const initLegacyMojibakeDomRepair = () => {
    if (!document.documentElement) return;

    repairLegacyMojibakeSubtree(document);
    if (!shouldEnableLegacyMojibakeObserver()) return;
    if (legacyMojibakeDomObserver) return;

    legacyMojibakeDomObserver = new MutationObserver((mutations) => {
      const shouldRepair = mutations.some((mutation) => {
        if (mutation.type === 'characterData') {
          return Boolean(mutation.target?.nodeValue);
        }

        if (mutation.type === 'attributes') {
          return Boolean(mutation.attributeName);
        }

        return Array.from(mutation.addedNodes || []).some(
          (node) => node.nodeType === Node.ELEMENT_NODE || node.nodeType === Node.TEXT_NODE,
        );
      });

      if (shouldRepair) {
        queueLegacyMojibakeDomRepair();
      }
    });

    legacyMojibakeDomObserver.observe(document.documentElement, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
      attributeFilter: LEGACY_MOJIBAKE_TEXT_ATTRIBUTE_NAMES,
    });
  };

  const safeReadJSON = (key, fallback) => {
    try {
      const rawValue = window.localStorage.getItem(key);
      if (!rawValue) return fallback;

      const parsedValue = JSON.parse(rawValue);
      const repaired = repairLegacyStoredValue(parsedValue);

      if (repaired.changed) {
        window.localStorage.setItem(key, JSON.stringify(repaired.value));
      }

      return repaired.value;
    } catch (error) {
      console.warn(`Unable to read ${key}`, error);
      return fallback;
    }
  };

  const saveJSON = (key, value) => {
    try {
      window.localStorage.setItem(key, JSON.stringify(repairLegacyStoredValue(value).value));
      return true;
    } catch (error) {
      console.warn(`Unable to save ${key}`, error);
      return false;
    }
  };

  const readStoredSession = (storage, key) => {
    const rawValue = storage.getItem(key);
    if (!rawValue) return null;

    const parsedValue = JSON.parse(rawValue);
    const repaired = repairLegacyStoredValue(parsedValue);

    if (repaired.changed) {
      storage.setItem(key, JSON.stringify(repaired.value));
    }

    return repaired.value;
  };

  const safeReadSessionJSON = (key, fallback) => {
    try {
      return readStoredSession(window.sessionStorage, key) ?? readStoredSession(window.localStorage, key) ?? fallback;
    } catch (error) {
      console.warn(`Unable to read session ${key}`, error);
      return fallback;
    }
  };

  const saveSessionJSON = (key, value) => {
    try {
      const repairedValue = repairLegacyStoredValue(value).value;
      const rememberSession = Boolean(repairedValue?.remember);
      const primaryStorage = rememberSession ? window.localStorage : window.sessionStorage;
      const secondaryStorage = rememberSession ? window.sessionStorage : window.localStorage;
      primaryStorage.setItem(key, JSON.stringify(repairedValue));
      secondaryStorage.removeItem(key);
    } catch (error) {
      console.warn(`Unable to save session ${key}`, error);
    }
  };

  const getRelativeUrl = (url) => {
    const nextUrl = new URL(url, window.location.href);
    const relativePath = nextUrl.pathname.replace(/^\/+/, '') || 'index.html';
    return `${relativePath}${nextUrl.search}${nextUrl.hash}`;
  };

  const sanitizeInternalNavigationTarget = (target, fallback = 'index.html') => {
    const safeFallback = typeof fallback === 'string' && fallback.trim() ? fallback.trim() : 'index.html';
    if (typeof target !== 'string' || !target.trim()) return safeFallback;

    try {
      const nextUrl = new URL(target.trim(), window.location.href);
      if (!['http:', 'https:'].includes(nextUrl.protocol)) return safeFallback;
      if (nextUrl.origin !== window.location.origin) return safeFallback;
      if (!/\.html$/i.test(nextUrl.pathname)) return safeFallback;
      return getRelativeUrl(nextUrl.href);
    } catch (error) {
      console.warn('Rejected unsafe navigation target', target, error);
      return safeFallback;
    }
  };

  const navigateToInternal = (target, fallback = 'index.html') => {
    window.location.href = sanitizeInternalNavigationTarget(target, fallback);
  };


  const setSession = (session) => saveSessionJSON(STORAGE_KEYS.session, session);
  const getSession = () => {
    const session = safeReadSessionJSON(STORAGE_KEYS.session, null);
    if (!session) return null;
    if (session.expiresAt && Date.now() > Date.parse(session.expiresAt)) {
      clearSession();
      return null;
    }
    return session;
  };
  const clearSession = () => {
    window.sessionStorage.removeItem(STORAGE_KEYS.session);
    window.localStorage.removeItem(STORAGE_KEYS.session);
  };
  const saveCompanyDashboardFeedback = (payload = null) => {
    if (!payload?.selector || !payload?.message) return;
    try {
      window.sessionStorage.setItem(COMPANY_DASHBOARD_FEEDBACK_STORAGE_KEY, JSON.stringify(payload));
    } catch (error) {
      console.warn('Unable to persist company dashboard feedback', error);
    }
  };
  const consumeCompanyDashboardFeedback = () => {
    try {
      const stored = window.sessionStorage.getItem(COMPANY_DASHBOARD_FEEDBACK_STORAGE_KEY);
      if (!stored) return null;
      window.sessionStorage.removeItem(COMPANY_DASHBOARD_FEEDBACK_STORAGE_KEY);
      const parsed = JSON.parse(stored);
      if (!parsed?.selector || !parsed?.message) return null;
      return parsed;
    } catch (error) {
      window.sessionStorage.removeItem(COMPANY_DASHBOARD_FEEDBACK_STORAGE_KEY);
      return null;
    }
  };
  const waitForFirebaseAuthUser = async () => {
    if (!hasFirebaseSiteConfig()) {
      return { supported: false, user: null };
    }

    const services = await getFirebaseSiteServices();
    if (!services?.auth || !services?.authModule?.onAuthStateChanged) {
      return { supported: false, user: null };
    }

    const { auth, authModule } = services;
    if (auth.currentUser) {
      return { supported: true, user: auth.currentUser };
    }

    if (typeof auth.authStateReady === 'function') {
      try {
        await auth.authStateReady();
      } catch (error) {
        console.warn('Unable to wait for Firebase auth state readiness', error);
      }

      if (auth.currentUser) {
        return { supported: true, user: auth.currentUser };
      }
    }

    const user = await new Promise((resolve) => {
      let settled = false;
      let unsubscribe = () => {};
      const finish = (nextUser) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeoutId);
        unsubscribe();
        resolve(nextUser || null);
      };
      const timeoutId = window.setTimeout(() => finish(auth.currentUser || null), 1800);
      unsubscribe = authModule.onAuthStateChanged(
        auth,
        (nextUser) => finish(nextUser),
        () => finish(auth.currentUser || null),
      );
    });

    return { supported: true, user: user || null };
  };
  const isFirebasePermissionDeniedError = (error) => {
    const code = String(error?.code || '').trim().toLowerCase();
    const message = String(error?.message || '').trim().toLowerCase();
    return code === 'permission-denied' || message.includes('missing or insufficient permissions');
  };
  const clearSupabaseStoredAuthArtifacts = () => {
    const clearFromStorage = (storage) => {
      if (!storage) return;
      try {
        const keysToRemove = [];
        for (let index = 0; index < storage.length; index += 1) {
          const key = storage.key(index);
          if (!key) continue;
          if (/^sb-[a-z0-9-]+-auth-token(?:-code-verifier)?$/i.test(key)) {
            keysToRemove.push(key);
          }
        }
        keysToRemove.forEach((key) => storage.removeItem(key));
      } catch (error) {
        console.warn('Unable to clear Supabase auth artifacts', error);
      }
    };

    clearFromStorage(window.localStorage);
    clearFromStorage(window.sessionStorage);
  };
  const signOutCompanySession = async () => {
    try {
      if (hasFirebaseSiteConfig()) {
        const services = await getFirebaseSiteServices();
        if (services?.auth && typeof services?.authModule?.signOut === 'function') {
          await services.authModule.signOut(services.auth);
        }
      }
    } catch (error) {
      console.warn('Unable to sign out Firebase company session', error);
    } finally {
      clearSupabaseStoredAuthArtifacts();
      clearSession();
    }
  };
  const saveSocialDraft = (draft) => saveJSON(STORAGE_KEYS.socialDraft, draft);
  const getSocialDraft = () => safeReadJSON(STORAGE_KEYS.socialDraft, null);
  const clearSocialDraft = () => window.localStorage.removeItem(STORAGE_KEYS.socialDraft);
  const isAuthenticated = () => Boolean(getSession()?.loggedIn);
  const normalizeExternalBaseUrl = (value) => {
    const rawValue = String(value || '').trim();
    if (!rawValue) return '';

    try {
      const url = new URL(rawValue, window.location.origin);
      return url.href.endsWith('/') ? url.href : `${url.href}/`;
    } catch (error) {
      return '';
    }
  };
  const getDefaultAdminBaseUrl = () => {
    const host = String(window.location.hostname || '').trim().toLowerCase();
    const isLocalHost =
      host === 'localhost' ||
      host === '127.0.0.1' ||
      /^\d{1,3}(?:\.\d{1,3}){3}$/.test(host) && (
        host.startsWith('10.') ||
        host.startsWith('192.168.') ||
        /^172\.(1[6-9]|2\d|3[01])\./.test(host)
      );

    if (isLocalHost) {
      return `${window.location.protocol}//${host}:4174/`;
    }

    return 'https://rahma-al-muhdah-admin.web.app/';
  };
  const buildAdminUrl = (hashPath = '') => {
    const runtimeBaseUrl = normalizeExternalBaseUrl(window.__RAHMA_ADMIN_BASE_URL__);
    const adminBaseUrl = runtimeBaseUrl || getDefaultAdminBaseUrl();
    const normalizedHash = String(hashPath || '').trim().replace(/^#?/, '');

    if (!normalizedHash) return adminBaseUrl;
    return `${adminBaseUrl}#${normalizedHash.startsWith('/') ? normalizedHash : `/${normalizedHash}`}`;
  };
  const withAsyncTimeout = async (operation, timeoutMs = 12000, timeoutMessage = 'انتهت مهلة التنفيذ.') => {
    let timeoutId = null;

    try {
      return await Promise.race([
        Promise.resolve(operation),
        new Promise((_, reject) => {
          timeoutId = window.setTimeout(() => {
            reject(new Error(timeoutMessage));
          }, timeoutMs);
        }),
      ]);
    } finally {
      if (timeoutId) {
        window.clearTimeout(timeoutId);
      }
    }
  };

  const ADMIN_RUNTIME_KEY = 'rahmaAdminPublicRuntime.v1';
  const ADMIN_STATE_KEY = 'rahmaAdminControlCenter.v1';
  const ADMIN_LOGIN_URL = buildAdminUrl('/login');
  const ADMIN_DASHBOARD_URL = buildAdminUrl('/dashboard');
  const ADMIN_RUNTIME_SHARED_URL = 'admin-runtime.shared.json';
  const SHARED_RUNTIME_SYNC_PATH = '/__runtime-sync__/public-runtime';
  const SHARED_RUNTIME_SYNC_PORT = '4173';
  const MAINTENANCE_SHELL_ID = 'rahma-maintenance-shell';
  const COMPANY_PLACEHOLDER_IMAGE = 'assets/company-placeholder.svg';
  const COMPANY_IMAGE_MAX_BYTES = 2 * 1024 * 1024;
  const FIREBASE_SITE_CDN_BASE = 'https://www.gstatic.com/firebasejs/11.5.0';
  const FIREBASE_RUNTIME_SITE_DOC = { collection: 'siteConfig', id: 'public' };
  const firebaseSiteConfig = (() => {
    const rawConfig = window.__RAHMA_FIREBASE_CONFIG__ || {};
    return {
      apiKey: String(rawConfig.apiKey || '').trim(),
      authDomain: String(rawConfig.authDomain || '').trim(),
      projectId: String(rawConfig.projectId || '').trim(),
      storageBucket: String(rawConfig.storageBucket || '').trim(),
      messagingSenderId: String(rawConfig.messagingSenderId || '').trim(),
      appId: String(rawConfig.appId || '').trim(),
      measurementId: String(rawConfig.measurementId || '').trim(),
    };
  })();
  const hasFirebaseSiteConfig = () =>
    Boolean(firebaseSiteConfig.apiKey && firebaseSiteConfig.authDomain && firebaseSiteConfig.projectId && firebaseSiteConfig.appId);
  let firebaseSiteServicesPromise = null;
  const firebaseRuntimeCache = {
    companies: [],
    jobs: [],
    settings: {},
    content: {},
  };
  let firebaseApplicationsCache = [];
  let firebaseApplicationsCacheHydrated = false;
  let firebaseApplicationsReadDenied = false;
  let firebasePublicSyncBootstrapped = false;
  const firebasePublicUnsubscribers = [];
  const firebaseCompanyStateFingerprints = new Map();
  const hashLegacySeedKey = (value = '') => {
    let hash = 5381;
    const normalizedValue = String(value || '');
    for (let index = 0; index < normalizedValue.length; index += 1) {
      hash = ((hash << 5) + hash + normalizedValue.charCodeAt(index)) >>> 0;
    }
    return hash.toString(16).padStart(8, '0');
  };
  const isPrivateRuntimeSyncHost = (hostname = '') => {
    const normalizedHost = String(hostname || '').trim().toLowerCase();
    if (!normalizedHost) return false;
    if (normalizedHost === 'localhost' || normalizedHost === '127.0.0.1' || normalizedHost === '::1') {
      return true;
    }
    if (/^10\./.test(normalizedHost)) return true;
    if (/^192\.168\./.test(normalizedHost)) return true;
    if (/^172\.(1[6-9]|2\d|3[01])\./.test(normalizedHost)) return true;
    return false;
  };
  const CURRENT_SITE_PAGE = String(window.location.pathname.split('/').pop() || 'index.html').trim().toLowerCase();
  const READONLY_PUBLIC_PAGES = new Set([
    'index.html',
    'jobs.html',
    'job-details.html',
    'companies.html',
    'company-details.html',
    'about.html',
    'contact.html',
    'privacy.html',
    'terms.html',
    'faq.html',
    'track-application.html',
  ]);
  const shouldUseFirebaseOnlyPublicData = () =>
    hasFirebaseSiteConfig() && !isPrivateRuntimeSyncHost(window.location.hostname) && READONLY_PUBLIC_PAGES.has(CURRENT_SITE_PAGE);
  const shouldWriteSharedRuntimeOnBootstrap = () =>
    isPrivateRuntimeSyncHost(window.location.hostname) && !READONLY_PUBLIC_PAGES.has(CURRENT_SITE_PAGE);
  const normalizeLooseArabic = (value = '') =>
    normalize(value)
      .replace(/[\u064b-\u065f]/g, '')
      .replace(/[أإآ]/g, 'ا')
      .replace(/ؤ/g, 'و')
      .replace(/[ئى]/g, 'ي')
      .replace(/ة/g, 'ه')
      .replace(/\s*-\s*/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  const LEGACY_DEMO_APPLICANT_SIGNATURE_HASHES = new Set(['8f42223b', 'b54f11e7']);
  const buildApplicantSignatureHash = (values = []) =>
    hashLegacySeedKey(values.map((value) => normalizeLooseArabic(value)).join('||'));
  const isLegacyDemoApplicantPayload = (payload = {}) => {
    const compactHash = buildApplicantSignatureHash([
      payload?.fullName,
      payload?.phone,
      payload?.city,
      payload?.governorate,
    ]);
    const extendedHash = buildApplicantSignatureHash([
      payload?.fullName,
      payload?.phone,
      payload?.address,
      payload?.city,
      payload?.governorate,
    ]);
    return (
      LEGACY_DEMO_APPLICANT_SIGNATURE_HASHES.has(compactHash) ||
      LEGACY_DEMO_APPLICANT_SIGNATURE_HASHES.has(extendedHash)
    );
  };
  const LEGACY_STATIC_COMPANY_IDS = new Set([
    'company-fawry',
    'company-cib',
    'company-we',
    'company-elsewedy',
    'company-----------tiba-store',
    'company-creative-trips',
    '\u0634\u0631\u0643\u0629 \u0627\u0644\u0627\u062e\u062a\u0628\u0627\u0631 \u0644\u064a 20260326',
    'company-sync-test-001',
  ]);
  const LEGACY_STATIC_COMPANY_NAME_HASHES = new Set([
    '7c80afc1',
    '255be1a1',
    '08dc6391',
    '23d6c4d6',
    'c658c64f',
    '9171906e',
    '2b519cae',
    'f0439cdc',
    '4a00589d',
  ]);
  const LEGACY_TEST_COMPANY_NAMES = new Set([
    'شركة اختبار موبايل',
    'شركة النور للتجارة',
    'شركة البيان',
    'طيبة ستور Tiba Store',
    'Creative trips',
    'شركة تجريبية 20260326',
    '\u0634\u0631\u0643\u0629 \u062a\u062c\u0631\u064a\u0628\u064a\u0629',
  ].map((value) => normalize(value)));
  const LEGACY_STATIC_JOB_IDS = new Set([
    'job-fawry-senior-software-engineer',
    'job-edita-digital-marketing-manager',
    'job-cleopatra-hr-specialist',
    'job-raya-ui-ux-designer',
    'job-efinance-business-analyst',
    'job-orange-customer-support',
    'job-test-20260326',
    'job-sync-test-001',
  ]);
  const LEGACY_STATIC_JOB_KEY_HASHES = new Set([
    '42b16ec6',
    '75b5c676',
    '130b3432',
    '1db068d2',
    'abbf9801',
    '56921ba4',
  ]);

  const isLegacyStaticCompanyRecord = (company = {}) => {
    const id = String(company?.id || '').trim().toLowerCase();
    const normalizedName = normalize(company?.name);
    const nameHash = hashLegacySeedKey(normalizedName);
    return (
      LEGACY_STATIC_COMPANY_IDS.has(id) ||
      LEGACY_STATIC_COMPANY_NAME_HASHES.has(nameHash) ||
      LEGACY_TEST_COMPANY_NAMES.has(normalizedName)
    );
  };
  const isLegacyStaticJobRecord = (job = {}) => {
    const id = String(job?.id || '').trim().toLowerCase();
    const keyHash = hashLegacySeedKey(`${normalize(job?.title)}::${normalize(job?.companyName)}`);
    return (
      LEGACY_STATIC_JOB_IDS.has(id) ||
      LEGACY_STATIC_JOB_KEY_HASHES.has(keyHash) ||
      isLegacyStaticCompanyRecord({ name: job?.companyName })
    );
  };
  const isPlaceholderRuntimeId = (value) => /^(company|job|application)-[-_]+$/i.test(String(value || '').trim());
  const hasMeaningfulRuntimeValue = (value) => Boolean(normalize(value));
  const isMeaningfulRuntimeJob = (job = {}) =>
    hasMeaningfulRuntimeValue(job?.title) && hasMeaningfulRuntimeValue(job?.companyName);
  const isMeaningfulRuntimeApplication = (application = {}) =>
    hasMeaningfulRuntimeValue(application?.requestId || application?.id) &&
    [application?.applicantName, application?.applicantPhone, application?.jobTitle, application?.companyName].some(
      (value) => hasMeaningfulRuntimeValue(value),
    );
  const isMeaningfulRuntimeCompany = (company = {}, relatedCompanyNames = new Set()) => {
    if (!hasMeaningfulRuntimeValue(company?.name)) {
      return false;
    }

    const hasStructuredData =
      hasMeaningfulRuntimeValue(company?.email) ||
      hasMeaningfulRuntimeValue(company?.phone) ||
      hasMeaningfulRuntimeValue(company?.address) ||
      hasMeaningfulRuntimeValue(company?.summary) ||
      hasMeaningfulRuntimeValue(company?.imageUrl) ||
      (Array.isArray(company?.notes) && company.notes.length > 0) ||
      Number(company?.openings || 0) > 0;

    if (!isPlaceholderRuntimeId(company?.id)) {
      return true;
    }

    return hasStructuredData || relatedCompanyNames.has(normalize(company?.name));
  };
  const sanitizeAdminRuntime = (runtime = {}) => {
    const repairedRuntime =
      runtime && typeof runtime === 'object' ? repairLegacyStoredValue(runtime).value : runtime;
    if (!repairedRuntime || typeof repairedRuntime !== 'object') {
      return { runtime: {}, changed: Boolean(runtime) };
    }

    const nextRuntime = { ...repairedRuntime };
    let changed = repairedRuntime !== runtime;

    if (Array.isArray(repairedRuntime?.jobs)) {
      const jobs = repairedRuntime.jobs.filter((job) => !isLegacyStaticJobRecord(job) && isMeaningfulRuntimeJob(job));
      if (jobs.length !== repairedRuntime.jobs.length) {
        nextRuntime.jobs = jobs;
        changed = true;
      }
    }

    if (Array.isArray(repairedRuntime?.applications)) {
      const applications = repairedRuntime.applications.filter((application) => isMeaningfulRuntimeApplication(application));
      if (applications.length !== repairedRuntime.applications.length) {
        nextRuntime.applications = applications;
        changed = true;
      }
    }

    if (Array.isArray(repairedRuntime?.companies)) {
      const relatedCompanyNames = new Set(
        [
          ...(Array.isArray(nextRuntime?.jobs) ? nextRuntime.jobs : []),
          ...(Array.isArray(nextRuntime?.applications) ? nextRuntime.applications : []),
        ]
          .map((entry) => normalize(entry?.companyName))
          .filter(Boolean),
      );
      const companies = repairedRuntime.companies.filter(
        (company) => !isLegacyStaticCompanyRecord(company) && isMeaningfulRuntimeCompany(company, relatedCompanyNames),
      );
      if (companies.length !== repairedRuntime.companies.length) {
        nextRuntime.companies = companies;
        changed = true;
      }
    }

    return { runtime: nextRuntime, changed };
  };
  const getRuntimeCompanyKey = (company = {}) =>
    String(company?.id || normalize(company?.name) || '').trim();
  const getRuntimeJobKey = (job = {}) =>
    String(job?.id || normalize(`${job?.title || ''}::${job?.companyName || ''}::${job?.location || ''}`) || '').trim();
  const getRuntimeApplicationKey = (application = {}) =>
    String(application?.requestId || application?.id || '').trim();
  const mergeRuntimeCollections = (currentItems = [], incomingItems = [], keyGetter) => {
    const merged = new Map();

    [...currentItems, ...incomingItems].forEach((item) => {
      const key = keyGetter(item);
      if (!key) return;
      const existing = merged.get(key) || {};
      merged.set(key, { ...existing, ...item });
    });

    return Array.from(merged.values());
  };
  const mergeAdminRuntime = (currentRuntime = {}, incomingRuntime = {}) => ({
    ...currentRuntime,
    ...incomingRuntime,
    settings: {
      ...(currentRuntime?.settings || {}),
      ...(incomingRuntime?.settings || {}),
    },
    content: {
      ...(currentRuntime?.content || {}),
      ...(incomingRuntime?.content || {}),
    },
    companies: mergeRuntimeCollections(
      Array.isArray(currentRuntime?.companies) ? currentRuntime.companies : [],
      Array.isArray(incomingRuntime?.companies) ? incomingRuntime.companies : [],
      getRuntimeCompanyKey,
    ),
    jobs: mergeRuntimeCollections(
      Array.isArray(currentRuntime?.jobs) ? currentRuntime.jobs : [],
      Array.isArray(incomingRuntime?.jobs) ? incomingRuntime.jobs : [],
      getRuntimeJobKey,
    ),
    applications: mergeRuntimeCollections(
      Array.isArray(currentRuntime?.applications) ? currentRuntime.applications : [],
      Array.isArray(incomingRuntime?.applications) ? incomingRuntime.applications : [],
      getRuntimeApplicationKey,
    ),
  });
  const getAdminRuntime = () => {
    if (shouldUseFirebaseOnlyPublicData()) {
      return {};
    }

    const runtime = safeReadJSON(ADMIN_RUNTIME_KEY, {});
    const sanitizedRuntime = sanitizeAdminRuntime(runtime);
    if (sanitizedRuntime.changed) {
      saveJSON(ADMIN_RUNTIME_KEY, sanitizedRuntime.runtime);
    }
    return sanitizedRuntime.runtime;
  };
  let sharedRuntimeFingerprint = '';

  const readSharedAdminRuntime = () => {
    try {
      const request = new XMLHttpRequest();
      request.open('GET', `${ADMIN_RUNTIME_SHARED_URL}?_=${Date.now()}`, false);
      request.send(null);

      if (request.status >= 200 && request.status < 300 && request.responseText) {
        return request.responseText;
      }
    } catch (error) {
      return '';
    }

    return '';
  };

  const syncAdminRuntimeFromSharedFile = () => {
    if (hasFirebaseSiteConfig() && !isPrivateRuntimeSyncHost(window.location.hostname)) {
      return false;
    }

    const responseText = readSharedAdminRuntime();
    if (!responseText) return false;

    try {
      const parsedRuntime = JSON.parse(responseText);
      const sanitizedIncomingRuntime = sanitizeAdminRuntime(parsedRuntime).runtime;
      const sanitizedCurrentRuntime = sanitizeAdminRuntime(safeReadJSON(ADMIN_RUNTIME_KEY, {})).runtime;
      const nextRuntime = mergeAdminRuntime(sanitizedCurrentRuntime, sanitizedIncomingRuntime);
      const fingerprint = JSON.stringify(nextRuntime);

      if (!fingerprint || fingerprint === sharedRuntimeFingerprint) {
        return false;
      }

      sharedRuntimeFingerprint = fingerprint;
      saveJSON(ADMIN_RUNTIME_KEY, nextRuntime);

      if (
        Array.isArray(sanitizedIncomingRuntime?.applications) &&
        sanitizedIncomingRuntime.applications.length &&
        !hasFirebaseSiteConfig()
      ) {
        const mergedApplications = mergeRuntimeCollections(
          getLocalStoredApplications(),
          sanitizedIncomingRuntime.applications.map((application) => mapFirebaseApplicationRecord(application)),
          getRuntimeApplicationKey,
        );
        saveLocalStoredApplications(mergedApplications);
      }

      return true;
    } catch (error) {
      return false;
    }
  };
  const hasShareableRuntimeRecords = (runtime = {}) =>
    (Array.isArray(runtime?.companies) && runtime.companies.length > 0) ||
    (Array.isArray(runtime?.jobs) && runtime.jobs.length > 0) ||
    (Array.isArray(runtime?.applications) && runtime.applications.length > 0);
  const purgeLegacyRuntimeStorage = () => {
    if (shouldUseFirebaseOnlyPublicData()) {
      window.localStorage.removeItem(ADMIN_RUNTIME_KEY);
      window.localStorage.setItem(PUBLIC_SITE_BUILD_MARKER_KEY, PUBLIC_SITE_BUILD);
      return;
    }

    const sanitizedRuntime = sanitizeAdminRuntime(safeReadJSON(ADMIN_RUNTIME_KEY, {}));
    const runtime = sanitizedRuntime.runtime;
    const hasContent = Object.keys(runtime?.content || {}).length > 0;
    const hasSettings = Object.keys(runtime?.settings || {}).length > 0;

    if (sanitizedRuntime.changed) {
      if (!hasShareableRuntimeRecords(runtime) && !hasContent && !hasSettings) {
        window.localStorage.removeItem(ADMIN_RUNTIME_KEY);
      } else {
        saveJSON(ADMIN_RUNTIME_KEY, runtime);
      }
    }

    const lastBuildMarker = String(window.localStorage.getItem(PUBLIC_SITE_BUILD_MARKER_KEY) || '').trim();
    if (lastBuildMarker !== PUBLIC_SITE_BUILD) {
      window.localStorage.removeItem(ADMIN_RUNTIME_KEY);
      window.localStorage.setItem(PUBLIC_SITE_BUILD_MARKER_KEY, PUBLIC_SITE_BUILD);
    }
  };
  const getSharedRuntimeSyncUrl = () => {
    if (!isPrivateRuntimeSyncHost(window.location.hostname)) {
      return '';
    }

    if (window.location.port === SHARED_RUNTIME_SYNC_PORT) {
      return SHARED_RUNTIME_SYNC_PATH;
    }

    if (!window.location.hostname) {
      return SHARED_RUNTIME_SYNC_PATH;
    }

    return `${window.location.protocol}//${window.location.hostname}:${SHARED_RUNTIME_SYNC_PORT}${SHARED_RUNTIME_SYNC_PATH}`;
  };
  let sharedRuntimeWriteFingerprint = '';
  const syncSharedAdminRuntimeFile = async (runtime = {}) => {
    if (!isPrivateRuntimeSyncHost(window.location.hostname)) return false;
    const sanitizedRuntime = sanitizeAdminRuntime(runtime).runtime;
    if (!hasShareableRuntimeRecords(sanitizedRuntime)) return false;

    const fingerprint = JSON.stringify(sanitizedRuntime);
    if (!fingerprint || fingerprint === sharedRuntimeWriteFingerprint) {
      return false;
    }

    sharedRuntimeWriteFingerprint = fingerprint;

    try {
      const response = await fetch(getSharedRuntimeSyncUrl(), {
        method: 'POST',
        mode: 'cors',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(sanitizedRuntime),
      });

      return response.ok;
    } catch (error) {
      return false;
    }
  };
  const isRealStoredApplication = (application = {}) => {
    const job = application?.job || {};
    return !isLegacyStaticJobRecord({
      id: application?.id || application?.requestId,
      title: job?.jobTitle,
      companyName: job?.jobCompany,
    });
  };
  const isLegacyDemoApplicationRecord = (application = {}) =>
    isLegacyDemoApplicantPayload({
      fullName: application?.applicant?.fullName,
      phone: application?.applicant?.phone,
      address: application?.applicant?.address,
      city: application?.applicant?.city,
      governorate: application?.applicant?.governorate,
    });
  const clearApplicantDraftFields = (profile = {}) => ({
    ...profile,
    fullName: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    governorate: '',
    experience: '',
    cvFileMeta: null,
  });
  const clearApplicantMetaFields = (profile = {}) => ({
    ...profile,
    desiredRole: '',
    desiredCity: '',
    experienceYears: '',
    educationLevel: '',
    specialization: '',
    militaryStatus: '',
    publicServiceCompleted: '',
    maritalStatus: '',
    expectedSalary: '',
    preferredWorkType: '',
    address: '',
    governorate: '',
    resumeFileMeta: null,
  });
  const clearApplicantSeekerFields = (profile = {}) => clearApplicantMetaFields(profile);
  const stripApplicantMetaKeys = (profile = {}) => {
    const nextProfile = { ...(profile && typeof profile === 'object' ? profile : {}) };
    delete nextProfile.applicantMeta;
    delete nextProfile.seekerProfile;
    return nextProfile;
  };
  const readApplicantMeta = (...sources) => {
    for (const source of sources) {
      if (!source || typeof source !== 'object') continue;
      if (source.applicantMeta && typeof source.applicantMeta === 'object') {
        return source.applicantMeta;
      }
      if (source.seekerProfile && typeof source.seekerProfile === 'object') {
        return source.seekerProfile;
      }
    }

    return {};
  };
  const sanitizeStoredApplicantProfile = (profile = {}) => {
    if (!profile || typeof profile !== 'object') {
      return { changed: false, profile: {} };
    }

    const normalizedRole = normalize(profile?.role);
    const isCompanyAccount = normalizedRole === 'company';
    const draftProfile =
      isCompanyAccount && profile?.applicationDraft && typeof profile.applicationDraft === 'object'
        ? profile.applicationDraft
        : profile;
    const applicantMeta = readApplicantMeta(draftProfile, !isCompanyAccount ? profile : null);
    const hasLegacyApplicantShape =
      Boolean(normalizedRole && !['company', 'admin', 'applicant'].includes(normalizedRole)) ||
      Boolean(
        (draftProfile && typeof draftProfile === 'object' && 'seekerProfile' in draftProfile) ||
          (!isCompanyAccount && profile && typeof profile === 'object' && 'seekerProfile' in profile),
      );

    if (isCompanyAccount) {
      const hasCompanyApplicationDraft =
        Boolean(String(draftProfile?.fullName || '').trim()) ||
        Boolean(String(draftProfile?.phone || '').trim()) ||
        Boolean(String(draftProfile?.address || '').trim()) ||
        Boolean(String(draftProfile?.city || '').trim()) ||
        Boolean(String(draftProfile?.governorate || '').trim()) ||
        Object.values(applicantMeta || {}).some((value) => Boolean(String(value || '').trim()));

      if (!hasCompanyApplicationDraft) {
        return { changed: false, profile };
      }

      return {
        changed: true,
        profile: {
          ...profile,
          applicationDraft: {
            ...clearApplicantDraftFields(stripApplicantMetaKeys(draftProfile)),
            applicantMeta: clearApplicantMetaFields(applicantMeta),
          },
        },
      };
    }

    if (!isLegacyDemoApplicantPayload(draftProfile) && !hasLegacyApplicantShape) {
      return { changed: false, profile };
    }

    return {
      changed: true,
      profile: {
        ...clearApplicantDraftFields(stripApplicantMetaKeys(profile)),
        role: 'applicant',
        applicantMeta: clearApplicantMetaFields(applicantMeta),
      },
    };
  };
  const resolvePublicAssetUrl = (value, fallback = '') => {
    const rawValue = String(value || '').trim();
    if (!rawValue) return fallback;
    if (/^(https?:|data:|blob:)/i.test(rawValue)) return rawValue;
    if (/^(\/|\.\/|\.\.\/)/.test(rawValue)) return rawValue;
    return rawValue;
  };
  const normalizeWebsiteUrl = (value = '') => {
    const rawValue = String(value || '').trim();
    if (!rawValue) return '';
    if (/^(https?:\/\/|mailto:|tel:|data:|blob:)/i.test(rawValue)) return rawValue;
    return `https://${rawValue.replace(/^\/+/, '')}`;
  };
  const readFileAsDataUrl = (file) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(new Error('تعذر قراءة الملف المحدد.'));
      reader.readAsDataURL(file);
    });
  const optimizeImageDataUrlForStorage = async (dataUrl, options = {}) => {
    const rawDataUrl = String(dataUrl || '').trim();
    if (!/^data:image\//i.test(rawDataUrl)) return rawDataUrl;

    const {
      maxWidth = 1280,
      maxHeight = 1280,
      quality = 0.84,
      mimeType = 'image/jpeg',
    } = options;

    return await new Promise((resolve) => {
      const image = new Image();
      image.onload = () => {
        const originalWidth = Number(image.naturalWidth || image.width || 0);
        const originalHeight = Number(image.naturalHeight || image.height || 0);
        if (!originalWidth || !originalHeight) {
          resolve(rawDataUrl);
          return;
        }

        const scale = Math.min(1, maxWidth / originalWidth, maxHeight / originalHeight);
        const targetWidth = Math.max(1, Math.round(originalWidth * scale));
        const targetHeight = Math.max(1, Math.round(originalHeight * scale));
        const canvas = document.createElement('canvas');
        canvas.width = targetWidth;
        canvas.height = targetHeight;

        const context = canvas.getContext('2d');
        if (!context) {
          resolve(rawDataUrl);
          return;
        }

        if (mimeType === 'image/jpeg') {
          context.fillStyle = '#ffffff';
          context.fillRect(0, 0, targetWidth, targetHeight);
        }

        context.drawImage(image, 0, 0, targetWidth, targetHeight);
        const optimized = canvas.toDataURL(mimeType, quality);
        resolve(optimized.length < rawDataUrl.length ? optimized : rawDataUrl);
      };
      image.onerror = () => resolve(rawDataUrl);
      image.src = rawDataUrl;
    });
  };
  const buildCompanyAssetDataUrl = async (file, kind = 'asset') => {
    const rawDataUrl = await readFileAsDataUrl(file);
    if (String(file?.type || '').trim().toLowerCase() === 'image/svg+xml') {
      return rawDataUrl;
    }

    if (kind === 'logo') {
      return optimizeImageDataUrlForStorage(rawDataUrl, {
        maxWidth: 720,
        maxHeight: 720,
        quality: 0.9,
        mimeType: 'image/png',
      });
    }

    return optimizeImageDataUrlForStorage(rawDataUrl, {
      maxWidth: 1440,
      maxHeight: 900,
      quality: 0.82,
      mimeType: 'image/jpeg',
    });
  };
  const importFirebaseSiteModule = (modulePath) => import(`${FIREBASE_SITE_CDN_BASE}/${modulePath}`);
  const getFirebaseSiteServices = async () => {
    if (!hasFirebaseSiteConfig()) {
      return null;
    }

    if (!firebaseSiteServicesPromise) {
      firebaseSiteServicesPromise = (async () => {
        try {
          const [appModule, authModule, firestoreModule, storageModule] = await Promise.all([
            importFirebaseSiteModule('firebase-app.js'),
            importFirebaseSiteModule('firebase-auth.js'),
            importFirebaseSiteModule('firebase-firestore.js'),
            importFirebaseSiteModule('firebase-storage.js'),
          ]);

          const app = appModule.getApps?.().length ? appModule.getApp() : appModule.initializeApp(firebaseSiteConfig);
          return {
            app,
            auth: authModule.getAuth(app),
            db: firestoreModule.getFirestore(app),
            storage: storageModule.getStorage(app),
            authModule,
            firestoreModule,
            storageModule,
          };
        } catch (error) {
          console.warn('Unable to bootstrap Firebase on public site', error);
          firebaseSiteServicesPromise = null;
          return null;
        }
      })();
    }

    return firebaseSiteServicesPromise;
  };
  const normalizeFirebaseTimestamp = (value) => {
    if (!value) return '';
    if (typeof value === 'string') return value;
    if (value instanceof Date) return value.toISOString();
    if (typeof value?.toDate === 'function') {
      try {
        return value.toDate().toISOString();
      } catch (error) {
        return '';
      }
    }
    if (typeof value?.seconds === 'number') {
      return new Date(value.seconds * 1000).toISOString();
    }
    return '';
  };
  const normalizeCompanySocialLinks = (value = {}) => {
    const source = value && typeof value === 'object' ? value : {};
    return {
      facebook: String(source.facebook || '').trim(),
      instagram: String(source.instagram || '').trim(),
      linkedin: String(source.linkedin || '').trim(),
      x: String(source.x || source.twitter || '').trim(),
    };
  };
  const sanitizePositiveIntegerInput = (value = '', options = {}) => {
    const { allowLegacyRange = false } = options;
    const normalizedValue = normalizeEasternArabicDigits(value).trim();

    if (/^[1-9]\d*$/.test(normalizedValue)) {
      return normalizedValue;
    }

    if (!allowLegacyRange) {
      return '';
    }

    const rangeMatch = normalizedValue.match(/(\d+)\s*[-–]\s*(\d+)/);
    if (rangeMatch) {
      return rangeMatch[2];
    }

    const plusMatch = normalizedValue.match(/(\d+)\s*\+$/);
    if (plusMatch) {
      return plusMatch[1];
    }

    return '';
  };
  const mapFirebaseCompanyRecord = (entry = {}) => ({
    id: String(entry.id || entry.companyId || '').trim(),
    uid: String(entry.uid || entry.ownerUid || '').trim(),
    ownerUid: String(entry.ownerUid || entry.uid || '').trim(),
    name: String(entry.name || entry.companyName || '').trim(),
    sector: String(entry.sector || entry.companySector || '').trim(),
    location: String(entry.location || entry.city || entry.companyCity || '').trim(),
    city: String(entry.city || entry.location || entry.companyCity || '').trim(),
    teamSize: sanitizePositiveIntegerInput(entry.teamSize || '', { allowLegacyRange: true }),
    phone: String(entry.phone || '').trim(),
    landline: String(entry.landline || entry.companyLandline || '').trim(),
    email: String(entry.email || '').trim(),
    website: String(entry.website || '').trim(),
    socialLinks: normalizeCompanySocialLinks(entry.socialLinks),
    siteMode: String(entry.siteMode || 'full').trim() === 'landing' ? 'landing' : 'full',
    restrictionMessage: String(entry.restrictionMessage || '').trim(),
    restrictionAttachmentUrl: String(entry.restrictionAttachmentUrl || '').trim() || null,
    restrictionAttachmentName: String(entry.restrictionAttachmentName || '').trim(),
    summary: String(entry.summary || entry.description || entry.companyDescription || '').trim(),
    description: String(entry.description || entry.summary || entry.companyDescription || '').trim(),
    logoLetter: String(entry.logoLetter || getCompanyLogoLetter(entry.name || entry.companyName || 'ش')).trim(),
    imageUrl: String(entry.imageUrl || entry.logoUrl || entry.coverUrl || '').trim() || null,
    logoUrl: String(entry.logoUrl || entry.imageUrl || '').trim() || null,
    coverImage: String(entry.coverImage || entry.coverUrl || '').trim() || null,
    coverUrl: String(entry.coverUrl || entry.coverImage || '').trim() || null,
    openings: Number(entry.openings || 0),
    status: String(entry.status || 'approved').trim(),
    verified: entry.verified ?? false,
    deletedBy:
      String(entry.deletedBy || '').trim() === 'company'
        ? 'company'
        : String(entry.deletedBy || '').trim() === 'admin'
          ? 'admin'
          : null,
    deletionReason: String(entry.deletionReason || entry.deleteReason || '').trim(),
    deletedStatusSnapshot:
      ['approved', 'pending', 'restricted', 'archived'].includes(String(entry.deletedStatusSnapshot || '').trim())
        ? String(entry.deletedStatusSnapshot || '').trim()
        : null,
    deletedAt: normalizeFirebaseTimestamp(entry.deletedAt) || null,
    createdAt: normalizeFirebaseTimestamp(entry.createdAt) || '',
    updatedAt: normalizeFirebaseTimestamp(entry.updatedAt) || '',
  });
  const mapFirebaseJobRecord = (entry = {}) => ({
    id: String(entry.id || '').trim(),
    companyId: String(entry.companyId || '').trim(),
    title: String(entry.title || entry.jobTitle || '').trim(),
    companyName: String(entry.companyName || entry.jobCompany || '').trim(),
    location: String(entry.location || entry.city || '').trim(),
    type: String(entry.type || '').trim(),
    postedLabel: String(entry.postedLabel || '').trim(),
    salary: String(entry.salary || '').trim(),
    summary: String(entry.summary || entry.description || '').trim(),
    sector: String(entry.sector || '').trim(),
    applicationEnabled: entry.applicationEnabled !== false,
    featured: Boolean(entry.featured),
    status: String(entry.status || 'approved').trim(),
    applicantsCount: Number(entry.applicantsCount || 0),
    deletedBy:
      String(entry.deletedBy || '').trim() === 'company'
        ? 'company'
        : String(entry.deletedBy || '').trim() === 'admin'
          ? 'admin'
          : null,
    deletedStatusSnapshot:
      ['approved', 'pending', 'hidden', 'archived', 'rejected'].includes(String(entry.deletedStatusSnapshot || '').trim())
        ? String(entry.deletedStatusSnapshot || '').trim()
        : null,
    restoredByAdminAt: normalizeFirebaseTimestamp(entry.restoredByAdminAt) || null,
    deletedAt: normalizeFirebaseTimestamp(entry.deletedAt) || null,
    positions: String(entry.positions || '').trim(),
    requirements: String(entry.requirements || '').trim(),
    benefits: String(entry.benefits || '').trim(),
    postedAt: normalizeFirebaseTimestamp(entry.postedAt) || '',
    createdAt: normalizeFirebaseTimestamp(entry.createdAt) || '',
    updatedAt: normalizeFirebaseTimestamp(entry.updatedAt) || '',
  });
  const mapFirebaseApplicationRecord = (entry = {}) => {
    const requestId = String(entry.requestId || entry.id || '').trim();
    const job = entry.job && typeof entry.job === 'object' ? entry.job : {};
    const applicant = entry.applicant && typeof entry.applicant === 'object' ? entry.applicant : {};
    const company = entry.company && typeof entry.company === 'object' ? entry.company : {};
    const applicantPhoneKey = buildPhoneLookupKey(
      applicant.phone || entry.applicantPhone || entry.applicantPhoneKey || entry.phone || '',
    );
    const applicantPhoneDigits = normalizePhoneDigits(
      applicant.phone || entry.applicantPhone || entry.applicantPhoneDigits || entry.phone || '',
    );

    return {
      id: requestId,
      requestId,
      job: {
        ...job,
        id: String(job.id || entry.jobId || '').trim(),
        jobTitle: String(job.jobTitle || job.title || entry.jobTitle || '').trim(),
        jobCompany: String(job.jobCompany || job.companyName || entry.companyName || company.name || '').trim(),
        jobLocation: String(job.jobLocation || job.location || entry.location || '').trim(),
        jobType: String(job.jobType || job.type || '').trim(),
        jobSalary: String(job.jobSalary || job.salary || '').trim(),
        jobSector: String(job.jobSector || job.sector || '').trim(),
        jobSummary: String(job.jobSummary || job.summary || '').trim(),
      },
      jobId: String(entry.jobId || job.id || '').trim(),
      applicant: {
        ...applicant,
        fullName: String(applicant.fullName || entry.applicantName || '').trim(),
        phone: String(applicant.phone || entry.applicantPhone || '').trim(),
        phoneLookupKey: applicantPhoneKey,
        email: String(applicant.email || entry.applicantEmail || '').trim(),
        address: String(applicant.address || entry.address || '').trim(),
        governorate: String(applicant.governorate || entry.governorate || '').trim(),
        city: String(applicant.city || entry.city || '').trim(),
        experience: String(applicant.experience || entry.experience || '').trim(),
        experienceYears: String(applicant.experienceYears || entry.experienceYears || '').trim(),
        expectedSalary: String(applicant.expectedSalary || entry.expectedSalary || '').trim(),
        educationLevel: String(applicant.educationLevel || entry.educationLevel || '').trim(),
        specialization: String(applicant.specialization || entry.specialization || '').trim(),
        militaryStatus: String(applicant.militaryStatus || entry.militaryStatus || '').trim(),
        publicServiceCompleted: String(applicant.publicServiceCompleted || entry.publicServiceCompleted || '').trim(),
        maritalStatus: String(applicant.maritalStatus || entry.maritalStatus || '').trim(),
      },
      company: {
        ...company,
        name: String(company.name || entry.companyName || job.jobCompany || '').trim(),
        email: String(company.email || entry.companyEmail || '').trim(),
      },
      applicantPhoneKey,
      applicantPhoneDigits,
      submittedAt: normalizeFirebaseTimestamp(entry.submittedAt) || '',
      respondedAt: normalizeFirebaseTimestamp(entry.respondedAt) || '',
      rejectionReason: String(entry.rejectionReason || '').trim(),
      status: String(entry.status || 'review').trim(),
      companyTag: normalizeCompanyCandidateTag(entry.companyTag || ''),
      interviewScheduledAt: normalizeFirebaseTimestamp(entry.interviewScheduledAt) || '',
      interviewMode: normalizeInterviewMode(entry.interviewMode || ''),
      interviewLocation: String(entry.interviewLocation || '').trim(),
      notes: sanitizeApplicationNotes(entry.notes),
    };
  };
  const refreshPublicPagesFromFirebaseCache = () => {
    syncMaintenanceShell();
    syncSystemBanner();
    initHomeRuntimeContent();
    initHomeHeroVideo();
    initHomeUsefulStats();
    renderPublicJobsPage();
    renderPublicCompaniesPage();
    initJobDetailsPage();
    initApplicationTrackingPage();
    renderCompanyDashboard();
  };
  const syncFirebasePublicCache = async () => {
    const services = await getFirebaseSiteServices();
    if (!services) return false;

    try {
      const { db, firestoreModule } = services;
      const publicCompaniesQuery = firestoreModule.query(
        firestoreModule.collection(db, 'companies'),
        firestoreModule.where('status', '==', 'approved'),
        firestoreModule.where('deletedAt', '==', null),
      );
      const publicJobsQuery = firestoreModule.query(
        firestoreModule.collection(db, 'jobs'),
        firestoreModule.where('status', '==', 'approved'),
        firestoreModule.where('deletedAt', '==', null),
      );
      const [companiesSnapshot, jobsSnapshot, runtimeSnapshot] = await Promise.all([
        firestoreModule.getDocs(publicCompaniesQuery),
        firestoreModule.getDocs(publicJobsQuery),
        firestoreModule.getDoc(firestoreModule.doc(db, FIREBASE_RUNTIME_SITE_DOC.collection, FIREBASE_RUNTIME_SITE_DOC.id)),
      ]);

      firebaseRuntimeCache.companies = companiesSnapshot.docs.map((doc) => mapFirebaseCompanyRecord({ ...doc.data(), id: doc.id }));
      firebaseRuntimeCache.jobs = jobsSnapshot.docs.map((doc) => mapFirebaseJobRecord({ ...doc.data(), id: doc.id }));

      const runtimeData = runtimeSnapshot.exists() ? runtimeSnapshot.data() || {} : {};
      firebaseRuntimeCache.settings =
        runtimeData.settings && typeof runtimeData.settings === 'object'
          ? repairLegacyStoredValue(runtimeData.settings).value
          : {};
      firebaseRuntimeCache.content =
        runtimeData.content && typeof runtimeData.content === 'object'
          ? repairLegacyStoredValue(runtimeData.content).value
          : {};

      refreshPublicPagesFromFirebaseCache();
      return true;
    } catch (error) {
      console.warn('Unable to read Firebase public cache', error);
      return false;
    }
  };
  const startFirebasePublicSync = async () => {
    if (firebasePublicSyncBootstrapped || !hasFirebaseSiteConfig()) {
      return false;
    }

    firebasePublicSyncBootstrapped = true;
    const services = await getFirebaseSiteServices();
    if (!services) {
      firebasePublicSyncBootstrapped = false;
      return false;
    }

    try {
      const { db, firestoreModule } = services;
      const publicCompaniesQuery = firestoreModule.query(
        firestoreModule.collection(db, 'companies'),
        firestoreModule.where('status', '==', 'approved'),
        firestoreModule.where('deletedAt', '==', null),
      );
      const publicJobsQuery = firestoreModule.query(
        firestoreModule.collection(db, 'jobs'),
        firestoreModule.where('status', '==', 'approved'),
        firestoreModule.where('deletedAt', '==', null),
      );
      firebasePublicUnsubscribers.splice(0).forEach((unsubscribe) => {
        if (typeof unsubscribe === 'function') unsubscribe();
      });

      firebasePublicUnsubscribers.push(
        firestoreModule.onSnapshot(publicCompaniesQuery, (snapshot) => {
          firebaseRuntimeCache.companies = snapshot.docs.map((doc) => mapFirebaseCompanyRecord({ ...doc.data(), id: doc.id }));
          refreshPublicPagesFromFirebaseCache();
        }),
      );
      firebasePublicUnsubscribers.push(
        firestoreModule.onSnapshot(publicJobsQuery, (snapshot) => {
          firebaseRuntimeCache.jobs = snapshot.docs.map((doc) => mapFirebaseJobRecord({ ...doc.data(), id: doc.id }));
          refreshPublicPagesFromFirebaseCache();
        }),
      );
      firebasePublicUnsubscribers.push(
        firestoreModule.onSnapshot(
          firestoreModule.doc(db, FIREBASE_RUNTIME_SITE_DOC.collection, FIREBASE_RUNTIME_SITE_DOC.id),
          (snapshot) => {
            const runtimeData = snapshot.exists() ? snapshot.data() || {} : {};
            firebaseRuntimeCache.settings =
              runtimeData.settings && typeof runtimeData.settings === 'object'
                ? repairLegacyStoredValue(runtimeData.settings).value
                : {};
            firebaseRuntimeCache.content =
              runtimeData.content && typeof runtimeData.content === 'object'
                ? repairLegacyStoredValue(runtimeData.content).value
                : {};
            refreshPublicPagesFromFirebaseCache();
          },
        ),
      );

      await syncFirebasePublicCache();
      return true;
    } catch (error) {
      console.warn('Unable to attach Firebase public listeners', error);
      firebasePublicSyncBootstrapped = false;
      return false;
    }
  };
  const uploadCompanyAssetToFirebase = async (file, session = null, kind = 'asset') => {
    if (!file || !session?.companyId || !hasFirebaseSiteConfig()) {
      return '';
    }

    const services = await getFirebaseSiteServices();
    if (!services) return '';

    try {
      const { storage, storageModule } = services;
      const safeFileName = String(file.name || `${kind}.bin`).replace(/[^\w.-]+/g, '-');
      const fileRef = storageModule.ref(storage, `companies/${session.companyId}/${kind}-${Date.now()}-${safeFileName}`);
      await storageModule.uploadBytes(fileRef, file, {
        contentType: file.type || 'application/octet-stream',
      });
      return await storageModule.getDownloadURL(fileRef);
    } catch (error) {
      console.warn('Unable to upload company asset to Firebase Storage', error);
      return '';
    }
  };
  const buildFirebaseRuntimeDocument = (runtime = {}) => ({
    settings: runtime?.settings && typeof runtime.settings === 'object' ? runtime.settings : {},
    content: runtime?.content && typeof runtime.content === 'object' ? runtime.content : {},
    updatedAt: new Date().toISOString(),
  });
  const syncRuntimeDocumentToFirebase = async (runtime = {}) => {
    if (!hasFirebaseSiteConfig()) return false;
    const services = await getFirebaseSiteServices();
    if (!services) return false;

    try {
      const { db, firestoreModule } = services;
      await firestoreModule.setDoc(
        firestoreModule.doc(db, FIREBASE_RUNTIME_SITE_DOC.collection, FIREBASE_RUNTIME_SITE_DOC.id),
        buildFirebaseRuntimeDocument(runtime),
        { merge: true },
      );
      return true;
    } catch (error) {
      console.warn('Unable to sync runtime document to Firebase', error);
      return false;
    }
  };
  const syncCompanyStateToFirebase = async (companyRecord = {}, companyJobs = [], session = null) => {
    if (!hasFirebaseSiteConfig() || !session?.companyId) return false;

    const fingerprint = JSON.stringify({
      company: companyRecord,
      jobs: companyJobs.map((job) => ({
        id: job?.id,
        title: job?.title,
        status: job?.status,
        updatedAt: job?.updatedAt || job?.postedAt || '',
        deletedAt: job?.deletedAt || null,
      })),
    });
    if (firebaseCompanyStateFingerprints.get(session.companyId) === fingerprint) {
      return false;
    }

    const services = await getFirebaseSiteServices();
    if (!services) return false;

    try {
      const { db, firestoreModule } = services;
      const companyDocId = String(session.companyId || companyRecord.id || '').trim();
      const companyDocRef = firestoreModule.doc(db, 'companies', companyDocId);
      let remoteCompanyRecord = null;
      try {
        const remoteCompanySnapshot = await firestoreModule.getDoc(companyDocRef);
        if (remoteCompanySnapshot.exists()) {
          remoteCompanyRecord = mapFirebaseCompanyRecord({
            ...remoteCompanySnapshot.data(),
            id: remoteCompanySnapshot.id,
          });
        }
      } catch (error) {
        console.warn('Unable to read current company state from Firebase before sync', error);
      }

      const remoteCompanyStatus = normalizeCompanyPersistedStatus(remoteCompanyRecord?.status, '');
      const requestedCompanyStatus = normalizeCompanyPersistedStatus(companyRecord.status, remoteCompanyStatus || 'pending');
      const companyStatus =
        requestedCompanyStatus === 'pending' && ['approved', 'restricted', 'archived'].includes(remoteCompanyStatus)
          ? remoteCompanyStatus
          : requestedCompanyStatus;
      const companyVerified = remoteCompanyRecord?.verified === true ? true : companyRecord.verified ?? false;
      const companyDoc = {
        id: companyDocId,
        uid: String(session.uid || '').trim(),
        ownerUid: String(session.uid || '').trim(),
        name: String(companyRecord.name || session.name || '').trim(),
        sector: String(companyRecord.sector || '').trim(),
        city: String(companyRecord.location || companyRecord.city || '').trim(),
        location: String(companyRecord.location || companyRecord.city || '').trim(),
        teamSize: String(companyRecord.teamSize || '').trim(),
        phone: String(companyRecord.phone || '').trim(),
        landline: String(companyRecord.landline || '').trim(),
        email: String(companyRecord.email || session.email || '').trim(),
        website: String(companyRecord.website || '').trim(),
        socialLinks: normalizeCompanySocialLinks(companyRecord.socialLinks),
        siteMode: String(companyRecord.siteMode || 'full').trim() === 'landing' ? 'landing' : 'full',
        restrictionMessage: String(companyRecord.restrictionMessage || '').trim(),
        restrictionAttachmentUrl: String(companyRecord.restrictionAttachmentUrl || '').trim() || null,
        restrictionAttachmentName: String(companyRecord.restrictionAttachmentName || '').trim(),
        summary: String(companyRecord.summary || '').trim(),
        description: String(companyRecord.description || companyRecord.summary || '').trim(),
        logoLetter: String(companyRecord.logoLetter || getCompanyLogoLetter(companyRecord.name || session.name || 'ش')).trim(),
        imageUrl: String(companyRecord.imageUrl || companyRecord.logoUrl || companyRecord.coverImage || '').trim() || null,
        logoUrl: String(companyRecord.logoUrl || companyRecord.imageUrl || '').trim() || null,
        coverImage: String(companyRecord.coverImage || companyRecord.coverUrl || '').trim() || null,
        coverUrl: String(companyRecord.coverImage || companyRecord.coverUrl || '').trim() || null,
        openings: companyJobs.filter(
          (job) => !job?.deletedAt && !['archived', 'hidden', 'rejected'].includes(normalize(job?.status)),
        ).length,
        status: companyStatus,
        verified: companyVerified,
        deletedBy: String(companyRecord.deletedBy || '').trim() || null,
        deletionReason: String(companyRecord.deletionReason || '').trim(),
        deletedStatusSnapshot: String(companyRecord.deletedStatusSnapshot || '').trim() || null,
        deletedAt: companyRecord.deletedAt || null,
        createdAt: normalizeFirebaseTimestamp(companyRecord.createdAt) || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await firestoreModule.setDoc(companyDocRef, companyDoc, { merge: true });
      await Promise.all(
        companyJobs.map((job) =>
          firestoreModule.setDoc(
            firestoreModule.doc(db, 'jobs', String(job.id || createLocalEntityId('job')).trim()),
            {
              ...job,
              id: String(job.id || createLocalEntityId('job')).trim(),
              ownerUid: String(session.uid || '').trim(),
              companyId: session.companyId,
              companyName: companyDoc.name,
              title: String(job.title || '').trim(),
              location: String(job.location || '').trim(),
              type: String(job.type || '').trim(),
              salary: String(job.salary || '').trim(),
              summary: String(job.summary || '').trim(),
              sector: String(job.sector || companyDoc.sector || '').trim(),
              featured: Boolean(job.featured),
              status: String(job.status || 'approved').trim(),
              applicantsCount: Number(job.applicantsCount || 0),
              notes: Array.isArray(job.notes) ? job.notes : [],
              deletedBy: String(job.deletedBy || '').trim() || null,
              deletedStatusSnapshot: String(job.deletedStatusSnapshot || '').trim() || null,
              restoredByAdminAt: normalizeFirebaseTimestamp(job.restoredByAdminAt) || null,
              deletedAt: job.deletedAt || null,
              postedAt: job.postedAt || new Date().toISOString(),
              postedLabel: String(job.postedLabel || '').trim(),
              createdAt: normalizeFirebaseTimestamp(job.createdAt) || normalizeFirebaseTimestamp(job.postedAt) || new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
            { merge: true },
          ),
        ),
      );

      firebaseCompanyStateFingerprints.set(session.companyId, fingerprint);
      return true;
    } catch (error) {
      console.warn('Unable to sync company state to Firebase', error);
      return false;
    }
  };
  const syncApplicationRecordToFirebase = async (applicationRecord = {}, options = {}) => {
    const requestId = String(applicationRecord.requestId || applicationRecord.id || '').replace(/\D+/g, '').trim();
    if (!requestId || !hasFirebaseSiteConfig()) return false;
    const skipExistingLookup = options?.skipExistingLookup === true;
    const skipApplicantsCountSync = options?.skipApplicantsCountSync === true;

    const services = await getFirebaseSiteServices();
    if (!services) return false;

    try {
      const { db, firestoreModule } = services;
      const syncRelatedJobApplicantsCount = async (jobId = '') => {
        const normalizedJobId = String(jobId || '').trim();
        if (!normalizedJobId) return false;

        try {
          const jobDocRef = firestoreModule.doc(db, 'jobs', normalizedJobId);
          const applicationsQuery = firestoreModule.query(
            firestoreModule.collection(db, 'applications'),
            firestoreModule.where('jobId', '==', normalizedJobId),
            firestoreModule.where('deletedAt', '==', null),
          );
          const [jobSnapshot, applicationsSnapshot] = await Promise.all([
            firestoreModule.getDoc(jobDocRef),
            firestoreModule.getDocs(applicationsQuery),
          ]);

          if (!jobSnapshot.exists()) return false;

          const nextApplicantsCount = applicationsSnapshot.docs.length;
          const nextUpdatedAt = new Date().toISOString();

          await firestoreModule.updateDoc(jobDocRef, {
            applicantsCount: nextApplicantsCount,
            updatedAt: nextUpdatedAt,
          });

          const nextJobRecord = mapFirebaseJobRecord({
            ...jobSnapshot.data(),
            id: jobSnapshot.id,
            applicantsCount: nextApplicantsCount,
            updatedAt: nextUpdatedAt,
          });
          upsertFirebaseJobCache(nextJobRecord);
          firebaseRuntimeCache.jobs = getAdminRuntimeJobs().map((job) =>
            normalize(job?.id) === normalize(normalizedJobId)
              ? {
                  ...job,
                  applicantsCount: nextApplicantsCount,
                  updatedAt: nextUpdatedAt,
                }
              : job,
          );
          refreshPublicPagesFromFirebaseCache();
          return true;
        } catch (countError) {
          console.warn('Unable to sync Firebase job applicants count', countError);
          return false;
        }
      };

      const applicationDocRef = firestoreModule.doc(db, 'applications', requestId);
      const jobRecord = applicationRecord?.job || {};
      const applicantRecord = applicationRecord?.applicant || {};
      const companyRecord = applicationRecord?.company || {};
      const matchedJob =
        getAdminRuntimeJobs().find(
          (job) =>
            normalize(job?.id) === normalize(jobRecord?.id) ||
            (normalize(job?.title) === normalize(jobRecord?.jobTitle || jobRecord?.title) &&
              normalize(job?.companyName) === normalize(jobRecord?.jobCompany || companyRecord?.name)),
        ) || {};
      const matchedCompany =
        getAdminRuntimeCompanies().find(
          (company) =>
            normalize(company?.id) === normalize(companyRecord?.id) ||
            normalize(company?.name) === normalize(jobRecord?.jobCompany || companyRecord?.name),
        ) || {};
      const firebasePayload = {
        ...applicationRecord,
        id: requestId,
        requestId,
        companyId: String(matchedJob.companyId || matchedCompany.id || companyRecord?.id || '').trim(),
        companyName: String(jobRecord?.jobCompany || companyRecord?.name || '').trim(),
        jobId: String(jobRecord?.id || matchedJob.id || '').trim(),
        jobTitle: String(jobRecord?.jobTitle || jobRecord?.title || '').trim(),
        applicantName: String(applicantRecord?.fullName || '').trim(),
        applicantEmail: String(applicantRecord?.email || '').trim(),
        applicantPhone: String(applicantRecord?.phone || '').trim(),
        applicantPhoneKey: buildPhoneLookupKey(applicantRecord?.phone || ''),
        applicantPhoneDigits: normalizePhoneDigits(applicantRecord?.phone || ''),
        address: String(applicantRecord?.address || '').trim(),
        governorate: String(applicantRecord?.governorate || '').trim(),
        city: String(applicantRecord?.city || '').trim(),
        experience: String(applicantRecord?.experience || '').trim(),
        experienceYears: String(applicantRecord?.experienceYears || '').trim(),
        expectedSalary: String(applicantRecord?.expectedSalary || '').trim(),
        educationLevel: String(applicantRecord?.educationLevel || '').trim(),
        specialization: String(applicantRecord?.specialization || '').trim(),
        militaryStatus: String(applicantRecord?.militaryStatus || '').trim(),
        publicServiceCompleted: String(applicantRecord?.publicServiceCompleted || '').trim(),
        maritalStatus: String(applicantRecord?.maritalStatus || '').trim(),
        coverLetter: String(applicantRecord?.coverLetter || '').trim(),
        cvFileName: String(applicantRecord?.cvFileMeta?.name || '').trim(),
        cvFileType: String(applicantRecord?.cvFileMeta?.type || '').trim(),
        forwardedTo: String(applicationRecord?.forwardedTo || '').trim(),
        notes: sanitizeApplicationNotes(applicationRecord?.notes),
        deletedAt: applicationRecord?.deletedAt || null,
        submittedAt: applicationRecord.submittedAt || new Date().toISOString(),
        respondedAt: applicationRecord.respondedAt || null,
        companyTag: normalizeCompanyCandidateTag(applicationRecord?.companyTag || ''),
        interviewScheduledAt: String(applicationRecord?.interviewScheduledAt || '').trim() || null,
        interviewMode: normalizeInterviewMode(applicationRecord?.interviewMode || ''),
        interviewLocation: String(applicationRecord?.interviewLocation || '').trim(),
        updatedAt: new Date().toISOString(),
      };
      if (!skipExistingLookup) {
        const existingSnapshot = await firestoreModule.getDoc(applicationDocRef);
        if (existingSnapshot.exists()) {
          const existingData = existingSnapshot.data() || {};
          const statusUpdatePayload = {
            status: firebasePayload.status,
            rejectionReason: firebasePayload.rejectionReason,
            respondedAt: firebasePayload.respondedAt,
            forwardedTo: firebasePayload.forwardedTo,
            notes: firebasePayload.notes,
            companyTag: firebasePayload.companyTag,
            interviewScheduledAt: firebasePayload.interviewScheduledAt,
            interviewMode: firebasePayload.interviewMode,
            interviewLocation: firebasePayload.interviewLocation,
            updatedAt: firebasePayload.updatedAt,
          };

          await firestoreModule.updateDoc(applicationDocRef, statusUpdatePayload);
          upsertFirebaseApplicationCache(
            mapFirebaseApplicationRecord({
              ...existingData,
              ...statusUpdatePayload,
              id: requestId,
            }),
          );
          if (!skipApplicantsCountSync) {
            await syncRelatedJobApplicantsCount(firebasePayload.jobId);
          }
          return true;
        }
      }

      await firestoreModule.setDoc(applicationDocRef, firebasePayload, { merge: true });
      upsertFirebaseApplicationCache(mapFirebaseApplicationRecord(firebasePayload));
      if (!skipApplicantsCountSync) {
        await syncRelatedJobApplicantsCount(firebasePayload.jobId);
      }
      return true;
    } catch (error) {
      console.warn('Unable to sync application to Firebase', error);
      return false;
    }
  };
  const resolvePublicCompanyImage = (company = {}) =>
    resolvePublicAssetUrl(
      company?.companyLogoUrl ||
        company?.logoUrl ||
        company?.logoPath ||
        company?.companyProfile?.companyLogoUrl ||
        company?.companyProfile?.logoUrl ||
        company?.companyProfile?.logoPath ||
        company?.imageUrl ||
        company?.coverImage ||
        company?.companyCoverUrl ||
        company?.image ||
        '',
      COMPANY_PLACEHOLDER_IMAGE,
    );
  const resolvePublicCompanyCoverImage = (company = {}) =>
    resolvePublicAssetUrl(
      company?.companyCoverUrl ||
        company?.coverImage ||
        company?.coverUrl ||
        company?.companyProfile?.companyCoverUrl ||
        company?.companyProfile?.coverImage ||
        company?.companyProfile?.coverUrl ||
        company?.imageUrl ||
        company?.companyLogoUrl ||
        company?.logoUrl ||
        company?.image ||
        '',
      COMPANY_PLACEHOLDER_IMAGE,
    );
  const getAdminRuntimeJobs = () =>
    (
      shouldUseFirebaseOnlyPublicData()
        ? Array.isArray(firebaseRuntimeCache.jobs)
          ? firebaseRuntimeCache.jobs
          : []
        : mergeRuntimeCollections(
            Array.isArray(getAdminRuntime()?.jobs) ? getAdminRuntime().jobs : [],
            Array.isArray(firebaseRuntimeCache.jobs) ? firebaseRuntimeCache.jobs : [],
            getRuntimeJobKey,
          )
    ).filter((job) => !isLegacyStaticJobRecord(job));
  const getAdminRuntimeCompanies = () =>
    (
      shouldUseFirebaseOnlyPublicData()
        ? Array.isArray(firebaseRuntimeCache.companies)
          ? firebaseRuntimeCache.companies
          : []
        : mergeRuntimeCollections(
            Array.isArray(getAdminRuntime()?.companies) ? getAdminRuntime().companies : [],
            Array.isArray(firebaseRuntimeCache.companies) ? firebaseRuntimeCache.companies : [],
            getRuntimeCompanyKey,
          )
    ).filter((company) => !isLegacyStaticCompanyRecord(company));
  const getPublicRuntimeCompanies = () =>
    getAdminRuntimeCompanies().filter(
      (company) => !company?.deletedAt && ['approved', 'active'].includes(normalize(company?.status)),
    );
  const getPublicRuntimeJobs = () =>
    getAdminRuntimeJobs().filter((job) => {
      const linkedCompany = findRuntimeCompanyRecord({ companyName: job?.companyName, companyId: job?.companyId });
      return (
        !job?.deletedAt &&
        normalize(job?.status) === 'approved' &&
        normalize(job?.title) &&
        normalize(job?.companyName) &&
        (!linkedCompany || (!linkedCompany?.deletedAt && normalize(linkedCompany?.status) === 'approved'))
      );
    });
  const collectApprovedJobsForPublicListing = () => {
    const publicCompanyNames = new Set(getPublicRuntimeCompanies().map((company) => normalize(company?.name)));
    return getPublicRuntimeJobs()
      .filter((job) => publicCompanyNames.has(normalize(job?.companyName)))
      .sort((firstJob, secondJob) => Number(Boolean(secondJob.featured)) - Number(Boolean(firstJob.featured)));
  };
  const getAdminRuntimeContent = () => ({
    ...(shouldUseFirebaseOnlyPublicData() ? {} : getAdminRuntime()?.content || {}),
    ...(firebaseRuntimeCache.content || {}),
  });
  const getAdminRuntimeSettings = () => ({
    ...(shouldUseFirebaseOnlyPublicData() ? {} : getAdminRuntime()?.settings || {}),
    ...(firebaseRuntimeCache.settings || {}),
  });
  const escapeHtml = (value) =>
    String(repairLegacyMojibakeText(value || '')).replace(/[&<>"']/g, (character) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
      }[character] || character),
    );

  const resolveAdminActionUrl = (hashRoute) => buildAdminUrl(hashRoute);

  const findRuntimeCompanyRecord = (companyData = {}) => {
    const runtimeCompanies = getAdminRuntimeCompanies();
    if (!runtimeCompanies.length) return null;

    const requestedId = normalize(companyData?.companyId || companyData?.id || '');
    if (requestedId) {
      const recordById =
        runtimeCompanies.find((company) => normalize(String(company?.id || company?.companyId || '')) === requestedId) ||
        null;
      if (recordById) return recordById;
    }

    const requestedName = normalize(companyData?.companyName || companyData?.name || '');
    if (!requestedName) return null;

    return runtimeCompanies.find((company) => normalize(company?.name) === requestedName) || null;
  };

  const findRuntimeJobRecord = (jobData = {}) => {
    const runtimeJobs = getAdminRuntimeJobs();
    if (!runtimeJobs.length) return null;

    const requestedId = normalize(jobData?.jobId || jobData?.id || '');
    if (requestedId) {
      const recordById =
        runtimeJobs.find((job) => normalize(String(job?.id || job?.jobId || job?.requestId || '')) === requestedId) ||
        null;
      if (recordById) return recordById;
    }

    const title = normalize(jobData?.jobTitle || jobData?.title || '');
    const company = normalize(jobData?.jobCompany || jobData?.companyName || '');
    const location = normalize(jobData?.jobLocation || jobData?.location || '');

    return (
      runtimeJobs.find((job) => {
        const jobTitle = normalize(job?.title || job?.jobTitle || '');
        const jobCompany = normalize(job?.companyName || job?.jobCompany || '');
        const jobLocation = normalize(job?.location || job?.jobLocation || '');
        return jobTitle === title && jobCompany === company && (!location || jobLocation === location);
      }) ||
      runtimeJobs.find((job) => {
        const jobTitle = normalize(job?.title || job?.jobTitle || '');
        const jobCompany = normalize(job?.companyName || job?.jobCompany || '');
        return jobTitle === title && jobCompany === company;
      }) ||
      null
    );
  };

  const isPublicRuntimeJobRecord = (job) => !job?.deletedAt && normalize(job?.status) === 'approved';
  const isPublicRuntimeCompanyRecord = (company) =>
    !company?.deletedAt && ['approved', 'active'].includes(normalize(company?.status));

  const isSiteJobVisible = (jobTitle, companyName) => {
    const matchingJob = findRuntimeJobRecord({ jobTitle, jobCompany: companyName });
    if (!matchingJob) return true;
    return isPublicRuntimeJobRecord(matchingJob);
  };

  const isSiteCompanyVisible = (companyName) => {
    const matchingCompany = findRuntimeCompanyRecord({ companyName });
    if (!matchingCompany) return true;
    return isPublicRuntimeCompanyRecord(matchingCompany);
  };

  const isApplicationPubliclyTrackable = (application = {}) => {
    const runtimeJobs = getAdminRuntimeJobs();
    const runtimeCompanies = getAdminRuntimeCompanies();
    const applicationJob = application?.job && typeof application.job === 'object' ? application.job : {};
    const applicationCompany = application?.company && typeof application.company === 'object' ? application.company : {};

    const jobIdentity = {
      jobId: application?.jobId || applicationJob?.id || applicationJob?.jobId || '',
      jobTitle: applicationJob?.jobTitle || applicationJob?.title || application?.jobTitle || '',
      jobCompany:
        applicationJob?.jobCompany || applicationJob?.companyName || applicationCompany?.name || application?.companyName || '',
      jobLocation: applicationJob?.jobLocation || applicationJob?.location || application?.jobLocation || '',
    };

    const companyIdentity = {
      companyId: applicationCompany?.id || application?.companyId || '',
      companyName: applicationCompany?.name || application?.companyName || jobIdentity.jobCompany || '',
    };

    const hasJobIdentity =
      Boolean(normalize(jobIdentity.jobId)) || (Boolean(normalize(jobIdentity.jobTitle)) && Boolean(normalize(jobIdentity.jobCompany)));
    const hasCompanyIdentity = Boolean(normalize(companyIdentity.companyId)) || Boolean(normalize(companyIdentity.companyName));

    if (hasJobIdentity && runtimeJobs.length) {
      const runtimeJob = findRuntimeJobRecord(jobIdentity);
      if (!runtimeJob || !isPublicRuntimeJobRecord(runtimeJob)) {
        return false;
      }
    }

    if (hasCompanyIdentity && runtimeCompanies.length) {
      const runtimeCompany = findRuntimeCompanyRecord(companyIdentity);
      if (!runtimeCompany || !isPublicRuntimeCompanyRecord(runtimeCompany)) {
        return false;
      }
    }

    return true;
  };

  const toHex = (buffer) =>
    Array.from(new Uint8Array(buffer))
      .map((byte) => byte.toString(16).padStart(2, '0'))
      .join('');

  const SHA256_K = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ];

  const rotr32 = (value, shift) => (value >>> shift) | (value << (32 - shift));

  const sha256Bytes = (bytes) => {
    const paddedLength = Math.ceil((bytes.length + 9) / 64) * 64;
    const words = new Uint32Array(paddedLength / 4);

    for (let index = 0; index < bytes.length; index += 1) {
      words[index >> 2] |= bytes[index] << ((3 - (index % 4)) * 8);
    }

    words[bytes.length >> 2] |= 0x80 << ((3 - (bytes.length % 4)) * 8);

    const bitLength = bytes.length * 8;
    words[words.length - 2] = Math.floor(bitLength / 0x100000000);
    words[words.length - 1] = bitLength >>> 0;

    let h0 = 0x6a09e667;
    let h1 = 0xbb67ae85;
    let h2 = 0x3c6ef372;
    let h3 = 0xa54ff53a;
    let h4 = 0x510e527f;
    let h5 = 0x9b05688c;
    let h6 = 0x1f83d9ab;
    let h7 = 0x5be0cd19;

    const schedule = new Uint32Array(64);

    for (let offset = 0; offset < words.length; offset += 16) {
      for (let index = 0; index < 16; index += 1) {
        schedule[index] = words[offset + index];
      }

      for (let index = 16; index < 64; index += 1) {
        const s0 =
          rotr32(schedule[index - 15], 7) ^
          rotr32(schedule[index - 15], 18) ^
          (schedule[index - 15] >>> 3);
        const s1 =
          rotr32(schedule[index - 2], 17) ^
          rotr32(schedule[index - 2], 19) ^
          (schedule[index - 2] >>> 10);
        schedule[index] = (((schedule[index - 16] + s0) >>> 0) + ((schedule[index - 7] + s1) >>> 0)) >>> 0;
      }

      let a = h0;
      let b = h1;
      let c = h2;
      let d = h3;
      let e = h4;
      let f = h5;
      let g = h6;
      let h = h7;

      for (let index = 0; index < 64; index += 1) {
        const sum1 = rotr32(e, 6) ^ rotr32(e, 11) ^ rotr32(e, 25);
        const choice = (e & f) ^ (~e & g);
        const temp1 = (((((h + sum1) >>> 0) + choice) >>> 0) + ((SHA256_K[index] + schedule[index]) >>> 0)) >>> 0;
        const sum0 = rotr32(a, 2) ^ rotr32(a, 13) ^ rotr32(a, 22);
        const majority = (a & b) ^ (a & c) ^ (b & c);
        const temp2 = (sum0 + majority) >>> 0;

        h = g;
        g = f;
        f = e;
        e = (d + temp1) >>> 0;
        d = c;
        c = b;
        b = a;
        a = (temp1 + temp2) >>> 0;
      }

      h0 = (h0 + a) >>> 0;
      h1 = (h1 + b) >>> 0;
      h2 = (h2 + c) >>> 0;
      h3 = (h3 + d) >>> 0;
      h4 = (h4 + e) >>> 0;
      h5 = (h5 + f) >>> 0;
      h6 = (h6 + g) >>> 0;
      h7 = (h7 + h) >>> 0;
    }

    return [h0, h1, h2, h3, h4, h5, h6, h7]
      .map((part) => part.toString(16).padStart(8, '0'))
      .join('');
  };

  const fillRandomBytes = (bytes) => {
    if (window.crypto?.getRandomValues) {
      window.crypto.getRandomValues(bytes);
      return bytes;
    }

    for (let index = 0; index < bytes.length; index += 1) {
      bytes[index] = Math.floor(Math.random() * 256);
    }

    return bytes;
  };

  const buildQueryUrl = (base, values) => {
    const params = new URLSearchParams();

    Object.entries(values).forEach(([key, value]) => {
      if (value === undefined || value === null) return;
      if (normalize(value)) {
        params.set(key, value.toString().trim());
      }
    });

    const query = params.toString();
    return query ? `${base}?${query}` : base;
  };

  const appendQueryParams = (url, values) => {
    const nextUrl = new URL(url, window.location.href);
    Object.entries(values).forEach(([key, value]) => {
      if (value === undefined || value === null || value === '') {
        nextUrl.searchParams.delete(key);
        return;
      }
      nextUrl.searchParams.set(key, value.toString());
    });
    return getRelativeUrl(nextUrl.href);
  };

  const ARAB_COUNTRIES = repairLegacyStoredValue([
    'مصر',
    'السعودية',
    'الإمارات',
    'قطر',
    'الكويت',
    'البحرين',
    'عمان',
    'الأردن',
    'العراق',
    'لبنان',
    'سوريا',
    'فلسطين',
    'اليمن',
    'ليبيا',
    'تونس',
    'الجزائر',
    'المغرب',
    'السودان',
    'موريتانيا',
    'الصومال',
    'جيبوتي',
    'جزر القمر',
  ]).value;
  const EGYPT_GOVERNORATES = repairLegacyStoredValue([
    'القاهرة',
    'الجيزة',
    'الإسكندرية',
    'الدقهلية',
    'البحر الأحمر',
    'البحيرة',
    'الفيوم',
    'الغربية',
    'الإسماعيلية',
    'المنوفية',
    'المنيا',
    'القليوبية',
    'الوادي الجديد',
    'السويس',
    'اسوان',
    'أسيوط',
    'بني سويف',
    'بورسعيد',
    'دمياط',
    'الشرقية',
    'جنوب سيناء',
    'كفر الشيخ',
    'مطروح',
    'الأقصر',
    'قنا',
   'شمال سيناء',
    'سوهاج',
  ]).value;
  const COUNTRY_LOCATION_KEYWORDS = repairLegacyStoredValue({
   'مصر': ['مصر', 'egypt'],
   'السعودية': ['السعودية', 'السعوديه', 'الرياض', 'جدة', 'جده', 'الخبر', 'الدمام'],
   'الإمارات': ['الإمارات', 'الامارات', 'دبي', 'أبوظبي', 'ابوظبي', 'الشارقة', 'الشارقه'],
   'قطر': ['قطر', 'الدوحة', 'الدوحه'],
   'الكويت': ['الكويت'],
   'البحرين': ['البحرين', 'المنامة', 'المنامه'],
   'عمان': ['عمان', 'سلطنة عمان', 'مسقط'],
   'الأردن': ['الأردن', 'الاردن'],
   'العراق': ['العراق', 'بغداد', 'أربيل', 'اربل'],
   'لبنان': ['لبنان', 'بيروت'],
   'سوريا': ['سوريا', 'دمشق'],
   'فلسطين': ['فلسطين', 'رام الله', 'غزة'],
   'اليمن': ['اليمن', 'صنعاء', 'عدن'],
   'ليبيا': ['ليبيا', 'طرابلس'],
   'تونس': ['تونس'],
   'الجزائر': ['الجزائر'],
   'المغرب': ['المغرب', 'الدار البيضاء', 'الرباط'],
   'السودان': ['السودان', 'الخرطوم'],
   'موريتانيا': ['موريتانيا', 'نواكشوط'],
   'الصومال': ['الصومال', 'مقديشو'],
   'جيبوتي': ['جيبوتي'],
   'جزر القمر': ['جزر القمر', 'القمر'],
  }).value;
  const EGYPT_GOVERNORATE_KEYWORDS = repairLegacyStoredValue({
    'القاهرة': ['القاهرة', 'القاهره', 'القاهرة الجديدة', 'التجمع', 'التجمع الخامس', 'مدينة نصر', 'المعادي', 'مصر الجديدة', 'حلوان', 'شبرا'],
    'الجيزة': ['الجيزة', 'الجيزه', 'القرية الذكية', 'القرية الذكيه', '6 أكتوبر', 'اكتوبر', 'أكتوبر', 'الشيخ زايد', 'المهندسين', 'الدقي', 'الهرم'],
    'الإسكندرية': ['الإسكندرية', 'الاسكندرية', 'اسكندرية', 'برج العرب'],
    'الدقهلية': ['الدقهلية', 'الدقهلية', 'المنصورة', 'المنصوره'],
   'البحر الأحمر': ['البحر الأحمر', 'البحر الاحمر', 'الغردقة', 'الغردقه'],
    'البحيرة': ['البحيرة', 'البحيره', 'دمنهور'],
    'الفيوم': ['الفيوم', 'الفيّوم'],
    'الغربية': ['الغربية', 'الغربيه', 'طنطا', 'المحلة', 'المحلة الكبرى'],
    'الإسماعيلية': ['الإسماعيلية', 'الاسماعيلية', 'الإسماعيليه', 'الاسماعيليه'],
    'المنوفية': ['المنوفية', 'المنوفيه', 'شبين الكوم'],
    'المنيا': ['المنيا'],
    'القليوبية': ['القليوبية', 'القليوبيه', 'بنها', 'شبرا الخيمة'],
   'الوادي الجديد': ['الوادي الجديد', 'الخارجة', 'الخارجه'],
    'السويس': ['السويس'],
    'اسوان': ['اسوان', 'أسوان'],
    'أسيوط': ['أسيوط', 'اسيوط'],
   'بني سويف': ['بني سويف', 'بنى سويف'],
    'بورسعيد': ['بورسعيد', 'بور سعيد'],
    'دمياط': ['دمياط'],
    'الشرقية': ['الشرقية', 'الشرقيه', 'الزقازيق'],
   'جنوب سيناء': ['جنوب سيناء', 'شرم الشيخ'],
   'كفر الشيخ': ['كفر الشيخ'],
    'مطروح': ['مطروح', 'مرسى مطروح', 'مرسي مطروح'],
    'الأقصر': ['الأقصر', 'الاقصر'],
    'قنا': ['قنا'],
   'شمال سيناء': ['شمال سيناء', 'العريش'],
    'سوهاج': ['سوهاج'],
  }).value;

  const getSearchLocationMeta = (value) => {
    const raw = String(value || '').trim();
    const normalizedRaw = normalize(raw);
    if (!normalizedRaw) {
      return {
        raw: '',
        country: '',
        governorate: '',
      };
    }

    const governorateEntry = Object.entries(EGYPT_GOVERNORATE_KEYWORDS).find(([, keywords]) =>
      keywords.some((keyword) => normalizedRaw.includes(normalize(keyword))),
    );

    if (governorateEntry) {
      return {
        raw,
        country: 'مصر',
        governorate: governorateEntry[0],
      };
    }

    const countryEntry = Object.entries(COUNTRY_LOCATION_KEYWORDS).find(([, keywords]) =>
      keywords.some((keyword) => normalizedRaw.includes(normalize(keyword))),
    );

    return {
      raw,
      country: countryEntry?.[0] || '',
      governorate: '',
    };
  };

  const populateSelectOptions = (select, options, placeholder, selectedValue = '') => {
    if (!(select instanceof HTMLSelectElement)) return;

    const selected = String(selectedValue || '').trim();
    select.innerHTML = '';

    const placeholderOption = document.createElement('option');
    placeholderOption.value = '';
    placeholderOption.textContent = repairLegacyMojibakeText(placeholder);
    select.appendChild(placeholderOption);

    options.forEach((option) => {
      const optionElement = document.createElement('option');
      optionElement.value = option;
      optionElement.textContent = repairLegacyMojibakeText(option);
      if (option === selected) {
        optionElement.selected = true;
      }
      select.appendChild(optionElement);
    });

    if (!selected) {
      select.value = '';
    }
  };

  const syncGovernorateField = ({
    countrySelect,
    governorateSelect,
    governorateWrap,
    placeholder = 'كل المحافظات',
    selectedValue = '',
  }) => {
    if (!(countrySelect instanceof HTMLSelectElement) || !(governorateSelect instanceof HTMLSelectElement)) return;

    const isEgypt = normalize(countrySelect.value) === normalize('مصر');

    if (governorateWrap) {
      governorateWrap.classList.toggle('hidden', !isEgypt);
      governorateWrap.toggleAttribute('hidden', !isEgypt);
    }

    if (!isEgypt) {
      governorateSelect.innerHTML = '';
      governorateSelect.value = '';
      return;
    }

    populateSelectOptions(governorateSelect, EGYPT_GOVERNORATES, placeholder, selectedValue);
  };

  const buildJobsUrl = ({ keyword } = {}) =>
    buildQueryUrl('jobs.html', {
      q: keyword,
    });

    const buildJobDetailsUrl = (dataset) => {
      const jobId = String(dataset.jobId || '').trim();
      if (jobId) {
        return buildQueryUrl('job-details.html', { id: jobId });
      }

      return buildQueryUrl('job-details.html', {
        title: dataset.jobTitle,
        company: dataset.jobCompany,
        location: dataset.jobLocation,
        type: dataset.jobType,
        salary: dataset.jobSalary,
        posted: dataset.jobPosted,
        summary: dataset.jobSummary,
        sector: dataset.jobSector,
        featured: dataset.jobFeatured,
        positions: dataset.jobPositions,
        applicantsCount: dataset.jobApplicantsCount,
      });
    };

  const buildApplyUrl = (dataset) => appendQueryParams(buildJobDetailsUrl(dataset), { apply: '1' });

    const buildCompanyDetailsUrl = (dataset) => {
      const companyId = String(dataset.companyId || '').trim();
      if (companyId) {
        return buildQueryUrl('company-details.html', { id: companyId });
      }

      return buildQueryUrl('company-details.html', {
        company: dataset.companyName,
        sector: dataset.companySector,
        location: dataset.companyLocation,
        openings: dataset.companyOpenings,
        status: dataset.companyStatus,
        summary: dataset.companySummary,
        image: dataset.companyImage || dataset.companyLogo || '',
      });
    };

  const AUTH_APP_PATH = 'auth.html';
  const buildAuthUrl = (view, redirectTarget) =>
    buildQueryUrl(
      normalize(view) === 'register'
        ? 'register.html'
        : normalize(view) === 'login'
          ? 'login.html'
          : AUTH_APP_PATH,
      normalize(view) === 'register' || normalize(view) === 'login'
        ? {
            redirect: redirectTarget,
          }
        : {
            view,
            redirect: redirectTarget,
          },
    );

  const buildLoginUrl = (redirectTarget) => buildAuthUrl('login', redirectTarget);

  const SOCIAL_PROVIDER_URLS = {
    linkedin: {
      login: 'https://www.linkedin.com/login',
      register: 'https://www.linkedin.com/signup',
    },
    twitter: {
      login: 'https://x.com/login',
      register: 'https://twitter.com/signup',
    },
    facebook: {
      login: 'https://www.facebook.com/login.php',
      register: 'https://www.facebook.com/',
    },
  };

  const getSocialProviderUrl = (provider, action = 'login') => {
    const normalizedProvider = normalize(provider);
    const normalizedAction = normalize(action) === 'register' ? 'register' : 'login';
    return SOCIAL_PROVIDER_URLS[normalizedProvider]?.[normalizedAction] || '';
  };

  const handleSocialProviderAction = (provider, action) => {
    const authUrl = getSocialProviderUrl(provider, action);
    if (!authUrl) return false;

    window.location.href = authUrl;
    return true;
  };

  const showAuthStatus = (message, tone = 'success') => {
    const loginStatus = document.querySelector('#login-success');
    const registerStatus = document.querySelector('#register-social-success');
    const target = registerStatus || loginStatus;

    if (!target) return;

    target.dataset.tone = tone;
    target.textContent = repairLegacyMojibakeText(message);
    target.classList.add('is-visible');
  };

  const CONTACT_PHONE = '01066718722';
  const CONTACT_EMAIL = '';
  const CONTACT_LOCATION = 'العاشر من رمضان - الأردنية - مول الحجاز - الدور الرابع، مكتب رقم 10';
  const CONTACT_HOURS = 'من 8 ص إلى 5 م - من الأحد إلى الخميس.';
  const CONTACT_MAP_URL = 'https://maps.app.goo.gl/qZjFsnfB6j9qP8Eu8?g_st=ic';
  const TECH_PARTNER_NAME = 'Eng. Mahmoud';
  const TECH_PARTNER_ARABIC_NAME = 'م. محمود';
  const TECH_PARTNER_PHONE = '01155949775';
  const DEFAULT_HOME_HERO_TITLE = 'وظائف واضحة وتقديم مباشر ومتابعة للطلبات.';
  const DEFAULT_HOME_HERO_SUBTITLE =
    'اعرض الوظائف المنشورة فعليًا، قدّم مباشرة، واحتفظ برقم الطلب للمتابعة.';
  const LEGACY_HOME_HERO_TITLES = new Set([
    'منصة الرحمة المهداه للوظائف',
    'منصة الرحمة المهداة للوظائف',
    'الرحمة المهداة للوظائف',
    'الرحمة المهداه للوظائف',
    'الرحمة المهداه للتوظيف',
  ]);
  const LEGACY_HOME_HERO_SUBTITLES = new Set([
    'لوحة تحكم تنفيذية لإدارة المستخدمين والشركات والوظائف والتقارير من مكان واحد.',
  ]);
  const LEGACY_RUNTIME_TEXT_MAP = {
    'منصة الرحمة المهداه للوظائف': 'الرحمة المهداه للتوظيف',
    'منصة الرحمة المهداة للوظائف': 'الرحمة المهداه للتوظيف',
    'الرحمة المهداة للوظائف': 'الرحمة المهداه للتوظيف',
    'الرحمة المهداه للوظائف': 'الرحمة المهداه للتوظيف',
    '+20 100 000 0000': CONTACT_PHONE,
    'القاهرة الجديدة، مصر': CONTACT_LOCATION,
    'الأحد - الخميس: 9 ص - 6 م': CONTACT_HOURS,
    'الأحد - الخميس: 8 ص - 5 م': CONTACT_HOURS,
    'أصحاب الشركات': 'متابعة الوظائف والفرص',
    'نشر الوظائف، إدارة الطلبات، والبحث عن الكفاءات': 'اختيار التخصص المناسب ومعرفة حالة الفرص المتاحة والتقديم عليها.',
    'نشر الوظائف، المراجعة، وإدارة ظهور الشركة والفرص المتاحة.':
      'اختيار التخصص المناسب ومعرفة حالة الفرص المتاحة والتقديم عليها.',
    'كل ما تحتاج لمعرفته حول خدماتنا للتوظيف، الباحثين عن عمل، وأصحاب الشركات في مكان واحد.':
      'كل ما تحتاج لمعرفته حول التقديم على الوظائف، متابعة الفرص، ووسائل التواصل مع فريقنا في مكان واحد.',
    'كل ما تحتاج لمعرفته حول إدارة الحسابات والشركات والوظائف والتواصل داخل المنصة.':
      'كل ما تحتاج لمعرفته حول التقديم على الوظائف، متابعة الفرص، ووسائل التواصل مع فريقنا في مكان واحد.',
    'كيف تتم مراجعة الشركات الجديدة؟': 'كيف أختار الوظيفة المناسبة لي؟',
    'تدخل كل شركة جديدة طابور مراجعة موحد، ويستطيع الأدمن قبولها أو رفضها أو طلب استكمال البيانات.':
      'راجع التخصص، مكان العمل، نوع الدوام، والراتب المتوقع، ثم اقرأ وصف الوظيفة جيدًا قبل التقديم حتى تختار الفرصة الأنسب لخبراتك.',
    'كيف يمكنني نشر وظيفة جديدة؟': 'كيف أتابع الوظائف المتاحة وأختار الأنسب لي؟',
    'بالنسبة لأصحاب الشركات، يجب أولاً التسجيل كحساب "منشأة". بعد تفعيل الحساب، يمكنك الدخول إلى لوحة التحكم والضغط على "إضافة وظيفة جديدة" وإدخال كافة التفاصيل المطلوبة.':
      'تصفح الوظائف الحالية، وحدد التخصص المناسب لك، وراجع تفاصيل كل فرصة جيدًا. وإذا وجدت أن العدد اكتمل في فرصة مناسبة لك، اختر تخصصك وأقل مرتب متوقع حتى يتم التواصل معك عند توافر فرصة مناسبة.',
    'كيف تنشر الشركة وظيفة جديدة؟': 'ماذا أفعل إذا كان العدد اكتمل في الوظيفة المناسبة لي؟',
    'بعد تفعيل حساب الشركة، يمكنها إضافة الوظائف من داخل لوحة التحكم ومتابعة حالة كل وظيفة ونسبة التفاعل عليها.':
      'إذا وجدت أن العدد قد اكتمل في الوظيفة المناسبة لك حاليًا، اختر تخصصك وأقل مرتب متوقع حتى يتم التواصل معك عند توافر فرصة مناسبة لك.',
    'نحن هنا للإجابة على استفساراتكم الخاصة بالتوظيف، الحسابات، ونشر الوظائف بأعلى مستوى من الوضوح والسرعة':
      'يسعدنا الرد على استفسارات التوظيف ومتابعة الطلبات واستقبال رسائلكم عبر واتساب والبريد الإلكتروني خلال مواعيد العمل الرسمية',
    'نحن هنا للإجابة عن استفسارات التوظيف، الحسابات، ونشر الوظائف بأعلى مستوى من الوضوح والسرعة.':
      'يسعدنا الرد على استفسارات التوظيف ومتابعة الطلبات واستقبال رسائلكم عبر واتساب والبريد الإلكتروني خلال مواعيد العمل الرسمية.',
    'إذا كانت لديك أسئلة عن التقديم، التوثيق، أو إدارة الحسابات، فهذه الصفحة هي البوابة الأسرع للوصول إلى فريق الدعم.':
      'إذا كانت لديك أي استفسارات عن التقديم أو متابعة الفرص المناسبة لك، فهذه الصفحة هي الطريق الأسرع للوصول إلى فريق الرحمة المهداه للتوظيف.',
  };

  const normalizeLegacyRuntimeText = (value) => repairLegacyMojibakeText(LEGACY_RUNTIME_TEXT_MAP[value] || value);
  const sanitizeHiddenContactEmail = (value) => {
    const normalizedValue = String(normalizeLegacyRuntimeText(value || '') || '').trim();
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedValue) ? '' : normalizedValue;
  };
  const DISPOSABLE_EMAIL_DOMAINS = new Set([
    '10minutemail.com',
    '10minutemail.net',
    '10minutemail.org',
    '1secmail.com',
    '1secmail.net',
    '1secmail.org',
    'dispostable.com',
    'dropmail.me',
    'dropmail.vip',
    'emailondeck.com',
    'fakeinbox.com',
    'getnada.com',
    'guerrillamail.com',
    'guerrillamail.net',
    'guerrillamail.org',
    'guerrillamail.biz',
    'guerrillamailblock.com',
    'grr.la',
    'maildrop.cc',
    'mailinator.com',
    'mailnesia.com',
    'mintemail.com',
    'moakt.com',
    'sharklasers.com',
    'spam4.me',
    'tempmail.email',
    'tempmail.plus',
    'temp-mail.org',
    'tempail.com',
    'throwawaymail.com',
    'trashmail.com',
    'yopmail.com',
    'yopmail.net',
    'yopmail.fr',
    'yopmail.gq',
  ]);
  const getEmailDomain = (value = '') => {
    const normalizedValue = String(value || '').trim().toLowerCase();
    const atIndex = normalizedValue.lastIndexOf('@');
    if (atIndex <= 0 || atIndex === normalizedValue.length - 1) {
      return '';
    }

    return normalizedValue.slice(atIndex + 1).replace(/^\.+|\.+$/g, '');
  };
  const isDisposableEmailAddress = (value = '') => {
    const domain = getEmailDomain(value);
    if (!domain) {
      return false;
    }

    if (DISPOSABLE_EMAIL_DOMAINS.has(domain)) {
      return true;
    }

    return Array.from(DISPOSABLE_EMAIL_DOMAINS).some((blockedDomain) => domain.endsWith(`.${blockedDomain}`));
  };
  const normalizeHomeRuntimeText = (value, fallback, legacyValues = new Set()) => {
    if (typeof value !== 'string') return fallback;

    const trimmed = normalizeLegacyRuntimeText(value.trim());
    if (!trimmed || legacyValues.has(trimmed)) return fallback;
    return trimmed;
  };
  const normalizePhoneDigits = (value) => String(value || '').replace(/\D+/g, '');
  const PHONE_LOOKUP_COUNTRY_CODES = new Set(['20', '962', '965', '966', '967', '968', '970', '971', '973', '974']);
  const buildPhoneLookupKey = (value) => {
    let digits = normalizePhoneDigits(value);
    if (!digits) return '';

    digits = digits.replace(/^00+/, '');
    for (const countryCode of PHONE_LOOKUP_COUNTRY_CODES) {
      if (digits.startsWith(countryCode)) {
        digits = digits.slice(countryCode.length);
        break;
      }
    }

    digits = digits.replace(/^0+/, '');
    return digits;
  };
  const buildWhatsAppUrl = (phone = CONTACT_PHONE) => {
    const digits = normalizePhoneDigits(phone);
    if (!digits) return `https://wa.me/${normalizePhoneDigits(CONTACT_PHONE)}`;
    if (digits.startsWith('20')) return `https://wa.me/${digits}`;
    if (digits.startsWith('0')) return `https://wa.me/2${digits}`;
    return `https://wa.me/${digits}`;
  };
  const buildWhatsAppMessageUrl = (phone = CONTACT_PHONE, message = '') => {
    const baseUrl = buildWhatsAppUrl(phone);
    const trimmedMessage = String(message || '').trim();
    return trimmedMessage ? `${baseUrl}?text=${encodeURIComponent(trimmedMessage)}` : baseUrl;
  };

  const initTechnicalPartnerSignature = () => {
    const footerBottom = document.querySelector('.public-footer__bottom');
    if (!footerBottom) return;
    if (footerBottom.querySelector('.site-tech-partner')) return;

    const partnerCard = document.createElement('div');
    partnerCard.className = 'site-tech-partner';
    partnerCard.dir = 'rtl';
    partnerCard.setAttribute('aria-label', 'بيانات الشريك التقني');
    partnerCard.innerHTML = `
      <span class="site-tech-partner__eyebrow">
        <span class="site-tech-partner__icon" aria-hidden="true"><i class="fa-solid fa-laptop-code"></i></span>
        <span>Software Solution by ${escapeHtml(TECH_PARTNER_NAME)}</span>
      </span>
      <span class="site-tech-partner__divider" aria-hidden="true">•</span>
      <span class="site-tech-partner__meta">الشريك التقني: ${escapeHtml(TECH_PARTNER_ARABIC_NAME)}</span>
      <a
        class="site-tech-partner__cta"
        href="${buildWhatsAppUrl(TECH_PARTNER_PHONE)}"
        target="_blank"
        rel="noopener noreferrer"
        aria-label="تواصل عبر واتساب مع الشريك التقني ${escapeHtml(TECH_PARTNER_ARABIC_NAME)}"
      >
        <i class="fa-brands fa-whatsapp" aria-hidden="true"></i>
        <span dir="ltr">${escapeHtml(TECH_PARTNER_PHONE)}</span>
      </a>
    `;

    footerBottom.appendChild(partnerCard);
  };

  const setTemporaryButtonContent = (button, html, duration = 1300) => {
    if (!button) return;

    const originalContent = button.dataset.originalContent || button.innerHTML;
    if (!button.dataset.originalContent) {
      button.dataset.originalContent = originalContent;
    }

    button.innerHTML = repairLegacyMojibakeText(html);

    window.setTimeout(() => {
      if (!button.isConnected) return;
      button.innerHTML = button.dataset.originalContent || originalContent;
    }, duration);
  };

  const copyTextToClipboard = async (text) => {
    if (!text) return false;

    try {
      await window.navigator.clipboard.writeText(text);
      return true;
    } catch (error) {
      const tempInput = document.createElement('textarea');
      tempInput.value = text;
      tempInput.setAttribute('readonly', 'readonly');
      tempInput.style.position = 'absolute';
      tempInput.style.left = '-9999px';
      document.body.appendChild(tempInput);
      tempInput.select();

      try {
        const copied = document.execCommand('copy');
        document.body.removeChild(tempInput);
        return copied;
      } catch (fallbackError) {
        document.body.removeChild(tempInput);
        console.warn('Unable to copy text', fallbackError || error);
        return false;
      }
    }
  };

  const buildMailtoUrl = ({ subject, body }) => {
    const params = new URLSearchParams();
    if (subject) params.set('subject', subject);
    if (body) params.set('body', body);
    const query = params.toString();
    const runtimeEmail = sanitizeHiddenContactEmail(window.getRuntimeText(getAdminRuntimeContent()?.contactEmail, CONTACT_EMAIL));
    if (!normalize(runtimeEmail)) {
      const whatsappMessage = [subject, body].filter(Boolean).join('\n\n');
      return buildWhatsAppMessageUrl(CONTACT_PHONE, whatsappMessage);
    }
    return `mailto:${runtimeEmail}${query ? `?${query}` : ''}`;
  };

  const getSavedJobBookmarks = () => safeReadJSON(STORAGE_KEYS.bookmarkedJobs, []);

  const saveJobBookmarks = (bookmarks) => saveJSON(STORAGE_KEYS.bookmarkedJobs, bookmarks);

  const getJobBookmarkKey = (job) =>
    [job?.jobId, job?.jobTitle, job?.jobCompany, job?.jobLocation, job?.jobType].map(normalize).join('::');

  const setBookmarkButtonState = (button, isBookmarked) => {
    if (!button) return;

    button.dataset.bookmarked = isBookmarked ? 'true' : 'false';
    button.setAttribute('aria-pressed', String(isBookmarked));
    button.setAttribute(
      'aria-label',
      repairLegacyMojibakeText(isBookmarked ? 'إلغاء حفظ الوظيفة' : 'حفظ الوظيفة'),
    );
    button.title = repairLegacyMojibakeText(
      isBookmarked ? 'إلغاء حفظ الوظيفة' : 'حفظ الوظيفة',
    );
    button.style.backgroundColor = isBookmarked ? 'rgba(37, 99, 235, 0.12)' : '';
    button.style.color = isBookmarked ? '#2563eb' : '';
    button.style.boxShadow = isBookmarked ? '0 12px 28px rgba(37, 99, 235, 0.12)' : '';

    const icon = button.querySelector('.material-symbols-outlined');
    if (icon) {
      icon.textContent = isBookmarked ? 'bookmark_added' : 'bookmark';
    }
  };

  const renderPagination = ({
    root,
    currentPage,
    totalPages,
    onPageChange,
    activeClasses,
    inactiveClasses,
  }) => {
    if (!root) return;

    const pagesContainer = root.querySelector('[data-pagination-pages]');
    const prevButton = root.querySelector('[data-page-prev]');
    const nextButton = root.querySelector('[data-page-next]');

    if (!pagesContainer || !prevButton || !nextButton) return;

    root.classList.toggle('hidden', totalPages <= 1);
    pagesContainer.innerHTML = '';

    for (let page = 1; page <= totalPages; page += 1) {
      const pageButton = document.createElement('button');
      pageButton.type = 'button';
      pageButton.textContent = page;
      pageButton.className = page === currentPage ? activeClasses : inactiveClasses;
      pageButton.setAttribute('aria-label', repairLegacyMojibakeText(`الصفحة ${page}`));
      pageButton.setAttribute('aria-current', page === currentPage ? 'page' : 'false');
      pageButton.addEventListener('click', () => onPageChange(page));
      pagesContainer.appendChild(pageButton);
    }

    prevButton.disabled = currentPage <= 1;
    nextButton.disabled = currentPage >= totalPages;
    prevButton.onclick = () => onPageChange(currentPage - 1);
    nextButton.onclick = () => onPageChange(currentPage + 1);
  };

  const setInlineContent = (element, text) => {
    if (!element || !normalize(text)) return;

    const icon = element.querySelector('.material-symbols-outlined');
    const iconClone = icon ? icon.cloneNode(true) : null;

    element.textContent = '';
    if (iconClone) {
      element.appendChild(iconClone);
      element.appendChild(document.createTextNode(` ${text}`));
      return;
    }

    element.textContent = text;
  };

  const migrateStoredApplications = (applications = []) => {
    let changed = false;
    const usedIds = new Set();

    const buildLegacyReplacementId = (application, index) => {
      const submittedAt = new Date(application?.submittedAt || Date.now()).getTime();
      const baseId = Number.isFinite(submittedAt) && submittedAt > 0 ? String(submittedAt) : String(Date.now() + index);
      let candidate = `${baseId}${String(index + 1).padStart(2, '0')}`;

      while (usedIds.has(candidate)) {
        candidate = `${baseId}${Math.floor(Math.random() * 90 + 10)}`;
      }

      return candidate;
    };

    const migratedApplications = applications
      .filter((application) => {
        const keepApplication = isRealStoredApplication(application) && !isLegacyDemoApplicationRecord(application);
        if (!keepApplication) changed = true;
        return keepApplication;
      })
      .map((application, index) => {
        const currentId = String(application?.requestId || application?.id || '').trim();
        const needsReplacement = !/^\d+$/.test(currentId) || usedIds.has(currentId);
        const nextId = needsReplacement ? buildLegacyReplacementId(application, index) : currentId;
        const applicant = application?.applicant && typeof application.applicant === 'object' ? application.applicant : {};
        const applicantPhoneKey = buildPhoneLookupKey(
          applicant.phone || application?.applicantPhone || application?.phone || '',
        );
        const applicantPhoneDigits = normalizePhoneDigits(
          applicant.phone || application?.applicantPhone || application?.phone || '',
        );

        if (needsReplacement || application?.id !== nextId || application?.requestId !== nextId) {
          changed = true;
        }

        usedIds.add(nextId);
        return {
          ...application,
          id: nextId,
          requestId: nextId,
          applicantPhoneKey,
          applicantPhoneDigits,
          applicant: {
            ...applicant,
            phone: String(applicant.phone || application?.applicantPhone || application?.phone || '').trim(),
            phoneLookupKey: applicantPhoneKey,
          },
        };
      });

    return {
      changed,
      applications: migratedApplications,
    };
  };

  const getStoredProfile = () => {
    const storedProfile = safeReadJSON(STORAGE_KEYS.applicationProfile, {});
    const { changed, profile } = sanitizeStoredApplicantProfile(storedProfile);
    if (changed) {
      saveJSON(STORAGE_KEYS.applicationProfile, profile);
    }
    return profile;
  };
  const getApplicantDraftSeed = (profile = {}, session = null) => {
    const isCompanyAccount = normalize(profile?.role) === 'company';
    const draftProfile =
      isCompanyAccount ? {} : profile;
    const applicantMeta =
      !isCompanyAccount && draftProfile?.applicantMeta && typeof draftProfile.applicantMeta === 'object'
        ? draftProfile.applicantMeta
        : !isCompanyAccount && profile?.applicantMeta && typeof profile.applicantMeta === 'object'
          ? profile.applicantMeta
          : !isCompanyAccount && draftProfile?.seekerProfile && typeof draftProfile.seekerProfile === 'object'
            ? draftProfile.seekerProfile
            : !isCompanyAccount && profile?.seekerProfile && typeof profile.seekerProfile === 'object'
              ? profile.seekerProfile
          : {};

    return {
      isCompanyAccount,
      draftProfile,
      applicantMeta,
      fallbackName: isCompanyAccount ? '' : session?.name || '',
      fallbackEmail: isCompanyAccount ? '' : session?.email || '',
    };
  };
  const persistApplicantDraftProfile = (existingProfile = {}, profilePatch = {}, applicantMetaPatch = {}) => {
    const isCompanyAccount = normalize(existingProfile?.role) === 'company';

    if (isCompanyAccount) {
      return {
        ...existingProfile,
        applicationDraft: {
          ...clearApplicantDraftFields(
            existingProfile?.applicationDraft && typeof existingProfile.applicationDraft === 'object'
              ? existingProfile.applicationDraft
              : {},
          ),
          applicantMeta: clearApplicantMetaFields(
            readApplicantMeta(existingProfile?.applicationDraft),
          ),
          seekerProfile: clearApplicantSeekerFields(
            existingProfile?.applicationDraft?.seekerProfile &&
              typeof existingProfile.applicationDraft.seekerProfile === 'object'
              ? existingProfile.applicationDraft.seekerProfile
              : {},
          ),
        },
      };
    }

    return {
      ...existingProfile,
      ...profilePatch,
      role: 'applicant',
      applicantMeta: {
        ...readApplicantMeta(existingProfile),
        ...applicantMetaPatch,
      },
    };
  };
  const getLocalStoredApplications = () => {
    const rawApplications = safeReadJSON(STORAGE_KEYS.applications, []);
    const { changed, applications } = migrateStoredApplications(rawApplications);
    if (changed) {
      saveJSON(STORAGE_KEYS.applications, applications);
    }
    return applications;
  };

  const saveLocalStoredApplications = (applications = []) => {
    const { applications: normalizedApplications } = migrateStoredApplications(applications);
    saveJSON(STORAGE_KEYS.applications, normalizedApplications);
    const currentRuntime = sanitizeAdminRuntime(safeReadJSON(ADMIN_RUNTIME_KEY, {})).runtime;
    const nextRuntime = mergeAdminRuntime(currentRuntime, { applications: normalizedApplications });
    saveJSON(ADMIN_RUNTIME_KEY, nextRuntime);
    void syncSharedAdminRuntimeFile(nextRuntime);
    return normalizedApplications;
  };

  const setFirebaseApplicationsState = (applications = []) => {
    const { applications: normalizedApplications } = migrateStoredApplications(applications);
    firebaseApplicationsCache = normalizedApplications;
    firebaseApplicationsCacheHydrated = true;
    return normalizedApplications;
  };

  const upsertFirebaseApplicationCache = (applicationRecord = {}) => {
    const requestId = String(applicationRecord?.requestId || applicationRecord?.id || '').trim();
    if (!requestId) {
      return Array.isArray(firebaseApplicationsCache) ? firebaseApplicationsCache : [];
    }

    const mergedApplications = mergeRuntimeCollections(
      [applicationRecord],
      Array.isArray(firebaseApplicationsCache) ? firebaseApplicationsCache : [],
      (application) => String(application?.requestId || application?.id || '').trim(),
    );
    return setFirebaseApplicationsState(mergedApplications);
  };

  const hydrateCompanyApplicationsCacheFromFirebase = async (session = null) => {
    if (!hasFirebaseSiteConfig() || !session?.companyId || (firebaseApplicationsCacheHydrated && firebaseApplicationsCache.length)) {
      return false;
    }

    const services = await getFirebaseSiteServices();
    if (!services) return false;

    try {
      const { db, firestoreModule } = services;
      const companyId = String(session.companyId || '').trim();
      if (!companyId) return false;

      const applicationsSnapshot = await firestoreModule.getDocs(
        firestoreModule.query(
          firestoreModule.collection(db, 'applications'),
          firestoreModule.where('companyId', '==', companyId),
        ),
      );

      setFirebaseApplicationsState(
        applicationsSnapshot.docs.map((docSnapshot) =>
          mapFirebaseApplicationRecord({ ...docSnapshot.data(), id: docSnapshot.id }),
        ),
      );
      return true;
    } catch (error) {
      console.warn('Unable to hydrate company applications from Firebase', error);
      return false;
    }
  };

  const getStoredApplications = () => {
    const localApplications = getLocalStoredApplications();
    if (!hasFirebaseSiteConfig()) {
      return localApplications;
    }

    if (shouldUseFirebaseOnlyPublicData()) {
      const { applications: normalizedApplications } = migrateStoredApplications(
        mergeRuntimeCollections(
          localApplications,
          Array.isArray(firebaseApplicationsCache) ? firebaseApplicationsCache : [],
          (application) => String(application?.requestId || application?.id || '').trim(),
        ),
      );
      return normalizedApplications;
    }

    if (!firebaseApplicationsCacheHydrated && !firebaseApplicationsCache.length) {
      return localApplications;
    }

    const { applications: normalizedApplications } = migrateStoredApplications(
      Array.isArray(firebaseApplicationsCache) ? firebaseApplicationsCache : [],
    );
    return normalizedApplications;
  };

  const findStoredApplicationByRequestId = (rawRequestId = '') => {
    const normalizedRequestId = normalize(rawRequestId);
    if (!normalizedRequestId) return null;

    return (
      getStoredApplications().find(
        (application) => normalize(String(application?.requestId || application?.id || '').trim()) === normalizedRequestId,
      ) || null
    );
  };

  const fetchApplicationByRequestIdFromFirebase = async (rawRequestId = '') => {
    const requestId = String(rawRequestId || '').replace(/\D+/g, '').trim();
    if (!requestId || !hasFirebaseSiteConfig()) return null;

    const cachedApplication = findStoredApplicationByRequestId(requestId);
    if (firebaseApplicationsReadDenied) {
      return cachedApplication;
    }
    if (cachedApplication && (firebaseApplicationsCacheHydrated || firebaseApplicationsCache.length)) {
      return cachedApplication;
    }

    const services = await getFirebaseSiteServices();
    if (!services) return cachedApplication;

    try {
      const { db, firestoreModule } = services;
      const applicationSnapshot = await firestoreModule.getDoc(firestoreModule.doc(db, 'applications', requestId));
      if (!applicationSnapshot.exists()) {
        return cachedApplication;
      }

      const mappedApplication = mapFirebaseApplicationRecord({ ...applicationSnapshot.data(), id: applicationSnapshot.id });
      upsertFirebaseApplicationCache(mappedApplication);
      return mappedApplication;
    } catch (error) {
      if (isFirebasePermissionDeniedError(error)) {
        firebaseApplicationsReadDenied = true;
        return cachedApplication;
      }
      console.warn('Unable to fetch application by request ID from Firebase', error);
      return cachedApplication;
    }
  };

  const getApplicationByRequestId = async (rawRequestId = '') => {
    const requestId = String(rawRequestId || '').replace(/\D+/g, '').trim();
    if (!requestId) return null;

    const cachedApplication = findStoredApplicationByRequestId(requestId);
    if (!hasFirebaseSiteConfig()) {
      return cachedApplication && isApplicationPubliclyTrackable(cachedApplication) ? cachedApplication : null;
    }

    if (cachedApplication && (firebaseApplicationsCacheHydrated || firebaseApplicationsCache.length)) {
      return isApplicationPubliclyTrackable(cachedApplication) ? cachedApplication : null;
    }

    const fetchedApplication = (await fetchApplicationByRequestIdFromFirebase(requestId)) || cachedApplication || null;
    return fetchedApplication && isApplicationPubliclyTrackable(fetchedApplication) ? fetchedApplication : null;
  };

  const storeApplicationRecord = async (applicationRecord = {}) => {
    const requestId = String(applicationRecord?.requestId || applicationRecord?.id || '').replace(/\D+/g, '').trim();
    if (!requestId) {
      return { ok: false, source: 'invalid' };
    }

    if (!hasFirebaseSiteConfig()) {
      return {
        ok: false,
        source: 'firebase-missing',
        message: 'التقديم متوقف حاليًا لعدم اكتمال إعدادات الربط. أضف القيم المطلوبة ثم أعد المحاولة، ولن يتم حفظ أي طلب قبل ذلك.',
      };
    }

    const savedToFirebase = await syncApplicationRecordToFirebase(applicationRecord, {
        skipExistingLookup: true,
        skipApplicantsCountSync: true,
      });
    if (savedToFirebase) {
      const mergedLocalApplications = mergeRuntimeCollections(
        getLocalStoredApplications(),
        [applicationRecord],
        (application) => String(application?.requestId || application?.id || '').trim(),
      );
      saveJSON(STORAGE_KEYS.applications, mergedLocalApplications);
    }

    return {
      ok: savedToFirebase,
      source: 'firebase',
    };
  };

  const buildApplicationSupportMessage = (applicationRecord = {}, trackingUrl = '') => {
    const requestId = String(applicationRecord?.requestId || applicationRecord?.id || '').trim();
    const applicantName = String(applicationRecord?.applicant?.fullName || '').trim();
    const jobTitle = String(applicationRecord?.job?.jobTitle || '').trim();
    const companyName = String(applicationRecord?.job?.jobCompany || applicationRecord?.company?.name || '').trim();
    const absoluteTrackingUrl = trackingUrl ? new URL(trackingUrl, window.location.href).href : '';

    return [
      'مرحبًا، أرسلت طلب توظيف جديد.',
      applicantName ? `الاسم: ${applicantName}` : '',
      requestId ? `رقم الطلب: ${requestId}` : '',
      jobTitle ? `الوظيفة: ${jobTitle}` : '',
      companyName ? `الشركة: ${companyName}` : '',
      absoluteTrackingUrl ? `رابط المتابعة: ${absoluteTrackingUrl}` : '',
    ]
      .filter(Boolean)
      .join('\n');
  };

  const normalizeApplicationStatus = (value) => {
    const normalizedStatus = normalize(value);

    if (
      normalizedStatus.includes('interview') ||
      normalizedStatus.includes('meeting') ||
      normalizedStatus.includes('\u0645\u0642\u0627\u0628')
    ) {
      return 'interview';
    }

    if (
      normalizedStatus.includes('approve') ||
      normalizedStatus.includes('approved') ||
      normalizedStatus.includes('accept') ||
      normalizedStatus.includes('accepted') ||
      normalizedStatus.includes('hire') ||
      normalizedStatus.includes('hired')
    ) {
      return 'approved';
    }

    if (normalizedStatus.includes('reject') || normalizedStatus.includes('rejected')) {
      return 'rejected';
    }

    if (normalizedStatus.includes('review') || normalizedStatus.includes('pending')) {
      return 'review';
    }

    return 'review';
  };

  const COMPANY_CANDIDATE_TAG_LABELS = {
    strong: 'مناسب',
    contact: 'يحتاج تواصل',
    reserve: 'احتياطي',
    'not-fit': 'غير مناسب',
  };

  const INTERVIEW_MODE_LABELS = {
    onsite: 'حضوري',
    phone: 'هاتف',
    online: 'أونلاين',
  };

  const normalizeCompanyCandidateTag = (value) => {
    const normalizedValue = normalize(value);
    if (normalizedValue.includes('strong') || normalizedValue.includes('مناسب')) return 'strong';
    if (normalizedValue.includes('contact') || normalizedValue.includes('تواصل')) return 'contact';
    if (normalizedValue.includes('reserve') || normalizedValue.includes('احتياط')) return 'reserve';
    if (normalizedValue.includes('not-fit') || normalizedValue.includes('غير مناسب')) return 'not-fit';
    return '';
  };

  const normalizeInterviewMode = (value) => {
    const normalizedValue = normalize(value);
    if (normalizedValue.includes('onsite') || normalizedValue.includes('حضوري')) return 'onsite';
    if (normalizedValue.includes('phone') || normalizedValue.includes('هاتف')) return 'phone';
    if (normalizedValue.includes('online') || normalizedValue.includes('اونلاين') || normalizedValue.includes('أونلاين')) return 'online';
    return '';
  };

  const getCompanyCandidateTagLabel = (value) => COMPANY_CANDIDATE_TAG_LABELS[normalizeCompanyCandidateTag(value)] || '';
  const getInterviewModeLabel = (value) => INTERVIEW_MODE_LABELS[normalizeInterviewMode(value)] || 'غير محدد';
  const downloadCsvFile = (filename, rows) => {
    const csvContent = rows
      .map((row) =>
        row
          .map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`)
          .join(','),
      )
      .join('\n');
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 500);
  };

  const sanitizeApplicationNotes = (notes = []) =>
    (Array.isArray(notes) ? notes : [])
      .map((note) => ({
        id: String(note?.id || createId('note')).trim(),
        body: String(note?.body || note?.text || '').trim(),
        createdAt: String(note?.createdAt || new Date().toISOString()).trim(),
        authorName: String(note?.authorName || note?.author || 'إدارة الشركة').trim(),
      }))
      .filter((note) => note.body);

  const appendApplicationNote = (notes = [], body = '', authorName = 'إدارة الشركة') => {
    const trimmedBody = String(body || '').trim();
    const existingNotes = sanitizeApplicationNotes(notes);
    if (!trimmedBody) return existingNotes;

    return [
      {
        id: createId('note'),
        body: trimmedBody,
        createdAt: new Date().toISOString(),
        authorName: String(authorName || 'إدارة الشركة').trim() || 'إدارة الشركة',
      },
      ...existingNotes,
    ];
  };

  const toDateTimeLocalValue = (value) => {
    const date = value ? new Date(value) : null;
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '';
    const offsetMs = date.getTimezoneOffset() * 60000;
    return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
  };

  const fromDateTimeLocalValue = (value) => {
    const trimmedValue = String(value || '').trim();
    if (!trimmedValue) return '';
    const parsedDate = new Date(trimmedValue);
    return Number.isNaN(parsedDate.getTime()) ? '' : parsedDate.toISOString();
  };

  const getInterviewScheduleLabel = (application = {}) => {
    const scheduledAt = String(application?.interviewScheduledAt || '').trim();
    if (!scheduledAt) return '';
    const scheduledText = formatLocalDateTime(scheduledAt) || scheduledAt;
    const modeText = getInterviewModeLabel(application?.interviewMode);
    const locationText = String(application?.interviewLocation || '').trim();
    return [scheduledText, modeText !== 'غير محدد' ? modeText : '', locationText].filter(Boolean).join(' • ');
  };

  const getApplicationRequestId = (application) =>
    String(application?.requestId || application?.id || '').trim();

  const getJobPositionsCount = (job = {}) => {
    const rawPositions = Number.parseInt(String(job?.positions || job?.jobPositions || '').trim(), 10);
    return Number.isFinite(rawPositions) && rawPositions > 0 ? rawPositions : 1;
  };

  const getJobApplicantsCount = (job = {}, applications = getStoredApplications()) => {
    const normalizedJobId = normalize(job?.id || job?.jobId || '');
    const normalizedTitle = normalize(job?.title || job?.jobTitle || '');
    const normalizedCompany = normalize(job?.companyName || job?.jobCompany || '');
    const normalizedLocation = normalize(job?.location || job?.jobLocation || '');
    const entries = Array.isArray(applications) ? applications : [];

    return entries.filter((application) => {
      const applicationJob = application?.job || {};
      const applicationJobId = normalize(application?.jobId || applicationJob?.id || applicationJob?.jobId || '');
      const applicationTitle = normalize(applicationJob?.jobTitle || applicationJob?.title || application?.jobTitle || '');
      const applicationCompany = normalize(
        applicationJob?.jobCompany ||
          applicationJob?.companyName ||
          application?.companyName ||
          application?.company?.name ||
          '',
      );
      const applicationLocation = normalize(applicationJob?.jobLocation || applicationJob?.location || application?.jobLocation || '');

      if (normalizedJobId && applicationJobId) {
        return normalizedJobId === applicationJobId;
      }

      if (!normalizedTitle || !normalizedCompany) {
        return false;
      }

      const matchesTitleAndCompany = applicationTitle === normalizedTitle && applicationCompany === normalizedCompany;
      if (!normalizedLocation) {
        return matchesTitleAndCompany;
      }

      return matchesTitleAndCompany && applicationLocation === normalizedLocation;
    }).length;
  };

  const getJobDemandStatusMeta = (job = {}, applications = getStoredApplications()) => {
    const positionsCount = getJobPositionsCount(job);
    const applicantsCount = Math.max(Number(job?.applicantsCount || 0), getJobApplicantsCount(job, applications));
    const isClosed =
      job?.applicationEnabled === false ||
      ['hidden', 'archived', 'rejected'].includes(normalize(job?.status || 'approved'));
    const remainingCount = Math.max(positionsCount - applicantsCount, 0);
    const filled = isClosed || remainingCount <= 0;

    return {
      positionsCount,
      applicantsCount,
      remainingCount,
      filled,
      statusText: filled ? 'اكتمل العدد المطلوب' : `باقي عدد ${remainingCount}`,
      summaryText: filled ? 'تم إغلاق التقديم أو الوصول للعدد المطلوب.' : `${applicantsCount} متقدم حتى الآن`,
    };
  };

  const buildApplicationRequestId = () => {
    const existingIds = new Set(getStoredApplications().map((application) => getApplicationRequestId(application)));
    let nextId = '';

    do {
      nextId = `${Date.now()}${Math.floor(Math.random() * 90 + 10)}`;
    } while (existingIds.has(nextId));

    return nextId;
  };

  const getApplicationStatusPresentation = (application) => {
    const status = normalizeApplicationStatus(application?.status);
    const rejectionReason = String(application?.rejectionReason || '').trim();

    if (status === 'interview') {
      return {
        key: 'interview',
        label: 'تم تحديد مقابلة',
        tone: 'info',
        description: 'تم نقل الطلب إلى مرحلة المقابلة.',
      };
    }

    if (status === 'approved') {
      return {
        key: 'approved',
        label: 'تمت الموافقة',
        tone: 'success',
        description: 'تمت مراجعة الطلب والموافقة عليه.',
      };
    }

    if (status === 'rejected') {
      return {
        key: 'rejected',
        label: 'تم الرفض',
        tone: 'error',
        description: rejectionReason || 'تم رفض الطلب.',
      };
    }

    return {
      key: 'review',
      label: 'جارٍ المراجعة',
      tone: 'info',
      description: 'الطلب قيد المراجعة حاليًا.',
    };
  };

  const getApplicationsAverageResponseHours = (applications = []) => {
    const decidedApplications = applications.filter((application) => {
      const status = normalizeApplicationStatus(application?.status);
      return (
        ['approved', 'rejected'].includes(status) &&
        application?.respondedAt &&
        application?.submittedAt
      );
    });

    if (!decidedApplications.length) return null;

    const totalHours = decidedApplications.reduce((sum, application) => {
      const submittedAt = new Date(application.submittedAt).getTime();
      const respondedAt = new Date(application.respondedAt).getTime();
      if (!Number.isFinite(submittedAt) || !Number.isFinite(respondedAt) || respondedAt < submittedAt) {
        return sum;
      }

      return sum + (respondedAt - submittedAt) / (1000 * 60 * 60);
    }, 0);

    return Math.max(1, Math.round(totalHours / decidedApplications.length));
  };

  const formatAverageResponseLabel = (hours) => {
    if (!Number.isFinite(hours) || hours <= 0) return 'غير متاح';
    if (hours < 24) return `${hours} ساعة`;

    const days = Math.round(hours / 24);
    return `${days} يوم`;
  };

  const setTextContent = (selector, value) => {
    const element = document.querySelector(selector);
    if (element && value !== undefined && value !== null) {
      element.textContent = value;
    }
    return element;
  };

  const formatLocalDate = (value) => {
    if (!value) return '';
    const parsedDate = new Date(value);
    if (Number.isNaN(parsedDate.getTime())) return '';
    return parsedDate.toLocaleDateString('ar-EG', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };
  const formatLocalDateTime = (value) => {
    if (!value) return '';
    const parsedDate = new Date(value);
    if (Number.isNaN(parsedDate.getTime())) return '';
    return parsedDate.toLocaleString('ar-EG', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  const getAccountDisplayName = (profile = {}, session = null, fallback = '\u0627\u0644\u062d\u0633\u0627\u0628 \u0627\u0644\u062d\u0627\u0644\u064a') => {
    if (normalize(profile?.role) === 'company') {
      return (
        profile?.companyProfile?.companyName ||
        profile?.companyName ||
        profile?.fullName ||
        session?.name ||
        fallback
      );
    }

    return profile?.fullName || session?.name || fallback;
  };

  const getFirstName = (name, fallback = '\u0635\u062f\u064a\u0642\u0646\u0627') => {
    const firstToken = (name || '').toString().trim().split(/\s+/)[0];
    return firstToken || fallback;
  };

  const normalizeCompanyPersistedStatus = (value, fallback = 'pending') => {
    const normalizeKnownStatus = (entry) => {
      const normalizedEntry = normalize(entry);
      if (['approved', 'pending', 'restricted', 'archived'].includes(normalizedEntry)) return normalizedEntry;
      if (normalizedEntry === 'suspended') return 'restricted';
      return '';
    };

    return normalizeKnownStatus(value) || normalizeKnownStatus(fallback) || 'pending';
  };

  const getCompanyIdentity = (profile = {}, session = null) => ({
    name:
      profile?.companyProfile?.companyName ||
      profile?.companyName ||
      (normalize(profile?.role) === 'company' ? getAccountDisplayName(profile, session, '\u0634\u0631\u0643\u062a\u0643') : ''),
    sector: profile?.companyProfile?.companySector || profile?.companySector || profile?.headline || '',
    city: profile?.companyProfile?.companyCity || profile?.companyCity || profile?.city || '',
    teamSize: sanitizePositiveIntegerInput(profile?.companyProfile?.teamSize || profile?.teamSize || '', {
      allowLegacyRange: true,
    }),
    phone: profile?.companyProfile?.phone || profile?.phone || '',
    landline: profile?.companyProfile?.landline || profile?.companyLandline || '',
    website: profile?.companyProfile?.website || profile?.companyWebsite || profile?.website || '',
    socialLinks: normalizeCompanySocialLinks(profile?.companyProfile?.socialLinks || profile?.socialLinks),
    siteMode: String(profile?.companyProfile?.siteMode || profile?.siteMode || 'full').trim() === 'landing' ? 'landing' : 'full',
    restrictionMessage: String(profile?.companyProfile?.restrictionMessage || profile?.restrictionMessage || '').trim(),
    restrictionAttachmentUrl: String(
      profile?.companyProfile?.restrictionAttachmentUrl || profile?.restrictionAttachmentUrl || '',
    ).trim(),
    restrictionAttachmentName: String(
      profile?.companyProfile?.restrictionAttachmentName || profile?.restrictionAttachmentName || '',
    ).trim(),
    status: String(profile?.companyProfile?.status || profile?.status || profile?.companyStatus || '').trim(),
    description:
      profile?.companyProfile?.companyDescription ||
      profile?.companyDescription ||
      profile?.description ||
      profile?.headline ||
      '',
    logoUrl: profile?.companyProfile?.companyLogoUrl || profile?.companyLogoUrl || '',
    coverUrl: profile?.companyProfile?.companyCoverUrl || profile?.companyCoverUrl || '',
  });

  const refreshCompanySession = (profile = {}, session = null) => {
    if (normalize(profile?.role) !== 'company') return session;

    const currentSession = session || getSession() || {};
    const companyIdentity = getCompanyIdentity(profile, currentSession);
    const nextSession = {
      ...currentSession,
      loggedIn: true,
      role: 'company',
      email: String(profile?.email || currentSession?.email || '').trim(),
      name: companyIdentity.name || profile?.fullName || currentSession?.name || '',
      loggedInAt: currentSession?.loggedInAt || new Date().toISOString(),
      expiresAt: new Date(Date.now() + SESSION_TTL_MS).toISOString(),
    };

    setSession(nextSession);
    return nextSession;
  };

  const getCompanyTemplatePreset = (templateKey) => {
    const presets = {
      software: {
        title: '\u0645\u0637\u0648\u0631 \u0648\u0627\u062c\u0647\u0627\u062a',
        location: '\u0627\u0644\u0642\u0627\u0647\u0631\u0629 \u0627\u0644\u062c\u062f\u064a\u062f\u0629',
        type: '\u062f\u0648\u0627\u0645 \u0643\u0627\u0645\u0644',
      },
      finance: {
        title: '\u0645\u062d\u0627\u0633\u0628 \u0623\u0648\u0644',
        location: '\u0036 \u0623\u0643\u062a\u0648\u0628\u0631',
        type: '\u062f\u0648\u0627\u0645 \u0643\u0627\u0645\u0644',
      },
      hr: {
        title: '\u0623\u062e\u0635\u0627\u0626\u064a \u0645\u0648\u0627\u0631\u062f \u0628\u0634\u0631\u064a\u0629',
        location: '\u0627\u0644\u0642\u0627\u0647\u0631\u0629',
        type: '\u062f\u0648\u0627\u0645 \u0643\u0627\u0645\u0644',
      },
      support: {
        title: '\u062e\u062f\u0645\u0629 \u0639\u0645\u0644\u0627\u0621',
        location: '\u0627\u0644\u062c\u064a\u0632\u0629',
        type: '\u062f\u0648\u0627\u0645 \u062c\u0632\u0626\u064a',
      },
      marketing: {
        title: '\u062a\u0633\u0648\u064a\u0642 \u0631\u0642\u0645\u064a',
        location: '\u0627\u0644\u0642\u0627\u0647\u0631\u0629 \u0627\u0644\u062c\u062f\u064a\u062f\u0629',
        type: '\u0647\u062c\u064a\u0646',
      },
    };

    return presets[normalize(templateKey)] || null;
  };

  const createLocalEntityId = (prefix = 'item') =>
    `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;

  const getCompanyLogoLetter = (name = '') => String(name || '').trim().charAt(0) || 'ش';

  const normalizeCompanyStoredJob = (job = {}, profile = {}, session = null) => {
    const companyIdentity = getCompanyIdentity(profile, session);
    const companyName = String(job?.companyName || companyIdentity.name || '').trim();
    const title = String(job?.title || job?.jobTitle || '').trim();

    if (!companyName || !title) return null;

    const postedAt = String(job?.postedAt || job?.createdAt || new Date().toISOString()).trim();

    return {
      id: String(job?.id || createLocalEntityId('job')),
      title,
      companyName,
      location: String(job?.location || job?.city || companyIdentity.city || '').trim(),
      type: String(job?.type || '').trim(),
      postedLabel: String(job?.postedLabel || '').trim(),
      salary: String(job?.salary || '').trim(),
      summary: String(job?.summary || job?.description || '').trim(),
      sector: String(job?.sector || companyIdentity.sector || '').trim(),
      featured: Boolean(job?.featured),
      status: String(job?.status || 'approved').trim(),
      deletedBy:
        String(job?.deletedBy || '').trim() === 'company'
          ? 'company'
          : String(job?.deletedBy || '').trim() === 'admin'
            ? 'admin'
            : null,
      deletedStatusSnapshot: String(job?.deletedStatusSnapshot || '').trim() || null,
      restoredByAdminAt: String(job?.restoredByAdminAt || '').trim() || null,
      deletedAt: job?.deletedAt || null,
      positions: String(job?.positions || '').trim(),
      requirements: String(job?.requirements || '').trim(),
      benefits: String(job?.benefits || '').trim(),
      postedAt,
      createdAt: String(job?.createdAt || postedAt).trim(),
      updatedAt: String(job?.updatedAt || postedAt).trim(),
    };
  };

  const getCompanyStoredJobs = (profile = {}, session = null) => {
    const candidates = [];

    if (Array.isArray(profile?.companyJobs)) {
      candidates.push(...profile.companyJobs);
    }

    if (Array.isArray(profile?.companyProfile?.jobs)) {
      candidates.push(...profile.companyProfile.jobs);
    }

    const jobsByKey = new Map();

    candidates.forEach((job, index) => {
      const normalizedJob = normalizeCompanyStoredJob(job, profile, session);
      if (!normalizedJob) return;

      const fallbackKey = `${normalize(normalizedJob.title)}::${normalize(normalizedJob.companyName)}::${index}`;
      jobsByKey.set(String(normalizedJob.id || fallbackKey), normalizedJob);
    });

    return Array.from(jobsByKey.values()).sort(
      (firstJob, secondJob) => new Date(secondJob.postedAt).getTime() - new Date(firstJob.postedAt).getTime(),
    );
  };

  const buildCompanyJobDraftFromJob = (job = {}) => ({
    title: String(job?.title || '').trim(),
    department: String(job?.department || '').trim(),
    city: String(job?.location || job?.city || '').trim(),
    location: String(job?.location || job?.city || '').trim(),
    type: String(job?.type || '').trim(),
    salary: String(job?.salary || '').trim(),
    positions: String(job?.positions || '').trim(),
    description: String(job?.summary || job?.description || '').trim(),
    requirements: String(job?.requirements || '').trim(),
    benefits: String(job?.benefits || '').trim(),
    featured: Boolean(job?.featured),
  });

  const persistCompanyJobsProfile = (profile = {}, jobs = [], lastJob = null) => {
    const safeJobs = jobs.map((job) => ({ ...job }));
    const nextDraft = lastJob
      ? buildCompanyJobDraftFromJob(lastJob)
      : buildCompanyJobDraftFromJob(profile?.companyJobDraft || profile?.companyProfile?.draft || {});

    const nextProfile = {
      ...profile,
      companyJobs: safeJobs,
      companyJobDraft: nextDraft,
      companyProfile: {
        ...(profile?.companyProfile || {}),
        jobs: safeJobs,
        draft: nextDraft,
      },
    };

    saveJSON(STORAGE_KEYS.applicationProfile, nextProfile);
    return nextProfile;
  };

  const updateCompanyApplicationStatus = async (
    profile = {},
    session = null,
    applicationId = '',
    status = 'approved',
    rejectionReason = '',
    reviewOptions = {},
  ) => {
    const companyIdentity = getCompanyIdentity(profile, session);
    const companyName = String(companyIdentity.name || profile?.companyName || profile?.fullName || '').trim();
    const companyEmail = normalize(profile?.email || session?.email || '');
    const requestId = String(applicationId || '').trim();

    if (!requestId || !companyName) return false;

    const normalizedTargetStatus = normalizeApplicationStatus(status);
    const nextStatus =
      normalizedTargetStatus === 'rejected'
        ? 'rejected'
        : normalizedTargetStatus === 'interview'
          ? 'interview'
          : normalizedTargetStatus === 'review'
            ? 'review'
            : 'approved';
    const resolvedReason =
      nextStatus === 'rejected' ? String(rejectionReason || '').trim() || 'تم رفض الطلب من قبل الشركة.' : '';
    const reviewPatch = reviewOptions && typeof reviewOptions === 'object' ? reviewOptions : {};

    const applications = getStoredApplications();
    let changed = false;
    const nextApplications = applications.map((application) => {
      const currentRequestId = getApplicationRequestId(application);
      const matchesCompany =
        normalize(application?.job?.jobCompany) === normalize(companyName) ||
        (companyEmail && normalize(application?.company?.email) === companyEmail);

      if (currentRequestId !== requestId || !matchesCompany) return application;

      changed = true;
      const currentStatus = normalizeApplicationStatus(application?.status);
      const nextTag =
        normalizeCompanyCandidateTag(reviewPatch.companyTag || reviewPatch.tag || '') ||
        normalizeCompanyCandidateTag(application?.companyTag || '');
      const nextInterviewScheduledAt =
        fromDateTimeLocalValue(reviewPatch.interviewScheduledAt) ||
        String(reviewPatch.interviewScheduledAt || '').trim() ||
        String(application?.interviewScheduledAt || '').trim();
      const nextInterviewMode =
        normalizeInterviewMode(reviewPatch.interviewMode || '') || normalizeInterviewMode(application?.interviewMode || '');
      const nextInterviewLocation = String(reviewPatch.interviewLocation || application?.interviewLocation || '').trim();
      const nextNotes = appendApplicationNote(
        application?.notes,
        reviewPatch.note || reviewPatch.applicationNote || '',
        companyName,
      );
      const respondedAt =
        nextStatus === currentStatus
          ? application?.respondedAt || (nextStatus === 'review' ? null : new Date().toISOString())
          : nextStatus === 'review'
            ? null
            : new Date().toISOString();

      return {
        ...application,
        id: requestId,
        requestId,
        status: nextStatus,
        rejectionReason: resolvedReason,
        respondedAt,
        companyTag: nextTag,
        interviewScheduledAt: nextInterviewScheduledAt,
        interviewMode: nextInterviewMode,
        interviewLocation: nextInterviewLocation,
        notes: nextNotes,
        updatedAt: new Date().toISOString(),
      };
    });

    if (!changed) return false;
    const changedApplication =
      nextApplications.find((application) => String(application?.requestId || application?.id || '').trim() === requestId) || null;
    if (!changedApplication) return false;

    if (hasFirebaseSiteConfig()) {
      return await syncApplicationRecordToFirebase(changedApplication);
    }

    saveLocalStoredApplications(nextApplications);
    return true;
  };

  const deleteCompanyAccountPermanently = async (profile = {}, session = null) => {
    const activeSession = session || getSession() || {};
    const companyIdentity = getCompanyIdentity(profile, activeSession);
    const runtimeCompanies = getAdminRuntimeCompanies();
    const matchedRuntimeCompany =
      runtimeCompanies.find(
        (company) =>
          normalize(company?.id) === normalize(activeSession?.companyId || profile?.companyId || '') ||
          normalize(company?.email) === normalize(profile?.email || activeSession?.email || '') ||
          normalize(company?.name) === normalize(companyIdentity.name),
      ) || {};

    const companyId = String(activeSession?.companyId || profile?.companyId || matchedRuntimeCompany?.id || '').trim();
    const companyName = String(companyIdentity.name || matchedRuntimeCompany?.name || '').trim();
    const companyEmail = normalize(profile?.email || activeSession?.email || matchedRuntimeCompany?.email || '');

    if (!companyId && !companyName && !companyEmail) return false;

    const matchesCompany = (company = {}) => {
      const recordId = String(company?.id || '').trim();
      const recordName = normalize(company?.name || '');
      const recordEmail = normalize(company?.email || '');
      return (companyId && recordId === companyId) || (companyEmail && recordEmail === companyEmail) || (companyName && recordName === normalize(companyName));
    };

    const matchesJob = (job = {}) => {
      const recordCompanyId = String(job?.companyId || '').trim();
      const recordCompanyName = normalize(job?.companyName || job?.jobCompany || '');
      return (companyId && recordCompanyId === companyId) || (companyName && recordCompanyName === normalize(companyName));
    };

    const matchesApplication = (application = {}) => {
      const recordCompanyId = String(application?.companyId || '').trim();
      const recordCompanyName = normalize(
        application?.companyName || application?.company?.name || application?.job?.jobCompany || application?.jobCompany || '',
      );
      const recordCompanyEmail = normalize(application?.company?.email || '');
      return (
        (companyId && recordCompanyId === companyId) ||
        (companyName && recordCompanyName === normalize(companyName)) ||
        (companyEmail && recordCompanyEmail === companyEmail)
      );
    };

    const nextApplications = getStoredApplications().filter((application) => !matchesApplication(application));
    saveLocalStoredApplications(nextApplications);

    const currentRuntime = sanitizeAdminRuntime(safeReadJSON(ADMIN_RUNTIME_KEY, {})).runtime;
    const nextRuntime = {
      ...currentRuntime,
      companies: Array.isArray(currentRuntime?.companies) ? currentRuntime.companies.filter((company) => !matchesCompany(company)) : [],
      jobs: Array.isArray(currentRuntime?.jobs) ? currentRuntime.jobs.filter((job) => !matchesJob(job)) : [],
      applications: Array.isArray(currentRuntime?.applications)
        ? currentRuntime.applications.filter((application) => !matchesApplication(application))
        : [],
    };
    saveJSON(ADMIN_RUNTIME_KEY, nextRuntime);
    void syncSharedAdminRuntimeFile(nextRuntime);

    if (hasFirebaseSiteConfig()) {
      const services = await getFirebaseSiteServices();
      if (services) {
        try {
          const { db, firestoreModule, auth, authModule } = services;
          const refsToDelete = new Map();
          const rememberRef = (ref) => {
            if (ref?.path) refsToDelete.set(ref.path, ref);
          };

          if (companyId) {
            rememberRef(firestoreModule.doc(db, 'companies', companyId));
          }

          const companyQueries = [];
          const jobQueries = [];
          const applicationQueries = [];

          if (companyEmail) {
            companyQueries.push(
              firestoreModule.getDocs(
                firestoreModule.query(firestoreModule.collection(db, 'companies'), firestoreModule.where('email', '==', companyEmail)),
              ),
            );
          }
          if (companyName) {
            companyQueries.push(
              firestoreModule.getDocs(
                firestoreModule.query(firestoreModule.collection(db, 'companies'), firestoreModule.where('name', '==', companyName)),
              ),
            );
            jobQueries.push(
              firestoreModule.getDocs(
                firestoreModule.query(firestoreModule.collection(db, 'jobs'), firestoreModule.where('companyName', '==', companyName)),
              ),
            );
            applicationQueries.push(
              firestoreModule.getDocs(
                firestoreModule.query(
                  firestoreModule.collection(db, 'applications'),
                  firestoreModule.where('companyName', '==', companyName),
                ),
              ),
            );
          }
          if (companyId) {
            jobQueries.push(
              firestoreModule.getDocs(
                firestoreModule.query(firestoreModule.collection(db, 'jobs'), firestoreModule.where('companyId', '==', companyId)),
              ),
            );
            applicationQueries.push(
              firestoreModule.getDocs(
                firestoreModule.query(
                  firestoreModule.collection(db, 'applications'),
                  firestoreModule.where('companyId', '==', companyId),
                ),
              ),
            );
          }

          const [companySnapshots, jobSnapshots, applicationSnapshots] = await Promise.all([
            Promise.all(companyQueries),
            Promise.all(jobQueries),
            Promise.all(applicationQueries),
          ]);

          companySnapshots.forEach((snapshot) => snapshot.docs.forEach((docSnapshot) => rememberRef(docSnapshot.ref)));
          jobSnapshots.forEach((snapshot) => snapshot.docs.forEach((docSnapshot) => rememberRef(docSnapshot.ref)));
          applicationSnapshots.forEach((snapshot) => snapshot.docs.forEach((docSnapshot) => rememberRef(docSnapshot.ref)));

          if (refsToDelete.size) {
            const batch = firestoreModule.writeBatch(db);
            refsToDelete.forEach((ref) => batch.delete(ref));
            await batch.commit();
          }

          try {
            const authState = await waitForFirebaseAuthUser();
            const currentUser = authState?.user || auth?.currentUser || null;
            const matchesCurrentUser =
              currentUser &&
              ((companyEmail && normalize(currentUser.email || '') === companyEmail) ||
                (activeSession?.uid && String(currentUser.uid || '').trim() === String(activeSession.uid || '').trim()));

            if (matchesCurrentUser && typeof authModule?.deleteUser === 'function') {
              await authModule.deleteUser(currentUser);
            }
          } catch (error) {
            console.warn('Unable to remove Firebase auth user after company deletion', error);
          }
        } catch (error) {
          console.warn('Unable to permanently delete company account from Firebase', error);
          return false;
        }
      }
    }

    firebaseApplicationsCache = [];
    firebaseApplicationsCacheHydrated = false;
    if (companyId) {
      firebaseCompanyStateFingerprints.delete(companyId);
    }
    window.localStorage.removeItem(STORAGE_KEYS.applicationProfile);
    window.sessionStorage.removeItem(STORAGE_KEYS.applicationProfile);
    clearSocialDraft();
    await signOutCompanySession();
    return true;
  };
  const requestCompanyAccountDeletion = async (profile = {}, session = null, reason = '') => {
    const activeSession = session || getSession() || {};
    const deletionReason = repairLegacyMojibakeText(String(reason || '').trim());
    if (!deletionReason) return false;

    const companyIdentity = getCompanyIdentity(profile, activeSession);
    const runtimeCompanies = getAdminRuntimeCompanies();
    const matchedRuntimeCompany =
      runtimeCompanies.find(
        (company) =>
          normalize(company?.id) === normalize(activeSession?.companyId || profile?.companyId || '') ||
          normalize(company?.email) === normalize(profile?.email || activeSession?.email || '') ||
          normalize(company?.name) === normalize(companyIdentity.name),
      ) || {};

    const companyId = String(activeSession?.companyId || profile?.companyId || matchedRuntimeCompany?.id || '').trim();
    const companyName = String(companyIdentity.name || matchedRuntimeCompany?.name || '').trim();
    const companyEmail = normalize(profile?.email || activeSession?.email || matchedRuntimeCompany?.email || '');

    if (!companyId && !companyName && !companyEmail) return false;

    const matchesCompany = (company = {}) => {
      const recordId = String(company?.id || '').trim();
      const recordName = normalize(company?.name || '');
      const recordEmail = normalize(company?.email || '');
      return (
        (companyId && recordId === companyId) ||
        (companyEmail && recordEmail === companyEmail) ||
        (companyName && recordName === normalize(companyName))
      );
    };

    const matchesJob = (job = {}) => {
      const recordCompanyId = String(job?.companyId || '').trim();
      const recordCompanyName = normalize(job?.companyName || job?.jobCompany || '');
      return (companyId && recordCompanyId === companyId) || (companyName && recordCompanyName === normalize(companyName));
    };

    const now = new Date().toISOString();
    const profileJobs = getCompanyStoredJobs(profile, activeSession);
    const runtimeJobs = getAdminRuntimeJobs()
      .filter((job) => matchesJob(job))
      .map((job) => normalizeCompanyStoredJob(job, profile, activeSession))
      .filter(Boolean);
    const companyJobs = mergeRuntimeCollections(runtimeJobs, profileJobs, getRuntimeJobKey).map((job) => ({
      ...job,
      deletedAt: now,
      deletedBy: 'company',
      deletedStatusSnapshot: String(job?.deletedStatusSnapshot || job?.status || 'approved').trim() || 'approved',
      restoredByAdminAt: null,
      updatedAt: now,
    }));

    const baseCompany = {
      ...matchedRuntimeCompany,
      id:
        companyId ||
        String(matchedRuntimeCompany?.id || '').trim() ||
        `company-${normalize(companyName).replace(/[^a-z0-9]/g, '-') || 'custom'}`,
      name: companyName || String(matchedRuntimeCompany?.name || '').trim(),
      sector: String(companyIdentity.sector || matchedRuntimeCompany?.sector || '').trim(),
      location: String(companyIdentity.city || matchedRuntimeCompany?.location || '').trim(),
      city: String(companyIdentity.city || matchedRuntimeCompany?.city || matchedRuntimeCompany?.location || '').trim(),
      teamSize: sanitizePositiveIntegerInput(companyIdentity.teamSize || matchedRuntimeCompany?.teamSize || '', {
        allowLegacyRange: true,
      }),
      phone: String(companyIdentity.phone || matchedRuntimeCompany?.phone || '').trim(),
      landline: String(companyIdentity.landline || matchedRuntimeCompany?.landline || '').trim(),
      email: String(profile?.email || activeSession?.email || matchedRuntimeCompany?.email || '').trim(),
      website: String(companyIdentity.website || matchedRuntimeCompany?.website || '').trim(),
      socialLinks: normalizeCompanySocialLinks(companyIdentity.socialLinks || matchedRuntimeCompany?.socialLinks),
      siteMode: 'full',
      restrictionMessage: String(companyIdentity.restrictionMessage || matchedRuntimeCompany?.restrictionMessage || '').trim(),
      restrictionAttachmentUrl:
        String(companyIdentity.restrictionAttachmentUrl || matchedRuntimeCompany?.restrictionAttachmentUrl || '').trim() || null,
      restrictionAttachmentName: String(
        companyIdentity.restrictionAttachmentName || matchedRuntimeCompany?.restrictionAttachmentName || '',
      ).trim(),
      summary: String(
        companyIdentity.description || matchedRuntimeCompany?.summary || matchedRuntimeCompany?.description || '',
      ).trim(),
      description: String(
        companyIdentity.description || matchedRuntimeCompany?.description || matchedRuntimeCompany?.summary || '',
      ).trim(),
      logoLetter: String(
        matchedRuntimeCompany?.logoLetter || getCompanyLogoLetter(companyName || activeSession?.name || 'ش'),
      ).trim(),
      imageUrl:
        String(
          matchedRuntimeCompany?.imageUrl ||
            matchedRuntimeCompany?.logoUrl ||
            matchedRuntimeCompany?.coverImage ||
            profile?.companyLogoUrl ||
            profile?.companyCoverUrl ||
            '',
        ).trim() || null,
      logoUrl:
        String(
          matchedRuntimeCompany?.logoUrl ||
            matchedRuntimeCompany?.imageUrl ||
            profile?.companyLogoUrl ||
            '',
        ).trim() || null,
      coverImage:
        String(
          matchedRuntimeCompany?.coverImage ||
            matchedRuntimeCompany?.coverUrl ||
            profile?.companyCoverUrl ||
            '',
        ).trim() || null,
      coverUrl:
        String(
          matchedRuntimeCompany?.coverUrl ||
            matchedRuntimeCompany?.coverImage ||
            profile?.companyCoverUrl ||
            '',
        ).trim() || null,
      openings: 0,
      status: normalizeCompanyPersistedStatus(
        matchedRuntimeCompany?.status || profile?.status || profile?.companyStatus || 'approved',
        'approved',
      ),
      verified: matchedRuntimeCompany?.verified ?? false,
      deletedBy: 'company',
      deletionReason,
      deletedStatusSnapshot: normalizeCompanyPersistedStatus(
        matchedRuntimeCompany?.deletedStatusSnapshot || matchedRuntimeCompany?.status || profile?.status || profile?.companyStatus || 'approved',
        'approved',
      ),
      deletedAt: now,
      createdAt: normalizeFirebaseTimestamp(matchedRuntimeCompany?.createdAt) || now,
      updatedAt: now,
    };

    if (hasFirebaseSiteConfig()) {
      const synced = await withAsyncTimeout(
        syncCompanyStateToFirebase(baseCompany, companyJobs, activeSession),
        14000,
        'انتهت مهلة مزامنة طلب الحذف مع الخادم.',
      );
      if (!synced) {
        return false;
      }

      const services = await withAsyncTimeout(
        getFirebaseSiteServices(),
        10000,
        'انتهت مهلة الاتصال بخدمة Firebase.',
      );
      if (services) {
        try {
          const { db, firestoreModule } = services;
          const companySnapshots = [];
          const jobSnapshots = [];

          if (companyId) {
            const companyDoc = await firestoreModule.getDoc(firestoreModule.doc(db, 'companies', companyId));
            if (companyDoc.exists()) {
              companySnapshots.push(companyDoc);
            }
            jobSnapshots.push(
              await firestoreModule.getDocs(
                firestoreModule.query(
                  firestoreModule.collection(db, 'jobs'),
                  firestoreModule.where('companyId', '==', companyId),
                ),
              ),
            );
          }

          if (companyEmail) {
            companySnapshots.push(
              ...(await firestoreModule.getDocs(
                firestoreModule.query(
                  firestoreModule.collection(db, 'companies'),
                  firestoreModule.where('email', '==', String(profile?.email || activeSession?.email || '').trim()),
                ),
              )).docs,
            );
          }

          if (companyName) {
            companySnapshots.push(
              ...(await firestoreModule.getDocs(
                firestoreModule.query(
                  firestoreModule.collection(db, 'companies'),
                  firestoreModule.where('name', '==', companyName),
                ),
              )).docs,
            );
            jobSnapshots.push(
              await firestoreModule.getDocs(
                firestoreModule.query(
                  firestoreModule.collection(db, 'jobs'),
                  firestoreModule.where('companyName', '==', companyName),
                ),
              ),
            );
          }

          const batch = firestoreModule.writeBatch(db);
          const seenCompanyPaths = new Set();
          const seenJobPaths = new Set();

          companySnapshots.forEach((docSnapshot) => {
            const reference = docSnapshot.ref || docSnapshot;
            if (!reference?.path || seenCompanyPaths.has(reference.path)) return;
            seenCompanyPaths.add(reference.path);
            const data = typeof docSnapshot.data === 'function' ? docSnapshot.data() || {} : {};
            batch.set(
              reference,
              {
                deletedAt: now,
                deletedBy: 'company',
                deletionReason,
                deletedStatusSnapshot:
                  String(data.deletedStatusSnapshot || data.status || baseCompany.deletedStatusSnapshot || 'approved').trim() ||
                  'approved',
                updatedAt: now,
              },
              { merge: true },
            );
          });

          jobSnapshots.forEach((snapshot) => {
            const docs = Array.isArray(snapshot?.docs) ? snapshot.docs : [];
            docs.forEach((docSnapshot) => {
              if (!docSnapshot?.ref?.path || seenJobPaths.has(docSnapshot.ref.path)) return;
              seenJobPaths.add(docSnapshot.ref.path);
              const data = docSnapshot.data() || {};
              batch.set(
                docSnapshot.ref,
                {
                  deletedAt: now,
                  deletedBy: 'company',
                  deletedStatusSnapshot:
                    String(data.deletedStatusSnapshot || data.status || 'approved').trim() || 'approved',
                  restoredByAdminAt: null,
                  updatedAt: now,
                },
                { merge: true },
              );
            });
          });

          if (seenCompanyPaths.size || seenJobPaths.size) {
            await withAsyncTimeout(
              batch.commit(),
              12000,
              'انتهت مهلة حفظ طلب الحذف في السجلات المرتبطة.',
            );
          }
        } catch (error) {
          console.warn('Unable to persist company deletion request across Firebase records', error);
          return false;
        }
      }
    }

    const currentRuntime = sanitizeAdminRuntime(safeReadJSON(ADMIN_RUNTIME_KEY, {})).runtime;
    const runtimeCompaniesMarked = Array.isArray(currentRuntime?.companies)
      ? currentRuntime.companies.map((company) => (matchesCompany(company) ? { ...company, ...baseCompany } : company))
      : [];
    const runtimeJobsMarked = Array.isArray(currentRuntime?.jobs)
      ? currentRuntime.jobs.map((job) =>
          matchesJob(job)
            ? {
                ...job,
                deletedAt: now,
                deletedBy: 'company',
                deletedStatusSnapshot: String(job?.deletedStatusSnapshot || job?.status || 'approved').trim() || 'approved',
                restoredByAdminAt: null,
                updatedAt: now,
              }
            : job,
        )
      : [];
    const nextRuntime = {
      ...currentRuntime,
      companies: mergeRuntimeCollections(runtimeCompaniesMarked, [baseCompany], getRuntimeCompanyKey),
      jobs: mergeRuntimeCollections(runtimeJobsMarked, companyJobs, getRuntimeJobKey),
    };
    saveJSON(ADMIN_RUNTIME_KEY, nextRuntime);
    void syncSharedAdminRuntimeFile(nextRuntime);

    const adminState = safeReadJSON(ADMIN_STATE_KEY, null);
    if (adminState && Array.isArray(adminState?.companies) && Array.isArray(adminState?.jobs)) {
      const nextAdminCompany = {
        ...(adminState.companies.find((company) => matchesCompany(company)) || {}),
        ...baseCompany,
      };
      const adminJobsMarked = adminState.jobs.map((job) =>
        matchesJob(job)
          ? {
              ...job,
              deletedAt: now,
              deletedBy: 'company',
              deletedStatusSnapshot: String(job?.deletedStatusSnapshot || job?.status || 'approved').trim() || 'approved',
              restoredByAdminAt: null,
              updatedAt: now,
            }
          : job,
      );
      const nextAuditLogs = Array.isArray(adminState?.auditLogs)
        ? [
            {
              id: createLocalEntityId('audit'),
              actorName: companyName || 'الشركة',
              action: 'طلب حذف شركة',
              entityType: 'companies',
              entityLabel: String(baseCompany.id || companyName || '').trim(),
              details: `أرسلت الشركة طلب حذف الحساب. السبب: ${deletionReason}`,
              createdAt: now,
              severity: 'warning',
            },
            ...adminState.auditLogs,
          ]
        : adminState?.auditLogs;

      saveJSON(ADMIN_STATE_KEY, {
        ...adminState,
        companies: mergeRuntimeCollections(adminState.companies, [nextAdminCompany], getRuntimeCompanyKey),
        jobs: mergeRuntimeCollections(adminJobsMarked, companyJobs, getRuntimeJobKey),
        auditLogs: nextAuditLogs,
      });
    }

    firebaseApplicationsCacheHydrated = false;
    window.localStorage.removeItem(STORAGE_KEYS.applicationProfile);
    window.sessionStorage.removeItem(STORAGE_KEYS.applicationProfile);
    clearSocialDraft();
    await signOutCompanySession();
    return true;
  };

  const migrateLegacyCompanyDraftJobs = (profile = {}, session = null) => {
    return profile;
  };

  const syncCompanyPublishingState = (profile = {}, session = null) => {
    if (normalize(profile?.role) !== 'company') return;

    const companyIdentity = getCompanyIdentity(profile, session);
    const runtime = getAdminRuntime();
    const runtimeCompanies = Array.isArray(runtime?.companies) ? [...runtime.companies] : [];
    const runtimeJobs = Array.isArray(runtime?.jobs) ? [...runtime.jobs] : [];
    const existingRuntimeCompany =
      runtimeCompanies.find((company) => normalize(company?.name) === normalize(companyIdentity.name)) || {};
    const companyName = String(companyIdentity.name || existingRuntimeCompany?.name || '').trim();
    if (!companyName) return;

    const companyJobs = getCompanyStoredJobs(profile, session);
    const companyLogoUrl = String(
      companyIdentity.logoUrl || existingRuntimeCompany?.logoUrl || existingRuntimeCompany?.imageUrl || '',
    ).trim();
    const companyCoverUrl = String(
      companyIdentity.coverUrl || existingRuntimeCompany?.coverImage || existingRuntimeCompany?.coverUrl || '',
    ).trim();
    const companyImageUrl = companyLogoUrl || companyCoverUrl || existingRuntimeCompany?.imageUrl || null;
    const resolvedCompanyId =
      String(existingRuntimeCompany?.id || '').trim() ||
      String(profile?.companyId || session?.companyId || '').trim() ||
      `company-${normalize(companyName).replace(/[^a-z0-9]/g, '-') || 'custom'}`;
    const resolvedCompanyStatus = normalizeCompanyPersistedStatus(
      companyIdentity.status || existingRuntimeCompany?.status || profile?.status || profile?.companyStatus,
      existingRuntimeCompany?.status || profile?.status || profile?.companyStatus || 'pending',
    );

    const nextCompany = {
      ...existingRuntimeCompany,
      id: resolvedCompanyId,
      name: companyName,
      sector: String(companyIdentity.sector || existingRuntimeCompany?.sector || '').trim(),
      location: String(companyIdentity.city || existingRuntimeCompany?.location || '').trim(),
      phone: String(companyIdentity.phone || existingRuntimeCompany?.phone || profile?.phone || '').trim(),
      landline: String(
        companyIdentity.landline || existingRuntimeCompany?.landline || profile?.companyLandline || '',
      ).trim(),
      website: String(companyIdentity.website || existingRuntimeCompany?.website || '').trim(),
      socialLinks: normalizeCompanySocialLinks(companyIdentity.socialLinks || existingRuntimeCompany?.socialLinks),
      openings: companyJobs.filter(
        (job) => !job?.deletedAt && !['archived', 'hidden', 'rejected'].includes(normalize(job?.status)),
      ).length,
      summary: String(
        companyIdentity.description ||
          existingRuntimeCompany?.summary ||
          profile?.companyProfile?.companyDescription ||
          profile?.companyProfile?.description ||
          profile?.companyDescription ||
          profile?.description ||
          profile?.headline ||
          '',
      ).trim(),
      logoLetter: String(existingRuntimeCompany?.logoLetter || getCompanyLogoLetter(companyName)).trim(),
      imageUrl: companyImageUrl,
      logoUrl: companyLogoUrl || null,
      coverImage: companyCoverUrl || null,
      description: String(companyIdentity.description || existingRuntimeCompany?.description || '').trim(),
      status: resolvedCompanyStatus,
      siteMode: String(companyIdentity.siteMode || existingRuntimeCompany?.siteMode || 'full').trim() === 'landing' ? 'landing' : 'full',
      restrictionMessage: String(
        companyIdentity.restrictionMessage || existingRuntimeCompany?.restrictionMessage || '',
      ).trim(),
      restrictionAttachmentUrl: String(
        companyIdentity.restrictionAttachmentUrl || existingRuntimeCompany?.restrictionAttachmentUrl || '',
      ).trim() || null,
      restrictionAttachmentName: String(
        companyIdentity.restrictionAttachmentName || existingRuntimeCompany?.restrictionAttachmentName || '',
      ).trim(),
      verified: existingRuntimeCompany?.verified ?? false,
      deletedBy: null,
      deletionReason: '',
      deletedStatusSnapshot: null,
      deletedAt: null,
    };

    const nextRuntimeJobs = [...runtimeJobs];
    companyJobs.forEach((job) => {
      const existingIndex = nextRuntimeJobs.findIndex(
        (existingJob) =>
          String(existingJob?.id || '').trim() === String(job.id).trim() ||
          (normalize(existingJob?.title) === normalize(job.title) &&
            normalize(existingJob?.companyName) === normalize(companyName) &&
            normalize(existingJob?.location) === normalize(job.location)),
      );

      const existingJob = existingIndex >= 0 ? nextRuntimeJobs[existingIndex] : null;
      const adminRestoredJob =
        existingJob &&
        !existingJob?.deletedAt &&
        normalizeFirebaseTimestamp(existingJob?.restoredByAdminAt || existingJob?.updatedAt || '') &&
        job?.deletedAt;
      const mergedJob = {
        ...existingJob,
        ...job,
        companyName,
        sector: job.sector || nextCompany.sector,
        status: String(job.status || existingJob?.status || 'approved').trim(),
        featured: job.featured ?? existingJob?.featured ?? false,
        deletedBy: adminRestoredJob ? null : job?.deletedBy || existingJob?.deletedBy || null,
        deletedStatusSnapshot:
          adminRestoredJob ? null : job?.deletedStatusSnapshot || existingJob?.deletedStatusSnapshot || null,
        restoredByAdminAt:
          normalizeFirebaseTimestamp(job?.restoredByAdminAt || '') ||
          normalizeFirebaseTimestamp(existingJob?.restoredByAdminAt || '') ||
          null,
        deletedAt: adminRestoredJob ? null : job?.deletedAt || existingJob?.deletedAt || null,
      };

      if (existingIndex >= 0) {
        nextRuntimeJobs[existingIndex] = mergedJob;
      } else {
        nextRuntimeJobs.unshift(mergedJob);
      }
    });

    const nextRuntime = {
      ...runtime,
      companies: [
        nextCompany,
        ...runtimeCompanies.filter((company) => normalize(company?.name) !== normalize(companyName)),
      ],
      jobs: nextRuntimeJobs,
    };
    saveJSON(ADMIN_RUNTIME_KEY, nextRuntime);
    void syncSharedAdminRuntimeFile(nextRuntime);
    void syncCompanyStateToFirebase(nextCompany, companyJobs, session);

    const adminState = safeReadJSON(ADMIN_STATE_KEY, null);
    if (!adminState || !Array.isArray(adminState?.companies) || !Array.isArray(adminState?.jobs)) return;

    const adminCompanies = [...adminState.companies];
    const adminJobs = [...adminState.jobs];
    const existingAdminCompany =
      adminCompanies.find((company) => normalize(company?.name) === normalize(companyName)) || {};

    const nextAdminCompany = {
      ...existingAdminCompany,
      id: String(existingAdminCompany?.id || nextCompany.id).trim(),
      name: companyName,
      sector: nextCompany.sector,
      location: nextCompany.location,
      phone: nextCompany.phone,
      landline: nextCompany.landline,
      website: nextCompany.website,
      socialLinks: normalizeCompanySocialLinks(nextCompany.socialLinks),
      openings: nextCompany.openings,
      summary: nextCompany.summary,
      logoLetter: nextCompany.logoLetter,
      imageUrl: nextCompany.imageUrl || null,
      logoUrl: nextCompany.logoUrl || null,
      coverImage: nextCompany.coverImage || null,
      description: nextCompany.description || '',
      status: String(existingAdminCompany?.status || nextCompany.status || 'approved').trim(),
      siteMode: String(nextCompany.siteMode || existingAdminCompany?.siteMode || 'full').trim() === 'landing' ? 'landing' : 'full',
      restrictionMessage: String(nextCompany.restrictionMessage || existingAdminCompany?.restrictionMessage || '').trim(),
      restrictionAttachmentUrl:
        String(nextCompany.restrictionAttachmentUrl || existingAdminCompany?.restrictionAttachmentUrl || '').trim() || null,
      restrictionAttachmentName: String(
        nextCompany.restrictionAttachmentName || existingAdminCompany?.restrictionAttachmentName || '',
      ).trim(),
      verified: existingAdminCompany?.verified ?? true,
      notes: Array.isArray(existingAdminCompany?.notes) ? existingAdminCompany.notes : [],
      deletedBy: null,
      deletionReason: '',
      deletedStatusSnapshot: null,
      deletedAt: null,
    };

    const nextAdminJobs = [...adminJobs];
    companyJobs.forEach((job) => {
      const existingIndex = nextAdminJobs.findIndex(
        (existingJob) =>
          String(existingJob?.id || '').trim() === String(job.id).trim() ||
          (normalize(existingJob?.title) === normalize(job.title) &&
            normalize(existingJob?.companyName) === normalize(companyName) &&
            normalize(existingJob?.location) === normalize(job.location)),
      );

      const existingJob = existingIndex >= 0 ? nextAdminJobs[existingIndex] : null;
      const adminRestoredJob =
        existingJob &&
        !existingJob?.deletedAt &&
        normalizeFirebaseTimestamp(existingJob?.restoredByAdminAt || existingJob?.updatedAt || '') &&
        job.deletedAt;
      const mergedJob = {
        ...existingJob,
        id: String(existingJob?.id || job.id).trim(),
        title: job.title,
        companyName,
        location: job.location,
        type: job.type,
        postedLabel: job.postedLabel,
        salary: job.salary,
        summary: job.summary,
        sector: job.sector || nextAdminCompany.sector,
        featured: job.featured ?? existingJob?.featured ?? false,
        status: String(job.status || existingJob?.status || 'approved').trim(),
        applicantsCount: Number(existingJob?.applicantsCount || 0),
        notes: Array.isArray(existingJob?.notes) ? existingJob.notes : [],
        deletedBy: adminRestoredJob ? null : job?.deletedBy || existingJob?.deletedBy || null,
        deletedStatusSnapshot:
          adminRestoredJob ? null : job?.deletedStatusSnapshot || existingJob?.deletedStatusSnapshot || null,
        restoredByAdminAt:
          normalizeFirebaseTimestamp(job?.restoredByAdminAt || '') ||
          normalizeFirebaseTimestamp(existingJob?.restoredByAdminAt || '') ||
          null,
        deletedAt: adminRestoredJob ? null : job?.deletedAt || existingJob?.deletedAt || null,
      };

      if (existingIndex >= 0) {
        nextAdminJobs[existingIndex] = mergedJob;
      } else {
        nextAdminJobs.unshift(mergedJob);
      }
    });

  saveJSON(ADMIN_STATE_KEY, {
      ...adminState,
      companies: [
        nextAdminCompany,
        ...adminCompanies.filter((company) => normalize(company?.name) !== normalize(companyName)),
      ],
      jobs: nextAdminJobs,
    });
  };

  const bootstrapCompanyRuntimeFromProfile = () => {
    if (CURRENT_SITE_PAGE !== 'company-dashboard.html') return;
    const profile = getStoredProfile();
    const session = getSession();
    if (normalize(profile?.role) !== 'company') return;
    syncCompanyPublishingState(profile, session);
  };

  const renderCompanyDashboard = async () => {
    if (!window.location.pathname.endsWith('company-dashboard.html')) return;

    const loadingShell = document.querySelector('[data-company-dashboard-loading]');
    const loadingTitle = document.querySelector('[data-company-dashboard-loading-title]');
    const loadingMessage = document.querySelector('[data-company-dashboard-loading-message]');
    const dashboardBody = document.body;
    const setDashboardLoading = (isLoading, message = 'نحمّل بيانات الوظائف والطلبات وملف الشركة الآن.') => {
      if (!(loadingShell instanceof HTMLElement)) return;
      if (loadingTitle instanceof HTMLElement) {
        loadingTitle.textContent = 'جارٍ تجهيز لوحة الشركة';
      }
      if (loadingMessage instanceof HTMLElement) {
        loadingMessage.textContent = message;
      }
      loadingShell.classList.toggle('is-hidden', !isLoading);
      loadingShell.setAttribute('aria-hidden', isLoading ? 'false' : 'true');
    };
    const setDashboardSidebarOpen = (isOpen) => {
      if (!(dashboardBody instanceof HTMLElement)) return;
      if (isOpen) {
        dashboardBody.dataset.dashboardSidebarOpen = 'true';
      } else {
        delete dashboardBody.dataset.dashboardSidebarOpen;
      }
    };
    const bindCompanyDashboardChrome = () => {
      const openers = document.querySelectorAll('[data-company-sidebar-toggle]');
      const closers = document.querySelectorAll('[data-company-sidebar-close], .dashboard-nav__link, .dashboard-logout-link');

      openers.forEach((button) => {
        if (!(button instanceof HTMLElement) || button.dataset.boundCompanySidebarOpen === 'true') return;
        button.dataset.boundCompanySidebarOpen = 'true';
        button.addEventListener('click', () => setDashboardSidebarOpen(true));
      });

      closers.forEach((button) => {
        if (!(button instanceof HTMLElement) || button.dataset.boundCompanySidebarClose === 'true') return;
        button.dataset.boundCompanySidebarClose = 'true';
        button.addEventListener('click', () => setDashboardSidebarOpen(false));
      });

      if (dashboardBody instanceof HTMLElement && dashboardBody.dataset.boundCompanySidebarResize !== 'true') {
        dashboardBody.dataset.boundCompanySidebarResize = 'true';
        window.addEventListener('resize', () => {
          if (window.innerWidth > 1120) {
            setDashboardSidebarOpen(false);
          }
        });
      }
    };
    const setDashboardButtonPending = (button, isPending, pendingLabel = 'جارٍ التنفيذ...') => {
      if (!(button instanceof HTMLElement)) return;
      if (isPending) {
        button.dataset.originalHtml = button.innerHTML;
        button.classList.add('is-loading');
        button.setAttribute('aria-busy', 'true');
        if ('disabled' in button) {
          button.disabled = true;
        }
        button.innerHTML = `<span class="dashboard-inline-spinner" aria-hidden="true"></span><span>${escapeHtml(pendingLabel)}</span>`;
        return;
      }

      button.classList.remove('is-loading');
      button.removeAttribute('aria-busy');
      if ('disabled' in button) {
        button.disabled = false;
      }
      if (button.dataset.originalHtml) {
        button.innerHTML = button.dataset.originalHtml;
        delete button.dataset.originalHtml;
      }
    };

    bindCompanyDashboardChrome();
    setDashboardLoading(true);

    try {
      const session = getSession();
      if (!session?.loggedIn || normalize(session?.role) !== 'company') {
        window.location.href = buildLoginUrl('company-dashboard.html');
        return;
      }

      const companySessionProvider = normalize(session?.provider || '');
      if (companySessionProvider !== 'supabase') {
        const firebaseAuthState = await waitForFirebaseAuthUser();
        if (
          firebaseAuthState.supported &&
          (!firebaseAuthState.user || (session?.uid && firebaseAuthState.user.uid !== session.uid))
        ) {
          await signOutCompanySession();
          window.location.href = buildLoginUrl('company-dashboard.html');
          return;
        }
      }

      const profile = migrateLegacyCompanyDraftJobs(getStoredProfile(), session);
      syncCompanyPublishingState(profile, session);
      const activeSession = refreshCompanySession(profile, session);
      await hydrateCompanyApplicationsCacheFromFirebase(activeSession);

    const companyIdentity = getCompanyIdentity(profile, activeSession);
    const companyName = companyIdentity.name || getAccountDisplayName(profile, activeSession, '\u0634\u0631\u0643\u062a\u0643');
    const companyEmail = normalize(profile?.email || activeSession?.email);
    const existingRuntimeCompany =
      findRuntimeCompanyRecord({
        companyId: profile?.companyId || activeSession?.companyId || '',
        companyName,
        name: companyName,
      }) || {};
    if (existingRuntimeCompany?.deletedAt && normalize(existingRuntimeCompany?.deletedBy) === 'company') {
      await signOutCompanySession();
      window.location.href = buildLoginUrl('company-dashboard.html');
      return;
    }
    const runtimeCompanyId = normalize(
      existingRuntimeCompany?.id || existingRuntimeCompany?.companyId || profile?.companyId || activeSession?.companyId || '',
    );
    const resolvedCompanyStatus = normalizeCompanyPersistedStatus(
      existingRuntimeCompany?.status || profile?.status || profile?.companyStatus,
      existingRuntimeCompany?.status || profile?.status || profile?.companyStatus || 'pending',
    );
    const companyApplications = getStoredApplications().filter((application) => {
      const matchesCompany = normalize(application?.job?.jobCompany) === normalize(companyName);
      const matchesEmail = companyEmail && normalize(application?.company?.email) === companyEmail;
      const matchesCompanyId =
        runtimeCompanyId &&
        normalize(application?.company?.id || application?.companyId || application?.job?.companyId || '') ===
          runtimeCompanyId;
      return matchesCompany || matchesEmail || matchesCompanyId;
    }).sort((firstApplication, secondApplication) => {
      const firstTime = new Date(firstApplication?.submittedAt || 0).getTime();
      const secondTime = new Date(secondApplication?.submittedAt || 0).getTime();
      return secondTime - firstTime;
    });
    const pendingCount = companyApplications.filter((application) => normalizeApplicationStatus(application?.status) === 'review').length;
    const interviewCount = companyApplications.filter((application) => normalizeApplicationStatus(application?.status) === 'interview').length;
    const runtimeJobs = getAdminRuntimeJobs()
      .filter((job) => {
        const matchesCompanyName = normalize(job?.companyName || job?.jobCompany) === normalize(companyName);
        const matchesCompanyId = runtimeCompanyId && normalize(job?.companyId || '') === runtimeCompanyId;
        return matchesCompanyName || matchesCompanyId;
      })
      .sort((firstJob, secondJob) => {
        const firstTime = new Date(firstJob?.postedAt || firstJob?.createdAt || 0).getTime();
        const secondTime = new Date(secondJob?.postedAt || secondJob?.createdAt || 0).getTime();
        return secondTime - firstTime;
      });
    const profileJobs = getCompanyStoredJobs(profile, session);
    const mergeCompanyJobsForDashboard = (remoteJobs = [], localJobs = []) => {
      const mergedJobs = new Map();

      localJobs.forEach((job) => {
        const key = getRuntimeJobKey(job);
        if (!key) return;
        mergedJobs.set(key, { ...job });
      });

      remoteJobs.forEach((job) => {
        const key = getRuntimeJobKey(job);
        if (!key) return;

        const existingJob = mergedJobs.get(key) || {};
        const adminRestoredJob =
          !job?.deletedAt &&
          normalizeFirebaseTimestamp(job?.restoredByAdminAt || job?.updatedAt || '') &&
          existingJob?.deletedAt;

        mergedJobs.set(key, {
          ...existingJob,
          ...job,
          deletedAt: adminRestoredJob ? null : job?.deletedAt || existingJob?.deletedAt || null,
          deletedBy: adminRestoredJob ? null : job?.deletedBy || existingJob?.deletedBy || null,
          deletedStatusSnapshot: adminRestoredJob
            ? null
            : job?.deletedStatusSnapshot || existingJob?.deletedStatusSnapshot || null,
          restoredByAdminAt:
            normalizeFirebaseTimestamp(job?.restoredByAdminAt || '') ||
            normalizeFirebaseTimestamp(existingJob?.restoredByAdminAt || '') ||
            null,
        });
      });

      return Array.from(mergedJobs.values());
    };

    const jobs = mergeCompanyJobsForDashboard(runtimeJobs, profileJobs).sort((firstJob, secondJob) => {
      const firstTime = new Date(firstJob?.postedAt || firstJob?.createdAt || 0).getTime();
      const secondTime = new Date(secondJob?.postedAt || secondJob?.createdAt || 0).getTime();
      return secondTime - firstTime;
    });
    const activeCompanyJobs = jobs.filter((job) => !job?.deletedAt);
    const publishedJobsCount = activeCompanyJobs.filter(
      (job) => !job?.deletedAt && !['archived', 'hidden', 'rejected'].includes(normalize(job?.status)),
    ).length;

    setTextContent('[data-company-dashboard-name]', companyName);
    setTextContent('[data-company-dashboard-greeting]', `\u0645\u0631\u062d\u0628\u0627\u064b \u0628\u0643 \u0645\u062c\u062f\u062f\u0627\u064b\u060c ${companyName}`);
    setTextContent('[data-company-stat="jobs"]', String(publishedJobsCount));
    setTextContent('[data-company-stat="applications"]', String(companyApplications.length));
    setTextContent('[data-company-stat="pending"]', String(pendingCount));
    setTextContent('[data-company-stat="interviews"]', String(interviewCount));
    setTextContent(
      '[data-company-applicants-summary]',
      companyApplications.length
        ? `إجمالي ${companyApplications.length} طلب، منها ${pendingCount} تحت المراجعة و${interviewCount} في مرحلة المقابلة.`
        : 'راجع كل الطلبات وحدد حالتها مباشرة من هنا.',
    );

    const setImageSource = (selector, value, fallback = COMPANY_PLACEHOLDER_IMAGE, alt = '') => {
      const element = document.querySelector(selector);
      if (!(element instanceof HTMLImageElement)) return null;
      element.src = resolvePublicAssetUrl(value, fallback);
      if (alt) {
        element.alt = alt;
      }
      return element;
    };

    const applyDashboardFeedback = (selector, message, tone = 'info') => {
      const box = document.querySelector(selector);
      if (!(box instanceof HTMLElement) || !message) return;
      box.className = 'application-status';
      box.classList.add(`application-status--${tone}`);
      box.textContent = message;
      box.classList.remove('hidden');
      box.removeAttribute('hidden');
    };

    const rerenderCompanyDashboardWithFeedback = (selector, message, tone = 'info') => {
      saveCompanyDashboardFeedback({ selector, message, tone });
      void renderCompanyDashboard().then(() => {
        applyDashboardFeedback(selector, message, tone);
      });
    };

    const companyLogoImage = resolvePublicCompanyImage(profile);
    const companyCoverImage = resolvePublicCompanyCoverImage(profile);
    const companyWebsiteUrl = normalizeWebsiteUrl(companyIdentity.website || profile?.companyWebsite || profile?.website || '');
    const companyLandline = String(
      companyIdentity.landline || profile?.companyLandline || profile?.companyProfile?.landline || '',
    ).trim();
    const companySocialLinks = normalizeCompanySocialLinks(
      companyIdentity.socialLinks || profile?.socialLinks || profile?.companyProfile?.socialLinks,
    );
    const companyRestrictionMessage = String(
      companyIdentity.restrictionMessage || profile?.restrictionMessage || profile?.companyProfile?.restrictionMessage || '',
    ).trim();
    const companyRestrictionAttachmentUrl = String(
      companyIdentity.restrictionAttachmentUrl ||
        profile?.restrictionAttachmentUrl ||
        profile?.companyProfile?.restrictionAttachmentUrl ||
        '',
    ).trim();
    const companyRestrictionAttachmentName = String(
      companyIdentity.restrictionAttachmentName ||
        profile?.restrictionAttachmentName ||
        profile?.companyProfile?.restrictionAttachmentName ||
        '',
    ).trim();
    const companyDescriptionText =
      companyIdentity.description || profile?.companyDescription || profile?.description || '';
    setImageSource('[data-company-dashboard-avatar-img]', companyLogoImage, COMPANY_PLACEHOLDER_IMAGE, `${companyName} logo`);
    setImageSource('[data-company-profile-logo-preview]', companyLogoImage, COMPANY_PLACEHOLDER_IMAGE, `${companyName} logo`);
    setImageSource('[data-company-profile-cover-preview]', companyCoverImage, COMPANY_PLACEHOLDER_IMAGE, `${companyName} cover`);
    setTextContent('[data-company-profile-name]', companyName);
    setTextContent('[data-company-profile-sector]', companyIdentity.sector || 'غير محدد');
    setTextContent('[data-company-profile-city]', companyIdentity.city || 'غير محددة');
    setTextContent('[data-company-profile-phone]', companyIdentity.phone || 'غير محدد');
    setTextContent('[data-company-profile-description]', companyDescriptionText || 'أضف نبذة واضحة تعرّف بالشركة وتوضح طبيعة عملها.');
    const landlineRow = document.querySelector('[data-company-profile-landline-row]');
    if (landlineRow instanceof HTMLElement) {
      landlineRow.hidden = !companyLandline;
    }
    setTextContent('[data-company-profile-landline]', companyLandline || 'غير محدد');

    const toggleSocialLinks = (selectorPrefix, links) => {
      const container = document.querySelector(selectorPrefix);
      if (!(container instanceof HTMLElement)) return;
      const anchors = Array.from(container.querySelectorAll('[data-company-profile-social], [data-company-preview-social], [data-company-social-link]'));
      let visibleCount = 0;
      anchors.forEach((anchor) => {
        if (!(anchor instanceof HTMLAnchorElement)) return;
        const network = anchor.dataset.companyProfileSocial || anchor.dataset.companyPreviewSocial || anchor.dataset.companySocialLink || '';
        const href = normalizeWebsiteUrl(links?.[network] || '');
        anchor.hidden = !href;
        if (href) {
          anchor.href = href;
          visibleCount += 1;
        } else {
          anchor.removeAttribute('href');
        }
      });
      container.hidden = visibleCount === 0;
    };

    const websiteLink = document.querySelector('[data-company-profile-website]');
    if (websiteLink instanceof HTMLAnchorElement) {
      if (companyWebsiteUrl) {
        websiteLink.href = companyWebsiteUrl;
        websiteLink.target = '_blank';
        websiteLink.rel = 'noopener noreferrer';
        websiteLink.textContent = companyWebsiteUrl;
      } else {
        websiteLink.removeAttribute('href');
        websiteLink.removeAttribute('target');
        websiteLink.removeAttribute('rel');
        websiteLink.textContent = 'أضف الموقع الإلكتروني';
      }
    }
    toggleSocialLinks('[data-company-profile-socials]', companySocialLinks);

    const visibilityNote = document.querySelector('[data-company-visibility-note]');
    if (visibilityNote instanceof HTMLElement) {
      const isRestricted = normalize(existingRuntimeCompany?.status || profile?.accountStatus) === 'restricted';
      visibilityNote.className = 'application-status';
      if (isRestricted) {
        visibilityNote.classList.add('application-status--info');
        visibilityNote.innerHTML = '';
        const text = document.createElement('span');
        text.textContent = companyRestrictionMessage || 'الموقع محجوب حاليًا عن الزوار من جهة الإدارة.';
        visibilityNote.appendChild(text);
        if (companyRestrictionAttachmentUrl) {
          const attachmentLink = document.createElement('a');
          attachmentLink.href = companyRestrictionAttachmentUrl;
          attachmentLink.target = '_blank';
          attachmentLink.rel = 'noopener noreferrer';
          attachmentLink.className = 'site-action site-action--ghost';
          attachmentLink.textContent = companyRestrictionAttachmentName || 'فتح الملف المرفق';
          visibilityNote.appendChild(attachmentLink);
        }
      } else {
        visibilityNote.classList.add('hidden');
      }
    }

    const jobComposerSection = document.querySelector('#company-job-composer');
    const jobComposerForm = document.querySelector('[data-company-job-form="true"]');
    const jobComposerTitle = document.querySelector('[data-company-job-panel-title]');
    const jobComposerShortcut = document.querySelector('[data-company-job-submit-shortcut]');
    const jobComposerPrimarySubmit = document.querySelector('[data-company-job-submit-label]');
    const jobComposerReset = document.querySelector('[data-company-job-reset]');
    const setCompanyJobComposerState = (job = null, draftOverride = null) => {
      if (!(jobComposerForm instanceof HTMLFormElement)) return;

      const draftSource = buildCompanyJobDraftFromJob(
        job || draftOverride || profile?.companyJobDraft || profile?.companyProfile?.draft || {},
      );
      const editingJobId = String(job?.id || '').trim();
      const titleField = jobComposerForm.querySelector('[name="job_title"]');
      const cityField = jobComposerForm.querySelector('[name="job_city"]');
      const typeField = jobComposerForm.querySelector('[name="job_type"]');
      const salaryField = jobComposerForm.querySelector('[name="job_salary"]');
      const positionsField = jobComposerForm.querySelector('[name="job_positions"]');
      const featuredField = jobComposerForm.querySelector('[name="job_featured"]');
      const descriptionField = jobComposerForm.querySelector('[name="job_description"]');
      const jobIdField = jobComposerForm.querySelector('[name="job_id"]');

      if (jobIdField instanceof HTMLInputElement) {
        jobIdField.value = editingJobId;
      }
      if (titleField instanceof HTMLInputElement) {
        titleField.value = draftSource.title || '';
      }
      if (cityField instanceof HTMLInputElement) {
        cityField.value = draftSource.city || draftSource.location || companyIdentity.city || '';
      }
      if (typeField instanceof HTMLSelectElement) {
        typeField.value = draftSource.type || 'دوام كامل';
      }
      if (salaryField instanceof HTMLInputElement) {
        salaryField.value = draftSource.salary || '';
      }
      if (positionsField instanceof HTMLInputElement) {
        positionsField.value = draftSource.positions || '1';
      }
      if (featuredField instanceof HTMLInputElement) {
        featuredField.checked = Boolean(draftSource.featured);
      }
      if (descriptionField instanceof HTMLTextAreaElement) {
        descriptionField.value = draftSource.description || '';
      }

      const isEditing = Boolean(editingJobId);
      const headingText = isEditing ? 'تعديل الوظيفة' : 'نشر وظيفة جديدة';
      const shortcutText = isEditing ? 'حفظ التعديلات' : 'نشر الوظيفة';
      const submitText = isEditing ? 'حفظ التعديلات' : 'نشر الوظيفة الآن';

      if (jobComposerTitle instanceof HTMLElement) {
        jobComposerTitle.textContent = headingText;
      }
      if (jobComposerShortcut instanceof HTMLElement) {
        jobComposerShortcut.textContent = shortcutText;
      }
      if (jobComposerPrimarySubmit instanceof HTMLElement) {
        jobComposerPrimarySubmit.textContent = submitText;
      }
      if (jobComposerReset instanceof HTMLElement) {
        jobComposerReset.classList.toggle('hidden', !isEditing);
        jobComposerReset.toggleAttribute('hidden', !isEditing);
      }
      if (jobComposerSection instanceof HTMLElement) {
        if (isEditing) {
          jobComposerSection.innerHTML = `
            <div class="application-status application-status--info">
              يتم الآن تعديل الوظيفة: ${escapeHtml(job?.title || 'الوظيفة الحالية')}
            </div>`;
        } else {
          jobComposerSection.innerHTML = '';
        }
      }
    };

    const jobsBody = document.querySelector('[data-company-jobs-body]');
    if (jobsBody) {
      if (!activeCompanyJobs.length) {
        jobsBody.innerHTML = `
          <tr>
            <td class="px-6 py-8 text-center text-sm text-slate-500" colspan="5">لا توجد وظائف مرتبطة بحسابك بعد. أول وظيفة تنشرها ستظهر هنا.</td>
          </tr>`;
      } else {
        const getStatusBadgeMarkup = (status) => {
          const normalizedStatus = normalize(status);
          if (normalizedStatus === 'approved') {
            return `
              <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-green-100 text-green-700">
                <span class="w-1.5 h-1.5 rounded-full bg-green-500"></span>
                منشورة
              </span>`;
          }
          if (normalizedStatus === 'hidden') {
            return `
              <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-slate-200 text-slate-700">
                <span class="w-1.5 h-1.5 rounded-full bg-slate-500"></span>
                غير منشورة
              </span>`;
          }
          if (normalizedStatus === 'archived') {
            return `
              <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-violet-100 text-violet-700">
                <span class="w-1.5 h-1.5 rounded-full bg-violet-500"></span>
                مؤرشفة
              </span>`;
          }
          if (normalizedStatus === 'pending') {
            return `
              <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-700">
                <span class="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                قيد المراجعة
              </span>`;
          }
          return `
            <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-700">
              <span class="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
              ${escapeHtml(status || 'غير محددة')}
            </span>`;
        };

        const getLatestCompanyJobContext = () => {
          const latestProfile = migrateLegacyCompanyDraftJobs(getStoredProfile(), activeSession);
          const latestSession = refreshCompanySession(latestProfile, activeSession);
          const latestJobs = getCompanyStoredJobs(latestProfile, latestSession);
          return { latestProfile, latestSession, latestJobs };
        };
        const commitCompanyJobChanges = ({ latestProfile, latestSession, nextJobs, draftJob = null }) => {
          const nextProfile = persistCompanyJobsProfile(latestProfile, nextJobs, draftJob);
          const nextSession = refreshCompanySession(nextProfile, latestSession);
          syncCompanyPublishingState(nextProfile, nextSession);
          return { nextProfile, nextSession };
        };

        jobsBody.innerHTML = activeCompanyJobs.map((job) => {
          const applicantsCount = companyApplications.filter(
            (application) =>
              normalize(application?.job?.jobTitle) === normalize(job.title) &&
              normalize(application?.job?.jobCompany) === normalize(companyName),
          ).length;
          const featuredBadge = job.featured
            ? `
              <span class="request-chip request-chip--featured mt-2">
                <i class="fa-solid fa-star" aria-hidden="true"></i>
                وظيفة مميزة
              </span>`
            : '';
          const normalizedStatus = normalize(job?.status || 'approved');
          const publishLabel = normalizedStatus === 'approved' ? 'إلغاء النشر' : 'نشر';
          const archiveActionMarkup =
            normalizedStatus === 'archived'
              ? ''
              : `
                <button
                  type="button"
                  class="site-action site-action--ghost"
                  data-company-job-archive="${escapeHtml(String(job.id || ''))}"
                  data-company-job-title="${escapeHtml(job.title || '')}"
                >
                  أرشفة
                </button>`;

          return `
            <tr class="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
              <td class="px-6 py-4">
                <div class="font-bold text-slate-900 dark:text-white">${escapeHtml(job.title || 'بدون مسمى')}</div>
                <div class="text-xs text-slate-500">${escapeHtml(job.type || 'غير محدد')} | ${escapeHtml(job.location || 'غير محدد')}</div>
                ${featuredBadge}
              </td>
              <td class="px-6 py-4 text-sm text-slate-500">${escapeHtml(formatLocalDate(job.postedAt || job.createdAt) || '\u062d\u062f\u064a\u062b\u0627\u064b')}</td>
              <td class="px-6 py-4 text-sm font-bold">${applicantsCount}</td>
              <td class="px-6 py-4">${getStatusBadgeMarkup(job.status)}</td>
              <td class="px-6 py-4">
                <div class="flex flex-wrap gap-2">
                  <button
                    type="button"
                    class="site-action site-action--ghost"
                    data-company-job-edit="${escapeHtml(String(job.id || ''))}"
                  >
                    تعديل
                  </button>
                  <button
                    type="button"
                    class="site-action site-action--secondary"
                    data-company-job-publish="${escapeHtml(String(job.id || ''))}"
                    data-company-job-publish-state="${escapeHtml(normalizedStatus === 'approved' ? 'unpublish' : 'publish')}"
                    data-company-job-title="${escapeHtml(job.title || '')}"
                  >
                    ${escapeHtml(publishLabel)}
                  </button>
                  ${archiveActionMarkup}
                  <button
                    type="button"
                    class="site-action site-action--danger"
                    data-company-job-delete="${escapeHtml(String(job.id || ''))}"
                    data-company-job-title="${escapeHtml(job.title || '')}"
                  >
                    حذف
                  </button>
                </div>
              </td>
            </tr>`;
        }).join('');

        jobsBody.querySelectorAll('[data-company-job-edit]').forEach((node) => {
          if (!(node instanceof HTMLButtonElement) || node.dataset.boundCompanyEdit === 'true') return;

          node.dataset.boundCompanyEdit = 'true';
          node.addEventListener('click', () => {
            const targetJobId = String(node.dataset.companyJobEdit || '').trim();
            if (!targetJobId) return;

            const { latestJobs } = getLatestCompanyJobContext();
            const targetJob = latestJobs.find((job) => String(job?.id || '').trim() === targetJobId) || null;
            if (!targetJob) {
              rerenderCompanyDashboardWithFeedback('[data-company-job-feedback]', 'تعذر العثور على الوظيفة المطلوبة.', 'error');
              return;
            }

            setCompanyJobComposerState(targetJob);
            jobComposerSection?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            jobComposerForm?.querySelector('[name="job_title"]')?.focus();
          });
        });

        jobsBody.querySelectorAll('[data-company-job-publish]').forEach((node) => {
          if (!(node instanceof HTMLButtonElement) || node.dataset.boundCompanyPublish === 'true') return;

          node.dataset.boundCompanyPublish = 'true';
          node.addEventListener('click', () => {
            const targetJobId = String(node.dataset.companyJobPublish || '').trim();
            if (!targetJobId) return;

            const { latestProfile, latestSession, latestJobs } = getLatestCompanyJobContext();
            const targetJob = latestJobs.find((job) => String(job?.id || '').trim() === targetJobId) || null;
            if (!targetJob) {
              rerenderCompanyDashboardWithFeedback('[data-company-job-feedback]', 'تعذر العثور على الوظيفة المطلوبة.', 'error');
              return;
            }

            const shouldPublish = String(node.dataset.companyJobPublishState || 'publish').trim() !== 'unpublish';
            const jobTitle = String(targetJob.title || node.dataset.companyJobTitle || 'الوظيفة').trim();
            const pendingLabel = shouldPublish ? 'جارٍ نشر الوظيفة...' : 'جارٍ إلغاء النشر...';
            setDashboardButtonPending(node, true, pendingLabel);

            const now = new Date().toISOString();
            const nextJobs = latestJobs.map((job) =>
              String(job?.id || '').trim() === targetJobId
                ? {
                    ...job,
                    status: shouldPublish ? 'approved' : 'hidden',
                    deletedAt: null,
                    deletedBy: null,
                    deletedStatusSnapshot: null,
                    restoredByAdminAt: null,
                    postedLabel: shouldPublish ? 'الآن' : job.postedLabel || 'آخر تحديث',
                    updatedAt: now,
                  }
                : job,
            );

            commitCompanyJobChanges({ latestProfile, latestSession, nextJobs, draftJob: targetJob });
            const successMessage = shouldPublish ? `تم نشر الوظيفة: ${jobTitle}` : `تم إلغاء نشر الوظيفة: ${jobTitle}`;
            showToast(successMessage);
            setDashboardButtonPending(node, false);
            rerenderCompanyDashboardWithFeedback('[data-company-job-feedback]', successMessage, 'success');
          });
        });

        jobsBody.querySelectorAll('[data-company-job-archive]').forEach((node) => {
          if (!(node instanceof HTMLButtonElement) || node.dataset.boundCompanyArchive === 'true') return;

          node.dataset.boundCompanyArchive = 'true';
          node.addEventListener('click', () => {
            const targetJobId = String(node.dataset.companyJobArchive || '').trim();
            if (!targetJobId) return;

            const { latestProfile, latestSession, latestJobs } = getLatestCompanyJobContext();
            const targetJob = latestJobs.find((job) => String(job?.id || '').trim() === targetJobId) || null;
            if (!targetJob) {
              rerenderCompanyDashboardWithFeedback('[data-company-job-feedback]', 'تعذر العثور على الوظيفة المطلوبة.', 'error');
              return;
            }

            const jobTitle = String(targetJob.title || node.dataset.companyJobTitle || 'الوظيفة').trim();
            const confirmed = window.confirm(`هل تريد أرشفة وظيفة "${jobTitle}" وإخفاءها من الوظائف الحالية؟`);
            if (!confirmed) return;

            setDashboardButtonPending(node, true, 'جارٍ أرشفة الوظيفة...');
            const now = new Date().toISOString();
            const nextJobs = latestJobs.map((job) =>
              String(job?.id || '').trim() === targetJobId
                ? {
                    ...job,
                    status: 'archived',
                    deletedAt: null,
                    deletedBy: null,
                    deletedStatusSnapshot: null,
                    restoredByAdminAt: null,
                    updatedAt: now,
                  }
                : job,
            );

            commitCompanyJobChanges({ latestProfile, latestSession, nextJobs, draftJob: targetJob });
            const successMessage = `تمت أرشفة الوظيفة: ${jobTitle}`;
            showToast(successMessage);
            setDashboardButtonPending(node, false);
            rerenderCompanyDashboardWithFeedback('[data-company-job-feedback]', successMessage, 'success');
          });
        });

        jobsBody.querySelectorAll('[data-company-job-delete]').forEach((node) => {
          if (!(node instanceof HTMLButtonElement) || node.dataset.boundCompanyDelete === 'true') return;

          node.dataset.boundCompanyDelete = 'true';
          node.addEventListener('click', () => {
            const targetJobId = String(node.dataset.companyJobDelete || '').trim();
            if (!targetJobId) return;

            const { latestProfile, latestSession, latestJobs } = getLatestCompanyJobContext();
            const targetJob = latestJobs.find((job) => String(job?.id || '').trim() === targetJobId) || null;
            if (!targetJob) {
              rerenderCompanyDashboardWithFeedback('[data-company-job-feedback]', 'تعذر العثور على الوظيفة المطلوبة.', 'error');
              return;
            }

            const jobTitle = String(targetJob.title || node.dataset.companyJobTitle || 'الوظيفة').trim();
            const confirmed = window.confirm(`هل تريد حذف وظيفة "${jobTitle}" نهائيًا من لوحة الشركة؟`);
            if (!confirmed) return;

            setDashboardButtonPending(node, true, 'جارٍ حذف الوظيفة...');
            const now = new Date().toISOString();
            const nextJobs = latestJobs.map((job) =>
              String(job?.id || '').trim() === targetJobId
                ? {
                    ...job,
                    deletedAt: now,
                    deletedBy: 'company',
                    deletedStatusSnapshot: String(job?.status || 'pending').trim() || 'pending',
                    restoredByAdminAt: null,
                    updatedAt: now,
                  }
                : job,
            );

            commitCompanyJobChanges({ latestProfile, latestSession, nextJobs });
            const successMessage = `تم حذف الوظيفة من لوحة الشركة: ${jobTitle}`;
            showToast(successMessage);
            setDashboardButtonPending(node, false);
            rerenderCompanyDashboardWithFeedback('[data-company-job-feedback]', successMessage, 'success');
          });
        });
      }
    }

    const bindCompanyProfileEditor = () => {
      const form = document.querySelector('[data-company-profile-form="true"]');
      const feedbackBox = document.querySelector('[data-company-profile-feedback]');
      if (!form || !feedbackBox || form.dataset.boundCompanyProfileForm === 'true') return;

      form.dataset.boundCompanyProfileForm = 'true';

      const nameField = form.querySelector('[name="company_name"]');
      const sectorField = form.querySelector('[name="company_sector"]');
      const cityField = form.querySelector('[name="company_city"]');
      const phoneField = form.querySelector('[name="company_phone"]');
      const landlineField = form.querySelector('[name="company_landline"]');
      const emailField = form.querySelector('[name="company_email"]');
      const websiteField = form.querySelector('[name="company_website"]');
      const facebookField = form.querySelector('[name="company_facebook"]');
      const instagramField = form.querySelector('[name="company_instagram"]');
      const linkedinField = form.querySelector('[name="company_linkedin"]');
      const xField = form.querySelector('[name="company_x"]');
      const teamSizeField = form.querySelector('[name="team_size"]');
      const descriptionField = form.querySelector('[name="company_description"]');
      const logoField = form.querySelector('[name="company_logo"]');
      const coverField = form.querySelector('[name="company_cover"]');
      const companyJobs = getCompanyStoredJobs(profile, activeSession);
      const companyLogoUrl = profile?.companyLogoUrl || profile?.companyProfile?.companyLogoUrl || '';
      const companyCoverUrl = profile?.companyCoverUrl || profile?.companyProfile?.companyCoverUrl || '';
      let pendingCompanyLogoAsset = null;
      let pendingCompanyCoverAsset = null;
      const setProfileFeedback = (message, tone = 'info') => {
        feedbackBox.className = 'application-status';
        feedbackBox.classList.add(`application-status--${tone}`);
        feedbackBox.textContent = message;
      };
      const buildSelectedAssetMeta = (file) =>
        file
          ? {
              name: file.name,
              type: file.type || 'image/*',
              size: file.size,
            }
          : null;
      const prepareSelectedImage = async (file, label, kind = 'asset') => {
        if (!file) return null;
        if (!String(file.type || '').startsWith('image/')) {
          throw new Error(`${label} يجب أن تكون صورة.`);
        }
        if (file.size > COMPANY_IMAGE_MAX_BYTES) {
          throw new Error(`${label} أكبر من الحد المسموح. اختَر صورة أصغر من 2MB.`);
        }
        return {
          url: await buildCompanyAssetDataUrl(file, kind),
          meta: buildSelectedAssetMeta(file),
        };
      };

      const fillField = (field, value) => {
        if (!field || field.value) return;
        field.value = String(value || '');
      };

      fillField(nameField, companyName);
      fillField(sectorField, companyIdentity.sector);
      fillField(cityField, companyIdentity.city);
      fillField(phoneField, companyIdentity.phone);
      fillField(landlineField, companyIdentity.landline);
      fillField(emailField, companyEmail);
      fillField(websiteField, companyIdentity.website || profile?.companyWebsite || profile?.website || '');
      fillField(facebookField, companySocialLinks.facebook);
      fillField(instagramField, companySocialLinks.instagram);
      fillField(linkedinField, companySocialLinks.linkedin);
      fillField(xField, companySocialLinks.x);
      fillField(
        teamSizeField,
        sanitizePositiveIntegerInput(companyIdentity.teamSize, { allowLegacyRange: true }),
      );
      fillField(descriptionField, companyIdentity.description);

      const refreshPreview = () => {
        const nextName = nameField?.value.trim() || companyName;
        const nextSector = sectorField?.value.trim() || companyIdentity.sector || 'غير محدد';
        const nextCity = cityField?.value.trim() || companyIdentity.city || 'غير محددة';
        const nextPhone = phoneField?.value.trim() || companyIdentity.phone || 'غير محدد';
        const nextLandline = landlineField?.value.trim() || companyIdentity.landline || '';
        const nextWebsite = normalizeWebsiteUrl(websiteField?.value || companyIdentity.website || '');
        const nextSocialLinks = normalizeCompanySocialLinks({
          facebook: facebookField?.value || companySocialLinks.facebook,
          instagram: instagramField?.value || companySocialLinks.instagram,
          linkedin: linkedinField?.value || companySocialLinks.linkedin,
          x: xField?.value || companySocialLinks.x,
        });
        const nextDescription = descriptionField?.value.trim() || companyIdentity.description || '';

        setTextContent('[data-company-profile-name]', nextName);
        setTextContent('[data-company-profile-sector]', nextSector);
        setTextContent('[data-company-profile-city]', nextCity);
        setTextContent('[data-company-profile-phone]', nextPhone);
        const landlineRow = document.querySelector('[data-company-profile-landline-row]');
        if (landlineRow instanceof HTMLElement) {
          landlineRow.hidden = !nextLandline;
        }
        setTextContent('[data-company-profile-landline]', nextLandline || 'غير محدد');
        setTextContent('[data-company-profile-description]', nextDescription || 'أضف نبذة واضحة تعرّف بالشركة وتوضح طبيعة عملها.');

        const websiteLink = document.querySelector('[data-company-profile-website]');
        if (websiteLink instanceof HTMLAnchorElement) {
          if (nextWebsite) {
            websiteLink.href = nextWebsite;
            websiteLink.target = '_blank';
            websiteLink.rel = 'noopener noreferrer';
            websiteLink.textContent = nextWebsite;
          } else {
            websiteLink.removeAttribute('href');
            websiteLink.removeAttribute('target');
            websiteLink.removeAttribute('rel');
            websiteLink.textContent = 'أضف الموقع الإلكتروني';
          }
        }
        toggleSocialLinks('[data-company-profile-socials]', nextSocialLinks);
      };

      const updateFileHint = (field, label) => {
        if (!field) return;
        field.setAttribute('title', label);
      };

      updateFileHint(logoField, 'اختر صورة شعار الشركة');
      updateFileHint(coverField, 'اختر صورة غلاف الشركة');

      if (logoField && logoField.dataset.boundCompanyAssetUpload !== 'true') {
        logoField.dataset.boundCompanyAssetUpload = 'true';
        logoField.addEventListener('change', async (event) => {
          const file = event.target?.files?.[0] || null;
          if (!file) {
            pendingCompanyLogoAsset = null;
            return;
          }

          try {
            setProfileFeedback('جارٍ تجهيز شعار الشركة...', 'info');
            const nextAsset = await prepareSelectedImage(file, 'شعار الشركة', 'logo');
            pendingCompanyLogoAsset = nextAsset;
            if (nextAsset?.url) {
              setImageSource(
                '[data-company-profile-logo-preview]',
                nextAsset.url,
                COMPANY_PLACEHOLDER_IMAGE,
                `${companyName} logo`,
              );
              setImageSource(
                '[data-company-dashboard-avatar-img]',
                nextAsset.url,
                COMPANY_PLACEHOLDER_IMAGE,
                `${companyName} logo`,
              );
            }
            setProfileFeedback('تم تجهيز شعار الشركة وسيتم حفظه عند الضغط على زر حفظ بيانات الشركة.', 'success');
          } catch (error) {
            pendingCompanyLogoAsset = null;
            logoField.value = '';
            setProfileFeedback(error?.message || 'تعذر تجهيز شعار الشركة الآن.', 'error');
          }
        });
      }

      if (coverField && coverField.dataset.boundCompanyAssetUpload !== 'true') {
        coverField.dataset.boundCompanyAssetUpload = 'true';
        coverField.addEventListener('change', async (event) => {
          const file = event.target?.files?.[0] || null;
          if (!file) {
            pendingCompanyCoverAsset = null;
            return;
          }

          try {
            setProfileFeedback('جارٍ تجهيز صورة الغلاف...', 'info');
            const nextAsset = await prepareSelectedImage(file, 'صورة الغلاف', 'cover');
            pendingCompanyCoverAsset = nextAsset;
            if (nextAsset?.url) {
              setImageSource(
                '[data-company-profile-cover-preview]',
                nextAsset.url,
                COMPANY_PLACEHOLDER_IMAGE,
                `${companyName} cover`,
              );
            }
            setProfileFeedback('تم تجهيز صورة الغلاف وسيتم حفظها عند الضغط على زر حفظ بيانات الشركة.', 'success');
          } catch (error) {
            pendingCompanyCoverAsset = null;
            coverField.value = '';
            setProfileFeedback(error?.message || 'تعذر تجهيز صورة الغلاف الآن.', 'error');
          }
        });
      }

      [
        nameField,
        sectorField,
        cityField,
        phoneField,
        landlineField,
        emailField,
        websiteField,
        facebookField,
        instagramField,
        linkedinField,
        xField,
        teamSizeField,
        descriptionField,
      ].forEach((field) => {
        field?.addEventListener('input', refreshPreview);
        field?.addEventListener('change', refreshPreview);
      });

      refreshPreview();

      const deleteCompanyModal = document.querySelector('[data-company-delete-modal]');
      const deleteCompanyForm = deleteCompanyModal?.querySelector('[data-company-delete-form="true"]');
      const deleteCompanyFeedback = deleteCompanyModal?.querySelector('[data-company-delete-feedback]');
      const deleteCompanyReasonField = deleteCompanyForm?.querySelector('[name="delete_reason"]');
      const deleteCompanyTarget = deleteCompanyModal?.querySelector('[data-company-delete-target]');
      const deleteCompanyCloseButtons = deleteCompanyModal?.querySelectorAll('[data-company-delete-close]') || [];
      const setDeleteCompanyFeedback = (message = '', tone = 'info') => {
        if (!(deleteCompanyFeedback instanceof HTMLElement)) return;
        deleteCompanyFeedback.className = message ? 'application-status' : 'application-status hidden';
        if (message) {
          deleteCompanyFeedback.classList.add(`application-status--${tone}`);
        }
        deleteCompanyFeedback.textContent = message;
      };
      const closeDeleteCompanyModal = () => {
        if (!(deleteCompanyModal instanceof HTMLElement)) return;
        deleteCompanyModal.classList.add('hidden');
        deleteCompanyModal.setAttribute('aria-hidden', 'true');
        setDeleteCompanyFeedback('');
        if (deleteCompanyForm instanceof HTMLFormElement) {
          deleteCompanyForm.reset();
        }
      };
      const openDeleteCompanyModal = (companyLabel = 'هذه الشركة') => {
        if (!(deleteCompanyModal instanceof HTMLElement)) return;
        if (deleteCompanyTarget instanceof HTMLElement) {
          deleteCompanyTarget.textContent = `سيختفي ${companyLabel} من الموقع فورًا، وسيصل طلب الحذف إلى صندوق مراجعة الأدمن مع السبب الذي ستكتبه الآن.`;
        }
        deleteCompanyModal.classList.remove('hidden');
        deleteCompanyModal.setAttribute('aria-hidden', 'false');
        setDeleteCompanyFeedback('');
        if (deleteCompanyForm instanceof HTMLFormElement) {
          deleteCompanyForm.reset();
        }
        if (deleteCompanyReasonField instanceof HTMLTextAreaElement) {
          window.setTimeout(() => deleteCompanyReasonField.focus(), 30);
        }
      };

      if (deleteCompanyModal instanceof HTMLElement && deleteCompanyModal.dataset.boundCompanyDeleteModal !== 'true') {
        deleteCompanyModal.dataset.boundCompanyDeleteModal = 'true';
        deleteCompanyCloseButtons.forEach((button) => {
          button.addEventListener('click', closeDeleteCompanyModal);
        });
        document.addEventListener('keydown', (event) => {
          if (event.key === 'Escape' && !deleteCompanyModal.classList.contains('hidden')) {
            closeDeleteCompanyModal();
          }
        });
      }

      const deleteCompanyButton = document.querySelector('[data-company-account-delete="true"]');
      if (deleteCompanyButton instanceof HTMLButtonElement && deleteCompanyButton.dataset.boundCompanyDelete !== 'true') {
        deleteCompanyButton.dataset.boundCompanyDelete = 'true';
        deleteCompanyButton.addEventListener('click', () => {
          const latestProfile = migrateLegacyCompanyDraftJobs(getStoredProfile(), activeSession);
          const latestSession = refreshCompanySession(latestProfile, activeSession);
          const latestIdentity = getCompanyIdentity(latestProfile, latestSession);
          const companyLabel = String(latestIdentity.name || 'هذه الشركة').trim();
          openDeleteCompanyModal(companyLabel);
        });
      }

      if (deleteCompanyForm instanceof HTMLFormElement && deleteCompanyForm.dataset.boundCompanyDeleteForm !== 'true') {
        deleteCompanyForm.dataset.boundCompanyDeleteForm = 'true';
        deleteCompanyForm.addEventListener('submit', async (event) => {
          event.preventDefault();

          const reason = String(deleteCompanyReasonField?.value || '').trim();
          if (!reason) {
            setDeleteCompanyFeedback('اكتب سبب حذف الحساب قبل التأكيد النهائي.', 'error');
            deleteCompanyReasonField?.focus();
            return;
          }

          const latestProfile = migrateLegacyCompanyDraftJobs(getStoredProfile(), activeSession);
          const latestSession = refreshCompanySession(latestProfile, activeSession);
          const confirmDeleteButton = deleteCompanyForm.querySelector('[data-company-delete-confirm]');

          setDashboardButtonPending(confirmDeleteButton, true, 'جارٍ إرسال الطلب...');
          let deleted = false;
          try {
            deleted = await requestCompanyAccountDeletion(latestProfile, latestSession, reason);
          } catch (error) {
            console.warn('Unable to submit company deletion request', error);
            deleted = false;
          }
          setDashboardButtonPending(confirmDeleteButton, false);

          if (!deleted) {
            const failureMessage = 'تعذر إرسال طلب حذف الشركة الآن. حاول مرة أخرى أو راجع إعدادات الربط.';
            setDeleteCompanyFeedback(failureMessage, 'error');
            setProfileFeedback(failureMessage, 'error');
            return;
          }

          closeDeleteCompanyModal();
          setProfileFeedback('تم إرسال طلب حذف الشركة، وسيظهر الآن في صندوق مراجعة الأدمن.', 'success');
          showToast('تم إرسال طلب حذف الشركة.');
          window.setTimeout(() => {
            navigateToInternal('index.html', 'index.html');
          }, 900);
        });
      }

      form.addEventListener('submit', async (event) => {
        event.preventDefault();

        const submitButton = form.querySelector('button[type="submit"]');

        const nextCompanyName = nameField?.value.trim() || '';
        const nextCompanySector = sectorField?.value.trim() || '';
        const nextCompanyCity = cityField?.value.trim() || '';
        const nextCompanyPhone = phoneField?.value.trim() || '';
        const nextCompanyLandline = landlineField?.value.trim() || '';
        const nextCompanyEmail = emailField?.value.trim() || '';
        const nextCompanyWebsite = normalizeWebsiteUrl(websiteField?.value || '');
        const nextSocialLinks = normalizeCompanySocialLinks({
          facebook: facebookField?.value || '',
          instagram: instagramField?.value || '',
          linkedin: linkedinField?.value || '',
          x: xField?.value || '',
        });
        const nextTeamSize = sanitizePositiveIntegerInput(teamSizeField?.value || '');
        const nextCompanyDescription = descriptionField?.value.trim() || '';

        if (!nextCompanyName || !nextCompanySector || !nextCompanyCity || !nextCompanyEmail) {
          setProfileFeedback('من فضلك أكمل الاسم والقطاع والمدينة والبريد الإلكتروني.', 'error');
          return;
        }

        if (isDisposableEmailAddress(nextCompanyEmail)) {
          setProfileFeedback('استخدم بريدًا إلكترونيًا رسميًا للشركة. الإيميلات المؤقتة أو الوهمية غير مسموح بها.', 'error');
          return;
        }

        const selectedLogo = logoField?.files?.[0] || null;
        const selectedCover = coverField?.files?.[0] || null;
        const readSelectedImage = async (file, label, kind = 'asset') => {
          if (!file) return null;
          if (!String(file.type || '').startsWith('image/')) {
            throw new Error(`${label} يجب أن تكون صورة.`);
          }
          if (file.size > COMPANY_IMAGE_MAX_BYTES) {
            throw new Error(`${label} أكبر من الحد المسموح. اختَر صورة أصغر من 2MB.`);
          }
          return buildCompanyAssetDataUrl(file, kind);
        };

        let nextCompanyLogoUrl = pendingCompanyLogoAsset?.url || companyLogoUrl;
        let nextCompanyCoverUrl = pendingCompanyCoverAsset?.url || companyCoverUrl;
        let nextCompanyLogoMeta =
          pendingCompanyLogoAsset?.meta || profile?.companyLogoMeta || profile?.companyProfile?.companyLogoMeta || null;
        let nextCompanyCoverMeta =
          pendingCompanyCoverAsset?.meta || profile?.companyCoverMeta || profile?.companyProfile?.companyCoverMeta || null;

        try {
          setDashboardButtonPending(submitButton, true, 'جارٍ حفظ بيانات الشركة...');
          if (selectedLogo && !pendingCompanyLogoAsset?.url) {
            nextCompanyLogoUrl = await readSelectedImage(selectedLogo, 'شعار الشركة', 'logo');
            nextCompanyLogoMeta = buildSelectedAssetMeta(selectedLogo);
          }

          if (selectedCover && !pendingCompanyCoverAsset?.url) {
            nextCompanyCoverUrl = await readSelectedImage(selectedCover, 'صورة الغلاف', 'cover');
            nextCompanyCoverMeta = buildSelectedAssetMeta(selectedCover);
          }
        } catch (error) {
          setDashboardButtonPending(submitButton, false);
          setProfileFeedback(error?.message || 'تعذر حفظ الصورة المحددة.', 'error');
          return;
        }

        if (/^data:image\//i.test(String(nextCompanyLogoUrl || ''))) {
          nextCompanyLogoUrl = await optimizeImageDataUrlForStorage(nextCompanyLogoUrl, {
            maxWidth: 720,
            maxHeight: 720,
            quality: 0.9,
            mimeType: 'image/png',
          });
        }

        if (/^data:image\//i.test(String(nextCompanyCoverUrl || ''))) {
          nextCompanyCoverUrl = await optimizeImageDataUrlForStorage(nextCompanyCoverUrl, {
            maxWidth: 1440,
            maxHeight: 900,
            quality: 0.82,
            mimeType: 'image/jpeg',
          });
        }

        const nextProfile = {
          ...profile,
          role: 'company',
          accountStatus: profile?.accountStatus || 'active',
          status: resolvedCompanyStatus,
          companyStatus: resolvedCompanyStatus,
          fullName: nextCompanyName,
          companyName: nextCompanyName,
          email: nextCompanyEmail,
          phone: nextCompanyPhone,
          companyLandline: nextCompanyLandline,
          city: nextCompanyCity,
          headline: nextCompanySector,
          companySector: nextCompanySector,
          companyCity: nextCompanyCity,
          teamSize: nextTeamSize,
          companyWebsite: nextCompanyWebsite,
          website: nextCompanyWebsite,
          socialLinks: nextSocialLinks,
          restrictionMessage: companyRestrictionMessage,
          restrictionAttachmentUrl: companyRestrictionAttachmentUrl,
          restrictionAttachmentName: companyRestrictionAttachmentName,
          companyDescription: nextCompanyDescription,
          description: nextCompanyDescription,
          companyLogoUrl: nextCompanyLogoUrl || '',
          companyCoverUrl: nextCompanyCoverUrl || '',
          companyLogoMeta: nextCompanyLogoMeta,
          companyCoverMeta: nextCompanyCoverMeta,
          companyProfile: {
            ...(profile?.companyProfile || {}),
            status: resolvedCompanyStatus,
            companyName: nextCompanyName,
            companySector: nextCompanySector,
            companyCity: nextCompanyCity,
            teamSize: nextTeamSize,
            phone: nextCompanyPhone,
            landline: nextCompanyLandline,
            email: nextCompanyEmail,
            website: nextCompanyWebsite,
            socialLinks: nextSocialLinks,
            restrictionMessage: companyRestrictionMessage,
            restrictionAttachmentUrl: companyRestrictionAttachmentUrl,
            restrictionAttachmentName: companyRestrictionAttachmentName,
            companyDescription: nextCompanyDescription,
            companyLogoUrl: nextCompanyLogoUrl || '',
            companyCoverUrl: nextCompanyCoverUrl || '',
            companyLogoMeta: nextCompanyLogoMeta,
            companyCoverMeta: nextCompanyCoverMeta,
            jobs: companyJobs,
            draft: profile?.companyJobDraft || profile?.companyProfile?.draft || {},
          },
          companyJobs,
          companyJobDraft: profile?.companyJobDraft || profile?.companyProfile?.draft || {},
        };

        const profileSaved = saveJSON(STORAGE_KEYS.applicationProfile, nextProfile);
        if (!profileSaved) {
          setDashboardButtonPending(submitButton, false);
          setProfileFeedback('تعذر حفظ بيانات الشركة على هذا الجهاز الآن. قلّل حجم الصور ثم أعد المحاولة.', 'error');
          return;
        }
        const nextSession = refreshCompanySession(nextProfile, activeSession);
        syncCompanyPublishingState(nextProfile, nextSession);
        if (logoField) logoField.value = '';
        if (coverField) coverField.value = '';
        pendingCompanyLogoAsset = null;
        pendingCompanyCoverAsset = null;
        const successMessage = 'تم حفظ بيانات الشركة والصور بنجاح.';
        setProfileFeedback(successMessage, 'success');
        showToast('تم تحديث ملف الشركة بنجاح.');
        setDashboardButtonPending(submitButton, false);
        rerenderCompanyDashboardWithFeedback('[data-company-profile-feedback]', successMessage, 'success');
      });
    };

    bindCompanyProfileEditor();

    const bindCompanyJobComposer = () => {
      const form = document.querySelector('[data-company-job-form="true"]');
      const feedbackBox = document.querySelector('[data-company-job-feedback]');
      const composerSection = document.querySelector('#company-job-composer');
      const resetButton = document.querySelector('[data-company-job-reset]');

      document.querySelectorAll('[data-company-job-open]').forEach((trigger) => {
        if (trigger.dataset.boundCompanyJobOpen === 'true') return;
        trigger.dataset.boundCompanyJobOpen = 'true';
        trigger.addEventListener('click', () => {
          setCompanyJobComposerState();
          composerSection?.scrollIntoView({ behavior: 'smooth', block: 'start' });
          form?.querySelector('[name="job_title"]')?.focus();
        });
      });

      if (!form || !feedbackBox || form.dataset.boundCompanyJobForm === 'true') return;

      form.dataset.boundCompanyJobForm = 'true';
      const setComposerFeedback = (message, tone = 'info') => {
        feedbackBox.className = 'application-status';
        feedbackBox.classList.add(`application-status--${tone}`);
        feedbackBox.textContent = message;
      };

      setCompanyJobComposerState();

      if (resetButton instanceof HTMLButtonElement && resetButton.dataset.boundCompanyJobReset !== 'true') {
        resetButton.dataset.boundCompanyJobReset = 'true';
        resetButton.addEventListener('click', () => {
          setCompanyJobComposerState();
          setComposerFeedback('تم إلغاء وضع التعديل والرجوع إلى نموذج نشر وظيفة جديدة.', 'info');
          form.querySelector('[name="job_title"]')?.focus();
        });
      }

      form.addEventListener('submit', (event) => {
        event.preventDefault();

        const submitButton = form.querySelector('button[type="submit"]');
        const editingJobId = form.querySelector('[name="job_id"]')?.value.trim() || '';

        const nextTitle = form.querySelector('[name="job_title"]')?.value.trim() || '';
        const nextCity = form.querySelector('[name="job_city"]')?.value.trim() || companyIdentity.city || '';
        const nextType = form.querySelector('[name="job_type"]')?.value.trim() || '';
        const nextSalary = form.querySelector('[name="job_salary"]')?.value.trim() || '';
        const nextPositions = form.querySelector('[name="job_positions"]')?.value.trim() || '1';
        const nextFeatured = Boolean(form.querySelector('[name="job_featured"]')?.checked);
        const nextDescription = form.querySelector('[name="job_description"]')?.value.trim() || '';

        if (!nextTitle || !nextDescription) {
          setComposerFeedback('اكتب مسمى الوظيفة والوصف قبل الحفظ.', 'error');
          return;
        }

        const latestProfile = migrateLegacyCompanyDraftJobs(getStoredProfile(), session);
        const latestSession = refreshCompanySession(latestProfile, activeSession);
        const existingJobs = getCompanyStoredJobs(latestProfile, latestSession);
        const existingJob = editingJobId
          ? existingJobs.find((job) => String(job?.id || '').trim() === editingJobId) || null
          : null;

        if (editingJobId && !existingJob) {
          setComposerFeedback('تعذر العثور على الوظيفة المطلوب تعديلها. أعد فتحها من الجدول.', 'error');
          return;
        }

        setDashboardButtonPending(
          submitButton,
          true,
          existingJob ? 'جارٍ حفظ التعديلات...' : 'جارٍ نشر الوظيفة...',
        );
        const nextJob = normalizeCompanyStoredJob(
          {
            id: existingJob?.id || createLocalEntityId('job'),
            title: nextTitle,
            city: nextCity,
            type: nextType,
            salary: nextSalary,
            positions: nextPositions,
            featured: nextFeatured,
            summary: nextDescription,
            status: existingJob?.status || 'approved',
            postedLabel: existingJob?.postedLabel || 'الآن',
            postedAt: existingJob?.postedAt || new Date().toISOString(),
            createdAt: existingJob?.createdAt || new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            deletedAt: existingJob?.deletedAt || null,
            deletedBy: existingJob?.deletedBy || null,
            deletedStatusSnapshot: existingJob?.deletedStatusSnapshot || null,
            restoredByAdminAt: existingJob?.restoredByAdminAt || null,
          },
          latestProfile,
          latestSession,
        );

        if (!nextJob) {
          setDashboardButtonPending(submitButton, false);
          setComposerFeedback('تعذر تجهيز بيانات الوظيفة. حاول مرة أخرى.', 'error');
          return;
        }

        const nextJobs = existingJob
          ? existingJobs.map((job) => (String(job?.id || '').trim() === editingJobId ? { ...job, ...nextJob } : job))
          : [nextJob, ...existingJobs];
        const nextProfile = persistCompanyJobsProfile(latestProfile, nextJobs, nextJob);
        const nextSession = refreshCompanySession(nextProfile, latestSession);
        syncCompanyPublishingState(nextProfile, nextSession);
        const successMessage = existingJob
          ? `تم حفظ تعديلات الوظيفة: ${nextJob.title}`
          : nextJob.featured
            ? `تم نشر الوظيفة المميزة: ${nextJob.title}`
            : `تم نشر الوظيفة: ${nextJob.title}`;
        setComposerFeedback(successMessage, 'success');
        showToast(successMessage);
        setCompanyJobComposerState();
        setDashboardButtonPending(submitButton, false);
        rerenderCompanyDashboardWithFeedback('[data-company-job-feedback]', successMessage, 'success');
      });
    };

    bindCompanyJobComposer();

    const bindCompanyDashboardSearch = () => {
      const searchInput = document.querySelector('[data-company-dashboard-search]');
      if (!(searchInput instanceof HTMLInputElement) || searchInput.dataset.boundCompanyDashboardSearch === 'true') return;

      searchInput.dataset.boundCompanyDashboardSearch = 'true';

      const applySearch = () => {
        const query = normalize(searchInput.value);

        const jobRows = Array.from(document.querySelectorAll('[data-company-jobs-body] tr'));
        jobRows.forEach((row) => {
          if (!(row instanceof HTMLTableRowElement)) return;
          const isEmptyState = Boolean(row.querySelector('td[colspan]'));
          if (!query) {
            row.hidden = false;
            return;
          }
          if (isEmptyState) {
            row.hidden = true;
            return;
          }
          row.hidden = !normalize(row.textContent || '').includes(query);
        });

        const applicantCards = Array.from(document.querySelectorAll('[data-company-applicants] > *'));
        applicantCards.forEach((card) => {
          if (!(card instanceof HTMLElement)) return;
          const isEmptyState = card.classList.contains('dashboard-empty-card');
          if (!query) {
            card.hidden = false;
            return;
          }
          if (isEmptyState) {
            card.hidden = true;
            return;
          }
          card.hidden = !normalize(card.textContent || '').includes(query);
        });
      };

      searchInput.addEventListener('input', applySearch);
      searchInput.addEventListener('search', applySearch);
    };

    bindCompanyDashboardSearch();
    const queuedDashboardFeedback = consumeCompanyDashboardFeedback();
    if (queuedDashboardFeedback) {
      applyDashboardFeedback(
        queuedDashboardFeedback.selector,
        queuedDashboardFeedback.message,
        queuedDashboardFeedback.tone || 'info',
      );
    }

    const applicantsRoot = document.querySelector('[data-company-applicants]');
    const applicantsFeedback = document.querySelector('[data-company-applications-feedback]');
    if (!applicantsRoot) return;

    const setApplicationsFeedback = (message, tone = 'info') => {
      if (!(applicantsFeedback instanceof HTMLElement)) {
        if (message) showToast(message);
        return;
      }

      applicantsFeedback.className = 'application-status';
      applicantsFeedback.classList.add(`application-status--${tone}`);
      applicantsFeedback.textContent = message;
      applicantsFeedback.classList.remove('hidden');
      applicantsFeedback.removeAttribute('hidden');
    };

    const searchInput = document.querySelector('[data-company-dashboard-search]');
    const statusFilterControl = document.querySelector('[data-company-applicants-status-filter]');
    const jobFilterControl = document.querySelector('[data-company-applicants-job-filter]');
    const tagFilterControl = document.querySelector('[data-company-applicants-tag-filter]');
    const exportApplicantsButton = document.querySelector('[data-company-applicants-export]');
    const applicantsCountLabel = document.querySelector('[data-company-applicants-count]');
    const reviewModal = document.querySelector('[data-company-review-modal]');
    const reviewForm = reviewModal?.querySelector('[data-company-review-form="true"]');
    const reviewFeedback = reviewModal?.querySelector('[data-company-review-feedback]');
    const reviewCloseButtons = reviewModal?.querySelectorAll('[data-company-review-close]') || [];
    let selectedReviewApplicationId = '';

    const getApplicantStatusToneClass = (tone) =>
      tone === 'success'
        ? 'bg-emerald-100 text-emerald-700'
        : tone === 'error'
          ? 'bg-rose-100 text-rose-700'
          : tone === 'info'
            ? 'bg-sky-100 text-sky-700'
            : 'bg-amber-100 text-amber-700';

    const setReviewFeedback = (message, tone = 'info') => {
      if (!(reviewFeedback instanceof HTMLElement)) return;
      reviewFeedback.className = 'application-status';
      reviewFeedback.classList.add(`application-status--${tone}`);
      reviewFeedback.textContent = message;
      reviewFeedback.classList.remove('hidden');
      reviewFeedback.removeAttribute('hidden');
    };

    const closeReviewModal = () => {
      if (!(reviewModal instanceof HTMLElement)) return;
      reviewModal.classList.add('hidden');
      reviewModal.setAttribute('aria-hidden', 'true');
      selectedReviewApplicationId = '';
      if (reviewFeedback instanceof HTMLElement) {
        reviewFeedback.className = 'application-status hidden';
        reviewFeedback.textContent = '';
      }
    };

    const openReviewModal = (applicationId) => {
      if (!(reviewModal instanceof HTMLElement) || !(reviewForm instanceof HTMLFormElement)) return;
      const application =
        companyApplications.find((entry) => getApplicationRequestId(entry) === String(applicationId || '').trim()) || null;
      if (!application) {
        setApplicationsFeedback('تعذر العثور على بيانات هذا المتقدم.', 'error');
        return;
      }

      selectedReviewApplicationId = getApplicationRequestId(application);
      reviewForm.elements.application_id.value = selectedReviewApplicationId;
      reviewForm.elements.application_status.value = normalizeApplicationStatus(application?.status);
      reviewForm.elements.application_tag.value = normalizeCompanyCandidateTag(application?.companyTag || '');
      reviewForm.elements.interview_scheduled_at.value = toDateTimeLocalValue(application?.interviewScheduledAt || '');
      reviewForm.elements.interview_mode.value = normalizeInterviewMode(application?.interviewMode || '');
      reviewForm.elements.interview_location.value = String(application?.interviewLocation || '').trim();
      reviewForm.elements.application_rejection_reason.value = String(application?.rejectionReason || '').trim();
      reviewForm.elements.application_note.value = '';
      reviewModal.classList.remove('hidden');
      reviewModal.setAttribute('aria-hidden', 'false');
    };

    const syncJobFilterOptions = () => {
      if (!(jobFilterControl instanceof HTMLSelectElement)) return;
      const currentValue = jobFilterControl.value || 'all';
      const jobOptions = Array.from(
        new Set(
          companyApplications
            .map((application) => String(application?.job?.jobTitle || application?.job?.title || '').trim())
            .filter(Boolean),
        ),
      ).sort((first, second) => first.localeCompare(second, 'ar'));

      jobFilterControl.innerHTML = [
        '<option value="all">كل الوظائف</option>',
        ...jobOptions.map((jobTitle) => `<option value="${escapeHtml(jobTitle)}">${escapeHtml(jobTitle)}</option>`),
      ].join('');

      if (jobOptions.includes(currentValue)) {
        jobFilterControl.value = currentValue;
      }
    };

    const getVisibleCompanyApplications = () => {
      const selectedStatus =
        statusFilterControl instanceof HTMLSelectElement ? normalizeApplicationStatus(statusFilterControl.value || 'all') : 'all';
      const selectedJob =
        jobFilterControl instanceof HTMLSelectElement ? String(jobFilterControl.value || 'all').trim() : 'all';
      const selectedTag =
        tagFilterControl instanceof HTMLSelectElement ? normalizeCompanyCandidateTag(tagFilterControl.value || 'all') : 'all';
      const searchQuery = normalize(searchInput instanceof HTMLInputElement ? searchInput.value : '');

      return companyApplications.filter((application) => {
        const applicationStatus = normalizeApplicationStatus(application?.status);
        const jobTitle = String(application?.job?.jobTitle || application?.job?.title || '').trim();
        const applicationTag = normalizeCompanyCandidateTag(application?.companyTag || '');
        const searchableText = normalize(
          [
            application?.applicant?.fullName,
            application?.applicant?.phone,
            application?.applicant?.city,
            application?.applicant?.experience,
            application?.rejectionReason,
            application?.companyTag,
            application?.interviewLocation,
            jobTitle,
          ]
            .filter(Boolean)
            .join(' '),
        );

        const matchesStatus = selectedStatus === 'all' ? true : applicationStatus === selectedStatus;
        const matchesJob = selectedJob === 'all' ? true : jobTitle === selectedJob;
        const matchesTag = selectedTag === 'all' ? true : applicationTag === selectedTag;
        const matchesQuery = !searchQuery ? true : searchableText.includes(searchQuery);
        return matchesStatus && matchesJob && matchesTag && matchesQuery;
      });
    };

    const renderApplicants = () => {
      syncJobFilterOptions();
      const visibleApplications = getVisibleCompanyApplications();

      if (applicantsCountLabel instanceof HTMLElement) {
        applicantsCountLabel.textContent = `${visibleApplications.length} طلب ظاهر`;
      }

      if (!visibleApplications.length) {
        applicantsRoot.innerHTML = `
          <div class="rounded-2xl border border-dashed border-slate-200 bg-white p-5 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
            ${companyApplications.length ? 'لا توجد نتائج مطابقة للفلاتر الحالية.' : 'لا توجد طلبات تقديم حقيقية مرتبطة بحساب شركتك حتى الآن.'}
          </div>`;
        return;
      }

      applicantsRoot.innerHTML = visibleApplications
        .map((application) => {
          const applicationId = getApplicationRequestId(application);
          const applicantName = escapeHtml(application?.applicant?.fullName || 'متقدم جديد');
          const jobTitle = escapeHtml(application?.job?.jobTitle || application?.job?.title || 'وظيفة');
          const status = getApplicationStatusPresentation(application);
          const meta = [application?.applicant?.city, application?.applicant?.phone, application?.applicant?.experience]
            .filter(Boolean)
            .join(' • ');
          const submittedAt = escapeHtml(formatLocalDate(application?.submittedAt) || 'حديثًا');
          const rejectionReason = String(application?.rejectionReason || '').trim();
          const tagLabel = getCompanyCandidateTagLabel(application?.companyTag || '');
          const interviewLabel = getInterviewScheduleLabel(application);
          const notes = sanitizeApplicationNotes(application?.notes).slice(0, 2);

          return `
            <article class="dashboard-applicant-card">
              <div class="dashboard-applicant-card__head">
                <div class="dashboard-applicant-card__avatar">
                  <i class="fa-solid fa-user" aria-hidden="true"></i>
                </div>
                <div class="dashboard-applicant-card__copy">
                  <div class="dashboard-applicant-card__title-row">
                    <div class="dashboard-applicant-card__titles">
                      <h4>${applicantName}</h4>
                      <p>${jobTitle}</p>
                    </div>
                    <span class="dashboard-applicant-card__status ${getApplicantStatusToneClass(status.tone)}">${escapeHtml(status.label)}</span>
                  </div>
                  <p class="dashboard-applicant-card__meta">${escapeHtml(meta || submittedAt)}</p>
                  <p class="dashboard-applicant-card__meta">رقم الطلب: ${escapeHtml(applicationId)} • تاريخ التقديم: ${submittedAt}</p>
                  <div class="dashboard-applicant-card__meta-row">
                    ${
                      tagLabel
                        ? `<span class="dashboard-applicant-card__pill dashboard-applicant-card__pill--tag">${escapeHtml(tagLabel)}</span>`
                        : ''
                    }
                    ${
                      interviewLabel
                        ? `<span class="dashboard-applicant-card__pill dashboard-applicant-card__pill--schedule">${escapeHtml(interviewLabel)}</span>`
                        : ''
                    }
                  </div>
                  ${
                    rejectionReason
                      ? `<p class="dashboard-applicant-card__reason">سبب الرفض: ${escapeHtml(rejectionReason)}</p>`
                      : ''
                  }
                  ${
                    notes.length
                      ? `<div class="dashboard-applicant-card__notes">${notes
                          .map(
                            (note) => `
                            <div class="dashboard-applicant-card__note">
                              <strong>${escapeHtml(note.authorName)}</strong>
                              <p>${escapeHtml(note.body)}</p>
                            </div>`,
                          )
                          .join('')}</div>`
                      : ''
                  }
                </div>
              </div>
              <div class="dashboard-applicant-card__actions">
                <button type="button" class="site-action site-action--ghost" data-company-application-action="review" data-company-application-id="${escapeHtml(applicationId)}">مراجعة</button>
                <button type="button" class="site-action site-action--secondary" data-company-application-action="interview" data-company-application-id="${escapeHtml(applicationId)}">مقابلة</button>
                <button type="button" class="site-action site-action--primary" data-company-application-action="approved" data-company-application-id="${escapeHtml(applicationId)}">قبول</button>
                <button type="button" class="site-action site-action--danger" data-company-application-action="rejected" data-company-application-id="${escapeHtml(applicationId)}">رفض</button>
                <button type="button" class="site-action site-action--ghost" data-company-application-manage="${escapeHtml(applicationId)}">إدارة المتقدم</button>
              </div>
            </article>`;
        })
        .join('');
    };

    if (statusFilterControl instanceof HTMLSelectElement && statusFilterControl.dataset.boundCompanyApplicantsFilter !== 'true') {
      statusFilterControl.dataset.boundCompanyApplicantsFilter = 'true';
      statusFilterControl.addEventListener('change', renderApplicants);
    }

    if (jobFilterControl instanceof HTMLSelectElement && jobFilterControl.dataset.boundCompanyApplicantsFilter !== 'true') {
      jobFilterControl.dataset.boundCompanyApplicantsFilter = 'true';
      jobFilterControl.addEventListener('change', renderApplicants);
    }

    if (tagFilterControl instanceof HTMLSelectElement && tagFilterControl.dataset.boundCompanyApplicantsFilter !== 'true') {
      tagFilterControl.dataset.boundCompanyApplicantsFilter = 'true';
      tagFilterControl.addEventListener('change', renderApplicants);
    }

    if (searchInput instanceof HTMLInputElement && searchInput.dataset.boundCompanyApplicantsSearch !== 'true') {
      searchInput.dataset.boundCompanyApplicantsSearch = 'true';
      searchInput.addEventListener('input', renderApplicants);
      searchInput.addEventListener('search', renderApplicants);
    }

    if (exportApplicantsButton instanceof HTMLButtonElement && exportApplicantsButton.dataset.boundCompanyApplicantsExport !== 'true') {
      exportApplicantsButton.dataset.boundCompanyApplicantsExport = 'true';
      exportApplicantsButton.addEventListener('click', () => {
        const visibleApplications = getVisibleCompanyApplications();
        if (!visibleApplications.length) {
          setApplicationsFeedback('لا توجد طلبات ظاهرة لتصديرها الآن.', 'error');
          return;
        }

        downloadCsvFile(
          'rahma-company-applicants.csv',
          [
            ['رقم الطلب', 'الاسم', 'الهاتف', 'البريد', 'المدينة', 'الخبرة', 'الوظيفة', 'الحالة', 'التمييز', 'موعد المقابلة', 'سبب الرفض'],
            ...visibleApplications.map((application) => [
              getApplicationRequestId(application),
              application?.applicant?.fullName || '',
              application?.applicant?.phone || '',
              application?.applicant?.email || '',
              application?.applicant?.city || '',
              application?.applicant?.experience || '',
              application?.job?.jobTitle || application?.job?.title || '',
              getApplicationStatusPresentation(application).label,
              getCompanyCandidateTagLabel(application?.companyTag || ''),
              getInterviewScheduleLabel(application),
              application?.rejectionReason || '',
            ]),
          ],
        );

        setApplicationsFeedback('تم تصدير الطلبات الظاهرة بنجاح.', 'success');
      });
    }

    if (reviewModal instanceof HTMLElement && reviewModal.dataset.boundCompanyReviewModal !== 'true') {
      reviewModal.dataset.boundCompanyReviewModal = 'true';
      reviewCloseButtons.forEach((button) => {
        button.addEventListener('click', closeReviewModal);
      });
      reviewModal.addEventListener('click', (event) => {
        if (event.target === reviewModal) {
          closeReviewModal();
        }
      });
      document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && !reviewModal.classList.contains('hidden')) {
          closeReviewModal();
        }
      });
    }

    if (reviewForm instanceof HTMLFormElement && reviewForm.dataset.boundCompanyReviewForm !== 'true') {
      reviewForm.dataset.boundCompanyReviewForm = 'true';
      reviewForm.addEventListener('submit', async (event) => {
        event.preventDefault();

        const reviewSubmitButton = reviewForm.querySelector('button[type="submit"]');

        const applicationId = String(reviewForm.elements.application_id.value || selectedReviewApplicationId || '').trim();
        const nextStatus = String(reviewForm.elements.application_status.value || 'review').trim();
        const nextReason = String(reviewForm.elements.application_rejection_reason.value || '').trim();
        setDashboardButtonPending(reviewSubmitButton, true, 'جارٍ حفظ التحديث...');
        const updated = await updateCompanyApplicationStatus(profile, activeSession, applicationId, nextStatus, nextReason, {
          companyTag: reviewForm.elements.application_tag.value,
          interviewScheduledAt: reviewForm.elements.interview_scheduled_at.value,
          interviewMode: reviewForm.elements.interview_mode.value,
          interviewLocation: reviewForm.elements.interview_location.value,
          note: reviewForm.elements.application_note.value,
        });

        if (!updated) {
          setDashboardButtonPending(reviewSubmitButton, false);
          setReviewFeedback('تعذر حفظ التحديث. تأكد أن الطلب تابع لشركتك.', 'error');
          return;
        }

        firebaseApplicationsCache = [];
        firebaseApplicationsCacheHydrated = false;
        const successMessage = 'تم حفظ تحديث المتقدم وربطه بحساب شركتك بنجاح.';
        setApplicationsFeedback(successMessage, 'success');
        setReviewFeedback(successMessage, 'success');
        showToast('تم حفظ تحديث المتقدم.');
        setDashboardButtonPending(reviewSubmitButton, false);
        closeReviewModal();
        rerenderCompanyDashboardWithFeedback('[data-company-applications-feedback]', successMessage, 'success');
      });
    }

    if (applicantsRoot.dataset.boundCompanyApplicantActions !== 'true') {
      applicantsRoot.dataset.boundCompanyApplicantActions = 'true';
      applicantsRoot.addEventListener('click', async (event) => {
        const manageButton = event.target.closest('[data-company-application-manage]');
        if (manageButton instanceof HTMLElement) {
          event.preventDefault();
          openReviewModal(String(manageButton.dataset.companyApplicationManage || '').trim());
          return;
        }

        const actionButton = event.target.closest('[data-company-application-action]');
        if (!(actionButton instanceof HTMLElement)) return;

        event.preventDefault();

        const applicationId = String(actionButton.dataset.companyApplicationId || '').trim();
        const action = String(actionButton.dataset.companyApplicationAction || '').trim();
        if (!applicationId || !action) return;

        if (action === 'rejected') {
          const promptReason = window.prompt('اكتب سبب الرفض (اختياري):', '');
          if (promptReason === null) return;
          setDashboardButtonPending(actionButton, true, 'جارٍ رفض الطلب...');
          const updated = await updateCompanyApplicationStatus(
            profile,
            activeSession,
            applicationId,
            'rejected',
            promptReason.trim(),
          );
          if (!updated) {
            setDashboardButtonPending(actionButton, false);
            setApplicationsFeedback('تعذر تحديث حالة الطلب. تأكد أن الطلب تابع لشركتك.', 'error');
            return;
          }

          firebaseApplicationsCache = [];
          firebaseApplicationsCacheHydrated = false;
          const successMessage = 'تم رفض الطلب وتحديث حالته بنجاح.';
          setApplicationsFeedback(successMessage, 'success');
          showToast('تم رفض الطلب.');
          setDashboardButtonPending(actionButton, false);
          rerenderCompanyDashboardWithFeedback('[data-company-applications-feedback]', successMessage, 'success');
          return;
        }

        setDashboardButtonPending(
          actionButton,
          true,
          action === 'interview' ? 'جارٍ نقل الطلب للمقابلة...' : action === 'review' ? 'جارٍ إعادة الطلب...' : 'جارٍ قبول الطلب...',
        );
        const updated = await updateCompanyApplicationStatus(profile, activeSession, applicationId, action);
        if (!updated) {
          setDashboardButtonPending(actionButton, false);
          setApplicationsFeedback('تعذر تحديث حالة الطلب. تأكد أن الطلب تابع لشركتك.', 'error');
          return;
        }

        firebaseApplicationsCache = [];
        firebaseApplicationsCacheHydrated = false;
        const successMessage =
          action === 'interview'
            ? 'تم نقل الطلب إلى مرحلة المقابلة بنجاح.'
            : action === 'review'
              ? 'تمت إعادة الطلب إلى حالة المراجعة.'
              : 'تمت الموافقة على الطلب وتحديث حالته بنجاح.';
        setApplicationsFeedback(successMessage, 'success');
        showToast(
          action === 'interview'
            ? 'تم تحديد حالة المقابلة.'
            : action === 'review'
              ? 'تمت إعادة الطلب للمراجعة.'
              : 'تمت الموافقة على الطلب.',
        );
        setDashboardButtonPending(actionButton, false);
        rerenderCompanyDashboardWithFeedback('[data-company-applications-feedback]', successMessage, 'success');
      });
    }

    if (applicantsFeedback instanceof HTMLElement) {
      applicantsFeedback.className = 'application-status hidden';
      applicantsFeedback.textContent = '';
    }

      renderApplicants();
      setDashboardSidebarOpen(false);
    } catch (error) {
      console.error('Failed to render company dashboard', error);
      showToast('تعذر تجهيز لوحة الشركة الآن. حاول تحديث الصفحة مرة أخرى.');
    } finally {
      setDashboardLoading(false);
    }
  };

  const renderProfilePage = () => {};
  /* Legacy seeker profile page removed from the product surface.

    const profile = getStoredProfile();
    const session = getSession();
    const seekerEmail = normalize(profile?.email || session?.email);
    const applications = getStoredApplications().filter((application) => {
      if (!seekerEmail) return true;
      return normalize(application?.applicant?.email) === seekerEmail;
    });
    const displayName = getAccountDisplayName(profile, session);
    const headline = profile?.headline || profile?.seekerProfile?.desiredRole || '\u0644\u0645 \u064a\u062a\u0645 \u062a\u062d\u062f\u064a\u062f \u0627\u0644\u0645\u0633\u0645\u0649 \u0628\u0639\u062f';
    const city = profile?.city || profile?.seekerProfile?.desiredCity || '\u0623\u0636\u0641 \u0645\u062f\u064a\u0646\u062a\u0643';
    const experience = profile?.experience || profile?.seekerProfile?.experienceYears || '';
    const preferredWorkType = profile?.preferredWorkType || profile?.seekerProfile?.preferredWorkType || '';
    const cvMeta = profile?.cvFileMeta || profile?.seekerProfile?.resumeFileMeta || null;
    const bioParts = [];

    if (headline && !headline.includes('\u0644\u0645 \u064a\u062a\u0645')) {
      bioParts.push(`\u0627\u0644\u0645\u0633\u0645\u0649 \u0627\u0644\u0645\u0633\u062a\u0647\u062f\u0641: ${headline}`);
    }
    if (city && !city.includes('\u0623\u0636\u0641')) {
      bioParts.push(`\u0627\u0644\u0645\u062f\u064a\u0646\u0629: ${city}`);
    }
    if (experience) {
      bioParts.push(`\u0627\u0644\u062e\u0628\u0631\u0629: ${experience}`);
    }
    if (preferredWorkType) {
      bioParts.push(`\u0646\u0648\u0639 \u0627\u0644\u0639\u0645\u0644: ${preferredWorkType}`);
    }

    setTextContent('[data-profile-name]', displayName);
    setTextContent('[data-profile-headline]', headline);
    setTextContent('[data-profile-city]', city);
    const applicationsBadge = document.querySelector('a[href="company-dashboard.html"] .mr-auto');
    if (applicationsBadge) applicationsBadge.textContent = String(applications.length);
    setTextContent('[data-profile-cv-name]', cvMeta?.name || '\u0644\u0645 \u064a\u062a\u0645 \u0631\u0641\u0639 \u0645\u0644\u0641 \u0628\u0639\u062f.');
    setTextContent(
      '[data-profile-bio]',
      bioParts.join(' | ') || '\u0633\u064a\u062a\u0645 \u0639\u0631\u0636 \u0646\u0628\u0630\u0629 \u062d\u0633\u0627\u0628\u0643 \u0647\u0646\u0627 \u0628\u0645\u062c\u0631\u062f \u0627\u0633\u062a\u0643\u0645\u0627\u0644 \u0628\u064a\u0627\u0646\u0627\u062a\u0643 \u0627\u0644\u062d\u0642\u064a\u0642\u064a\u0629.'
    );

    const summaryGrid = document.querySelector('[data-profile-summary-grid]');
    if (summaryGrid) {
      const items = [
        ['\u0627\u0644\u0628\u0631\u064a\u062f \u0627\u0644\u0625\u0644\u0643\u062a\u0631\u0648\u0646\u064a', profile?.email || '\u063a\u064a\u0631 \u0645\u0633\u062c\u0644'],
        ['\u0631\u0642\u0645 \u0627\u0644\u0647\u0627\u062a\u0641', profile?.phone || '\u063a\u064a\u0631 \u0645\u0636\u0627\u0641'],
        ['\u0627\u0644\u0645\u062f\u064a\u0646\u0629', city],
        ['\u0627\u0644\u0645\u0633\u0645\u0649 \u0627\u0644\u0645\u0633\u062a\u0647\u062f\u0641', headline],
        ['\u0633\u0646\u0648\u0627\u062a \u0627\u0644\u062e\u0628\u0631\u0629', experience || '\u063a\u064a\u0631 \u0645\u062d\u062f\u062f\u0629'],
        ['\u0646\u0648\u0639 \u0627\u0644\u0639\u0645\u0644 \u0627\u0644\u0645\u0641\u0636\u0644', preferredWorkType || '\u063a\u064a\u0631 \u0645\u062d\u062f\u062f'],
      ];

      summaryGrid.innerHTML = items.map(([label, value]) => `
        <div class="rounded-2xl border border-slate-200 dark:border-slate-700 px-4 py-5 bg-slate-50 dark:bg-slate-950/40">
          <p class="text-xs font-bold text-slate-400 mb-2">${escapeHtml(label)}</p>
          <p class="text-sm font-bold text-slate-800 dark:text-white">${escapeHtml(value)}</p>
        </div>`).join('');
    }

    const educationRoot = document.querySelector('[data-profile-education]');
    if (educationRoot) {
      educationRoot.innerHTML = `
        <div class="rounded-2xl border border-dashed border-slate-200 dark:border-slate-700 px-4 py-5 text-sm text-slate-500 dark:text-slate-400">
          \u0644\u0645 \u062a\u062a\u0645 \u0625\u0636\u0627\u0641\u0629 \u0627\u0644\u0645\u0624\u0647\u0644\u0627\u062a \u0627\u0644\u062f\u0631\u0627\u0633\u064a\u0629 \u0628\u0639\u062f. \u064a\u0645\u0643\u0646\u0643 \u0625\u0643\u0645\u0627\u0644\u0647\u0627 \u0644\u0627\u062d\u0642\u0627\u064b \u0628\u0639\u062f \u062a\u0648\u0633\u0639\u0629 \u0646\u0645\u0648\u0630\u062c \u0627\u0644\u062d\u0633\u0627\u0628.
        </div>`;
    }

    const skillsRoot = document.querySelector('[data-profile-skills]');
    if (skillsRoot) {
      skillsRoot.innerHTML = `
        <div class="rounded-2xl border border-dashed border-slate-200 dark:border-slate-700 px-4 py-5 text-sm text-slate-500 dark:text-slate-400">
          \u0644\u0627 \u062a\u0648\u062c\u062f \u0645\u0647\u0627\u0631\u0627\u062a \u0645\u0636\u0627\u0641\u0629 \u0639\u0644\u0649 \u0647\u0630\u0627 \u0627\u0644\u062d\u0633\u0627\u0628 \u062d\u062a\u0649 \u0627\u0644\u0622\u0646. \u0633\u062a\u0638\u0647\u0631 \u0647\u0646\u0627 \u0628\u0639\u062f \u0625\u062a\u0627\u062d\u0629 \u062a\u0639\u062f\u064a\u0644 \u0627\u0644\u0645\u0647\u0627\u0631\u0627\u062a \u0641\u064a \u0627\u0644\u0645\u0644\u0641.
        </div>`;
    }

    const cvButton = document.querySelector('[data-profile-cv-name] + button');
    if (cvButton) {
      cvButton.dataset.link = buildAuthUrl('register', 'company-dashboard.html');
      cvButton.disabled = false;
      cvButton.classList.remove('opacity-60', 'cursor-not-allowed');
      const actionLabel = cvButton.querySelector('[data-profile-cv-action-label]');
      if (actionLabel) {
        actionLabel.textContent = cvMeta ? 'إدارة CV' : 'رفع CV';
      }
    }
  };

  */
  const renderAdminApplications = () => {
    if (!window.location.pathname.endsWith('admin-panel.html')) return;

    const applicationsRoot = document.querySelector('[data-admin-applications]');
    const summary = document.querySelector('[data-admin-application-summary]');
    const applications = getStoredApplications();

    if (!applicationsRoot || !summary) return;

    if (!applications.length) {
      summary.textContent = '\u0639\u0631\u0636 0 \u0645\u0646 \u0623\u0635\u0644 0 \u0645\u062a\u0642\u062f\u0645';
      applicationsRoot.innerHTML = `
        <div class="bg-white dark:bg-slate-900 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl p-6 text-sm text-slate-500 dark:text-slate-400">
          \u0644\u0627 \u062a\u0648\u062c\u062f \u0637\u0644\u0628\u0627\u062a \u062a\u0642\u062f\u064a\u0645 \u062d\u0642\u064a\u0642\u064a\u0629 \u0645\u0639\u0631\u0648\u0636\u0629 \u062d\u0627\u0644\u064a\u0627\u064b. \u0623\u064a \u0637\u0644\u0628\u0627\u062a \u062c\u062f\u064a\u062f\u0629 \u0633\u064a\u062c\u0631\u064a \u0639\u0631\u0636\u0647\u0627 \u0647\u0646\u0627 \u0645\u0628\u0627\u0634\u0631\u0629.
        </div>`;
      return;
    }

    const visibleApplications = applications.slice(0, 3);
    summary.textContent = `\u0639\u0631\u0636 1-${visibleApplications.length} \u0645\u0646 \u0623\u0635\u0644 ${applications.length} \u0645\u062a\u0642\u062f\u0645`;
    applicationsRoot.innerHTML = visibleApplications.map((application) => {
      const applicantName = escapeHtml(application?.applicant?.fullName || '\u0645\u062a\u0642\u062f\u0645 \u062c\u062f\u064a\u062f');
      const jobTitle = escapeHtml(application?.job?.jobTitle || '\u0648\u0638\u064a\u0641\u0629');
      const company = escapeHtml(application?.job?.jobCompany || '\u0634\u0631\u0643\u0629');
      const experience = escapeHtml(application?.applicant?.experience || '\u063a\u064a\u0631 \u0645\u062d\u062f\u062f\u0629');
      const submittedAt = escapeHtml(formatLocalDate(application?.submittedAt) || '\u062d\u062f\u064a\u062b\u0627\u064b');
      return `
        <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 hover:border-primary/30 transition-all hover:shadow-xl hover:shadow-primary/5">
          <div class="flex flex-col md:flex-row gap-6">
            <div class="flex items-start gap-4 flex-1">
              <div class="w-16 h-16 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
                <span class="material-symbols-outlined">person</span>
              </div>
              <div class="space-y-1">
                <div class="flex items-center gap-2">
                  <h3 class="font-bold text-lg">${applicantName}</h3>
                  <span class="px-2 py-0.5 bg-accent-blue/10 text-accent-blue text-[10px] font-bold rounded-full">\u0637\u0644\u0628 \u062d\u0642\u064a\u0642\u064a</span>
                </div>
                <p class="text-sm text-slate-600 dark:text-slate-400">${jobTitle} • ${company}</p>
              </div>
            </div>
            <div class="flex flex-col justify-between gap-4 border-r md:pr-6 border-slate-100 dark:border-slate-800 min-w-[200px]">
              <div class="grid grid-cols-2 gap-4">
                <div>
                  <p class="text-[10px] text-slate-400 uppercase font-bold tracking-wider">\u0627\u0644\u062e\u0628\u0631\u0629</p>
                  <p class="text-sm font-bold">${experience}</p>
                </div>
                <div>
                  <p class="text-[10px] text-slate-400 uppercase font-bold tracking-wider">\u062a\u0627\u0631\u064a\u062e \u0627\u0644\u062a\u0642\u062f\u064a\u0645</p>
                  <p class="text-sm font-bold">${submittedAt}</p>
                </div>
              </div>
            </div>
          </div>
        </div>`;
    }).join('');
  };

  const initHomeSearch = () => {
    const keywordInput = document.querySelector('[data-home-keyword]');
    const button = document.querySelector('[data-search-action="home"]');
    const searchForm = document.querySelector('[data-home-search-form]');

    if (!keywordInput || !button) return;

    const runSearch = () => {
      window.location.href = buildJobsUrl({
        keyword: keywordInput.value,
      });
    };

    button.addEventListener('click', (event) => {
      event.preventDefault();
      runSearch();
    });

    if (searchForm) {
      searchForm.addEventListener('submit', (event) => {
        event.preventDefault();
        runSearch();
      });
    }

    [keywordInput].forEach((input) => {
      input.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          runSearch();
        }
      });
    });
  };

  const initHomeHeroVideo = () => {
    const section = document.querySelector('section[data-purpose="hero-section"]');
    if (!section) return;
    const wrap = section.querySelector('[data-home-hero-video-wrap]');
    const video = section.querySelector('[data-home-hero-video]');
    const placeholder = section.querySelector('[data-home-hero-video-placeholder]');
    if (!(wrap instanceof HTMLElement) || !(video instanceof HTMLVideoElement)) return;

    const url = String(getAdminRuntimeContent().homeHeroVideoUrl || '').trim();
    if (!url) {
      try {
        delete video.dataset.rahmaHeroSrc;
        video.removeAttribute('src');
        video.load();
      } catch (error) {
        /* ignore */
      }
      wrap.classList.remove('hidden');
      wrap.removeAttribute('hidden');
      if (placeholder instanceof HTMLElement) {
        placeholder.classList.remove('hidden');
        placeholder.removeAttribute('hidden');
      }
      return;
    }

    wrap.classList.remove('hidden');
    wrap.removeAttribute('hidden');
    if (placeholder instanceof HTMLElement) {
      placeholder.classList.add('hidden');
      placeholder.setAttribute('hidden', '');
    }

    if (video.dataset.rahmaHeroSrc !== url) {
      video.dataset.rahmaHeroSrc = url;
      video.src = url;
      try {
        const playPromise = video.play();
        if (playPromise && typeof playPromise.catch === 'function') {
          playPromise.catch(() => {});
        }
      } catch (error) {
        /* autoplay may be blocked */
      }
    }
  };

  const initHomeSearchLive = () => {
    const keywordInput = document.querySelector('[data-home-keyword]');
    const panel = document.querySelector('[data-home-search-panel]');
    if (!keywordInput || !(panel instanceof HTMLElement)) return;

    const resultsRoot = panel.querySelector('[data-home-search-results]');
    if (!resultsRoot) return;

    const maxRows = 8;
    let frame = null;

    const hidePanel = () => {
      panel.hidden = true;
      panel.setAttribute('hidden', '');
    };

    const showPanel = () => {
      panel.hidden = false;
      panel.removeAttribute('hidden');
    };

    const render = () => {
      const query = String(keywordInput.value || '').trim();
      if (!query) {
        resultsRoot.innerHTML = '';
        hidePanel();
        return;
      }

      const jobs = collectApprovedJobsForPublicListing().filter((job) => {
        const locationMeta = getSearchLocationMeta(String(job.location || ''));
        return matchesSearchQuery(
          query,
          job.title,
          job.companyName,
          job.location,
          locationMeta.raw,
          locationMeta.governorate,
          job.type,
          job.salary,
          job.sector,
          job.summary,
        );
      });

      if (!jobs.length) {
        resultsRoot.innerHTML =
          '<p class="home-search-live__empty" dir="rtl">لا توجد وظائف مطابقة. جرّب كلمات أخرى أو اضغط «بحث» لعرض صفحة الوظائف.</p>';
        showPanel();
        return;
      }

      const slice = jobs.slice(0, maxRows);
      resultsRoot.innerHTML = slice
        .map((job) => {
          const jobData = {
            jobId: String(job.id || '').trim(),
            jobTitle: String(job.title || '').trim(),
            jobCompany: String(job.companyName || '').trim(),
            jobLocation: String(job.location || '').trim(),
            jobType: String(job.type || '').trim(),
            jobSalary: String(job.salary || '').trim(),
            jobPosted: String(job.postedLabel || '').trim(),
            jobSummary: String(job.summary || '').trim(),
            jobSector: String(job.sector || '').trim(),
            jobFeatured: Boolean(job.featured),
          };
          const href = escapeHtml(buildJobDetailsUrl(jobData));
          return `<a class="home-search-live__row" href="${href}"><span class="home-search-live__title">${escapeHtml(jobData.jobTitle || 'وظيفة')}</span><span class="home-search-live__meta">${escapeHtml(jobData.jobCompany)} · ${escapeHtml(jobData.jobLocation || 'الموقع غير مضاف')}</span></a>`;
        })
        .join('');

      showPanel();
    };

    const schedule = () => {
      if (frame !== null) {
        cancelAnimationFrame(frame);
      }
      frame = requestAnimationFrame(() => {
        frame = null;
        render();
      });
    };

    keywordInput.addEventListener('input', schedule);
    keywordInput.addEventListener('focus', () => {
      if (String(keywordInput.value || '').trim()) {
        render();
      }
    });

    document.addEventListener('click', (event) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (target === keywordInput || panel.contains(target)) return;
      hidePanel();
    });

    keywordInput.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        hidePanel();
      }
    });
  };

  const initHomeRuntimeContent = () => {
    const heroSection = document.querySelector('section[data-purpose="hero-section"]');
    if (!heroSection) return;

    const runtimeContent = getAdminRuntimeContent();
    const heroBrandCopy = heroSection.querySelector('.hero-brand-copy');
    const heroTitle = heroSection.querySelector('h1');
    const heroSubtitle = heroSection.querySelector('p.text-gray-600, p.text-slate-600');
    const fallbackBrandCopy = heroBrandCopy?.textContent?.trim() || '';
    const fallbackHeroTitle = heroTitle?.textContent?.trim() || DEFAULT_HOME_HERO_TITLE;
    const fallbackHeroSubtitle = heroSubtitle?.textContent?.trim() || DEFAULT_HOME_HERO_SUBTITLE;

    if (heroBrandCopy) {
      heroBrandCopy.textContent = window.getRuntimeText(runtimeContent.siteAnnouncement, fallbackBrandCopy);
    }

    if (heroTitle) {
      heroTitle.textContent = normalizeHomeRuntimeText(
        runtimeContent.heroTitle,
        fallbackHeroTitle,
        LEGACY_HOME_HERO_TITLES,
      );
    }

    if (heroSubtitle) {
      heroSubtitle.textContent = normalizeHomeRuntimeText(
        runtimeContent.heroSubtitle,
        fallbackHeroSubtitle,
        LEGACY_HOME_HERO_SUBTITLES,
      );
    }
  };

  const initHomeUsefulStats = () => {
    const jobsStat = document.querySelector('[data-home-live-stat="jobs"]');
    const companiesStat = document.querySelector('[data-home-live-stat="companies"]');
    const responseStat = document.querySelector('[data-home-live-stat="response"]');

    if (!jobsStat && !companiesStat && !responseStat) return;

    const runtimeJobs = getPublicRuntimeJobs();
    const runtimeCompanies = getPublicRuntimeCompanies();
    const applications = getStoredApplications();

    const liveJobsCount = runtimeJobs.length;
    const activeCompaniesCount = runtimeCompanies.length;

    if (jobsStat) {
      jobsStat.dataset.countupTarget = String(liveJobsCount || 0);
      if (jobsStat.dataset.countupStarted !== 'true') {
        jobsStat.textContent = '0';
      } else {
        jobsStat.textContent = formatArabicInteger(liveJobsCount || 0);
      }
    }

    if (companiesStat) {
      companiesStat.dataset.countupTarget = String(activeCompaniesCount || 0);
      if (companiesStat.dataset.countupStarted !== 'true') {
        companiesStat.textContent = '0';
      } else {
        companiesStat.textContent = formatArabicInteger(activeCompaniesCount || 0);
      }
    }

    if (responseStat) {
      responseStat.textContent = formatAverageResponseLabel(
        getApplicationsAverageResponseHours(applications),
      );
    }

    initPublicScrollCounters(document);
  };

  const initCompanyOnlySections = () => {
    const session = getSession();
    const isCompanySession = Boolean(session?.loggedIn && normalize(session?.role) === 'company');

    document.querySelectorAll('[data-company-only]').forEach((element) => {
      element.classList.toggle('hidden', !isCompanySession);
      element.toggleAttribute('hidden', !isCompanySession);
      element.setAttribute('aria-hidden', String(!isCompanySession));
    });
  };

  const normalizePublicLabels = () => {
    const exactLabelMap = new Map([
      ['تعرف علينا', 'من نحن'],
      ['عن المنصة', 'من نحن'],
      ['دليل الشركات', 'الشركات'],
      ['ابحث عن وظيفتك', 'الوظائف'],
      ['اتصل بنا', 'تواصل معنا'],
    ]);

    document.querySelectorAll('a, button, span, strong, h1, h2, h3, h4').forEach((element) => {
      const text = element.textContent?.trim();
      if (!text || !exactLabelMap.has(text)) return;
      element.textContent = exactLabelMap.get(text);
    });

    if (document.title) {
      document.title = document.title
        .replace('تعرف علينا', 'من نحن')
        .replace('عن المنصة', 'من نحن');
    }
  };

  const initPublicHeaderChrome = () => {
    const currentPage = window.location.pathname.split('/').pop() || 'index.html';
    const publicPages = new Set([
      'index.html',
      'jobs.html',
      'job-details.html',
      'companies.html',
      'company-details.html',
      'about.html',
      'contact.html',
      'track-application.html',
      'privacy.html',
      'terms.html',
      'faq.html',
    ]);

    if (!publicPages.has(currentPage)) return;

    const header = document.querySelector('header, body > nav.glass-nav');
    if (!header) return;

    header.classList.add('site-topbar');

    const currentMainPage = ['company-details.html'].includes(currentPage)
      ? 'companies.html'
      : ['job-details.html'].includes(currentPage)
        ? 'jobs.html'
        : currentPage;

    const navLinks = Array.from(header.querySelectorAll('a[href]')).filter((link) => {
      const href = sanitizeInternalNavigationTarget(link.getAttribute('href') || '', '');
      const page = href.split(/[?#]/)[0];
      return ['index.html', 'jobs.html', 'companies.html', 'about.html', 'contact.html'].includes(page);
    });

    navLinks.forEach((link) => {
      const href = sanitizeInternalNavigationTarget(link.getAttribute('href') || '', '');
      const page = href.split(/[?#]/)[0];
      const keepVisible = ['index.html', 'jobs.html', 'companies.html', 'about.html'].includes(page);

      link.classList.add('site-nav__link');
      link.classList.toggle('is-active', page === currentMainPage);

      if (page === 'jobs.html') {
        link.textContent = 'الوظائف';
      }

      if (page === 'companies.html') {
        link.textContent = 'الشركات';
      }

      if (page === 'about.html') {
        link.textContent = 'من نحن';
      }

      if (!keepVisible) {
        link.classList.add('header-link-hidden');
        link.setAttribute('tabindex', '-1');
        link.setAttribute('aria-hidden', 'true');
      }
    });

    const loginControl = header.querySelector('a[href*="dist/index.html?view=login"]');
    const actionContainer = loginControl?.parentElement;
    if (actionContainer) {
      actionContainer.classList.add('site-header__actions');
    }

    if (loginControl) {
      loginControl.classList.add('site-action', 'site-action--ghost');
      if ('href' in loginControl) {
        loginControl.href = buildAuthUrl('login', 'company-dashboard.html');
      }
      loginControl.textContent = 'دخول';
    }

    const hasRegisterControl = Boolean(
      actionContainer?.querySelector(
        'a[href*="dist/index.html?view=register"]',
      ),
    );
    const registerControl = actionContainer?.querySelector(
      'a[href*="dist/index.html?view=register"]',
    );
    const trackControl = actionContainer?.querySelector(
      'a[href^="track-application.html"], button[data-link="track-application.html"]',
    );

    if (registerControl) {
      registerControl.className = 'site-action site-action--primary header-register-link hidden sm:inline-flex';
      if ('href' in registerControl) {
        registerControl.href = buildAuthUrl('register', 'company-dashboard.html');
      }
      registerControl.textContent = 'سجل شركتك';
    }

    if (trackControl) {
      trackControl.className = 'site-action site-action--ghost hidden sm:inline-flex';
      trackControl.textContent = 'متابعة الطلب';
    }

    if (actionContainer && !trackControl) {
      const trackingLink = document.createElement('a');
      trackingLink.href = 'track-application.html';
      trackingLink.className = 'site-action site-action--ghost hidden sm:inline-flex';
      trackingLink.textContent = 'متابعة الطلب';
      actionContainer.insertBefore(trackingLink, loginControl || actionContainer.firstChild);
    }

    if (actionContainer && !hasRegisterControl) {
      const registerLink = document.createElement('a');
      registerLink.href = buildAuthUrl('register', 'company-dashboard.html');
      registerLink.className = 'site-action site-action--primary header-register-link hidden sm:inline-flex';
      registerLink.textContent = 'سجل شركتك';
      actionContainer.appendChild(registerLink);
    }
  };

  /* System banner removed from the product surface.
  const SYSTEM_BANNER_ID = 'rahma-system-banner';
  const SYSTEM_BANNER_STYLE_ID = 'rahma-system-banner-style';
  const FAQ_CATEGORY_CONFIG = {
    account: {
      titleKey: 'faqAccountTitle',
      descriptionKey: 'faqAccountDescription',
      fallbackTitle: 'كل ما يخص إنشاء الحساب والتقديم على الوظائف',
      fallbackDescription: 'خطوات التسجيل، التقديم، والتجهيز للوظيفة المناسبة',
      borderClass: 'border-primary',
    },
    companies: {
      titleKey: 'faqCompaniesTitle',
      descriptionKey: 'faqCompaniesDescription',
      fallbackTitle: 'متابعة الوظائف والفرص',
      fallbackDescription: 'اختيار التخصص المناسب ومعرفة حالة الفرص المتاحة والتقديم عليها.',
      borderClass: 'border-accent',
    },
    support: {
      titleKey: 'faqSupportTitle',
      descriptionKey: 'faqSupportDescription',
      fallbackTitle: 'الدعم الفني',
      fallbackDescription: 'المساعدة التقنية واستعادة الحساب والخصوصية',
      borderClass: 'border-slate-300',
    },
  };
  const DEFAULT_PUBLIC_FAQ_ITEMS = [];

  let systemBannerResizeObserver = null;
  let faqActiveCategory = 'account';

  function getRuntimeText(value, fallback = '') {
    if (typeof value !== 'string') return fallback;
    const trimmed = normalizeLegacyRuntimeText(value.trim());
    return trimmed || repairLegacyMojibakeText(fallback);
  }

  window.getRuntimeText = getRuntimeText;

  const ensureSystemBannerStyles = () => {
    if (document.getElementById(SYSTEM_BANNER_STYLE_ID)) return;

    const style = document.createElement('style');
    style.id = SYSTEM_BANNER_STYLE_ID;
    style.textContent = `
      body[data-rahma-banner-visible="true"] {
        padding-top: calc(var(--rahma-system-banner-offset, 0px) + var(--rahma-base-body-padding, 0px));
      }
      body[data-rahma-banner-visible="true"] .glass-nav.fixed.top-0,
      body[data-rahma-banner-visible="true"] nav.fixed.top-0,
      body[data-rahma-banner-visible="true"] header.fixed.top-0,
      body[data-rahma-banner-visible="true"] nav.sticky.top-0,
      body[data-rahma-banner-visible="true"] .auth-topbar {
        top: var(--rahma-system-banner-offset, 0px) !important;
      }
      #${SYSTEM_BANNER_ID} {
        position: fixed;
        inset-inline: 0;
        top: 0;
        z-index: 10000;
        display: none;
        padding: 12px 16px;
        pointer-events: none;
      }
      #${SYSTEM_BANNER_ID}[data-visible="true"] {
        display: block;
      }
      #${SYSTEM_BANNER_ID} .rahma-system-banner__panel {
        pointer-events: auto;
      }
    `;
    document.head.appendChild(style);
  };

  const getBodyBasePadding = () => {
    if (!document.body.dataset.rahmaBasePadding) {
      document.body.dataset.rahmaBasePadding = window.getComputedStyle(document.body).paddingTop || '0px';
    }
    return document.body.dataset.rahmaBasePadding || '0px';
  };

  const applySystemBannerLayout = (height) => {
    ensureSystemBannerStyles();
    const nextHeight = Math.max(0, Math.ceil(height || 0));
    document.documentElement.style.setProperty('--rahma-system-banner-offset', `${nextHeight}px`);
    document.documentElement.style.setProperty('--rahma-base-body-padding', getBodyBasePadding());
    document.body.dataset.rahmaBannerVisible = nextHeight > 0 ? 'true' : 'false';
    document.body.style.paddingTop = `calc(${getBodyBasePadding()} + ${nextHeight}px)`;
  };

  const syncSystemBannerLayout = () => {
    const banner = document.getElementById(SYSTEM_BANNER_ID);
    if (!banner || banner.dataset.visible !== 'true') {
      applySystemBannerLayout(0);
      return;
    }

    applySystemBannerLayout(banner.getBoundingClientRect().height);
  };

  const ensureSystemBanner = () => {
    let banner = document.getElementById(SYSTEM_BANNER_ID);
    if (banner) return banner;

    banner = document.createElement('div');
    banner.id = SYSTEM_BANNER_ID;
    banner.dataset.visible = 'false';
    banner.innerHTML = `
      <div class="rahma-system-banner__panel mx-auto flex max-w-7xl items-center justify-between gap-4 rounded-[1.75rem] border border-sky-100 bg-[linear-gradient(135deg,rgba(255,255,255,0.96),rgba(239,246,255,0.98))] px-4 py-3 text-slate-800 shadow-[0_18px_40px_rgba(148,163,184,0.16)] backdrop-blur-xl">
        <div class="flex min-w-0 items-start gap-3">
          <span class="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-sky-100 text-sm font-black text-sky-700" data-rahma-banner-badge>إشعار</span>
          <div class="min-w-0">
            <p class="text-sm font-black tracking-wide text-slate-800" data-rahma-banner-title>تنبيه من لوحة الأدمن</p>
            <p class="mt-1 text-sm leading-7 text-slate-600" data-rahma-banner-message></p>
          </div>
        </div>
        <a class="inline-flex shrink-0 items-center gap-2 rounded-2xl bg-[linear-gradient(135deg,#4f9cf9,#39cfc2)] px-4 py-2 text-sm font-black text-white shadow-[0_14px_30px_rgba(79,156,249,0.22)] transition hover:brightness-105" href="contact.html" data-rahma-banner-action>
          تواصل مع الدعم
        </a>
      </div>`;
    document.body.prepend(banner);

    if (typeof ResizeObserver !== 'undefined') {
      if (systemBannerResizeObserver) {
        systemBannerResizeObserver.disconnect();
      }
      systemBannerResizeObserver = new ResizeObserver(() => syncSystemBannerLayout());
      systemBannerResizeObserver.observe(banner);
    } else {
      window.addEventListener('resize', syncSystemBannerLayout);
    }

    return banner;
  };

  const syncSystemBanner = () => {
    const banner = document.getElementById(SYSTEM_BANNER_ID);
    if (banner) {
      banner.remove();
    }

    const style = document.getElementById(SYSTEM_BANNER_STYLE_ID);
    if (style) {
      style.remove();
    }

    if (systemBannerResizeObserver) {
      systemBannerResizeObserver.disconnect();
      systemBannerResizeObserver = null;
    }

    document.documentElement.style.removeProperty('--rahma-system-banner-offset');
    document.documentElement.style.removeProperty('--rahma-base-body-padding');
    delete document.body.dataset.rahmaBannerVisible;
    delete document.body.dataset.rahmaBasePadding;
    document.body.style.paddingTop = '';
  };

  */
  function getRuntimeText(value, fallback = '') {
    if (typeof value !== 'string') return fallback;
    const trimmed = normalizeLegacyRuntimeText(value.trim());
    return trimmed || repairLegacyMojibakeText(fallback);
  }

  window.getRuntimeText = getRuntimeText;
  const SITE_TITLE_SUFFIX = 'الرحمة المهداه للتوظيف';

  const syncSystemBanner = () => {};

  const formatMaintenanceDateTime = (value) => {
    if (!value) return '';

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);

    try {
      return new Intl.DateTimeFormat('ar-EG', {
        dateStyle: 'full',
        timeStyle: 'short',
        hour12: true,
      }).format(date);
    } catch (error) {
      return date.toLocaleString('ar-EG', { hour12: true });
    }
  };

  const ensureMaintenanceShell = () => {
    let shell = document.getElementById(MAINTENANCE_SHELL_ID);
    if (shell) return shell;

    shell = document.createElement('section');
    shell.id = MAINTENANCE_SHELL_ID;
    shell.hidden = true;
    shell.setAttribute('aria-live', 'polite');
    shell.dataset.supportOpen = 'true';
    shell.innerHTML = `
      <div class="rahma-maintenance-shell__card">
        <div class="rahma-maintenance-shell__brandbar" aria-hidden="true">
          <span></span>
          <span></span>
        </div>
        <div class="rahma-maintenance-shell__body">
          <div class="rahma-maintenance-shell__hero">
            <div class="rahma-maintenance-shell__copy">
              <div class="rahma-maintenance-shell__brand">
                <div class="rahma-maintenance-shell__logo">
                  <img src="logo-mark.png" alt="الرحمة المهداه للتوظيف" />
                </div>
                <div class="rahma-maintenance-shell__brand-copy">
                  <span class="rahma-maintenance-shell__badge">صفحة الصيانة</span>
                  <h1 class="rahma-maintenance-shell__title">المنصة متوقفة مؤقتًا</h1>
                </div>
              </div>
              <p class="rahma-maintenance-shell__lead" data-maintenance-lead></p>
              <div class="rahma-maintenance-shell__grid">
                <div class="rahma-maintenance-shell__box">
                  <span>سبب الإيقاف</span>
                  <strong data-maintenance-reason></strong>
                </div>
                <div class="rahma-maintenance-shell__box">
                  <span>الموعد المتوقع للعودة</span>
                  <strong data-maintenance-until></strong>
                </div>
              </div>
              <div class="rahma-maintenance-shell__actions">
                <button
                  type="button"
                  class="rahma-maintenance-shell__button"
                  data-maintenance-support-toggle
                  aria-controls="rahma-maintenance-shell-support"
                  aria-expanded="true"
                >
                  إخفاء بيانات الدعم
                </button>
              </div>
            </div>
          </div>
        </div>
        <section class="rahma-maintenance-shell__support" id="rahma-maintenance-shell-support" data-maintenance-support-panel aria-hidden="false">
          <div class="rahma-maintenance-shell__support-head">
            <div>
              <span class="rahma-maintenance-shell__support-badge">الدعم الفني</span>
              <h2 class="rahma-maintenance-shell__support-title">تواصل مباشر مع فريق الدعم أثناء الصيانة</h2>
              <p class="rahma-maintenance-shell__support-copy">اختر وسيلة التواصل المناسبة من هنا، وسيبقى هذا القسم ظاهرًا لتسهيل الوصول إلى الدعم الفني.</p>
            </div>
            <button type="button" class="rahma-maintenance-shell__support-close" data-maintenance-support-close>إخفاء الدعم</button>
          </div>
          <div class="rahma-maintenance-shell__support-grid">
            <div class="rahma-maintenance-shell__support-item">
              <span>رقم الدعم</span>
              <a data-support-phone href="#"></a>
            </div>
            <div class="rahma-maintenance-shell__support-item">
              <span>واتساب</span>
              <a data-support-whatsapp href="#"></a>
            </div>
            <div class="rahma-maintenance-shell__support-item" data-support-email-item>
              <span>البريد الإلكتروني</span>
              <a data-support-email href="#"></a>
            </div>
            <div class="rahma-maintenance-shell__support-item">
              <span>العنوان</span>
              <strong data-support-location></strong>
            </div>
            <div class="rahma-maintenance-shell__support-item">
              <span>ساعات العمل</span>
              <strong data-support-hours></strong>
            </div>
          </div>
          <div class="rahma-maintenance-shell__support-actions">
            <a class="rahma-maintenance-shell__support-button" data-support-call href="#">اتصال مباشر</a>
            <a class="rahma-maintenance-shell__support-button" data-support-whatsapp-direct href="#">فتح واتساب</a>
            <a class="rahma-maintenance-shell__support-button rahma-maintenance-shell__support-button--ghost" data-support-mail href="#" hidden>إرسال بريد</a>
          </div>
        </section>
      </div>
    `;
    shell.addEventListener('click', (event) => {
      const toggleButton = event.target.closest('[data-maintenance-support-toggle]');
      const closeButton = event.target.closest('[data-maintenance-support-close]');

      if (toggleButton) {
        event.preventDefault();
        shell.dataset.supportOpen = shell.dataset.supportOpen === 'true' ? 'false' : 'true';
        syncMaintenanceShell();
        const supportPanel = shell.querySelector('[data-maintenance-support-panel]');
        supportPanel?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        return;
      }

      if (closeButton) {
        event.preventDefault();
        shell.dataset.supportOpen = 'false';
        syncMaintenanceShell();
      }
    });
    document.body.prepend(shell);
    return shell;
  };

  const updateMaintenanceSupportPanel = (shell, runtimeContent, isOpen) => {
    const phoneText = window.getRuntimeText(runtimeContent.contactPhone, CONTACT_PHONE);
    const emailText = sanitizeHiddenContactEmail(window.getRuntimeText(runtimeContent.contactEmail, CONTACT_EMAIL));
    const locationText =
      window.getRuntimeText(runtimeContent.contactLocation, '') ||
      'سيتم مشاركة بيانات الموقع الرسمي مع فريق الدعم داخل المنصة.';
    const hoursText =
      window.getRuntimeText(runtimeContent.contactHours, '') ||
      'خلال مواعيد العمل الرسمية فقط.';

    const supportPanel = shell.querySelector('[data-maintenance-support-panel]');
    const supportToggle = shell.querySelector('[data-maintenance-support-toggle]');
    const supportPhone = shell.querySelector('[data-support-phone]');
    const supportWhatsapp = shell.querySelector('[data-support-whatsapp]');
    const supportEmailItem = shell.querySelector('[data-support-email-item]');
    const supportEmail = shell.querySelector('[data-support-email]');
    const supportLocation = shell.querySelector('[data-support-location]');
    const supportHours = shell.querySelector('[data-support-hours]');
    const supportCall = shell.querySelector('[data-support-call]');
    const supportWhatsappDirect = shell.querySelector('[data-support-whatsapp-direct]');
    const supportMail = shell.querySelector('[data-support-mail]');

    if (supportPanel instanceof HTMLElement) {
      supportPanel.setAttribute('aria-hidden', String(!isOpen));
    }

    if (supportToggle instanceof HTMLButtonElement) {
      supportToggle.textContent = isOpen ? 'إخفاء بيانات الدعم' : 'عرض بيانات الدعم';
    }

    const telHref = `tel:${normalizePhoneDigits(phoneText || CONTACT_PHONE)}`;
    const whatsappHref = buildWhatsAppMessageUrl(
      phoneText || CONTACT_PHONE,
      'السلام عليكم، أحتاج مساعدة أثناء فترة الصيانة.',
    );

    if (supportPhone instanceof HTMLAnchorElement) {
      supportPhone.textContent = phoneText || CONTACT_PHONE;
      supportPhone.href = telHref;
    }

    if (supportWhatsapp instanceof HTMLAnchorElement) {
      supportWhatsapp.textContent = phoneText || CONTACT_PHONE;
      supportWhatsapp.href = whatsappHref;
    }

    if (supportEmailItem instanceof HTMLElement) {
      supportEmailItem.hidden = !normalize(emailText);
    }

    if (supportEmail instanceof HTMLAnchorElement) {
      supportEmail.textContent = emailText || '';
      supportEmail.href = normalize(emailText)
        ? `mailto:${emailText}?subject=${encodeURIComponent('طلب دعم أثناء الصيانة')}&body=${encodeURIComponent(
            'السلام عليكم، أحتاج مساعدة بخصوص المنصة أثناء فترة الصيانة.',
          )}`
        : '#';
    }

    if (supportLocation instanceof HTMLElement) {
      supportLocation.textContent = locationText;
    }

    if (supportHours instanceof HTMLElement) {
      supportHours.textContent = hoursText;
    }

    if (supportCall instanceof HTMLAnchorElement) {
      supportCall.href = telHref;
    }

    if (supportWhatsappDirect instanceof HTMLAnchorElement) {
      supportWhatsappDirect.href = whatsappHref;
    }

    if (supportMail instanceof HTMLAnchorElement) {
      supportMail.hidden = !normalize(emailText);
    }
  };

  const syncMaintenanceShell = () => {
    const runtimeSettings = getAdminRuntimeSettings();
    const runtimeContent = getAdminRuntimeContent();
    const shell = ensureMaintenanceShell();
    const active = Boolean(runtimeSettings.maintenanceMode);

    if (!active) {
      shell.hidden = true;
      shell.dataset.visible = 'false';
      shell.dataset.supportOpen = 'false';
      delete document.documentElement.dataset.maintenanceMode;
      return;
    }

    const wasHidden = shell.hidden;
    const leadNode = shell.querySelector('[data-maintenance-lead]');
    const reasonNode = shell.querySelector('[data-maintenance-reason]');
    const untilNode = shell.querySelector('[data-maintenance-until]');
    const reasonText =
      window.getRuntimeText(runtimeSettings.maintenanceReason, '') ||
      window.getRuntimeText(runtimeSettings.systemMessage, '') ||
      'جاري إيقاف المنصة مؤقتًا لأعمال التحديث والصيانة.';
    const untilText = formatMaintenanceDateTime(runtimeSettings.maintenanceUntil) || 'سيتم الإعلان عن الموعد لاحقًا';

    shell.hidden = false;
    shell.dataset.visible = 'true';
    if (wasHidden || !shell.dataset.supportOpen) {
      shell.dataset.supportOpen = 'true';
    }
    document.documentElement.dataset.maintenanceMode = 'true';

    if (leadNode) {
      leadNode.textContent = 'سيتم إظهار البيانات مرة أخرى بعد انتهاء الصيانة.';
    }

    if (reasonNode) {
      reasonNode.textContent = reasonText;
    }

    if (untilNode) {
      untilNode.textContent = untilText;
    }

    updateMaintenanceSupportPanel(shell, runtimeContent, shell.dataset.supportOpen === 'true');
  };

  const updateFaqVisibility = () => {
    const searchInput = document.querySelector('[data-faq-search]');
    const emptyState = document.querySelector('[data-faq-empty]');
    const sections = Array.from(document.querySelectorAll('[data-faq-section]'));
    const query = normalize(searchInput?.value || '');
    let visibleItems = 0;

    sections.forEach((section) => {
      const sectionCategory = section.dataset.faqSection || 'account';
      const items = Array.from(section.querySelectorAll('[data-faq-item]'));
      let sectionVisible = false;

      items.forEach((item) => {
        const matchesCategory = faqActiveCategory === 'all' || faqActiveCategory === sectionCategory;
        const matchesQuery = !query || normalize(item.textContent).includes(query);
        const isVisible = matchesCategory && matchesQuery;
        item.hidden = !isVisible;

        if (isVisible) {
          sectionVisible = true;
          visibleItems += 1;
        }
      });

      section.hidden = !sectionVisible;
    });

    if (emptyState) {
      emptyState.classList.toggle('hidden', visibleItems > 0);
    }
  };

  const renderFaqPage = () => {
    if (!window.location.pathname.endsWith('faq.html')) return;

    const runtimeContent = getAdminRuntimeContent();
    const heroTitle = document.querySelector('[data-faq-hero-title]');
    const heroSubtitle = document.querySelector('[data-faq-hero-subtitle]');
    const categoryButtons = Array.from(document.querySelectorAll('[data-faq-category]'));
    const faqData = Array.isArray(runtimeContent.faqItems)
      ? runtimeContent.faqItems
      : DEFAULT_PUBLIC_FAQ_ITEMS;
    const normalizeFaqCategory = (value) => {
      const category = normalize(value);
      if (category === 'companies' || category === 'support') return category;
      return 'account';
    };
    const hasFaqContent = (item) =>
      Boolean(String(item?.question || '').trim()) || Boolean(String(item?.answer || '').trim());
    const groupedFaq = {
      account: faqData.filter((item) => normalizeFaqCategory(item?.category) === 'account' && hasFaqContent(item)),
      companies: faqData.filter((item) => normalizeFaqCategory(item?.category) === 'companies' && hasFaqContent(item)),
      support: faqData.filter((item) => normalizeFaqCategory(item?.category) === 'support' && hasFaqContent(item)),
    };
    const firstAvailableCategory = ['account', 'companies', 'support'].find((category) => (groupedFaq[category] || []).length > 0);
    faqActiveCategory = firstAvailableCategory || 'account';

    if (heroTitle && window.getRuntimeText(runtimeContent.faqHeroTitle, '')) {
      heroTitle.textContent = window.getRuntimeText(runtimeContent.faqHeroTitle, heroTitle.textContent);
    }

    if (heroSubtitle && window.getRuntimeText(runtimeContent.faqHeroSubtitle, '')) {
      heroSubtitle.textContent = window.getRuntimeText(runtimeContent.faqHeroSubtitle, heroSubtitle.textContent);
    }

    Object.entries(FAQ_CATEGORY_CONFIG).forEach(([category, config]) => {
      const section = document.querySelector(`[data-faq-section="${category}"]`);
      const categoryButton = document.querySelector(`[data-faq-category="${category}"]`);
      const titleNode = document.querySelector(`[data-faq-section-title="${category}"]`);
      const descriptionNode = document.querySelector(`[data-faq-section-description="${category}"]`);
      const itemsRoot = document.querySelector(`[data-faq-items="${category}"]`);
      const items = groupedFaq[category] || [];
      const titleValue = window.getRuntimeText(runtimeContent[config.titleKey], config.fallbackTitle);
      const descriptionValue = window.getRuntimeText(runtimeContent[config.descriptionKey], config.fallbackDescription);

      if (categoryButton) {
        const categoryTitleNode = categoryButton.querySelector(`[data-faq-category-title="${category}"]`);
        const categoryDescriptionNode = categoryButton.querySelector(`[data-faq-category-description="${category}"]`);
        if (categoryTitleNode) categoryTitleNode.textContent = titleValue;
        if (categoryDescriptionNode) categoryDescriptionNode.textContent = descriptionValue;
      }

      if (titleNode) titleNode.textContent = titleValue;
      if (descriptionNode) descriptionNode.textContent = descriptionValue;
      if (!itemsRoot) return;

      if (!items.length) {
        itemsRoot.innerHTML = `
          <div class="rounded-2xl border border-dashed border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40 px-5 py-6 text-sm text-slate-500 dark:text-slate-400">
            لا توجد أسئلة مضافة لهذا القسم بعد. أضف عنصرًا جديدًا من لوحة المحتوى.
          </div>`;
        if (section) section.hidden = false;
        return;
      }

      itemsRoot.innerHTML = items
        .map((item, index) => {
          const question = escapeHtml(window.getRuntimeText(item.question, ''));
          const answer = escapeHtml(window.getRuntimeText(item.answer, ''));
          const isOpen = index === 0 ? ' open=""' : '';
          return `
            <details class="group bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm" data-faq-item data-faq-category="${escapeHtml(category)}"${isOpen}>
              <summary class="flex items-center justify-between p-6 cursor-pointer list-none">
                <span class="text-lg font-bold text-slate-800 dark:text-slate-100">${question}</span>
                <span class="material-symbols-outlined transition-transform duration-300 group-open:rotate-180 text-primary">expand_more</span>
              </summary>
              <div class="px-6 pb-6 text-slate-600 dark:text-slate-400 leading-relaxed">
                <p>${answer}</p>
              </div>
            </details>`;
        })
        .join('');
    });

    const searchInput = document.querySelector('[data-faq-search]');
    const searchButton = document.querySelector('[data-faq-search-btn]');
    const categoryButtonsForState = Array.from(document.querySelectorAll('[data-faq-category]'));

    const setButtonState = (button, isActive) => {
      button.style.opacity = isActive ? '1' : '0.72';
      button.style.transform = isActive ? 'translateY(-2px)' : '';
      button.style.boxShadow = isActive ? '0 20px 36px rgba(37, 99, 235, 0.12)' : '';
    };

    categoryButtonsForState.forEach((button) => {
      const isActive = button.dataset.faqCategory === faqActiveCategory;
      button.setAttribute('aria-pressed', String(isActive));
      setButtonState(button, isActive);
      button.onclick = () => {
        faqActiveCategory = button.dataset.faqCategory || 'all';
        categoryButtonsForState.forEach((item) => {
          const active = item.dataset.faqCategory === faqActiveCategory;
          item.setAttribute('aria-pressed', String(active));
          setButtonState(item, active);
        });
        updateFaqVisibility();
        document.querySelector('main')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      };
    });

    if (searchInput) {
      searchInput.oninput = updateFaqVisibility;
    }

    if (searchButton) {
      searchButton.onclick = updateFaqVisibility;
    }

    updateFaqVisibility();
    document.title = 'الأسئلة الشائعة | الرحمة المهداه للتوظيف';
  };

  const renderStaticPageContent = () => {
    const content = getAdminRuntimeContent();

    const pageConfigs = [
      {
        path: 'about.html',
        pageTitle: 'من نحن',
        titleKey: 'aboutHeroTitle',
        subtitleKey: 'aboutHeroSubtitle',
        titleSelector: '[data-about-hero-title]',
        subtitleSelector: '[data-about-hero-subtitle]',
        extra: [
          ['[data-about-overview-title]', content.aboutOverviewTitle],
          ['[data-about-overview-text]', content.aboutOverviewText],
          ['[data-about-process-title]', content.aboutProcessTitle],
          ['[data-about-process-text]', content.aboutProcessText],
          ['[data-about-cta-heading]', content.aboutCTAHeading],
          ['[data-about-cta-text]', content.aboutCTAText],
        ],
      },
      {
        path: 'contact.html',
        pageTitle: 'تواصل معنا',
        titleKey: 'contactHeroTitle',
        subtitleKey: 'contactHeroSubtitle',
        titleSelector: '[data-contact-hero-title]',
        subtitleSelector: '[data-contact-hero-subtitle]',
        extra: [
          ['[data-contact-intro-text]', content.contactIntroText],
          ['[data-contact-phone]', content.contactPhone],
          ['[data-contact-email]', content.contactEmail],
          ['[data-contact-location]', content.contactLocation],
          ['[data-contact-hours]', content.contactHours],
        ],
      },
      {
        path: 'privacy.html',
        pageTitle: 'سياسة الخصوصية',
        titleKey: 'privacyHeroTitle',
        subtitleKey: 'privacyHeroSubtitle',
        titleSelector: '[data-privacy-hero-title]',
        subtitleSelector: '[data-privacy-hero-subtitle]',
        extra: [['[data-privacy-intro-text]', content.privacyIntroText]],
      },
      {
        path: 'terms.html',
        pageTitle: 'الشروط والأحكام',
        titleKey: 'termsHeroTitle',
        subtitleKey: 'termsHeroSubtitle',
        titleSelector: '[data-terms-hero-title]',
        subtitleSelector: '[data-terms-hero-subtitle]',
        extra: [['[data-terms-intro-text]', content.termsIntroText]],
      },
    ];

    pageConfigs.forEach((config) => {
      if (!window.location.pathname.endsWith(config.path)) return;

      const titleNode = document.querySelector(config.titleSelector);
      const subtitleNode = document.querySelector(config.subtitleSelector);
      const titleValue = window.getRuntimeText(content[config.titleKey], titleNode?.textContent || '');
      const subtitleValue = window.getRuntimeText(content[config.subtitleKey], subtitleNode?.textContent || '');

      if (titleNode) titleNode.textContent = titleValue;
      if (subtitleNode) subtitleNode.textContent = subtitleValue;
      config.extra.forEach(([selector, value]) => {
        const node = document.querySelector(selector);
        if (node && typeof value === 'string' && value.trim()) {
          node.textContent = window.getRuntimeText(value, node.textContent || '');
        }
      });

      if (config.path === 'contact.html') {
        const phoneNode = document.querySelector('[data-contact-phone]');
        const emailNode = document.querySelector('[data-contact-email]');
        const emailItem = document.querySelector('[data-contact-email-item]');
        const mapLink = document.querySelector('[data-map-link]');
        const whatsappLink = document.querySelector('[data-whatsapp-link]');
        const emailLink = document.querySelector('[data-email-link]');
        const phoneText = window.getRuntimeText(content.contactPhone, CONTACT_PHONE);
        const emailText = sanitizeHiddenContactEmail(window.getRuntimeText(content.contactEmail, CONTACT_EMAIL));

        if (phoneNode) {
          phoneNode.textContent = phoneText;
          if (phoneNode instanceof HTMLAnchorElement) {
            phoneNode.href = buildWhatsAppUrl(phoneText);
          }
        }

        if (emailItem instanceof HTMLElement) {
          emailItem.hidden = !normalize(emailText);
        }

        if (emailNode) {
          if (normalize(emailText)) {
            emailNode.textContent = emailText;
            if (emailNode instanceof HTMLAnchorElement) {
              emailNode.href = `mailto:${emailText}`;
            }
          } else {
            emailNode.textContent = '';
          }
        }

        if (whatsappLink instanceof HTMLAnchorElement) {
          whatsappLink.href = buildWhatsAppUrl(phoneText);
        }

        if (emailLink instanceof HTMLAnchorElement && normalize(emailText)) {
          emailLink.href = `mailto:${emailText}`;
        }

        if (mapLink instanceof HTMLAnchorElement) {
          mapLink.href = CONTACT_MAP_URL;
        }
      }

      document.title = `${normalizeLegacyRuntimeText(config.pageTitle)} | ${SITE_TITLE_SUFFIX}`;
    });
  };

  const renderPublicJobsPage = () => {
    if (!window.location.pathname.endsWith('jobs.html')) return;

    const grid = document.querySelector('[data-jobs-grid]');
    const emptyState = document.querySelector('[data-jobs-empty]');
    const countNode = document.querySelector('[data-jobs-count]');
    if (!grid) return;

    const publicCompanies = getPublicRuntimeCompanies();
    const companyImages = new Map(publicCompanies.map((company) => [normalize(company?.name), resolvePublicCompanyImage(company)]));
    const approvedJobs = collectApprovedJobsForPublicListing();

    const getTypeClass = (type) => {
      const normalizedType = normalize(type);
      if (normalizedType.includes('عن بعد')) {
        return 'listing-job-card__type listing-job-card__type--sky';
      }
      if (normalizedType.includes('عقد') || normalizedType.includes('مؤقت')) {
        return 'listing-job-card__type listing-job-card__type--amber';
      }
      return 'listing-job-card__type';
    };

    grid.innerHTML = approvedJobs
      .map((job) => {
        const jobData = {
            jobId: String(job.id || '').trim(),
            jobTitle: String(job.title || '').trim(),
            jobCompany: String(job.companyName || '').trim(),
            jobLocation: String(job.location || '').trim(),
          jobType: String(job.type || '').trim(),
          jobSalary: String(job.salary || '').trim(),
          jobPosted: String(job.postedLabel || '').trim(),
          jobSummary: String(job.summary || '').trim(),
          jobSector: String(job.sector || '').trim(),
          jobFeatured: Boolean(job.featured),
        };
        const demandMeta = getJobDemandStatusMeta(job);
        const companyImage = companyImages.get(normalize(job.companyName)) || COMPANY_PLACEHOLDER_IMAGE;
        const jobDetailsUrl = buildJobDetailsUrl(jobData);
        const applyJobUrl = buildApplyUrl(jobData);
        const applyDisabledAttributes = demandMeta.filled
          ? `aria-disabled="true" data-disabled-message="اكتمل العدد المطلوب لهذه الوظيفة أو تم إغلاق التقديم عليها."`
          : '';

          return `
            <article
              class="page-card listing-job-card job-card"
              data-job-id="${escapeHtml(jobData.jobId)}"
              data-job-title="${escapeHtml(jobData.jobTitle)}"
              data-job-company="${escapeHtml(jobData.jobCompany)}"
              data-job-location="${escapeHtml(jobData.jobLocation)}"
              data-job-type="${escapeHtml(jobData.jobType)}"
              data-job-salary="${escapeHtml(jobData.jobSalary)}"
              data-job-posted="${escapeHtml(jobData.jobPosted)}"
              data-job-summary="${escapeHtml(jobData.jobSummary)}"
              data-job-sector="${escapeHtml(jobData.jobSector)}"
              data-job-featured="${jobData.jobFeatured ? 'true' : 'false'}"
              data-job-company-image="${escapeHtml(companyImage)}"
              data-job-positions="${escapeHtml(String(demandMeta.positionsCount))}"
              data-job-applicants="${escapeHtml(String(demandMeta.applicantsCount))}"
              data-job-remaining="${escapeHtml(String(demandMeta.remainingCount))}"
              data-job-filled="${demandMeta.filled ? 'true' : 'false'}"
            >
            <div class="listing-job-card__top">
              <span class="listing-job-card__logo">
                <img src="${escapeHtml(companyImage)}" alt="شعار ${escapeHtml(jobData.jobCompany || 'الشركة')}"/>
              </span>
              <div class="listing-job-card__top-badges">
                ${jobData.jobFeatured ? '<span class="listing-job-card__featured">وظيفة مميزة</span>' : ''}
                <span class="${getTypeClass(jobData.jobType)}">${escapeHtml(jobData.jobType || 'غير محدد')}</span>
              </div>
            </div>

            <div>
              <h3>${escapeHtml(jobData.jobTitle || 'وظيفة بدون عنوان')}</h3>
              <p class="listing-job-card__company">${escapeHtml(jobData.jobCompany || 'شركة غير محددة')}</p>
            </div>

            <div class="listing-job-card__tags">
              <span>${escapeHtml(jobData.jobLocation || 'الموقع غير مضاف')}</span>
              <span>${escapeHtml(jobData.jobSector || 'القطاع غير مضاف')}</span>
              <span>${escapeHtml(jobData.jobSalary || 'الراتب غير مضاف')}</span>
            </div>

            <p class="listing-job-card__summary">
              ${escapeHtml(jobData.jobSummary || 'لا يوجد وصف مضاف لهذه الوظيفة حتى الآن.')}
            </p>

            <div class="listing-job-card__demand">
              <span class="listing-job-card__demand-chip">
                <strong>${escapeHtml(String(demandMeta.positionsCount))}</strong>
                <small>مطلوب</small>
              </span>
              <span class="listing-job-card__demand-chip ${demandMeta.filled ? 'listing-job-card__demand-chip--filled' : ''}">
                <strong>${escapeHtml(demandMeta.filled ? 'اكتمل العدد' : `باقي ${demandMeta.remainingCount}`)}</strong>
                <small>${escapeHtml(`${demandMeta.applicantsCount} متقدم`)}</small>
              </span>
            </div>

            <div class="listing-job-card__footer">
              <span class="listing-job-card__time">${escapeHtml(jobData.jobPosted || 'حديثًا')}</span>
              <div class="listing-job-card__actions">
                <a
                  href="${escapeHtml(applyJobUrl)}"
                  class="listing-job-card__primary"
                  data-apply-job
                  aria-label="قدّم الآن على ${escapeHtml(jobData.jobTitle || 'الوظيفة')}"
                  data-job-title="${escapeHtml(jobData.jobTitle)}"
                  data-job-company="${escapeHtml(jobData.jobCompany)}"
                  data-job-location="${escapeHtml(jobData.jobLocation)}"
                  data-job-type="${escapeHtml(jobData.jobType)}"
                  data-job-salary="${escapeHtml(jobData.jobSalary)}"
                  data-job-posted="${escapeHtml(jobData.jobPosted)}"
                  data-job-summary="${escapeHtml(jobData.jobSummary)}"
                  data-job-sector="${escapeHtml(jobData.jobSector)}"
                  data-job-featured="${jobData.jobFeatured ? 'true' : 'false'}"
                  data-job-id="${escapeHtml(jobData.jobId)}"
                  ${applyDisabledAttributes}
                >
                  ${demandMeta.filled ? 'اكتمل العدد المطلوب' : 'قدّم الآن'}
                </a>
                <a
                  href="${escapeHtml(jobDetailsUrl)}"
                  class="listing-job-card__secondary"
                  data-job-details
                  data-job-title="${escapeHtml(jobData.jobTitle)}"
                  data-job-company="${escapeHtml(jobData.jobCompany)}"
                  data-job-location="${escapeHtml(jobData.jobLocation)}"
                  data-job-type="${escapeHtml(jobData.jobType)}"
                  data-job-salary="${escapeHtml(jobData.jobSalary)}"
                  data-job-posted="${escapeHtml(jobData.jobPosted)}"
                  data-job-summary="${escapeHtml(jobData.jobSummary)}"
                  data-job-sector="${escapeHtml(jobData.jobSector)}"
                  data-job-featured="${jobData.jobFeatured ? 'true' : 'false'}"
                  data-job-id="${escapeHtml(jobData.jobId)}"
                >
                  التفاصيل
                </a>
              </div>
            </div>
          </article>
        `;
      })
      .join('');

    if (countNode) {
      countNode.textContent = `${approvedJobs.length} ${approvedJobs.length === 1 ? 'وظيفة متاحة' : 'وظائف متاحة'}`;
    }

    if (emptyState) {
      emptyState.classList.toggle('hidden', approvedJobs.length !== 0);
      emptyState.toggleAttribute('hidden', approvedJobs.length !== 0);
    }

    const renderedCards = Array.from(grid.querySelectorAll('.job-card'));
    syncJobsCoverflow(renderedCards);
    initPublicExperienceEnhancements(grid);
    requestPublicMotionRefresh();
    refreshPublicJobsListingFilters();
  };

  const renderPublicCompaniesPage = () => {
    if (!window.location.pathname.endsWith('companies.html')) return;

    const grid = document.querySelector('[data-companies-grid]');
    const emptyState = document.querySelector('[data-companies-empty]');
    const countNode = document.querySelector('[data-companies-count]');
    if (!grid) return;

    const approvedCompanies = getPublicRuntimeCompanies().filter(
      (company) =>
        normalize(company?.name),
    );

    grid.innerHTML = approvedCompanies
      .map((company) => {
        const companyData = {
            companyId: String(company.id || '').trim(),
            companyName: String(company.name || '').trim(),
            companySector: String(company.sector || '').trim(),
            companyLocation: String(company.location || '').trim(),
          companyOpenings: String(company.openings ?? '').trim(),
          companyStatus: String(company.status || '').trim(),
          companySummary: String(company.summary || '').trim(),
          companyImage: resolvePublicCompanyImage(company),
        };
        const openingsLabel = Number.parseInt(companyData.companyOpenings || '0', 10);
        const statusLabel =
          normalize(companyData.companyStatus) === 'approved'
            ? 'نشطة'
            : normalize(companyData.companyStatus) === 'pending'
              ? 'قيد المراجعة'
              : normalize(companyData.companyStatus) === 'restricted'
                ? 'مقيدة'
                : normalize(companyData.companyStatus) === 'archived'
                  ? 'مؤرشفة'
                  : companyData.companyStatus || 'غير محددة';
          return `
            <article class="page-card directory-company-card company-card" data-company-id="${escapeHtml(companyData.companyId)}">
              <div class="directory-company-card__top">
              <span class="directory-company-card__logo directory-company-card__logo--image">
                <img src="${escapeHtml(companyData.companyImage)}" alt="صورة ${escapeHtml(companyData.companyName || 'الشركة')}"/>
              </span>
              <div class="directory-company-card__meta">
                <h3>${escapeHtml(companyData.companyName || 'شركة')}</h3>
                <p>${escapeHtml(companyData.companySector || 'قطاع غير محدد')}</p>
              </div>
              <span class="request-chip">
                ${Number.isFinite(openingsLabel) && openingsLabel > 0 ? `${openingsLabel} وظيفة` : 'بدون وظائف حالية'}
              </span>
            </div>

            <p class="directory-company-card__summary">
              ${escapeHtml(companyData.companySummary || 'لا توجد نبذة مضافة لهذه الشركة حتى الآن.')}
            </p>

            <div class="directory-company-card__facts">
              <span>${escapeHtml(companyData.companyLocation || 'الموقع غير مضاف')}</span>
              <span>${escapeHtml(statusLabel)}</span>
            </div>

              <div class="directory-company-card__actions">
                <button
                  type="button"
                  class="site-action site-action--secondary"
                  data-company-details
                  data-company-id="${escapeHtml(companyData.companyId)}"
                  data-company-name="${escapeHtml(companyData.companyName)}"
                data-company-sector="${escapeHtml(companyData.companySector)}"
                data-company-location="${escapeHtml(companyData.companyLocation)}"
                data-company-openings="${escapeHtml(companyData.companyOpenings || '0')}"
                data-company-status="${escapeHtml(statusLabel)}"
                data-company-summary="${escapeHtml(companyData.companySummary)}"
                data-company-image="${escapeHtml(companyData.companyImage)}"
              >
                التفاصيل
              </button>
              <a class="site-action site-action--ghost" href="${escapeHtml(buildJobsUrl({ keyword: companyData.companyName }))}">
                الوظائف المرتبطة
              </a>
            </div>
          </article>
        `;
      })
      .join('');

    if (countNode) {
      countNode.textContent = `${approvedCompanies.length} ${approvedCompanies.length === 1 ? 'شركة' : 'شركات'}`;
    }

    if (emptyState) {
      emptyState.classList.toggle('hidden', approvedCompanies.length !== 0);
      emptyState.toggleAttribute('hidden', approvedCompanies.length !== 0);
    }

    initPublicExperienceEnhancements(grid);
    requestPublicMotionRefresh();
  };

  const initJobsSearch = () => {
    const keywordInput = document.querySelector('[data-jobs-keyword]');
    const button = document.querySelector('[data-search-action="jobs"]');
    const searchForm = document.querySelector('[data-jobs-search-form]');
    const grid = document.querySelector('[data-jobs-grid]');
    const count = document.querySelector('[data-jobs-count]');
    const empty = document.querySelector('[data-jobs-empty]');
    const paginationRoot = document.querySelector('[data-jobs-pagination]');

    if (!keywordInput || !button || !grid) return;

    const params = new URLSearchParams(window.location.search);
    const legacyLocationMeta = getSearchLocationMeta(params.get('location'));
    const pageSize = 3;
    let currentPage = Number.parseInt(params.get('page') || '1', 10);

    if (!Number.isFinite(currentPage) || currentPage < 1) {
      currentPage = 1;
    }

    if (params.has('q')) {
      keywordInput.value = params.get('q');
    } else if (params.get('governorate')) {
      keywordInput.value = params.get('governorate');
    } else if (legacyLocationMeta.governorate) {
      keywordInput.value = legacyLocationMeta.governorate;
    }

    let inputFilterFrame = null;
    const scheduleFilterFromInput = () => {
      if (inputFilterFrame !== null) {
        cancelAnimationFrame(inputFilterFrame);
      }
      inputFilterFrame = requestAnimationFrame(() => {
        inputFilterFrame = null;
        applyFilters();
      });
    };

    const applyFilters = ({ page, preservePage = false } = {}) => {
      if (Number.isFinite(page)) {
        currentPage = page;
      } else if (!preservePage) {
        currentPage = 1;
      }

      const cards = Array.from(grid.querySelectorAll('.job-card'));
      const runtimeJobs = getAdminRuntimeJobs();
      const matchedCards = [];

      cards.forEach((card) => {
        const title = normalize(card.dataset.jobTitle || card.querySelector('h3, h4')?.textContent);
        const company = normalize(card.dataset.jobCompany || card.querySelector('p.text-sm, p.text-gray-500')?.textContent);
        const locationText =
          card.dataset.jobLocation ||
          Array.from(card.querySelectorAll('.flex.flex-wrap.gap-2.mb-4 span, .flex.gap-3.mb-10 span'))
            .map((item) => item.textContent)
            .join(' ');
        const locationMeta = getSearchLocationMeta(locationText);
        const haystack = normalize(card.textContent);
        const runtimeJob = runtimeJobs.find(
          (job) => normalize(job?.title) === title && normalize(job?.companyName) === company,
        );
        const blockedByAdmin = runtimeJob && (runtimeJob.deletedAt || normalize(runtimeJob.status) !== 'approved');

        if (blockedByAdmin) {
          return;
        }

        const matchesKeyword = matchesSearchQuery(
          keywordInput.value,
          title,
          company,
          locationText,
          locationMeta.raw,
          locationMeta.governorate,
          card.dataset.jobType,
          card.dataset.jobSalary,
          card.dataset.jobSector,
          card.dataset.jobSummary,
          haystack,
        );

        if (matchesKeyword) {
          matchedCards.push(card);
        }
      });

      const visibleCount = matchedCards.length;
      const totalPages = Math.max(1, Math.ceil(visibleCount / pageSize));

      if (currentPage > totalPages) {
        currentPage = totalPages;
      }

      const startIndex = (currentPage - 1) * pageSize;
      const paginatedCards = new Set(matchedCards.slice(startIndex, startIndex + pageSize));

      cards.forEach((card) => {
        card.style.display = paginatedCards.has(card) ? '' : 'none';
      });

      syncJobsCoverflow(matchedCards);

      if (count) {
        count.textContent = `${visibleCount} ${visibleCount === 1 ? 'وظيفة متاحة' : 'وظائف متاحة'}`;
      }

      if (empty) {
        empty.classList.toggle('hidden', visibleCount !== 0);
        empty.toggleAttribute('hidden', visibleCount !== 0);
      }

      renderPagination({
        root: paginationRoot,
        currentPage,
        totalPages,
        onPageChange: (nextPage) => applyFilters({ page: nextPage, preservePage: true }),
        activeClasses: 'w-10 h-10 rounded-full bg-brand-blue text-white font-bold',
        inactiveClasses:
          'w-10 h-10 rounded-full border border-gray-200 text-gray-600 hover:border-brand-blue hover:text-brand-blue font-bold',
      });

      window.history.replaceState(
        {},
        '',
        appendQueryParams(
          buildJobsUrl({
            keyword: keywordInput.value,
          }),
          {
            page: totalPages > 1 && currentPage > 1 ? String(currentPage) : null,
          }
        )
      );
    };

    refreshPublicJobsListingFilters = () => applyFilters({ preservePage: true });

    button.addEventListener('click', (event) => {
      event.preventDefault();
      applyFilters();
    });

    if (searchForm) {
      searchForm.addEventListener('submit', (event) => {
        event.preventDefault();
        applyFilters();
      });
    }

    [keywordInput].forEach((input) => {
      input.addEventListener('input', scheduleFilterFromInput);
      input.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          if (inputFilterFrame !== null) {
            cancelAnimationFrame(inputFilterFrame);
            inputFilterFrame = null;
          }
          applyFilters();
        }
      });
    });

    applyFilters({ preservePage: true });
  };

  const initMobileMenus = () => {
    const toggles = Array.from(document.querySelectorAll('[data-mobile-menu-toggle]'));
    const menus = Array.from(document.querySelectorAll('[data-mobile-menu]'));

    if (!toggles.length || !menus.length) return;

    const closeMenu = (menu) => {
      if (!menu) return;
      menu.classList.add('hidden');
      const menuId = menu.id || '';
      const togglesForMenu = toggles.filter((toggle) => toggle.getAttribute('aria-controls') === menuId);
      togglesForMenu.forEach((toggle) => toggle.setAttribute('aria-expanded', 'false'));
      document.body.classList.remove('overflow-hidden');
    };

    const openMenu = (menu) => {
      if (!menu) return;
      menus.forEach((item) => {
        if (item !== menu) closeMenu(item);
      });
      menu.classList.remove('hidden');
      const menuId = menu.id || '';
      const togglesForMenu = toggles.filter((toggle) => toggle.getAttribute('aria-controls') === menuId);
      togglesForMenu.forEach((toggle) => toggle.setAttribute('aria-expanded', 'true'));
      document.body.classList.add('overflow-hidden');
    };

    toggles.forEach((toggle) => {
      const menuId = toggle.getAttribute('aria-controls') || toggle.dataset.mobileMenuToggle;
      const menu = menuId ? document.getElementById(menuId) : null;

      if (!menu) return;

      toggle.addEventListener('click', () => {
        const isHidden = menu.classList.contains('hidden');
        if (isHidden) {
          openMenu(menu);
          return;
        }

        closeMenu(menu);
      });
    });

    menus.forEach((menu) => {
      menu.addEventListener('click', (event) => {
        if (event.target.closest('[data-mobile-menu-close]') || event.target.closest('a')) {
          closeMenu(menu);
        }
      });
    });

    document.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape') return;
      menus.forEach((menu) => closeMenu(menu));
    });
  };

  const initCompaniesPagination = () => {
    if (!window.location.pathname.endsWith('companies.html')) return;

    const cards = Array.from(document.querySelectorAll('.company-card'));
    const runtimeCompanies = getAdminRuntimeCompanies();
    const paginationRoot = document.querySelector('[data-companies-pagination]');
    const searchInput = document.querySelector('[data-companies-search]');
    const sectorInput = document.querySelector('[data-companies-sector]');
    const locationInput = document.querySelector('[data-companies-location]');
    const filterButton = document.querySelector('[data-companies-filter]');
    const emptyState = document.querySelector('[data-companies-empty]');
    const countNode = document.querySelector('[data-companies-count]');

    if (!cards.length || !paginationRoot || !searchInput || !sectorInput || !locationInput || !filterButton) return;

    const params = new URLSearchParams(window.location.search);
    const pageSize = Math.max(1, Number.parseInt(paginationRoot.dataset.pageSize || '6', 10) || 6);
    let currentPage = Number.parseInt(params.get('page') || '1', 10);

    if (!Number.isFinite(currentPage) || currentPage < 1) {
      currentPage = 1;
    }

    if (params.has('q')) searchInput.value = params.get('q');
    if (params.has('sector') && normalize(params.get('sector')) && normalize(params.get('sector')) !== 'كل القطاعات') {
      sectorInput.value = params.get('sector');
    }
    if (params.has('location') && normalize(params.get('location')) && normalize(params.get('location')) !== 'كل المدن') {
      locationInput.value = params.get('location');
    }

    const normalizeFilterValue = (value) => {
      const normalized = normalize(value);
      if (!normalized) return '';
      if (normalized === 'كل القطاعات' || normalized === 'كل المدن') return '';
      return normalized;
    };

    const getCardMeta = (card) => {
      const button = card.querySelector('[data-company-details]');
      const title = normalize(card.querySelector('h3')?.textContent);
      const sector = normalize(button?.dataset.companySector || card.querySelector('.mb-4 span')?.textContent);
      const location = normalize(button?.dataset.companyLocation || '');
      const summary = normalize(button?.dataset.companySummary || card.textContent);
      const haystack = normalize(card.textContent);

      return { title, sector, location, summary, haystack };
    };

    const getFilteredCards = () => {
      const keyword = normalize(searchInput.value);
      const sector = normalizeFilterValue(sectorInput.value);
      const location = normalizeFilterValue(locationInput.value);

      return cards.filter((card) => {
        const meta = getCardMeta(card);
        const runtimeCompany = runtimeCompanies.find((company) => normalize(company?.name) === meta.title);
        const blockedByAdmin = runtimeCompany && (runtimeCompany.deletedAt || normalize(runtimeCompany.status) !== 'approved');
        if (blockedByAdmin) {
          return false;
        }
        const matchesKeyword =
          !keyword || meta.title.includes(keyword) || meta.summary.includes(keyword) || meta.haystack.includes(keyword);
        const matchesSector = !sector || meta.sector.includes(sector) || meta.haystack.includes(sector);
        const matchesLocation = !location || meta.location.includes(location) || meta.haystack.includes(location);
        return matchesKeyword && matchesSector && matchesLocation;
      });
    };

    const updateUrl = ({ page, preservePage = false } = {}) => {
      const keyword = searchInput.value.trim();
      const sector = normalizeFilterValue(sectorInput.value);
      const location = normalizeFilterValue(locationInput.value);

      window.history.replaceState(
        {},
        '',
        appendQueryParams(window.location.href, {
          q: keyword || null,
          sector: sector || null,
          location: location || null,
          page: preservePage && page && page > 1 ? String(page) : page && page > 1 ? String(page) : null,
        })
      );
    };

    const applyPagination = ({ page, preservePage = false } = {}) => {
      if (Number.isFinite(page)) {
        currentPage = page;
      } else if (!preservePage) {
        currentPage = 1;
      }

      const matchedCards = getFilteredCards();
      const totalPages = Math.max(1, Math.ceil(matchedCards.length / pageSize));

      if (currentPage > totalPages) {
        currentPage = totalPages;
      }

      const startIndex = (currentPage - 1) * pageSize;
      const visibleCards = new Set(matchedCards.slice(startIndex, startIndex + pageSize));

      cards.forEach((card) => {
        card.style.display = visibleCards.has(card) ? '' : 'none';
      });

      if (countNode) {
        countNode.textContent = `${matchedCards.length} ${matchedCards.length === 1 ? 'شركة' : 'شركات'}`;
      }

      if (emptyState) {
        emptyState.classList.toggle('hidden', matchedCards.length !== 0);
        emptyState.hidden = matchedCards.length !== 0;
      }

      renderPagination({
        root: paginationRoot,
        currentPage,
        totalPages,
        onPageChange: (nextPage) => applyPagination({ page: nextPage, preservePage: true }),
        activeClasses:
          'size-10 rounded-xl bg-primary text-white border border-primary flex items-center justify-center font-bold',
        inactiveClasses:
          'size-10 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-400 font-bold hover:border-primary hover:text-primary',
      });

      updateUrl({ page: currentPage, preservePage });
    };

    filterButton.addEventListener('click', () => applyPagination());

    [searchInput, sectorInput, locationInput].forEach((input) => {
      input.addEventListener('input', () => applyPagination());
      input.addEventListener('change', () => applyPagination());
      input.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          applyPagination();
        }
      });
    });

    applyPagination({ preservePage: true });
  };

  const initJobDetailsPage = () => {
    if (!window.location.pathname.endsWith('job-details.html')) return;

    const modernRoot = document.querySelector('[data-job-root]');
    if (modernRoot) {
      const params = new URLSearchParams(window.location.search);
      const runtimeJobs = getAdminRuntimeJobs();
      const requestedId = normalize(params.get('id') || params.get('jobId') || '');
      const runtimeRecord =
        runtimeJobs.find((job) => normalize(String(job?.id || job?.jobId || job?.requestId || '')) === requestedId) ||
        null;
      const featured = ['1', 'true', 'yes'].includes(normalize(params.get('featured')));
      const title =
        normalizeLegacyRuntimeText(
          runtimeRecord?.title ||
            runtimeRecord?.jobTitle ||
            params.get('title') ||
            document.querySelector('[data-job-title-text]')?.textContent?.trim() ||
            'تفاصيل الوظيفة',
        ) || 'تفاصيل الوظيفة';
      const company =
        normalizeLegacyRuntimeText(
          runtimeRecord?.companyName ||
            runtimeRecord?.jobCompany ||
            params.get('company') ||
            document.querySelector('[data-job-company-text]')?.textContent?.trim() ||
            'الشركة',
        ) || 'الشركة';
      const location =
        normalizeLegacyRuntimeText(
          runtimeRecord?.location ||
            runtimeRecord?.jobLocation ||
            params.get('location') ||
            document.querySelector('[data-job-location-text]')?.textContent?.trim() ||
            '',
        );
      const posted =
        normalizeLegacyRuntimeText(
          runtimeRecord?.postedLabel ||
            runtimeRecord?.jobPosted ||
            params.get('posted') ||
            document.querySelector('[data-job-posted-text]')?.textContent?.trim() ||
            '',
        );
      const type =
        normalizeLegacyRuntimeText(
          runtimeRecord?.type ||
            runtimeRecord?.jobType ||
            params.get('type') ||
            document.querySelector('[data-job-type-text]')?.textContent?.trim() ||
            '',
        );
      const salary =
        normalizeLegacyRuntimeText(
          runtimeRecord?.salary ||
            runtimeRecord?.jobSalary ||
            params.get('salary') ||
            document.querySelector('[data-job-salary-text]')?.textContent?.trim() ||
            '',
        );
      const sector =
        normalizeLegacyRuntimeText(
          runtimeRecord?.sector ||
            runtimeRecord?.jobSector ||
            params.get('sector') ||
            document.querySelector('[data-job-sector-text]')?.textContent?.trim() ||
            '',
        );
      const summary =
        normalizeLegacyRuntimeText(
          runtimeRecord?.summary ||
            runtimeRecord?.jobSummary ||
            params.get('summary') ||
            document.querySelector('[data-job-summary-text]')?.textContent?.trim() ||
            '',
        );
      const companySummary =
        normalizeLegacyRuntimeText(
          runtimeRecord?.companySummary ||
            params.get('companySummary') ||
            document.querySelector('[data-company-summary]')?.textContent?.trim() ||
            '',
        );
      const runtimeCompany = getAdminRuntimeCompanies().find(
        (entry) => normalize(entry?.name) === normalize(company),
      );
      const canonicalJobId = String(runtimeRecord?.id || runtimeRecord?.jobId || requestedId || '').trim();
      const demandMeta = getJobDemandStatusMeta(
        runtimeRecord || {
          id: canonicalJobId,
          title,
          companyName: company,
          location,
          positions: params.get('positions') || '',
          applicantsCount: params.get('applicantsCount') || '0',
          applicationEnabled: true,
          status: 'approved',
        },
      );
      const cleanJobUrl = canonicalJobId
        ? buildQueryUrl('job-details.html', { id: canonicalJobId })
        : 'job-details.html';
      window.__RAHMA_PENDING_JOB_APPLY__ = params.get('apply') === '1';

      document.querySelectorAll('[data-job-title-text]').forEach((element) => {
        element.textContent = title;
      });
      document.querySelectorAll('[data-job-company-text], [data-job-company-side]').forEach((element) => {
        element.textContent = company;
      });
      document.querySelectorAll('[data-job-location-text], [data-job-location-side]').forEach((element) => {
        element.textContent = location;
      });
      document.querySelectorAll('[data-job-posted-text]').forEach((element) => {
        element.textContent = posted;
      });
      document.querySelectorAll('[data-job-type-text], [data-job-type-side]').forEach((element) => {
        element.textContent = type;
      });
      document.querySelectorAll('[data-job-salary-text], [data-job-salary-side]').forEach((element) => {
        element.textContent = salary;
      });
      document.querySelectorAll('[data-job-sector-text], [data-job-sector-side]').forEach((element) => {
        element.textContent = sector;
      });
      document.querySelectorAll('[data-job-summary-text], [data-job-summary-detail]').forEach((element) => {
        element.textContent = summary;
      });
      document.querySelectorAll('[data-job-applicants-count-text]').forEach((element) => {
        element.textContent = String(demandMeta.applicantsCount);
      });
      document.querySelectorAll('[data-job-positions-text], [data-job-positions-card]').forEach((element) => {
        element.textContent = String(demandMeta.positionsCount);
      });
      document.querySelectorAll('[data-job-availability-text]').forEach((element) => {
        element.textContent = demandMeta.statusText;
      });
      document.querySelectorAll('[data-job-availability-summary]').forEach((element) => {
        element.textContent = demandMeta.summaryText;
      });
      document.querySelectorAll('[data-job-availability-card]').forEach((element) => {
        element.classList.toggle('job-demand-card--filled', demandMeta.filled);
      });

      const featuredBadge = document.querySelector('[data-job-featured-badge]');
      if (featuredBadge instanceof HTMLElement) {
        featuredBadge.toggleAttribute('hidden', !featured);
      }

      const companySummaryElement = document.querySelector('[data-company-summary]');
      if (companySummaryElement) {
        companySummaryElement.textContent = companySummary;
      }

      const companyVisitLink = document.querySelector('[data-company-visit-link]');
      const applyCurrentLink = document.querySelector('[data-apply-current]');
      if (companyVisitLink) {
        companyVisitLink.href = buildCompanyDetailsUrl({
          companyId: String(runtimeCompany?.id || '').trim(),
          companyName: company,
          companySector: sector,
          companyLocation: location,
          companySummary,
        });
      }
      if (applyCurrentLink instanceof HTMLAnchorElement) {
        applyCurrentLink.href = buildApplyUrl({
          jobTitle: title,
          jobCompany: company,
          jobLocation: location,
          jobType: type,
          jobSalary: salary,
          jobPosted: posted,
          jobSummary: summary,
          jobSector: sector,
          jobFeatured: featured ? 'true' : 'false',
          jobId: canonicalJobId,
        });
        if (demandMeta.filled) {
          applyCurrentLink.setAttribute('aria-disabled', 'true');
          applyCurrentLink.dataset.disabledMessage = 'اكتمل العدد المطلوب لهذه الوظيفة أو تم إغلاق التقديم عليها.';
          applyCurrentLink.textContent = 'اكتمل العدد المطلوب';
        } else {
          applyCurrentLink.removeAttribute('aria-disabled');
          delete applyCurrentLink.dataset.disabledMessage;
          applyCurrentLink.textContent = 'قدم الآن';
        }
      }

      const canonicalLink = document.querySelector('link[rel="canonical"]');
      if (canonicalLink instanceof HTMLLinkElement) {
        canonicalLink.href = new URL(cleanJobUrl, window.location.href).toString();
      }

      const ogTitle = document.querySelector('meta[property="og:title"]');
      if (ogTitle instanceof HTMLMetaElement) {
        ogTitle.content = `${title} | ${SITE_TITLE_SUFFIX}`;
      }

      const ogDescription = document.querySelector('meta[property="og:description"]');
      if (ogDescription instanceof HTMLMetaElement) {
        ogDescription.content = summary || companySummary || ogDescription.content;
      }

      const ogUrl = document.querySelector('meta[property="og:url"]');
      if (ogUrl instanceof HTMLMetaElement) {
        ogUrl.content = new URL(cleanJobUrl, window.location.href).toString();
      }

      const twitterTitle = document.querySelector('meta[name="twitter:title"]');
      if (twitterTitle instanceof HTMLMetaElement) {
        twitterTitle.content = `${title} | ${SITE_TITLE_SUFFIX}`;
      }

      const twitterDescription = document.querySelector('meta[name="twitter:description"]');
      if (twitterDescription instanceof HTMLMetaElement) {
        twitterDescription.content = summary || companySummary || twitterDescription.content;
      }

      document.title = `${normalizeLegacyRuntimeText(title)} | ${SITE_TITLE_SUFFIX}`;
      if (canonicalJobId) {
        window.history.replaceState({}, '', cleanJobUrl);
      }
      return;
    }

    const params = new URLSearchParams(window.location.search);
    const title = params.get('title') || params.get('jobTitle');
    const requestedId = normalize(params.get('id') || params.get('jobId') || '');
    const cleanJobUrl = requestedId ? buildQueryUrl('job-details.html', { id: requestedId }) : 'job-details.html';

    if (!normalize(title)) return;

    const company = params.get('company');
    const location = params.get('location');
    const type = params.get('type');
    const salary = params.get('salary');
    const posted = params.get('posted');
    const summary = params.get('summary');
    const sector = params.get('sector');

    const heroSection = document.querySelector('main section.mb-10');
    const titleElement = heroSection?.querySelector('h2');
    const infoItems = heroSection?.querySelectorAll('.flex.flex-wrap.items-center.gap-4 > span');
    const badgeItems = heroSection?.querySelectorAll('.flex.flex-wrap.gap-2.pt-2 > span');
    const companyNameInSidebar = Array.from(document.querySelectorAll('h4.font-bold')).find((item) =>
      item.closest('.space-y-8')
    );
    const companyDescription = document.querySelector(
      '.space-y-8 .bg-white.dark\\:bg-slate-900.rounded-3xl p.text-sm.text-slate-500'
    );
    const companyMetaValues = document.querySelectorAll(
      '.space-y-8 .bg-white.dark\\:bg-slate-900.rounded-3xl .flex.justify-between.items-center.text-sm .font-bold'
    );
    const companyVisitLink = Array.from(document.querySelectorAll('a[href="company-details.html"]')).find((link) =>
      normalize(link.textContent).includes('زيارة')
    );
    const applyCurrentLink = document.querySelector('[data-apply-current]');
    const descriptionParagraph = document.querySelector(
      '.lg\\:col-span-2 .bg-white.dark\\:bg-slate-900.rounded-3xl p.text-slate-600'
    );
    const derivedCompanySummary = String(summary || '').trim();

    if (titleElement) titleElement.textContent = title;
    if (company && infoItems?.[0]) setInlineContent(infoItems[0], company);
    if (location && infoItems?.[1]) setInlineContent(infoItems[1], location);
    if (posted && infoItems?.[2]) setInlineContent(infoItems[2], posted);
    if (type && badgeItems?.[0]) badgeItems[0].textContent = type;
    if (sector && badgeItems?.[1]) badgeItems[1].textContent = sector;
    if (salary && badgeItems?.[2]) badgeItems[2].textContent = salary;
    if (company && companyNameInSidebar) companyNameInSidebar.textContent = company;
    if (descriptionParagraph) {
      descriptionParagraph.textContent = summary || 'لا توجد تفاصيل مضافة لهذه الوظيفة حتى الآن.';
    }
    if (companyDescription) {
      companyDescription.textContent = derivedCompanySummary || 'لا توجد نبذة متاحة عن الشركة حتى الآن.';
    }
    if (sector && companyMetaValues?.[1]) companyMetaValues[1].textContent = sector;

    if (companyVisitLink) {
      companyVisitLink.href = buildCompanyDetailsUrl({
        companyName: company,
        companySector: sector,
        companyLocation: location,
        companySummary: derivedCompanySummary || summary,
      });
    }
    if (applyCurrentLink instanceof HTMLAnchorElement) {
      applyCurrentLink.href = buildApplyUrl({
        jobTitle: title,
        jobCompany: company,
        jobLocation: location,
        jobType: type,
        jobSalary: salary,
        jobPosted: posted,
        jobSummary: summary,
        jobSector: sector,
        jobId: requestedId,
      });
    }

    const canonicalLink = document.querySelector('link[rel="canonical"]');
    if (canonicalLink instanceof HTMLLinkElement) {
      canonicalLink.href = new URL(cleanJobUrl, window.location.href).toString();
    }

    const ogUrl = document.querySelector('meta[property="og:url"]');
    if (ogUrl instanceof HTMLMetaElement) {
      ogUrl.content = new URL(cleanJobUrl, window.location.href).toString();
    }

    document.title = `${normalizeLegacyRuntimeText(title)} | ${SITE_TITLE_SUFFIX}`;
  };

  const initCompanyDetailsPage = () => {
    if (!window.location.pathname.endsWith('company-details.html')) return;

    const modernRoot = document.querySelector('[data-company-detail-root]');
    if (modernRoot) {
      const params = new URLSearchParams(window.location.search);
      const savedProfile = getStoredProfile();
      const session = getSession();
      const savedCompany = getCompanyIdentity(savedProfile, session);

      const requestedId = normalize(params.get('id') || params.get('companyId') || '');
      const runtimeCompany =
        getAdminRuntimeCompanies().find((entry) => normalize(String(entry?.id || entry?.companyId || '')) === requestedId) ||
        null;

      let company =
        runtimeCompany?.name ||
        params.get('company') ||
        savedCompany.name ||
        '';
      let sector = runtimeCompany?.sector || params.get('sector');
      let location = runtimeCompany?.location || params.get('location');
      let openings = runtimeCompany?.openings ?? params.get('openings');
      let status = runtimeCompany?.status || params.get('status');
      let summary = runtimeCompany?.summary || params.get('summary');
      let image = params.get('image');
      let phone = runtimeCompany?.phone || '';
      let landline = runtimeCompany?.landline || '';
      let website = runtimeCompany?.website || '';
      let socialLinks = normalizeCompanySocialLinks(runtimeCompany?.socialLinks);
      if (runtimeCompany) {
        openings = openings || runtimeCompany.openings;
        image = image || runtimeCompany.imageUrl || runtimeCompany.logoUrl || runtimeCompany.logoPath || '';
      }

      if (!normalize(company) && normalize(savedProfile?.role) === 'company') {
        company = savedCompany.name;
        sector = savedCompany.sector;
        location = savedCompany.city;
        openings = String(getCompanyStoredJobs(savedProfile, session).filter((job) => !job?.deletedAt).length || 0);
        status = 'نشطة';
        phone = savedCompany.phone || '';
        landline = savedCompany.landline || '';
        website = savedCompany.website || '';
        socialLinks = normalizeCompanySocialLinks(savedCompany.socialLinks);
        summary = String(
          savedProfile?.companyProfile?.companyDescription ||
            savedProfile?.companyProfile?.description ||
            savedProfile?.companyDescription ||
            savedProfile?.description ||
            savedProfile?.headline ||
            '',
        ).trim();
      }

      image = image || savedProfile?.companyCoverUrl || savedProfile?.companyLogoUrl || '';

      if (!normalize(company)) return;

      sector = sector || 'غير محدد';
      location = location || 'غير محدد';
      openings = openings || '0';
      status = status || 'غير محددة';
      summary = summary || 'لا توجد نبذة متاحة عن الشركة حتى الآن.';

      const jobsUrl = buildJobsUrl({ keyword: company });
      const cleanCompanyUrl = requestedId
        ? buildQueryUrl('company-details.html', { id: requestedId })
        : buildQueryUrl('company-details.html', { company });
      setTextContent('[data-company-name-text]', company);
      setTextContent('[data-company-summary-text]', summary);
      setTextContent('[data-company-summary-body]', summary);
      setTextContent('[data-company-sector-text]', sector);
      setTextContent('[data-company-location-text]', location);
      setTextContent('[data-company-openings-text]', openings);
      setTextContent('[data-company-status-text]', status);
      setTextContent('[data-company-phone-text]', phone || 'غير محدد');
      setTextContent('[data-company-landline-text]', landline || 'غير محدد');
      const detailLandlineRow = document.querySelector('[data-company-landline-row]');
      if (detailLandlineRow instanceof HTMLElement) {
        detailLandlineRow.hidden = !landline;
      }
      document.querySelectorAll('[data-company-image]').forEach((node) => {
        if (node instanceof HTMLImageElement) {
          node.src = resolvePublicCompanyImage({ imageUrl: image, name: company });
          node.alt = `صورة ${company}`;
        }
      });

      document.querySelectorAll('[data-company-visit-link]').forEach((link) => {
        if (link instanceof HTMLAnchorElement) {
          link.href = jobsUrl;
          link.removeAttribute('aria-disabled');
          link.removeAttribute('tabindex');
          delete link.dataset.disabledMessage;
        }
      });

      const websiteLink = document.querySelector('[data-company-website-link]');
      const websiteEmpty = document.querySelector('[data-company-website-empty]');
      if (websiteLink instanceof HTMLAnchorElement && websiteEmpty instanceof HTMLElement) {
        const normalizedWebsite = normalizeWebsiteUrl(website);
        websiteLink.hidden = !normalizedWebsite;
        websiteEmpty.hidden = Boolean(normalizedWebsite);
        if (normalizedWebsite) {
          websiteLink.href = normalizedWebsite;
        } else {
          websiteLink.removeAttribute('href');
        }
      }

      const socialContainer = document.querySelector('[data-company-social-links]');
      if (socialContainer instanceof HTMLElement) {
        let visibleSocialCount = 0;
        socialContainer.querySelectorAll('[data-company-social-link]').forEach((node) => {
          if (!(node instanceof HTMLAnchorElement)) return;
          const network = node.dataset.companySocialLink || '';
          const href = normalizeWebsiteUrl(socialLinks?.[network] || '');
          node.hidden = !href;
          if (href) {
            node.href = href;
            visibleSocialCount += 1;
          } else {
            node.removeAttribute('href');
          }
        });
        socialContainer.hidden = visibleSocialCount === 0;
      }

      const canonicalLink = document.querySelector('link[rel="canonical"]');
      if (canonicalLink instanceof HTMLLinkElement) {
        canonicalLink.href = new URL(cleanCompanyUrl, window.location.href).toString();
      }

      const ogTitle = document.querySelector('meta[property="og:title"]');
      if (ogTitle instanceof HTMLMetaElement) {
        ogTitle.content = `${company} | ${SITE_TITLE_SUFFIX}`;
      }

      const ogDescription = document.querySelector('meta[property="og:description"]');
      if (ogDescription instanceof HTMLMetaElement) {
        ogDescription.content = summary || ogDescription.content;
      }

      const ogUrl = document.querySelector('meta[property="og:url"]');
      if (ogUrl instanceof HTMLMetaElement) {
        ogUrl.content = new URL(cleanCompanyUrl, window.location.href).toString();
      }

      document.title = `${normalizeLegacyRuntimeText(company)} | ${SITE_TITLE_SUFFIX}`;
      if (requestedId) {
        window.history.replaceState({}, '', cleanCompanyUrl);
      }
      return;
    }

    const params = new URLSearchParams(window.location.search);
    const savedProfile = getStoredProfile();
    const session = getSession();
    const savedCompany = getCompanyIdentity(savedProfile, session);
    const requestedId = normalize(params.get('id') || params.get('companyId') || '');
    const cleanCompanyUrl = requestedId
      ? buildQueryUrl('company-details.html', { id: requestedId })
      : buildQueryUrl('company-details.html', { company: params.get('company') || savedCompany.name || '' });

    let company = params.get('company');
    let sector = params.get('sector');
    let location = params.get('location');
    let openings = params.get('openings');
    let status = params.get('status');
    let summary = params.get('summary');

    if (!normalize(company) && normalize(savedProfile?.role) === 'company') {
      company = savedCompany.name;
      sector = savedCompany.sector;
      location = savedCompany.city;
      openings = String(getCompanyStoredJobs(savedProfile, session).filter((job) => !job?.deletedAt).length || 0);
      status = '\u0646\u0634\u0637\u0629';
      summary = String(
        savedProfile?.companyProfile?.companyDescription ||
          savedProfile?.companyProfile?.description ||
          savedProfile?.companyDescription ||
          savedProfile?.description ||
          savedProfile?.headline ||
          '',
      ).trim();
    }

    if (!normalize(company)) return;

    sector = sector || '\u063a\u064a\u0631 \u0645\u062d\u062f\u062f';
    location = location || '\u063a\u064a\u0631 \u0645\u062d\u062f\u062f';
    openings = openings || '0';
    status = status || '\u063a\u064a\u0631 \u0645\u062d\u062f\u062f\u0629';
    summary = summary || '\u0644\u0627 \u062a\u0648\u062c\u062f \u0646\u0628\u0630\u0629 \u0645\u062a\u0627\u062d\u0629 \u0639\u0646 \u0627\u0644\u0634\u0631\u0643\u0629 \u062d\u062a\u0649 \u0627\u0644\u0622\u0646.';

    const heroSection = document.querySelector('section.relative.py-20');
    const heroTitle = heroSection?.querySelector('h1');
    const heroSummary = heroSection?.querySelector('p');
    const statCards = Array.from(document.querySelectorAll('section.py-12 .grid > div'));
    const storyHeading = document.querySelector('section.py-20.bg-background-light h2');
    const storyParagraphs = document.querySelectorAll('section.py-20.bg-background-light .space-y-6 p');

    if (heroTitle) {
      heroTitle.textContent = `\u0646\u0628\u0630\u0629 \u0639\u0646 ${company}`;
    }

    if (heroSummary) {
      heroSummary.textContent = summary;
    }

    if (statCards[0]) {
      const value = statCards[0].querySelector('.text-4xl');
      const label = statCards[0].querySelector('.text-slate-500');
      if (value) value.textContent = openings;
      if (label) label.textContent = '\u0641\u0631\u0635 \u0645\u0641\u062a\u0648\u062d\u0629';
    }

    if (statCards[1]) {
      const value = statCards[1].querySelector('.text-4xl');
      const label = statCards[1].querySelector('.text-slate-500');
      if (value) value.textContent = sector;
      if (label) label.textContent = '\u0627\u0644\u0642\u0637\u0627\u0639';
    }

    if (statCards[2]) {
      const value = statCards[2].querySelector('.text-4xl');
      const label = statCards[2].querySelector('.text-slate-500');
      if (value) value.textContent = location;
      if (label) label.textContent = '\u0627\u0644\u0645\u0648\u0642\u0639';
    }

    if (statCards[3]) {
      const value = statCards[3].querySelector('.text-4xl');
      const label = statCards[3].querySelector('.text-slate-500');
      if (value) value.textContent = status;
      if (label) label.textContent = '\u062d\u0627\u0644\u0629 \u0627\u0644\u0634\u0631\u0643\u0629';
    }

    if (storyHeading) {
      storyHeading.textContent = `\u0646\u0628\u0630\u0629 \u0639\u0646 ${company}`;
    }

    if (storyParagraphs[0]) {
      storyParagraphs[0].textContent = summary;
    }

    if (storyParagraphs[1]) {
      storyParagraphs[1].textContent = '\u0644\u0645 \u062a\u0642\u0645 \u0627\u0644\u0634\u0631\u0643\u0629 \u0628\u0625\u0636\u0627\u0641\u0629 \u062a\u0641\u0627\u0635\u064a\u0644 \u0625\u0636\u0627\u0641\u064a\u0629 \u0628\u0639\u062f.';
    }

    const canonicalLink = document.querySelector('link[rel="canonical"]');
    if (canonicalLink instanceof HTMLLinkElement) {
      canonicalLink.href = new URL(cleanCompanyUrl, window.location.href).toString();
    }

    const ogUrl = document.querySelector('meta[property="og:url"]');
    if (ogUrl instanceof HTMLMetaElement) {
      ogUrl.content = new URL(cleanCompanyUrl, window.location.href).toString();
    }

    document.title = `${normalizeLegacyRuntimeText(company)} | ${SITE_TITLE_SUFFIX}`;
  };

  const getCurrentJobData = () => {
    if (document.querySelector('[data-job-root]')) {
      const params = new URLSearchParams(window.location.search);
      const jobId = params.get('id') || params.get('jobId') || '';

      return {
        jobId,
        jobTitle:
          params.get('title') ||
          document.querySelector('[data-job-title-text]')?.textContent?.trim() ||
          'الوظيفة الحالية',
        jobCompany:
          params.get('company') ||
          document.querySelector('[data-job-company-text]')?.textContent?.trim() ||
          'الشركة الحالية',
        jobLocation:
          params.get('location') ||
          document.querySelector('[data-job-location-text]')?.textContent?.trim() ||
          '',
        jobPosted:
          params.get('posted') ||
          document.querySelector('[data-job-posted-text]')?.textContent?.trim() ||
          '',
        jobType:
          params.get('type') ||
          document.querySelector('[data-job-type-text]')?.textContent?.trim() ||
          '',
        jobSalary:
          params.get('salary') ||
          document.querySelector('[data-job-salary-text]')?.textContent?.trim() ||
          '',
        jobSummary:
          params.get('summary') ||
          document.querySelector('[data-job-summary-text]')?.textContent?.trim() ||
          '',
        jobSector:
          params.get('sector') ||
          document.querySelector('[data-job-sector-text]')?.textContent?.trim() ||
          '',
      };
    }

    const params = new URLSearchParams(window.location.search);
    const jobId = params.get('id') || params.get('jobId') || '';
    const heroSection = document.querySelector('main section.mb-10');
    const titleElement = heroSection?.querySelector('h2');
    const infoItems = heroSection?.querySelectorAll('.flex.flex-wrap.items-center.gap-4 > span');
    const badgeItems = heroSection?.querySelectorAll('.flex.flex-wrap.gap-2.pt-2 > span');
    const descriptionParagraph = document.querySelector(
      '.lg\\:col-span-2 .bg-white.dark\\:bg-slate-900.rounded-3xl p.text-slate-600'
    );

    return {
      jobId,
      jobTitle: params.get('title') || titleElement?.textContent.trim() || '',
      jobCompany: params.get('company') || infoItems?.[0]?.textContent.trim() || '',
      jobLocation: params.get('location') || infoItems?.[1]?.textContent.trim() || '',
      jobPosted: params.get('posted') || infoItems?.[2]?.textContent.trim() || '',
      jobType: params.get('type') || badgeItems?.[0]?.textContent.trim() || '',
      jobSalary: params.get('salary') || badgeItems?.[2]?.textContent.trim() || '',
      jobSummary: params.get('summary') || descriptionParagraph?.textContent.trim() || '',
      jobSector: params.get('sector') || '',
    };
  };

  const getCurrentRuntimeJobRecord = (jobData = {}) => {
    return findRuntimeJobRecord(jobData);
  };

  const initContactForm = () => {
    const form = document.querySelector('form[data-contact-form="true"]');
    if (!form) return;

    form.addEventListener('submit', async (event) => {
      event.preventDefault();

      if (!form.reportValidity()) return;

      const formData = new FormData(form);
      const fullName = (formData.get('fullName') || '').toString().trim();
      const email = (formData.get('email') || '').toString().trim();
      const phone = (formData.get('phone') || '').toString().trim();
      const subject = (formData.get('subject') || 'رسالة من الموقع').toString().trim();
      const message = (formData.get('message') || '').toString().trim();

      const body = [
        `الاسم: ${fullName || 'غير مذكور'}`,
        `البريد الإلكتروني: ${email || 'غير مذكور'}`,
        `الموبايل: ${phone || 'غير مذكور'}`,
        `الموضوع: ${subject}`,
        '',
        message || 'لا توجد رسالة إضافية.',
      ].join('\n');

      window.location.href = buildMailtoUrl({
        subject: `رسالة جديدة من الموقع - ${subject}`,
        body,
      });
    });
  };

  const initJobDetailsActions = () => {
    if (!window.location.pathname.endsWith('job-details.html')) return;

    const bookmarkButton = document.querySelector('[data-bookmark-job]');
    const copyButton = document.querySelector('[data-copy-job-link]');
    const shareTwitterButton = document.querySelector('[data-share-twitter]');

    if (!bookmarkButton && !copyButton && !shareTwitterButton) return;

    const currentJob = getCurrentJobData();
    const bookmarkKey = getJobBookmarkKey(currentJob);

    const refreshBookmarkState = () => {
      const bookmarks = getSavedJobBookmarks();
      const isBookmarked = bookmarks.some((item) => item.bookmarkKey === bookmarkKey);
      setBookmarkButtonState(bookmarkButton, isBookmarked);
    };

    const toggleBookmark = () => {
      const bookmarks = getSavedJobBookmarks();
      const existingIndex = bookmarks.findIndex((item) => item.bookmarkKey === bookmarkKey);

      if (existingIndex >= 0) {
        bookmarks.splice(existingIndex, 1);
        saveJobBookmarks(bookmarks);
        refreshBookmarkState();
        return;
      }

      bookmarks.unshift({
        bookmarkKey,
        ...currentJob,
        savedAt: new Date().toISOString(),
        jobUrl: getRelativeUrl(window.location.href),
      });

      saveJobBookmarks(bookmarks.slice(0, 50));
      refreshBookmarkState();
    };

    const copyJobLink = async () => {
      const copied = await copyTextToClipboard(window.location.href);
      setTemporaryButtonContent(
        copyButton,
        copied
          ? '<span class="material-symbols-outlined text-xl">done</span> تم النسخ'
          : '<span class="material-symbols-outlined text-xl">close</span> تعذر النسخ'
      );
    };

    const shareOnTwitter = () => {
      const shareText = `${currentJob.jobTitle} في ${currentJob.jobCompany} - ${currentJob.jobLocation} | الرحمة المهداه للتوظيف`;
      const shareUrl = `https://twitter.com/intent/tweet?${new URLSearchParams({
        text: shareText,
        url: window.location.href,
      }).toString()}`;

      window.open(shareUrl, '_blank', 'noopener,noreferrer');
    };

    refreshBookmarkState();
    bookmarkButton?.addEventListener('click', toggleBookmark);
    copyButton?.addEventListener('click', copyJobLink);
    shareTwitterButton?.addEventListener('click', shareOnTwitter);
  };

  const initJobApplicationFlow = () => {
    if (!window.location.pathname.endsWith('job-details.html')) return;

    const modal = document.querySelector('[data-application-modal]');
    const overlay = document.querySelector('[data-application-overlay]');
    const closeButtons = document.querySelectorAll('[data-application-close]');
    const form = document.querySelector('[data-application-form]');
    const statusBox = document.querySelector('[data-application-status]');
    const jobLabel = document.querySelector('[data-application-job]');
    const cvFileInput = form.elements.cvFile;
    const cvFileName = document.querySelector('[data-cv-file-name]');
    const submitButton = form.querySelector('[type="submit"]');

    if (!modal || !form || !statusBox || !jobLabel) return;

    if (form.matches('.application-form')) {
      const searchParams = new URLSearchParams(window.location.search);
      const governorateSelect = form.querySelector('[data-application-governorate]');
      const yearsSelect = form.querySelector('[data-application-years]');
      const salaryInput = form.querySelector('[data-application-salary]');
      const militaryStatusSelect = form.querySelector('[data-application-military]');
      const publicServiceWrap = form.querySelector('[data-public-service-wrap]');
      const publicServiceSelect = form.querySelector('[data-public-service-select]');
      const savedProfile = getStoredProfile();
      const applicantSeed = getApplicantDraftSeed(savedProfile);
      const applicantProfile = applicantSeed.draftProfile || {};
      const applicantMeta = applicantSeed.applicantMeta || {};
      let isSubmitting = false;
      let currentJob = getCurrentJobData();
      let currentJobRecord = getCurrentRuntimeJobRecord(currentJob);
      let currentJobDemand = getJobDemandStatusMeta(currentJobRecord || currentJob);
      let applicationsEnabled = false;
      let applicationsDisabledMessage = '';

      const buildResolvedJobPayload = (jobData = {}, jobRecord = null) => ({
        jobId: String(jobRecord?.id || jobRecord?.jobId || jobData?.jobId || '').trim(),
        jobTitle: String(jobRecord?.title || jobRecord?.jobTitle || jobData?.jobTitle || '').trim(),
        jobCompany: String(jobRecord?.companyName || jobRecord?.jobCompany || jobData?.jobCompany || '').trim(),
        jobLocation: String(jobRecord?.location || jobRecord?.jobLocation || jobData?.jobLocation || '').trim(),
        jobPosted: String(jobRecord?.postedLabel || jobRecord?.jobPosted || jobData?.jobPosted || '').trim(),
        jobType: String(jobRecord?.type || jobRecord?.jobType || jobData?.jobType || '').trim(),
        jobSalary: String(jobRecord?.salary || jobRecord?.jobSalary || jobData?.jobSalary || '').trim(),
        jobSummary: String(jobRecord?.summary || jobRecord?.jobSummary || jobData?.jobSummary || '').trim(),
        jobSector: String(jobRecord?.sector || jobRecord?.jobSector || jobData?.jobSector || '').trim(),
      });

      const syncCurrentJobApplicationContext = async ({ forceRefresh = false } = {}) => {
        let liveJob = getCurrentJobData();
        let liveJobRecord = getCurrentRuntimeJobRecord(liveJob);
        const requestedJobId = normalize(liveJob?.jobId || searchParams.get('id') || searchParams.get('jobId') || '');

        if ((forceRefresh || !liveJobRecord) && requestedJobId && hasFirebaseSiteConfig()) {
          await syncFirebasePublicCache();
          liveJob = getCurrentJobData();
          liveJobRecord = getCurrentRuntimeJobRecord(liveJob);
        }

        const resolvedJob = buildResolvedJobPayload(liveJob, liveJobRecord);
        const runtimeSettings = getAdminRuntimeSettings();
        const waitingForJobRecord = Boolean(requestedJobId && hasFirebaseSiteConfig() && !liveJobRecord);
        const demandSource = liveJobRecord || {
          id: resolvedJob.jobId,
          title: resolvedJob.jobTitle,
          companyName: resolvedJob.jobCompany,
          location: resolvedJob.jobLocation,
          positions: '',
          applicantsCount: 0,
          applicationEnabled: !waitingForJobRecord,
          status: 'approved',
        };
        const liveJobDemand = getJobDemandStatusMeta(demandSource);
        const jobApplicationsAllowed =
          !waitingForJobRecord &&
          liveJobRecord?.applicationEnabled !== false &&
          !['hidden', 'archived', 'rejected'].includes(normalize(liveJobRecord?.status || 'approved')) &&
          !liveJobDemand.filled;
        const nextApplicationsEnabled =
          runtimeSettings.jobApplications !== false && !runtimeSettings.maintenanceMode && jobApplicationsAllowed;
        const nextDisabledMessage = waitingForJobRecord
          ? 'جارٍ تحميل بيانات الوظيفة الحالية. انتظر لحظة ثم أعد المحاولة.'
          : jobApplicationsAllowed
            ? 'التقديم على الوظائف متوقف حالياً من إعدادات الأدمن.'
            : liveJobDemand.filled
              ? 'اكتمل العدد المطلوب لهذه الوظيفة أو تم إغلاق التقديم عليها.'
              : 'التقديم على هذه الوظيفة موقوف حالياً من لوحة الأدمن.';

        currentJob = resolvedJob;
        currentJobRecord = liveJobRecord;
        currentJobDemand = liveJobDemand;
        applicationsEnabled = nextApplicationsEnabled;
        applicationsDisabledMessage = nextDisabledMessage;

        jobLabel.textContent = repairLegacyMojibakeText(
          `التقديم على وظيفة ${currentJob.jobTitle || 'الوظيفة الحالية'} لدى ${currentJob.jobCompany || 'الشركة الحالية'}.`,
        );

        if (!isSubmitting) {
          setSubmitBusyState(false);
        }

        return {
          currentJob,
          currentJobRecord,
          currentJobDemand,
          applicationsEnabled,
          applicationsDisabledMessage,
          waitingForJobRecord,
        };
      };

      const setSubmitBusyState = (busy = false) => {
        isSubmitting = busy;
        if (!submitButton) return;

        if (!submitButton.dataset.defaultLabel) {
          submitButton.dataset.defaultLabel = repairLegacyMojibakeText(
            submitButton.textContent || 'إرسال الطلب',
          );
        }

        submitButton.disabled = busy || !applicationsEnabled;
        submitButton.classList.toggle('opacity-60', busy || !applicationsEnabled);
        submitButton.classList.toggle('cursor-not-allowed', busy || !applicationsEnabled);
        submitButton.classList.toggle('cursor-wait', busy);
        submitButton.textContent = repairLegacyMojibakeText(
          busy ? 'جارٍ الإرسال...' : submitButton.dataset.defaultLabel || 'إرسال الطلب',
        );
      };

      const setStatus = (message, tone = 'info', meta = {}) => {
        statusBox.className = 'application-status';
        statusBox.classList.add(`application-status--${tone}`);
        statusBox.innerHTML = '';

        const messageElement = document.createElement('p');
        messageElement.textContent = repairLegacyMojibakeText(message);
        statusBox.appendChild(messageElement);

        if (meta.requestId) {
          const requestChip = document.createElement('span');
          requestChip.className = 'request-chip';
          requestChip.textContent = repairLegacyMojibakeText(`رقم الطلب: ${meta.requestId}`);
          statusBox.appendChild(requestChip);

          const copyButton = document.createElement('button');
          copyButton.type = 'button';
          copyButton.className = 'site-action site-action--ghost';
          copyButton.textContent = repairLegacyMojibakeText('انسخ الآن');
          copyButton.addEventListener('click', async () => {
            const copied = await copyTextToClipboard(meta.requestId);
            if (copied) {
              setTemporaryButtonContent(copyButton, 'تم النسخ');
              showToast(`تم نسخ رقم الطلب: ${meta.requestId}`);
              return;
            }

            setTemporaryButtonContent(copyButton, 'تعذر النسخ');
          });
          statusBox.appendChild(copyButton);

          const whatsappButton = document.createElement('a');
          whatsappButton.href =
            meta.whatsappUrl ||
            buildWhatsAppMessageUrl(CONTACT_PHONE, meta.whatsappMessage || `رقم الطلب: ${meta.requestId}`);
          whatsappButton.target = '_blank';
          whatsappButton.rel = 'noopener noreferrer';
          whatsappButton.className = 'site-action site-action--secondary';
          whatsappButton.textContent = repairLegacyMojibakeText('واتساب');
          statusBox.appendChild(whatsappButton);
        }

        if (meta.link) {
          const trackingLink = document.createElement('a');
          trackingLink.href = meta.link;
          trackingLink.className = 'site-action site-action--secondary';
          trackingLink.textContent = repairLegacyMojibakeText('متابعة الطلب');
          statusBox.appendChild(trackingLink);
        }
      };

      const fillNumericSelect = ({ select, start, end, step = 1, placeholder, selectedValue = '' }) => {
        if (!(select instanceof HTMLSelectElement)) return;

        const options = [];
        for (let value = start; value <= end; value += step) {
          options.push(String(value));
        }

        populateSelectOptions(select, options, placeholder, selectedValue);
      };

      if (governorateSelect instanceof HTMLSelectElement) {
        populateSelectOptions(
          governorateSelect,
          EGYPT_GOVERNORATES,
          'اختر المحافظة',
          applicantProfile.governorate || applicantMeta.governorate || '',
        );
      }

      fillNumericSelect({
        select: yearsSelect,
        start: 1,
        end: 50,
        placeholder: 'اختر سنوات الخبرة',
        selectedValue: applicantMeta.experienceYears || '',
      });

      if (salaryInput instanceof HTMLInputElement) {
        salaryInput.value = sanitizePositiveIntegerInput(applicantMeta.expectedSalary || '');
      }

      const syncPublicServiceField = () => {
        const isPublicService =
          militaryStatusSelect instanceof HTMLSelectElement &&
          militaryStatusSelect.value === 'خدمة عامة';

        if (publicServiceWrap) {
          publicServiceWrap.classList.toggle('hidden', !isPublicService);
          publicServiceWrap.toggleAttribute('hidden', !isPublicService);
        }

        if (publicServiceSelect instanceof HTMLSelectElement) {
          publicServiceSelect.required = isPublicService;
          if (!isPublicService) {
            publicServiceSelect.value = '';
          }
        }
      };

      const openModal = async () => {
        const liveContext = await syncCurrentJobApplicationContext({ forceRefresh: true });
        if (!liveContext.applicationsEnabled) {
          showToast(liveContext.applicationsDisabledMessage);
          return;
        }

        if (!hasFirebaseSiteConfig()) {
          showToast('التقديم متوقف حاليًا لعدم اكتمال إعدادات الربط. لن يتم حفظ أي طلب قبل إضافة القيم المطلوبة.');
          return;
        }

        modal.classList.remove('hidden');
        modal.setAttribute('aria-hidden', 'false');
        document.body.style.overflow = 'hidden';
        form.querySelector('[name="fullName"]')?.focus();
      };

      const closeModal = () => {
        modal.classList.add('hidden');
        modal.setAttribute('aria-hidden', 'true');
        document.body.style.removeProperty('overflow');
      };

      void syncCurrentJobApplicationContext();
      form.elements.fullName.value = applicantProfile.fullName || '';
      form.elements.mobile.value = applicantProfile.phone || '';
      form.elements.address.value = applicantProfile.address || applicantMeta.address || '';
      form.elements.city.value = applicantProfile.city || applicantMeta.desiredCity || '';
      form.elements.specialization.value = applicantMeta.specialization || '';
      if (form.elements.educationLevel) {
        form.elements.educationLevel.value = applicantMeta.educationLevel || '';
      }
      if (militaryStatusSelect instanceof HTMLSelectElement) {
        militaryStatusSelect.value = applicantMeta.militaryStatus || '';
      }
      if (publicServiceSelect instanceof HTMLSelectElement) {
        publicServiceSelect.value = applicantMeta.publicServiceCompleted || '';
      }
      if (form.elements.maritalStatus) {
        form.elements.maritalStatus.value = applicantMeta.maritalStatus || '';
      }
      syncPublicServiceField();

      if (!applicationsEnabled && submitButton) {
        setSubmitBusyState(false);
      }

      closeButtons.forEach((button) => {
        button.addEventListener('click', closeModal);
      });

      overlay?.addEventListener('click', closeModal);
      militaryStatusSelect?.addEventListener('change', syncPublicServiceField);

      document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && !modal.classList.contains('hidden')) {
          closeModal();
        }
      });

      form.addEventListener('submit', async (event) => {
        event.preventDefault();
        if (isSubmitting) return;

        const liveContext = await syncCurrentJobApplicationContext({ forceRefresh: true });
        if (!liveContext.applicationsEnabled) {
          setStatus(liveContext.applicationsDisabledMessage, 'error');
          return;
        }

        syncPublicServiceField();

        if (!form.reportValidity()) {
          setStatus('برجاء استكمال كل البيانات المطلوبة قبل إرسال الطلب.', 'error');
          return;
        }

        const requestId = buildApplicationRequestId();
        const submittedAt = new Date().toISOString();
        const experienceYears = form.elements.experienceYears.value.trim();
        const expectedSalary = sanitizePositiveIntegerInput(form.elements.expectedSalary.value.trim());
        const militaryStatus = form.elements.militaryStatus.value.trim();
        const publicServiceCompleted =
          militaryStatus === 'خدمة عامة' ? form.elements.publicServiceCompleted.value.trim() : '';

        if (!expectedSalary) {
          setSubmitBusyState(false);
          setStatus('اكتب الراتب المتوقع كرقم صحيح أكبر من صفر.', 'error');
          return;
        }

        const applicationRecord = {
          id: requestId,
          requestId,
          job: liveContext.currentJob,
          applicant: {
            fullName: form.elements.fullName.value.trim(),
            email: '',
            phone: form.elements.mobile.value.trim(),
            address: form.elements.address.value.trim(),
            governorate: form.elements.governorate.value.trim(),
            city: form.elements.city.value.trim(),
            experience: experienceYears ? `${experienceYears} سنة` : '',
            experienceYears,
            expectedSalary,
            educationLevel: form.elements.educationLevel.value.trim(),
            specialization: form.elements.specialization.value.trim(),
            militaryStatus,
            publicServiceCompleted,
            maritalStatus: form.elements.maritalStatus.value.trim(),
          },
          company: {
            name: liveContext.currentJob.jobCompany,
            email: '',
          },
          submittedAt,
          respondedAt: '',
          rejectionReason: '',
          status: 'review',
          companyTag: '',
          interviewScheduledAt: '',
          interviewMode: '',
          interviewLocation: '',
          notes: [],
        };

        setSubmitBusyState(true);
        setStatus('جارٍ إرسال الطلب وحفظه...', 'info');

        const submitResult = await storeApplicationRecord(applicationRecord);
        if (!submitResult.ok) {
          setSubmitBusyState(false);
          setStatus(
            submitResult.source === 'firebase-missing'
              ? 'تعذر إرسال الطلب لأن إعدادات الربط غير مكتملة حاليًا. راجع إعدادات المشروع ثم حاول مرة أخرى.'
              : 'تعذر إرسال الطلب حاليًا. راجع اتصال الشبكة أو إعدادات المشروع ثم حاول مرة أخرى.',
            'error',
          );
          return;
        }

        const existingProfile = getStoredProfile();
        const existingApplicantSeed = getApplicantDraftSeed(existingProfile);
        saveJSON(
          STORAGE_KEYS.applicationProfile,
          persistApplicantDraftProfile(
            existingProfile,
            {
              fullName:
                applicationRecord.applicant.fullName || existingApplicantSeed.draftProfile?.fullName || '',
              phone:
                applicationRecord.applicant.phone || existingApplicantSeed.draftProfile?.phone || '',
              city: applicationRecord.applicant.city || existingApplicantSeed.draftProfile?.city || '',
              address:
                applicationRecord.applicant.address || existingApplicantSeed.draftProfile?.address || '',
              governorate:
                applicationRecord.applicant.governorate ||
                existingApplicantSeed.draftProfile?.governorate ||
                '',
              experience:
                applicationRecord.applicant.experience || existingApplicantSeed.draftProfile?.experience || '',
            },
            {
              desiredCity:
                applicationRecord.applicant.city || existingApplicantSeed.applicantMeta?.desiredCity || '',
              experienceYears:
                applicationRecord.applicant.experienceYears ||
                existingApplicantSeed.applicantMeta?.experienceYears ||
                '',
              educationLevel:
                applicationRecord.applicant.educationLevel ||
                existingApplicantSeed.applicantMeta?.educationLevel ||
                '',
              specialization:
                applicationRecord.applicant.specialization ||
                existingApplicantSeed.applicantMeta?.specialization ||
                '',
              militaryStatus:
                applicationRecord.applicant.militaryStatus ||
                existingApplicantSeed.applicantMeta?.militaryStatus ||
                '',
              publicServiceCompleted:
                applicationRecord.applicant.publicServiceCompleted ||
                existingApplicantSeed.applicantMeta?.publicServiceCompleted ||
                '',
              maritalStatus:
                applicationRecord.applicant.maritalStatus ||
                existingApplicantSeed.applicantMeta?.maritalStatus ||
                '',
              expectedSalary:
                applicationRecord.applicant.expectedSalary ||
                existingApplicantSeed.applicantMeta?.expectedSalary ||
                '',
              address:
                applicationRecord.applicant.address || existingApplicantSeed.applicantMeta?.address || '',
              governorate:
                applicationRecord.applicant.governorate ||
                existingApplicantSeed.applicantMeta?.governorate ||
                '',
            },
          ),
        );

        const trackingUrl = `track-application.html?id=${encodeURIComponent(requestId)}`;
        setStatus('تم استلام طلبك بنجاح.', 'success', {
          requestId,
          link: trackingUrl,
          whatsappMessage: buildApplicationSupportMessage(applicationRecord, trackingUrl),
          whatsappUrl: buildWhatsAppMessageUrl(
            CONTACT_PHONE,
            buildApplicationSupportMessage(applicationRecord, trackingUrl),
          ),
        });

        renderPublicJobsPage();
        initJobDetailsPage();
        const cleanUrl = appendQueryParams(window.location.href, { apply: null });
        window.history.replaceState({}, '', cleanUrl);
        showToast(`تم إرسال الطلب بنجاح. رقم الطلب: ${requestId}`);
        setSubmitBusyState(false);
      });

      window.rahmaOpenApplicationModal = openModal;

      if (window.__RAHMA_PENDING_JOB_APPLY__) {
        window.__RAHMA_PENDING_JOB_APPLY__ = false;
        openModal();
      }

      if (searchParams.get('apply') === '1') {
        if (!applicationsEnabled) {
          showToast(applicationsDisabledMessage);
          return;
        }
        openModal();
      }

      return;
    }

    const currentJob = getCurrentJobData();
    const currentJobRecord = getCurrentRuntimeJobRecord(currentJob);
    const currentJobDemand = getJobDemandStatusMeta(currentJobRecord || currentJob);
    const runtimeSettings = getAdminRuntimeSettings();
    const jobApplicationsAllowed =
      currentJobRecord?.applicationEnabled !== false &&
      !['hidden', 'archived', 'rejected'].includes(normalize(currentJobRecord?.status || 'approved')) &&
      !currentJobDemand.filled;
    const applicationsEnabled =
      runtimeSettings.jobApplications !== false &&
      runtimeSettings.fileUploads !== false &&
      !runtimeSettings.maintenanceMode &&
      jobApplicationsAllowed;
    const applicationsDisabledMessage = jobApplicationsAllowed
      ? 'التقديم على الوظائف أو رفع الملفات متوقف مؤقتًا من إعدادات لوحة الأدمن.'
      : currentJobDemand.filled
        ? 'اكتمل العدد المطلوب لهذه الوظيفة أو تم إغلاق التقديم عليها.'
        : 'التقديم على هذه الوظيفة موقوف حاليًا من لوحة الأدمن.';
    const searchParams = new URLSearchParams(window.location.search);
    const currentUrl = getRelativeUrl(window.location.href);
    const getSavedProfile = () => safeReadJSON(STORAGE_KEYS.applicationProfile, {});
    const allowedCvExtensions = new Set(['pdf', 'doc', 'docx', 'png', 'jpg', 'jpeg', 'webp', 'gif', 'avif']);
    const redirectToLogin = () => {
      window.location.href = buildLoginUrl(currentUrl);
    };

    const formatFileSize = (bytes) => {
      if (!Number.isFinite(bytes) || bytes < 0) return '';
      if (bytes < 1024) return `${bytes} B`;
      if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
      return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    };

    const getFileExtension = (fileName) => {
      const parts = normalize(fileName).split('.');
      return parts.length > 1 ? parts.pop() : '';
    };

    const isSupportedCvFile = (file) => {
      if (!file) return false;

      const mimeType = normalize(file.type);
      const extension = getFileExtension(file.name);

      return (
        allowedCvExtensions.has(extension) ||
        mimeType === 'application/pdf' ||
        mimeType === 'application/msword' ||
        mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
        mimeType.startsWith('image/')
      );
    };

    const buildCvFileMeta = (file) => ({
      name: file.name,
      type: file.type || 'application/octet-stream',
      size: file.size,
    });

    const setCvFileHint = (text) => {
      if (cvFileName) cvFileName.textContent = repairLegacyMojibakeText(text);
    };

    const syncCvFileState = () => {
      const savedProfile = getSavedProfile();
      const savedMeta = savedProfile.cvFileMeta || null;
      const selectedFile = cvFileInput?.files?.[0] || null;

      if (!cvFileInput) return savedMeta;

      if (selectedFile) {
        if (!isSupportedCvFile(selectedFile)) {
          cvFileInput.setCustomValidity('نوع الملف غير مدعوم. ارفع صورة أو Word أو PDF فقط.');
          setCvFileHint('نوع الملف غير مدعوم. اختر PDF أو Word أو صورة.');
          return null;
        }

        cvFileInput.setCustomValidity('');
        const meta = buildCvFileMeta(selectedFile);
        setCvFileHint(`تم الاختيار: ${meta.name}${meta.size ? ` • ${formatFileSize(meta.size)}` : ''}`);
        return meta;
      }

      if (savedMeta) {
        cvFileInput.setCustomValidity('');
        setCvFileHint(`ملف محفوظ سابقًا: ${savedMeta.name}${savedMeta.size ? ` • ${formatFileSize(savedMeta.size)}` : ''}`);
        return savedMeta;
      }

      cvFileInput.setCustomValidity('برجاء رفع ملف السيرة الذاتية أو الملف التعريفي.');
      setCvFileHint('لم يتم رفع ملف بعد.');
      return null;
    };

    const setStatus = (message, tone) => {
      statusBox.textContent = repairLegacyMojibakeText(message);
      statusBox.classList.remove('hidden', 'bg-emerald-500/10', 'text-emerald-700', 'dark:text-emerald-300', 'bg-red-500/10', 'text-red-700', 'dark:text-red-300');
      if (tone === 'error') {
        statusBox.classList.add('bg-red-500/10', 'text-red-700', 'dark:text-red-300');
      } else {
        statusBox.classList.add('bg-emerald-500/10', 'text-emerald-700', 'dark:text-emerald-300');
      }
    };

    if (!applicationsEnabled) {
      if (submitButton) {
        submitButton.disabled = true;
        submitButton.classList.add('opacity-60', 'cursor-not-allowed');
      }
      if (cvFileInput) {
        cvFileInput.disabled = true;
      }
      setStatus(applicationsDisabledMessage, 'error');
    }

    const openModal = () => {
      if (!isAuthenticated()) {
        redirectToLogin();
        return;
      }

      if (!applicationsEnabled) {
        showToast(applicationsDisabledMessage);
        return;
      }

      modal.classList.remove('hidden');
      document.body.style.overflow = 'hidden';
      form.querySelector('[name="fullName"]')?.focus();
    };

    const closeModal = () => {
      modal.classList.add('hidden');
      document.body.style.removeProperty('overflow');
    };

    const savedProfile = getSavedProfile();
    const session = getSession();
    const applicantSeed = getApplicantDraftSeed(savedProfile, session);
    const applicantProfile = applicantSeed.draftProfile || {};

    jobLabel.textContent = `التقديم على وظيفة ${currentJob.jobTitle} لدى ${currentJob.jobCompany}.`;
    form.elements.fullName.value = applicantProfile.fullName || applicantSeed.fallbackName || '';
    form.elements.email.value = applicantProfile.email || applicantSeed.fallbackEmail || '';
    form.elements.phone.value = applicantProfile.phone || '';
    form.elements.city.value = applicantProfile.city || '';
    form.elements.experience.value = applicantProfile.experience || '';
    form.elements.coverLetter.value = '';
    syncCvFileState();

    closeButtons.forEach((button) => {
      button.addEventListener('click', closeModal);
    });

    overlay?.addEventListener('click', closeModal);
    cvFileInput?.addEventListener('change', syncCvFileState);

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && !modal.classList.contains('hidden')) {
        closeModal();
      }
    });

    form.addEventListener('submit', async (event) => {
      event.preventDefault();

      if (!applicationsEnabled) {
        setStatus(applicationsDisabledMessage, 'error');
        return;
      }

      const cvFileMeta = syncCvFileState();

      if (!form.reportValidity()) {
        setStatus('برجاء استكمال كل البيانات المطلوبة قبل إرسال طلب التقديم.', 'error');
        return;
      }

      if (!cvFileMeta) {
        setStatus('برجاء رفع ملف السيرة الذاتية أو الملف التعريفي.', 'error');
        return;
      }

      const profile = {
        fullName: form.elements.fullName.value.trim(),
        email: form.elements.email.value.trim(),
        phone: form.elements.phone.value.trim(),
        city: form.elements.city.value.trim(),
        experience: form.elements.experience.value.trim(),
        cvFileMeta,
      };

      const requestId = buildApplicationRequestId();
      const applicationRecord = {
        id: requestId,
        requestId,
        job: currentJob,
        applicantPhoneKey: buildPhoneLookupKey(profile.phone),
        applicantPhoneDigits: normalizePhoneDigits(profile.phone),
        applicant: {
          ...profile,
          phoneLookupKey: buildPhoneLookupKey(profile.phone),
          coverLetter: form.elements.coverLetter.value.trim(),
        },
        company: {
          name: currentJob.jobCompany,
          email: '',
        },
        submittedAt: new Date().toISOString(),
        respondedAt: '',
        rejectionReason: '',
        status: 'review',
        companyTag: '',
        interviewScheduledAt: '',
        interviewMode: '',
        interviewLocation: '',
        notes: [],
      };

      const submitResult = await storeApplicationRecord(applicationRecord);
      if (!submitResult.ok) {
        const failureMessage =
          submitResult.message ||
          (submitResult.source === 'firebase-missing'
            ? 'التقديم متوقف حاليًا لعدم اكتمال إعدادات الربط. أضف القيم المطلوبة ثم أعد المحاولة، ولن يتم حفظ أي طلب قبل ذلك.'
            : 'تعذر إرسال الطلب حاليًا. حاول مرة أخرى بعد قليل.');
        setStatus(
          failureMessage,
          'error',
        );
        showToast(failureMessage);
        return;
      }

      const existingProfile = getStoredProfile();
      const existingApplicantSeed = getApplicantDraftSeed(existingProfile);
      saveJSON(
        STORAGE_KEYS.applicationProfile,
        persistApplicantDraftProfile(
          existingProfile,
          {
            ...profile,
            email: profile.email || existingApplicantSeed.draftProfile?.email || '',
            fullName: profile.fullName || existingApplicantSeed.draftProfile?.fullName || '',
            phone: profile.phone || existingApplicantSeed.draftProfile?.phone || '',
            city: profile.city || existingApplicantSeed.draftProfile?.city || '',
            experience: profile.experience || existingApplicantSeed.draftProfile?.experience || '',
            cvFileMeta:
              cvFileMeta ||
              existingApplicantSeed.draftProfile?.cvFileMeta ||
              existingApplicantSeed.applicantMeta?.resumeFileMeta ||
              null,
          },
          {
            desiredRole: existingApplicantSeed.applicantMeta?.desiredRole || existingProfile.headline || '',
            desiredCity:
              profile.city ||
              existingApplicantSeed.applicantMeta?.desiredCity ||
              existingApplicantSeed.draftProfile?.city ||
              '',
            experienceYears:
              profile.experience ||
              existingApplicantSeed.applicantMeta?.experienceYears ||
              existingApplicantSeed.draftProfile?.experience ||
              '',
            preferredWorkType:
              existingApplicantSeed.applicantMeta?.preferredWorkType || existingProfile.preferredWorkType || '',
            resumeFileMeta:
              cvFileMeta ||
              existingApplicantSeed.applicantMeta?.resumeFileMeta ||
              existingApplicantSeed.draftProfile?.cvFileMeta ||
              null,
          },
        ),
      );

      const trackingUrl = `track-application.html?id=${encodeURIComponent(requestId)}`;
      setStatus(`تم إرسال الطلب بنجاح. رقم الطلب: ${requestId}.`, 'success');
      showToast(`تم إرسال الطلب بنجاح. رقم الطلب: ${requestId}`);

      renderPublicJobsPage();
      initJobDetailsPage();
      const cleanUrl = appendQueryParams(window.location.href, { apply: null });
      window.history.replaceState({}, '', cleanUrl);

      setTimeout(() => {
        closeModal();
      }, 900);
    });

    window.rahmaOpenApplicationModal = openModal;

    if (searchParams.get('apply') === '1') {
      if (!isAuthenticated()) {
        redirectToLogin();
        return;
      }
      if (!applicationsEnabled) {
        showToast(applicationsDisabledMessage);
        return;
      }
      openModal();
    }
  };

  const initApplicationTrackingPage = () => {
    if (!window.location.pathname.endsWith('track-application.html')) return;

    const form = document.querySelector('[data-track-form="true"]');
    const feedbackBox = document.querySelector('[data-track-feedback]');
    const resultCard = document.querySelector('[data-track-result]');
    const placeholderCard = document.querySelector('[data-track-placeholder]');
    const requestIdInput = form?.querySelector('[name="requestId"]');
    const submitButton = form?.querySelector('[type="submit"]');
    const phoneForm = document.querySelector('[data-track-phone-form="true"]');
    const phoneFeedbackBox = document.querySelector('[data-track-phone-feedback]');
    const phoneResultsContainer = document.querySelector('[data-track-phone-results]');
    const phoneRequestCount = document.querySelector('[data-track-phone-count]');
    const phoneInput = phoneForm?.querySelector('[name="phone"]');

    if (!form || !feedbackBox || !resultCard || !placeholderCard || !requestIdInput) return;

    const setTrackPanelVisibility = (element, visible) => {
      if (!element) return;
      element.classList.toggle('is-visible', visible);
      element.classList.toggle('is-hidden', !visible);
      element.setAttribute('aria-hidden', String(!visible));
    };

    const showTrackPlaceholder = () => {
      setTrackPanelVisibility(placeholderCard, true);
      setTrackPanelVisibility(resultCard, false);
    };

    const showTrackResult = () => {
      setTrackPanelVisibility(placeholderCard, false);
      setTrackPanelVisibility(resultCard, true);
    };

    const getApplicationPhoneLookupKey = (application = {}) =>
      buildPhoneLookupKey(
        application?.applicant?.phone ||
          application?.applicant?.phoneLookupKey ||
          application?.applicantPhone ||
          application?.applicantPhoneKey ||
          application?.phone ||
          '',
      );

    const getApplicationDisplayJobTitle = (application = {}) =>
      String(application?.job?.jobTitle || application?.job?.title || application?.jobTitle || '').trim() ||
      'غير متاح';

    const getApplicationDisplayCompanyName = (application = {}) =>
      String(
        application?.job?.jobCompany ||
          application?.job?.companyName ||
          application?.company?.name ||
          application?.companyName ||
          '',
      ).trim() || 'غير متاح';

    const getApplicationSubmittedAtLabel = (value) => formatLocalDateTime(value) || 'غير متاح';

    const getApplicationRespondedAtLabel = (application = {}, status = null) => {
      const respondedAtLabel = formatLocalDateTime(application?.respondedAt);
      if (respondedAtLabel) return respondedAtLabel;
      if (status?.key === 'review') return 'لم يتم تحديث الحالة بعد';
      return 'تم التحديث بدون تاريخ واضح';
    };

    const getApplicationStatusChipClass = (tone) => {
      if (tone === 'success') return 'request-chip request-chip--success';
      if (tone === 'error') return 'request-chip request-chip--error';
      return 'request-chip request-chip--info';
    };

    const findStoredApplicationsByPhone = (phoneKey = '') => {
      const normalizedPhoneKey = buildPhoneLookupKey(phoneKey);
      if (!normalizedPhoneKey) return [];

      return getStoredApplications().filter(
        (application) => getApplicationPhoneLookupKey(application) === normalizedPhoneKey,
      );
    };

    const fetchApplicationsByPhoneFromFirebase = async (phoneKey = '') => {
      const normalizedPhoneKey = buildPhoneLookupKey(phoneKey);
      if (!normalizedPhoneKey || !hasFirebaseSiteConfig()) return [];
      if (firebaseApplicationsReadDenied) return [];

      const services = await getFirebaseSiteServices();
      if (!services) return [];

      try {
        const { db, firestoreModule } = services;
        const applicationsSnapshot = await firestoreModule.getDocs(
          firestoreModule.query(
            firestoreModule.collection(db, 'applications'),
            firestoreModule.where('applicantPhoneKey', '==', normalizedPhoneKey),
          ),
        );

        return applicationsSnapshot.docs
          .map((doc) => mapFirebaseApplicationRecord({ ...doc.data(), id: doc.id }))
          .filter((application) => getApplicationRequestId(application));
      } catch (error) {
        if (isFirebasePermissionDeniedError(error)) {
          firebaseApplicationsReadDenied = true;
          return [];
        }
        console.warn('Unable to fetch applications by phone from Firebase', error);
        return [];
      }
    };

    const getApplicationsByPhone = async (rawPhone = '') => {
      const phoneKey = buildPhoneLookupKey(rawPhone);
      if (!phoneKey) return [];

      const localMatches = findStoredApplicationsByPhone(phoneKey);
      if (!hasFirebaseSiteConfig()) {
      return localMatches
        .filter((application) => isApplicationPubliclyTrackable(application))
        .sort(
          (firstApplication, secondApplication) =>
            new Date(secondApplication?.submittedAt || 0).getTime() -
            new Date(firstApplication?.submittedAt || 0).getTime(),
        );
    }

      const firebaseMatches = await fetchApplicationsByPhoneFromFirebase(phoneKey);
      let mergedMatches = mergeRuntimeCollections(
        localMatches,
        firebaseMatches,
        (application) => getApplicationRequestId(application),
      );

      if (!mergedMatches.length || !firebaseApplicationsCacheHydrated) {
        await syncFirebasePublicCache();
        mergedMatches = mergeRuntimeCollections(
          mergedMatches,
          findStoredApplicationsByPhone(phoneKey),
          (application) => getApplicationRequestId(application),
        );
      }

      return mergedMatches
        .filter((application) => isApplicationPubliclyTrackable(application))
        .sort(
          (firstApplication, secondApplication) =>
            new Date(secondApplication?.submittedAt || 0).getTime() -
            new Date(firstApplication?.submittedAt || 0).getTime(),
        );
    };

    const setPhoneFeedback = (message, tone = 'info') => {
      if (!phoneFeedbackBox) return;
      phoneFeedbackBox.className = 'application-status';
      phoneFeedbackBox.classList.add(`application-status--${tone}`);
      phoneFeedbackBox.textContent = repairLegacyMojibakeText(message);
    };

    const clearPhoneFeedback = () => {
      if (!phoneFeedbackBox) return;
      phoneFeedbackBox.className = 'application-status hidden';
      phoneFeedbackBox.textContent = '';
    };

    const renderPhoneLookupResults = (applications = [], phoneValue = '') => {
      if (!phoneResultsContainer) return;

      const normalizedPhone = String(phoneValue || '').trim();
      const normalizedApplications = Array.isArray(applications) ? applications : [];
      phoneResultsContainer.innerHTML = '';
      phoneResultsContainer.hidden = normalizedApplications.length === 0;

      if (!normalizedApplications.length) {
        if (phoneRequestCount) {
          phoneRequestCount.textContent = '';
          phoneRequestCount.hidden = true;
        }
        return;
      }

      const countLabel = normalizedApplications.length === 1 ? 'طلب واحد' : `${normalizedApplications.length} طلبات`;
      if (phoneRequestCount) {
        phoneRequestCount.textContent = countLabel;
        phoneRequestCount.hidden = false;
      }

      phoneResultsContainer.hidden = false;
      phoneResultsContainer.innerHTML = normalizedApplications
        .map((application) => {
          const status = getApplicationStatusPresentation(application);
          const requestId = escapeHtml(getApplicationRequestId(application));
          const jobTitleText = escapeHtml(getApplicationDisplayJobTitle(application));
          const companyNameText = escapeHtml(getApplicationDisplayCompanyName(application));
          const submittedAtText = escapeHtml(getApplicationSubmittedAtLabel(application?.submittedAt));
          const respondedAtText = escapeHtml(getApplicationRespondedAtLabel(application, status));
          const rejectionReason = String(application?.rejectionReason || '').trim();
          const rejectionReasonMarkup =
            status.key === 'rejected' && rejectionReason
              ? `
              <div class="info-list__item">
                <span class="info-list__label">سبب الرفض</span>
                <p>${escapeHtml(rejectionReason)}</p>
              </div>
            `
              : '';

          return `
            <article class="page-card">
              <div class="section-head section-head--inline">
                <div>
                  <span class="section-eyebrow">طلب ${requestId}</span>
                  <h3>${jobTitleText}</h3>
                  <p>${companyNameText}</p>
                </div>
                <span class="${getApplicationStatusChipClass(status.tone)}">${escapeHtml(status.label)}</span>
              </div>
              <div class="info-list">
                <div class="info-list__item">
                  <span class="info-list__label">رقم الطلب</span>
                  <p>${requestId}</p>
                </div>
                <div class="info-list__item">
                  <span class="info-list__label">تاريخ ووقت التقديم</span>
                  <p>${submittedAtText}</p>
                </div>
                <div class="info-list__item">
                  <span class="info-list__label">آخر تحديث</span>
                  <p>${respondedAtText}</p>
                </div>
                ${rejectionReasonMarkup}
              </div>
              <div class="page-actions">
                <button class="site-action site-action--ghost" type="button" data-copy-request-id="${requestId}">
                  نسخ رقم الطلب
                </button>
                <a class="site-action site-action--secondary" href="track-application.html?id=${encodeURIComponent(
                  getApplicationRequestId(application),
                )}">عرض الحالة</a>
              </div>
            </article>
          `;
        })
        .join('');

      if (normalizedPhone) {
        setPhoneFeedback(
          normalizedApplications.length === 1
            ? 'تم العثور على طلب واحد مرتبط بهذا الرقم.'
            : `تم العثور على ${normalizedApplications.length} طلبات مرتبطة بهذا الرقم.`,
          'success',
        );
      }
    };

    const setFeedback = (message, tone = 'info') => {
      feedbackBox.className = 'application-status';
      feedbackBox.classList.add(`application-status--${tone}`);
      feedbackBox.textContent = repairLegacyMojibakeText(message);
    };

    const clearFeedback = () => {
      feedbackBox.className = 'application-status hidden';
      feedbackBox.textContent = '';
    };

    const setLookupBusyState = (busy = false) => {
      if (!(submitButton instanceof HTMLButtonElement)) return;

      if (!submitButton.dataset.defaultLabel) {
        submitButton.dataset.defaultLabel = repairLegacyMojibakeText(
          submitButton.textContent || 'عرض الحالة',
        );
      }

      submitButton.disabled = busy;
      submitButton.classList.toggle('opacity-60', busy);
      submitButton.classList.toggle('cursor-wait', busy);
      submitButton.classList.toggle('cursor-not-allowed', busy);
      submitButton.textContent = repairLegacyMojibakeText(
        busy ? 'جارٍ البحث...' : submitButton.dataset.defaultLabel || 'عرض الحالة',
      );
    };

    const renderApplication = (application) => {
      const status = getApplicationStatusPresentation(application);
      const rejectionReason = String(application?.rejectionReason || '').trim();
      const respondedAt = application?.respondedAt ? formatLocalDateTime(application.respondedAt) : '';
      const jobTitleText = String(application?.job?.jobTitle || application?.jobTitle || '').trim() || 'غير متاح';
      const companyNameText =
        String(application?.job?.jobCompany || application?.company?.name || application?.companyName || '').trim() ||
        'غير متاح';
      const resolvedRequestId = getApplicationRequestId(application);
      const trackCopyButton = document.querySelector('[data-track-copy-request]');
      const trackWhatsAppLink = document.querySelector('[data-track-whatsapp]');
      const trackingUrl = `track-application.html?id=${encodeURIComponent(resolvedRequestId)}`;

      showTrackResult();
      clearFeedback();

      const statusLabel = document.querySelector('[data-track-status-label]');
      const requestId = document.querySelector('[data-track-request-id]');
      const jobTitle = document.querySelector('[data-track-job-title]');
      const companyName = document.querySelector('[data-track-company-name]');
      const submittedAt = document.querySelector('[data-track-submitted-at]');
      const respondedAtText = document.querySelector('[data-track-responded-at]');
      const reasonWrap = document.querySelector('[data-track-reason-wrap]');
      const rejectionReasonText = document.querySelector('[data-track-rejection-reason]');

      if (statusLabel) statusLabel.textContent = repairLegacyMojibakeText(status.label);
      if (requestId) requestId.textContent = resolvedRequestId;
      if (jobTitle) jobTitle.textContent = repairLegacyMojibakeText(jobTitleText);
      if (companyName) companyName.textContent = repairLegacyMojibakeText(companyNameText);
      if (submittedAt) submittedAt.textContent = repairLegacyMojibakeText(formatLocalDateTime(application?.submittedAt) || 'غير متاح');
      if (respondedAtText) {
        respondedAtText.textContent = repairLegacyMojibakeText(
          respondedAt || (status.key === 'review' ? 'لم يتم تحديث الحالة بعد' : 'تم التحديث بدون تاريخ واضح'),
        );
      }

      if (reasonWrap) {
        const showReason = status.key === 'rejected' && rejectionReason;
        reasonWrap.classList.toggle('hidden', !showReason);
        reasonWrap.toggleAttribute('hidden', !showReason);
      }

      if (rejectionReasonText) {
        rejectionReasonText.textContent = repairLegacyMojibakeText(rejectionReason || 'لا يوجد سبب مسجل');
      }

      if (trackCopyButton instanceof HTMLButtonElement) {
        trackCopyButton.dataset.requestId = resolvedRequestId;
      }

      if (trackWhatsAppLink instanceof HTMLAnchorElement) {
        trackWhatsAppLink.href = buildWhatsAppMessageUrl(
          CONTACT_PHONE,
          buildApplicationSupportMessage(application, trackingUrl),
        );
      }
    };

    const submitLookup = async (requestIdValue) => {
      const value = String(requestIdValue || '').replace(/\D+/g, '').trim();
      requestIdInput.value = value;
      if (!value) {
        showTrackPlaceholder();
        setFeedback('اكتب رقم الطلب أولًا.', 'error');
        return;
      }

      setLookupBusyState(true);
      setFeedback('جارٍ البحث عن الطلب...', 'info');

      try {
        const application = await getApplicationByRequestId(value);
        if (!application) {
          showTrackPlaceholder();
          setFeedback('لم يتم العثور على طلب بهذا الرقم. راجع الرقم وحاول مرة أخرى.', 'error');
          return;
        }

        renderApplication(application);
      } catch (error) {
        console.warn('Unable to track application', error);
        showTrackPlaceholder();
        setFeedback('تعذر قراءة حالة الطلب الآن. حاول مرة أخرى بعد قليل.', 'error');
      } finally {
        setLookupBusyState(false);
      }
    };

    const submitPhoneLookup = async (phoneValue = '') => {
      const value = buildPhoneLookupKey(phoneValue);
      if (phoneInput) {
        phoneInput.value = normalizePhoneDigits(phoneValue);
      }

      if (!value) {
        clearPhoneFeedback();
        if (phoneResultsContainer) {
          phoneResultsContainer.innerHTML = '';
          phoneResultsContainer.hidden = true;
        }
        if (phoneRequestCount) {
          phoneRequestCount.textContent = '';
          phoneRequestCount.hidden = true;
        }
        setPhoneFeedback('اكتب رقم الهاتف أولًا.', 'error');
        return;
      }

      if (phoneResultsContainer) {
        phoneResultsContainer.innerHTML = '';
        phoneResultsContainer.hidden = true;
      }
      if (phoneRequestCount) {
        phoneRequestCount.textContent = '';
        phoneRequestCount.hidden = true;
      }

      setPhoneFeedback('جارٍ استرجاع الطلبات المرتبطة بهذا الرقم...', 'info');

      try {
        const applications = await getApplicationsByPhone(value);
        if (!applications.length) {
          if (phoneResultsContainer) {
            phoneResultsContainer.innerHTML = '';
            phoneResultsContainer.hidden = true;
          }
          if (phoneRequestCount) {
            phoneRequestCount.textContent = '';
            phoneRequestCount.hidden = true;
          }
          setPhoneFeedback('لم نعثر على أي طلبات مرتبطة بهذا الرقم. راجع الرقم وحاول مرة أخرى.', 'error');
          return;
        }

        renderPhoneLookupResults(applications, value);
      } catch (error) {
        console.warn('Unable to lookup applications by phone', error);
        if (phoneResultsContainer) {
          phoneResultsContainer.innerHTML = '';
          phoneResultsContainer.hidden = true;
        }
        if (phoneRequestCount) {
          phoneRequestCount.textContent = '';
          phoneRequestCount.hidden = true;
        }
        setPhoneFeedback('تعذر استرجاع الطلبات الآن. حاول مرة أخرى بعد قليل.', 'error');
      }
    };

    form.addEventListener('submit', (event) => {
      event.preventDefault();
      void submitLookup(requestIdInput.value);
    });

    resultCard?.addEventListener('click', async (event) => {
      const target = event.target instanceof HTMLElement ? event.target.closest('[data-track-copy-request]') : null;
      if (!(target instanceof HTMLButtonElement)) return;

      const requestId = String(target.dataset.requestId || '').trim();
      if (!requestId) return;

      const copied = await copyTextToClipboard(requestId);
      if (copied) {
        setTemporaryButtonContent(target, 'تم النسخ');
        showToast(`تم نسخ رقم الطلب: ${requestId}`);
        return;
      }

      setTemporaryButtonContent(target, 'تعذر النسخ');
    });

    requestIdInput.addEventListener('input', () => {
      requestIdInput.value = requestIdInput.value.replace(/\D+/g, '');
      if (!requestIdInput.value.trim()) {
        showTrackPlaceholder();
        clearFeedback();
      }
    });

    phoneResultsContainer?.addEventListener('click', async (event) => {
      const target = event.target instanceof HTMLElement ? event.target.closest('[data-copy-request-id]') : null;
      if (!(target instanceof HTMLButtonElement)) return;

      const requestId = String(target.dataset.copyRequestId || '').trim();
      if (!requestId) return;

      const copied = await copyTextToClipboard(requestId);
      if (copied) {
        setTemporaryButtonContent(target, 'تم النسخ');
        showToast(`تم نسخ رقم الطلب: ${requestId}`);
        return;
      }

      setTemporaryButtonContent(target, 'تعذر النسخ');
    });

    phoneForm?.addEventListener('submit', (event) => {
      event.preventDefault();
      void submitPhoneLookup(phoneInput?.value || '');
    });

    phoneInput?.addEventListener('input', () => {
      phoneInput.value = phoneInput.value.replace(/\D+/g, '');
      if (!phoneInput.value.trim()) {
        clearPhoneFeedback();
        if (phoneResultsContainer) {
          phoneResultsContainer.innerHTML = '';
          phoneResultsContainer.hidden = true;
        }
        if (phoneRequestCount) {
          phoneRequestCount.textContent = '';
          phoneRequestCount.hidden = true;
        }
      }
    });

    const initialRequestId = new URLSearchParams(window.location.search).get('id') || '';
    const initialPhone = new URLSearchParams(window.location.search).get('phone') || '';
    showTrackPlaceholder();
    if (initialRequestId) {
      requestIdInput.value = initialRequestId.replace(/\D+/g, '');
      void submitLookup(requestIdInput.value);
    } else if (initialPhone) {
      if (phoneInput) {
        phoneInput.value = initialPhone.replace(/\D+/g, '');
      }
      void submitPhoneLookup(initialPhone);
    }
  };

  const handleAuthFormSubmit = async (form) => {
    const authType = form.dataset.authForm;
    if (!authType) return false;

    if (authType === 'admin-login') {
      showToast('جارٍ تحويلك إلى بوابة الأدمن الآمنة...');
      setTimeout(() => {
        window.location.href = ADMIN_LOGIN_URL;
      }, 450);
      return true;
    }

    const redirectTarget = sanitizeInternalNavigationTarget(
      new URLSearchParams(window.location.search).get('redirect'),
      'company-dashboard.html',
    );
    const authView =
      authType === 'register' ? 'register' : authType === 'forgot-password' ? 'forgot-password' : 'login';
    window.location.href = buildAuthUrl(authView, redirectTarget);
    return true;
  };
    /* Legacy static auth flow removed in favor of React Auth + Firebase.

    if (authType === 'login') {
      const email = form.querySelector('[name="email"]')?.value.trim() || '';
      const password = form.querySelector('[name="password"]')?.value || '';
      const existingProfile = safeReadJSON(STORAGE_KEYS.applicationProfile, {});
      const storedRecord = existingProfile.passwordRecord || null;
      const defaultRedirect = 'company-dashboard.html';
      const redirect = sanitizeInternalNavigationTarget(
        new URLSearchParams(window.location.search).get('redirect'),
        defaultRedirect,
      );
      const accountRole = 'company';
      const derivedName =
        existingProfile.fullName ||
        email.split('@')[0]?.replace(/[._-]+/g, ' ').trim() ||
        'مستخدم جديد';

      if (!email || !password) {
        showAuthStatus('من فضلك اكتب البريد الإلكتروني وكلمة المرور.', 'error');
        return true;
      }

      if (!existingProfile.email) {
        showAuthStatus('البريد الإلكتروني غير مسجل.', 'error');
        return true;
      }

      if (normalize(existingProfile.email) !== normalize(email)) {
        showAuthStatus('البريد الإلكتروني غير مسجل.', 'error');
        return true;
      }

      if (existingProfile.accountStatus === 'review') {
        showAuthStatus('حسابك ما زال قيد المراجعة.', 'error');
        return true;
      }

      if (storedRecord) {
        const passwordOk = await verifyPasswordRecord(password, storedRecord);
        if (!passwordOk) {
          showAuthStatus('كلمة المرور غير صحيحة.', 'error');
          return true;
        }
      }

      setSession({
        loggedIn: true,
        role: accountRole,
        email,
        name: derivedName,
        loggedInAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + SESSION_TTL_MS).toISOString(),
      });

      setTimeout(() => {
        navigateToInternal(redirect, defaultRedirect);
      }, 650);
      return true;
    }

    if (authType === 'forgot-password') {
      const email = form.querySelector('[name="email"]')?.value.trim() || '';
      const password = form.querySelector('[name="password"]')?.value || '';
      const confirmPassword = form.querySelector('[name="confirm_password"]')?.value || '';
      const existingProfile = safeReadJSON(STORAGE_KEYS.applicationProfile, {});

      if (!email || !password || !confirmPassword) {
        showAuthStatus('من فضلك اكتب البريد الإلكتروني وكلمة المرور الجديدة وتأكيدها.', 'error');
        return true;
      }

      if (!existingProfile.email || normalize(existingProfile.email) !== normalize(email)) {
        showAuthStatus('البريد الإلكتروني غير مسجل على هذا المتصفح.', 'error');
        return true;
      }

      if (password.length < 8) {
        showAuthStatus('كلمة المرور الجديدة يجب أن تكون 8 أحرف على الأقل.', 'error');
        return true;
      }

      if (password !== confirmPassword) {
        showAuthStatus('كلمتا المرور غير متطابقتين.', 'error');
        return true;
      }

      const passwordRecord = await createPasswordRecord(password);
      saveJSON(STORAGE_KEYS.applicationProfile, {
        ...existingProfile,
        passwordRecord,
      });

      showAuthStatus('تم تحديث كلمة المرور بنجاح. يمكنك تسجيل الدخول الآن.', 'success');
      setTimeout(() => {
        window.location.href = buildAuthUrl('login', 'company-dashboard.html');
      }, 700);
      return true;
    }

    if (authType === 'register') {
      const accountType = 'company';
      if (runtimeSettings.maintenanceMode) {
        showAuthStatus('الموقع في وضع الصيانة حاليًا. التسجيل متوقف مؤقتًا.', 'error');
        return true;
      }
      if (runtimeSettings.companyRegistration === false) {
        showAuthStatus('تسجيل الشركات متوقف مؤقتًا من لوحة الأدمن.', 'error');
        return true;
      }
      const firstName = form.querySelector('[name="first_name"]')?.value.trim() || '';
      const lastName = form.querySelector('[name="last_name"]')?.value.trim() || '';
      const desiredRole = form.querySelector('[name="desired_role"]')?.value.trim() || '';
      const desiredCity = form.querySelector('[name="desired_city"]')?.value.trim() || '';
      const experienceYears = form.querySelector('[name="experience_years"]')?.value.trim() || '';
      const preferredWorkType = form.querySelector('[name="preferred_work_type"]')?.value.trim() || '';
      const companyName = form.querySelector('[name="company_name"]')?.value.trim() || '';
      const companySector = form.querySelector('[name="company_sector"]')?.value.trim() || '';
      const companyCity = form.querySelector('[name="company_city"]')?.value.trim() || '';
      const teamSize = sanitizePositiveIntegerInput(form.querySelector('[name="team_size"]')?.value || '');
      const selectedTemplate = form.querySelector('[data-selected-template]')?.value.trim() || '';
      const customJobDraft = {
        title: form.querySelector('[name="custom_job_title"]')?.value.trim() || '',
        department: form.querySelector('[name="custom_job_department"]')?.value.trim() || '',
        city: form.querySelector('[name="custom_job_city"]')?.value.trim() || '',
        type: form.querySelector('[name="custom_job_type"]')?.value.trim() || '',
        salary: form.querySelector('[name="custom_job_salary"]')?.value.trim() || '',
        positions: form.querySelector('[name="custom_job_positions"]')?.value.trim() || '',
        description: form.querySelector('[name="custom_job_description"]')?.value.trim() || '',
        requirements: form.querySelector('[name="custom_job_requirements"]')?.value.trim() || '',
        benefits: form.querySelector('[name="custom_job_benefits"]')?.value.trim() || '',
      };
      const email = form.querySelector('[name="email"]')?.value.trim() || '';
      const phone = form.querySelector('[name="phone"]')?.value.trim() || '';
      const password = form.querySelector('[name="password"]')?.value || '';
      const confirmPassword = form.querySelector('[name="confirm_password"]')?.value || '';
      const socialDraft = getSocialDraft();
      const readFileMeta = (name) => {
        const file = form.querySelector(`[name="${name}"]`)?.files?.[0];
        if (!file) return null;
        return {
          name: file.name,
          type: file.type || 'application/octet-stream',
          size: file.size,
        };
      };
      const resumeFileMeta = readFileMeta('resume_file');
      const companyLogoMeta = readFileMeta('company_logo');
      const companyCoverMeta = readFileMeta('company_cover');

      const savedProfile = safeReadJSON(STORAGE_KEYS.applicationProfile, {});
      if (!password || password.length < 8) {
        showAuthStatus('كلمة المرور يجب أن تكون 8 أحرف على الأقل.', 'error');
        return true;
      }

      if (password !== confirmPassword) {
        showAuthStatus('كلمتا المرور غير متطابقتين.', 'error');
        return true;
      }

      if (accountType === 'company' && (!companyName || !companySector || !companyCity)) {
        showAuthStatus('من فضلك أكمل بيانات الشركة الأساسية.', 'error');
        return true;
      }

      if (accountType === 'company' && !teamSize) {
        showAuthStatus('اكتب حجم الفريق كرقم صحيح أكبر من صفر.', 'error');
        return true;
      }

      const profileName = `${firstName} ${lastName}`.trim() || socialDraft?.name || '';
      const resolvedEmail = email || socialDraft?.email || savedProfile.email || '';

      if (accountType === 'company' && isDisposableEmailAddress(resolvedEmail)) {
        showAuthStatus('استخدم بريدًا إلكترونيًا رسميًا للشركة. الإيميلات المؤقتة أو الوهمية غير مسموح بها.', 'error');
        return true;
      }

      const passwordRecord = await createPasswordRecord(password);

      if (accountType === 'company') {
        const nextCompanyProfile = {
          ...savedProfile,
          role: 'company',
          accountStatus: 'active',
          authProvider: socialDraft?.provider || savedProfile.authProvider || '',
          fullName: companyName || savedProfile.fullName || '',
          email: resolvedEmail,
          phone: phone || savedProfile.phone || '',
          passwordRecord,
          city: companyCity || savedProfile.city || '',
          headline: companySector || savedProfile.headline || '',
          companyProfile: {
            companyName,
            companySector,
            companyCity,
            teamSize,
            companyLogoMeta,
            companyCoverMeta,
            templateKey: selectedTemplate,
            draft: customJobDraft,
          },
          companyName,
          companySector,
          companyCity,
          teamSize,
          companyLogoMeta: companyLogoMeta || savedProfile.companyLogoMeta || null,
          companyCoverMeta: companyCoverMeta || savedProfile.companyCoverMeta || null,
          companyTemplateKey: selectedTemplate || savedProfile.companyTemplateKey || '',
          companyJobDraft: customJobDraft,
          companyJobs: Array.isArray(savedProfile.companyJobs) ? savedProfile.companyJobs : [],
        };

        nextCompanyProfile.companyProfile = {
          ...nextCompanyProfile.companyProfile,
          jobs: Array.isArray(savedProfile?.companyProfile?.jobs) ? savedProfile.companyProfile.jobs : [],
        };

        saveJSON(STORAGE_KEYS.applicationProfile, nextCompanyProfile);
        syncCompanyPublishingState(nextCompanyProfile, null);
        refreshCompanySession(nextCompanyProfile, {
          loggedIn: true,
          role: 'company',
          email: resolvedEmail,
          name: companyName || profileName || savedProfile.fullName || 'شركة',
          loggedInAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + SESSION_TTL_MS).toISOString(),
        });
      } else {
        saveJSON(STORAGE_KEYS.applicationProfile, {
          ...savedProfile,
          role: 'company',
          accountStatus: 'active',
          authProvider: socialDraft?.provider || savedProfile.authProvider || '',
          fullName: profileName || savedProfile.fullName || '',
          email: resolvedEmail,
          phone: phone || savedProfile.phone || '',
          passwordRecord,
          city: desiredCity || savedProfile.city || '',
          experience: experienceYears || savedProfile.experience || '',
          headline: desiredRole || savedProfile.headline || '',
          preferredWorkType: preferredWorkType || savedProfile.preferredWorkType || '',
          seekerProfile: {
            desiredRole,
            desiredCity,
            experienceYears,
            preferredWorkType,
            resumeFileMeta,
          },
          cvFileMeta: resumeFileMeta || savedProfile.cvFileMeta || null,
        });
      }

      clearSocialDraft();
      showAuthStatus('تم إنشاء حساب الشركة بنجاح. يتم تحويلك إلى لوحة الشركة الآن.', 'success');
      setTimeout(() => {
        navigateToInternal('company-dashboard.html');
      }, 800);
      return true;
    }

    return false;
  };
  */

  const initPasswordVisibilityToggles = () => {
    document.querySelectorAll('[data-password-toggle]').forEach((button) => {
      if (button.dataset.passwordToggleBound === 'true') return;
      button.dataset.passwordToggleBound = 'true';

      const input =
        button.closest('.auth-clean__password-wrap')?.querySelector('input[type="password"], input[type="text"]');
      const icon = button.querySelector('.material-symbols-outlined');
      if (!input) return;

        const syncState = (visible) => {
          input.type = visible ? 'text' : 'password';
          button.setAttribute('aria-pressed', String(visible));
        button.setAttribute('aria-label', visible ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور');
        if (icon) {
          icon.textContent = visible ? 'visibility_off' : 'visibility';
        }
      };

      syncState(false);

      button.addEventListener('click', () => {
        syncState(input.type === 'password');
      });
    });
  };

  const initAdminAccessGuard = () => {
    const currentPath = window.location.pathname.replace(/^\/+/, '');
    const currentPage = currentPath.split('/').pop() || '';
    const redirectMap = {
      'admin-login.html': ADMIN_LOGIN_URL,
      'admin-panel.html': ADMIN_DASHBOARD_URL,
      'access.html': ADMIN_LOGIN_URL,
      'console.html': ADMIN_DASHBOARD_URL,
      'portal/access.html': ADMIN_LOGIN_URL,
      'portal/console.html': ADMIN_DASHBOARD_URL,
    };

    if (redirectMap[currentPath]) {
      window.location.replace(redirectMap[currentPath]);
      return;
    }

    if (redirectMap[currentPage]) {
      window.location.replace(redirectMap[currentPage]);
    }
  };

  const initMobileBrandHomeLinks = () => {
    const mediaQuery = window.matchMedia('(max-width: 767px)');
    const brandElements = Array.from(document.querySelectorAll('.site-brand'));

    if (!brandElements.length) return;

    const updateState = () => {
      brandElements.forEach((brand) => {
        if (brand.closest('a')) return;

        if (mediaQuery.matches) {
          brand.dataset.mobileHomeLink = 'true';
          brand.setAttribute('role', 'link');
          brand.setAttribute('tabindex', '0');
          return;
        }

        delete brand.dataset.mobileHomeLink;
        brand.removeAttribute('role');
        brand.removeAttribute('tabindex');
      });
    };

    updateState();

    const changeHandler = () => updateState();
    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', changeHandler);
    } else if (typeof mediaQuery.addListener === 'function') {
      mediaQuery.addListener(changeHandler);
    }

    const goHome = () => {
      window.location.href = 'index.html';
    };

    document.addEventListener('click', (event) => {
      if (!mediaQuery.matches) return;
      const brand = event.target.closest('.site-brand[data-mobile-home-link="true"]');
      if (!brand) return;
      event.preventDefault();
      goHome();
    });

    document.addEventListener('keydown', (event) => {
      if (!mediaQuery.matches) return;
      if (event.key !== 'Enter' && event.key !== ' ') return;
      const brand = event.target.closest('.site-brand[data-mobile-home-link="true"]');
      if (!brand) return;
      event.preventDefault();
      goHome();
    });
  };


  const MOBILE_DRAWER_MENU_ITEMS = [
    {
      key: 'home',
      label: '\u0627\u0644\u0631\u0626\u064a\u0633\u064a\u0629',
      description: '\u0646\u0642\u0637\u0629 \u0627\u0644\u0627\u0646\u0637\u0644\u0627\u0642 \u0627\u0644\u0623\u0648\u0644\u0649',
      href: 'index.html',
      icon: 'home'
    },
    {
      key: 'jobs',
      label: '\u0627\u0644\u0648\u0638\u0627\u0626\u0641',
      description: '\u062a\u0635\u0641\u062d \u0627\u0644\u0641\u0631\u0635 \u0648\u0641\u0644\u062a\u0631\u0647\u0627 \u0628\u0633\u0631\u0639\u0629',
      href: 'jobs.html',
      icon: 'briefcase'
    },
    {
      key: 'companies',
      label: '\u0627\u0644\u0634\u0631\u0643\u0627\u062a',
      description: '\u0627\u0633\u062a\u0643\u0634\u0641 \u0623\u0635\u062d\u0627\u0628 \u0627\u0644\u0639\u0645\u0644 \u0648\u0627\u0644\u0642\u0637\u0627\u0639\u0627\u062a',
      href: 'companies.html',
      icon: 'building'
    },
    {
      key: 'about',
      label: '\u0645\u0646 \u0646\u062d\u0646',
      description: '\u062a\u0639\u0631\u0641 \u0639\u0644\u0649 \u0631\u0624\u064a\u0629 \u0627\u0644\u0645\u0646\u0635\u0629 \u0648\u0637\u0631\u064a\u0642\u0629 \u0639\u0645\u0644\u0647\u0627',
      href: 'about.html#overview',
      icon: 'spark'
    },
    {
      key: 'track',
      label: '\u0645\u062a\u0627\u0628\u0639\u0629 \u0627\u0644\u0637\u0644\u0628',
      description: '\u0627\u0639\u0631\u0641 \u0622\u062e\u0631 \u062d\u0627\u0644\u0629 \u0644\u0644\u0637\u0644\u0628 \u0628\u0631\u0642\u0645 \u0627\u0644\u0637\u0644\u0628',
      href: 'track-application.html',
      icon: 'help'
    },
    {
      key: 'contact',
      label: '\u062a\u0648\u0627\u0635\u0644 \u0645\u0639\u0646\u0627',
      description: '\u0642\u0646\u0648\u0627\u062a \u0627\u0644\u062f\u0639\u0645 \u0648\u0627\u0644\u062a\u0648\u0627\u0635\u0644 \u0627\u0644\u0645\u0628\u0627\u0634\u0631',
      href: 'contact.html',
      icon: 'mail'
    },
  ];
  const MOBILE_DRAWER_EXCLUDED_PAGES = new Set(["admin-panel.html", "admin-login.html", "access.html", "console.html", "portal/access.html", "portal/console.html", "company-dashboard.html"]);

  const getMobileDrawerActiveKey = (pageName) => {
    if (['jobs.html', 'job-details.html'].includes(pageName)) return 'jobs';
    if (['companies.html', 'company-details.html'].includes(pageName)) return 'companies';
    if (pageName === 'about.html') return 'about';
    if (pageName === 'track-application.html') return 'track';
    if (pageName === 'contact.html') return 'contact';
    return 'home';
  };

  const getMobileDrawerIcon = (icon) => {
    const icons = {
      home: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-4.5v-5.5h-5V21H5a1 1 0 0 1-1-1z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>',
      briefcase: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 7V5.5A1.5 1.5 0 0 1 9.5 4h5A1.5 1.5 0 0 1 16 5.5V7" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/><rect x="3" y="7" width="18" height="13" rx="3" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M3 12h18" fill="none" stroke="currentColor" stroke-width="1.7"/></svg>',
      building: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 20V6.5A1.5 1.5 0 0 1 6.5 5h4A1.5 1.5 0 0 1 12 6.5V20" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M12 20V3.5A1.5 1.5 0 0 1 13.5 2h4A1.5 1.5 0 0 1 19 3.5V20" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M8 9h1M8 12h1M15 7h1M15 10h1M15 13h1" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>',
      spark: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 1.7 4.3L18 9l-4.3 1.7L12 15l-1.7-4.3L6 9l4.3-1.7z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><path d="M18.5 3.5 19 5l1.5.5L19 6l-.5 1.5L18 6l-1.5-.5L18 5zM5.5 15.5 6 17l1.5.5L6 18l-.5 1.5L5 18l-1.5-.5L5 17z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>',
      help: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9.25 9a2.75 2.75 0 1 1 4.6 2.04c-.9.8-1.85 1.4-1.85 2.71" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/><circle cx="12" cy="17.3" r=".9" fill="currentColor"/><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.7"/></svg>',
      mail: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="3" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="m5 7 7 5 7-5" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>',
      login: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 7.5V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h7a2 2 0 0 0 2-2v-1.5" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/><path d="M20 12H9m7-4 4 4-4 4" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>',
      plus: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
      dashboard: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="4" width="7" height="7" rx="2" fill="none" stroke="currentColor" stroke-width="1.7"/><rect x="13" y="4" width="7" height="4" rx="2" fill="none" stroke="currentColor" stroke-width="1.7"/><rect x="13" y="10" width="7" height="10" rx="2" fill="none" stroke="currentColor" stroke-width="1.7"/><rect x="4" y="13" width="7" height="7" rx="2" fill="none" stroke="currentColor" stroke-width="1.7"/></svg>',
      logout: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 7.5V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h7a2 2 0 0 0 2-2v-1.5" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/><path d="M10 12h11m-4-4 4 4-4 4" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>',
      menu: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 7h14M5 12h14M5 17h10" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/></svg>',
      close: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m7 7 10 10M17 7 7 17" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/></svg>',
    };

    return icons[icon] || icons.menu;
  };

  const initSiteMobileDrawer = () => {
    const currentPage = window.location.pathname.split('/').pop() || 'index.html';
    if (MOBILE_DRAWER_EXCLUDED_PAGES.has(currentPage)) return;

    const authTopbar = document.querySelector('.auth-topbar');
    const brand = document.querySelector('.site-brand');
    const useAuthTopbar = Boolean(authTopbar && (!brand || brand.closest('.auth-brand')));
    const mountRow = useAuthTopbar ? authTopbar : brand?.parentElement;
    if (!mountRow || document.querySelector('[data-site-mobile-drawer="true"]')) return;

    const mobileQuery = window.matchMedia('(max-width: 767px)');
    const activeKey = getMobileDrawerActiveKey(currentPage);
    const session = getSession();
    const role = normalize(session?.role);
    const dashboardHref = 'company-dashboard.html';
    const dashboardLabel = 'لوحة الشركة';

    document.querySelectorAll('[data-mobile-menu], [data-mobile-menu-toggle]').forEach((node) => node.remove());
    Array.from(mountRow.children).forEach((child) => {
      if (useAuthTopbar || child !== brand) {
        child.setAttribute('data-mobile-drawer-hide', 'true');
      }
    });
    mountRow.classList.add('mobile-drawer-row');

    const navLinksMarkup = MOBILE_DRAWER_MENU_ITEMS.map((item, index) => {
      const isActive = item.key === activeKey;
      return `
        <a class="mobile-site-drawer__link${isActive ? ' is-active' : ''}" href="${item.href}" style="--item-index:${index}">
          <span class="mobile-site-drawer__content">
            <span class="mobile-site-drawer__label">${item.label}</span>
            <span class="mobile-site-drawer__description">${item.description || ''}</span>
          </span>
          <span class="mobile-site-drawer__icon">${getMobileDrawerIcon(item.icon)}</span>
        </a>`;
    }).join('');

    const actionItems = [];
    if (session?.loggedIn && role === 'company') {
      actionItems.push(`
        <a class="mobile-site-drawer__action mobile-site-drawer__action--ghost" href="${dashboardHref}" style="--item-index:${MOBILE_DRAWER_MENU_ITEMS.length}">
          <span>${dashboardLabel}</span>
          <span class="mobile-site-drawer__icon">${getMobileDrawerIcon('dashboard')}</span>
        </a>`);
      actionItems.push(`
        <a class="mobile-site-drawer__action mobile-site-drawer__action--primary" href="${buildAuthUrl('login', dashboardHref)}" data-logout="true" style="--item-index:${MOBILE_DRAWER_MENU_ITEMS.length + 1}">
          <span>تسجيل الخروج</span>
          <span class="mobile-site-drawer__icon">${getMobileDrawerIcon('logout')}</span>
        </a>`);
    } else {
      actionItems.push(`
        <a class="mobile-site-drawer__action mobile-site-drawer__action--ghost" href="${buildAuthUrl('login', dashboardHref)}" style="--item-index:${MOBILE_DRAWER_MENU_ITEMS.length}">
          <span>تسجيل الدخول</span>
          <span class="mobile-site-drawer__icon">${getMobileDrawerIcon('login')}</span>
        </a>`);
      actionItems.push(`
        <a class="mobile-site-drawer__action mobile-site-drawer__action--primary" href="${buildAuthUrl('register', dashboardHref)}" style="--item-index:${MOBILE_DRAWER_MENU_ITEMS.length + 1}">
          <span>سجل شركتك</span>
          <span class="mobile-site-drawer__icon">${getMobileDrawerIcon('plus')}</span>
        </a>`);
    }

    const drawer = document.createElement('div');
    drawer.className = 'mobile-site-drawer';
    drawer.setAttribute('data-site-mobile-drawer', 'true');
    drawer.setAttribute('aria-hidden', 'true');
    drawer.innerHTML = `
      <div class="mobile-site-drawer__backdrop" data-site-mobile-close></div>
      <aside class="mobile-site-drawer__panel" data-site-mobile-panel>
        <div class="mobile-site-drawer__top">
          <div class="mobile-site-drawer__brand-block">
            <div class="mobile-site-drawer__brand-mark">
              <img src="logo-mark.png" alt="\u0634\u0639\u0627\u0631 \u0645\u0646\u0635\u0629 \u0627\u0644\u0631\u062d\u0645\u0629 \u0627\u0644\u0645\u0647\u062f\u0627\u0647 \u0644\u0644\u0648\u0638\u0627\u0626\u0641" class="mobile-site-drawer__brand-logo"/>
            </div>
            <div class="mobile-site-drawer__brand-copy">
              <span class="mobile-site-drawer__eyebrow">\u0648\u0627\u062c\u0647\u0629 \u062a\u0646\u0642\u0644 \u0633\u0631\u064a\u0639\u0629</span>
              <strong class="mobile-site-drawer__title">\u0645\u0646\u0635\u0629 \u0627\u0644\u0631\u062d\u0645\u0629 \u0627\u0644\u0645\u0647\u062f\u0627\u0647 \u0644\u0644\u0648\u0638\u0627\u0626\u0641</strong>
              <span class="mobile-site-drawer__subtitle">\u0643\u0644 \u0627\u0644\u0623\u0642\u0633\u0627\u0645 \u0627\u0644\u0623\u0633\u0627\u0633\u064a\u0629 \u0641\u064a \u0645\u0643\u0627\u0646 \u0648\u0627\u062d\u062f \u0648\u0628\u0634\u0643\u0644 \u0623\u0633\u0631\u0639 \u0639\u0644\u0649 \u0627\u0644\u0645\u0648\u0628\u0627\u064a\u0644.</span>
            </div>
          </div>
          <button class="mobile-site-drawer__close" type="button" data-site-mobile-close aria-label="\u0625\u063a\u0644\u0627\u0642 \u0627\u0644\u0642\u0627\u0626\u0645\u0629">
            ${getMobileDrawerIcon('close')}
          </button>
        </div>
        <div class="mobile-site-drawer__list">${navLinksMarkup}</div>
        <div class="mobile-site-drawer__actions">${actionItems.join('')}</div>
      </aside>`;
    document.body.appendChild(drawer);

    const toggleButton = document.createElement('button');
    toggleButton.type = 'button';
    toggleButton.className = 'mobile-site-drawer__toggle';
    toggleButton.setAttribute('aria-expanded', 'false');
    toggleButton.setAttribute('aria-label', 'فتح قائمة التصفح');
    toggleButton.setAttribute('data-site-mobile-toggle', 'true');
    toggleButton.innerHTML = `<span>${getMobileDrawerIcon('menu')}</span>`;
    mountRow.appendChild(toggleButton);

    const panel = drawer.querySelector('[data-site-mobile-panel]');
    const closeButtons = Array.from(drawer.querySelectorAll('[data-site-mobile-close]'));
    const closeDrawer = () => {
      drawer.classList.remove('is-open');
      drawer.setAttribute('aria-hidden', 'true');
      toggleButton.setAttribute('aria-expanded', 'false');
      document.body.classList.remove('mobile-drawer-open');
    };

    const openDrawer = () => {
      if (!mobileQuery.matches) return;
      drawer.classList.add('is-open');
      drawer.setAttribute('aria-hidden', 'false');
      toggleButton.setAttribute('aria-expanded', 'true');
      document.body.classList.add('mobile-drawer-open');
      panel?.querySelector('a')?.focus?.();
    };

    toggleButton.addEventListener('click', () => {
      if (drawer.classList.contains('is-open')) {
        closeDrawer();
        return;
      }
      openDrawer();
    });

    closeButtons.forEach((button) => button.addEventListener('click', closeDrawer));
    drawer.querySelectorAll('a').forEach((link) => link.addEventListener('click', closeDrawer));

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') closeDrawer();
    });

    const syncDrawerState = () => {
      if (!mobileQuery.matches) closeDrawer();
    };

    if (typeof mobileQuery.addEventListener === 'function') {
      mobileQuery.addEventListener('change', syncDrawerState);
    } else if (typeof mobileQuery.addListener === 'function') {
      mobileQuery.addListener(syncDrawerState);
    }
  };

  const initPageState = () => {
    purgeLegacyRuntimeStorage();
    syncAdminRuntimeFromSharedFile();
    const localRuntime = sanitizeAdminRuntime(safeReadJSON(ADMIN_RUNTIME_KEY, {})).runtime;
    if (shouldWriteSharedRuntimeOnBootstrap() && hasShareableRuntimeRecords(localRuntime)) {
      void syncSharedAdminRuntimeFile(localRuntime);
    }
    const runtimeSettings = getAdminRuntimeSettings();
    if (runtimeSettings.maintenanceMode) {
      document.documentElement.dataset.maintenanceMode = 'true';
    } else {
      delete document.documentElement.dataset.maintenanceMode;
    }

    syncSystemBanner();
    syncMaintenanceShell();
    renderStaticPageContent();
    renderFaqPage();
    normalizePublicLabels();

    if (isAuthenticated()) {
      document.documentElement.dataset.userState = 'authenticated';
      return;
    }

    document.documentElement.dataset.userState = 'guest';
  };

  let siteMotionObserver = null;
  let siteMotionMutationObserver = null;
  let siteMotionRefreshFrame = null;

  const getMotionDelay = (start = 0, step = 70, index = 0, max = 560) => Math.min(start + step * index, max);

  const getUniqueMotionElements = (selector) =>
    Array.from(new Set(Array.from(document.querySelectorAll(selector))))
      .filter(Boolean)
      .filter((element) => !element.closest('[data-motion-skip="true"]'))
      .filter((element) => !['SCRIPT', 'STYLE'].includes(element.tagName));

  const markMotionTarget = (element, motion, options = {}) => {
    if (!element || element.dataset.motionLocked === 'true') return;

    if (options.force === true || !element.dataset.motion) {
      element.dataset.motion = motion;
    }

    if (options.hover && (options.force === true || !element.dataset.motionHover)) {
      element.dataset.motionHover = options.hover;
    }

    if (
      typeof options.duration === 'number' &&
      (options.force === true || !element.style.getPropertyValue('--motion-duration'))
    ) {
      element.style.setProperty('--motion-duration', `${options.duration}ms`);
    }

    if (
      typeof options.delay === 'number' &&
      (options.force === true || !element.style.getPropertyValue('--motion-delay'))
    ) {
      element.style.setProperty('--motion-delay', `${options.delay}ms`);
    }

    element.dataset.motionOnce = options.once === false ? 'false' : 'true';
  };

  const markMotionList = (elements, motions, options = {}) => {
    Array.from(new Set(elements))
      .filter(Boolean)
      .forEach((element, index) => {
        const motion = Array.isArray(motions)
          ? motions[index % motions.length]
          : typeof motions === 'function'
            ? motions(element, index)
            : motions;

        markMotionTarget(element, motion, {
          ...options,
          delay: getMotionDelay(options.startDelay || 0, options.step || 70, index, options.maxDelay || 560),
        });
      });
  };

  const markMotionChildren = (containerSelector, motions, options = {}) => {
    document.querySelectorAll(containerSelector).forEach((container, containerIndex) => {
      const children = Array.from(container.children).filter(
        (child) => !child.hasAttribute('hidden') && !['SCRIPT', 'STYLE'].includes(child.tagName),
      );

      children.forEach((child, index) => {
        const motion = Array.isArray(motions)
          ? motions[Math.min(index, motions.length - 1)] || motions[index % motions.length]
          : motions;

        markMotionTarget(child, motion, {
          ...options,
          delay: getMotionDelay(
            (options.startDelay || 0) + containerIndex * (options.groupOffset || 40),
            options.step || 85,
            index,
            options.maxDelay || 700,
          ),
        });
      });
    });
  };

  const revealMotionTarget = (element) => {
    if (!element || element.dataset.motionVisible === 'true') return;
    element.dataset.motionVisible = 'true';
  };

  const primeVisibleMotionTargets = () => {
    const fold = window.innerHeight * 0.9;
    document.querySelectorAll('[data-motion]').forEach((element) => {
      const rect = element.getBoundingClientRect();
      if (rect.top <= fold) {
        revealMotionTarget(element);
      }
    });
  };

  const observeSiteMotionTargets = () => {
    const elements = getUniqueMotionElements('[data-motion]');
    if (!elements.length) return;

    if (prefersReducedMotion()) {
      document.documentElement.dataset.motionReady = 'true';
      elements.forEach((element) => revealMotionTarget(element));
      return;
    }

    if (!siteMotionObserver) {
      siteMotionObserver = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (!entry.isIntersecting) return;
            revealMotionTarget(entry.target);

            if (entry.target.dataset.motionOnce !== 'false') {
              siteMotionObserver.unobserve(entry.target);
            }
          });
        },
        {
          threshold: 0.14,
          rootMargin: '0px 0px -8% 0px',
        },
      );
    }

    elements.forEach((element) => {
      if (element.dataset.motionObserved === 'true') return;
      siteMotionObserver.observe(element);
      element.dataset.motionObserved = 'true';
    });

    primeVisibleMotionTargets();
    document.documentElement.dataset.motionReady = 'true';
  };

  const decorateSiteMotionTargets = () => {
    document.body.classList.add('site-motion-enabled');

    markMotionList(
      getUniqueMotionElements('header, body > nav, body > nav.glass-nav, .site-topbar, .dashboard-topbar, .dashboard-sidebar'),
      'header-drop',
      { step: 50, duration: 760, maxDelay: 180, hover: 'panel' },
    );

    markMotionList(
      getUniqueMotionElements('main > section, .dashboard-hero, .dashboard-main-grid, .dashboard-shell, .auth-panel, .auth-visual, .auth-main, .home-final-cta, .footer-cta'),
      'section-rise',
      { step: 80, duration: 900, maxDelay: 420, hover: 'panel' },
    );

    markMotionChildren('.home-hero-v2__copy', ['trail', 'headline', 'copy', 'pop', 'trail'], {
      step: 90,
      duration: 920,
      maxDelay: 520,
    });

    markMotionChildren('.home-hero-v2__panel', ['trail', 'headline', 'copy', 'soft-card', 'soft-card'], {
      step: 85,
      duration: 880,
      maxDelay: 520,
      hover: 'panel',
    });

    markMotionChildren('.jobs-hero__copy', ['trail', 'headline', 'copy', 'soft-card', 'soft-card'], {
      step: 90,
      duration: 900,
      maxDelay: 520,
    });

    markMotionChildren('.jobs-hero__panel', ['trail', 'headline', 'copy', 'card-rise', 'soft-card'], {
      step: 85,
      duration: 860,
      maxDelay: 520,
      hover: 'panel',
    });

    markMotionChildren('.auth-panel', ['trail', 'image-float', 'headline', 'copy', 'field-rise'], {
      step: 75,
      duration: 840,
      maxDelay: 520,
    });

    markMotionChildren('.auth-visual', ['image-float', 'headline', 'copy', 'card-rise', 'card-tilt'], {
      step: 80,
      duration: 860,
      maxDelay: 520,
      hover: 'panel',
    });

    markMotionChildren('.home-section-head, .section-head, .section-head--inline, .jobs-results__head, .dashboard-panel__header, .dashboard-hero__content, .home-hero-v2__panel-head', ['trail', 'headline', 'copy'], {
      step: 70,
      duration: 800,
      maxDelay: 280,
    });

    markMotionList(
      getUniqueMotionElements(
        '.home-hero-v2__stack > article, .home-hero-v2__pulse > article, .home-value-grid > *, .home-modern-jobs > *, .home-footer__grid--compact > *, .jobs-hero__signals > article, .jobs-trend-list > article, .jobs-chip-bar__inner > *, .jobs-results__grid > *, .dashboard-panel, .dashboard-opportunity-card, .dashboard-progress-card, .dashboard-highlight-card, .dashboard-brand-card, .dashboard-stat-card, .dashboard-mini-stats > article, .auth-features > *, .account-card, .upload-card, .template-card, .auth-method-card, .company-card, .listing-job-card, .page-card',
      ),
      ['card-rise', 'card-tilt', 'soft-card'],
      {
        step: 65,
        duration: 820,
        maxDelay: 560,
        hover: 'card',
      },
    );

    markMotionList(
      getUniqueMotionElements('.home-search-card__field, .jobs-search-panel__field, .auth-grid > *, .auth-form > *, .dashboard-search, .dashboard-topbar__actions > *, .dashboard-hero__actions > *'),
      ['field-rise', 'trail'],
      {
        step: 55,
        duration: 760,
        maxDelay: 320,
        hover: 'panel',
      },
    );

    markMotionList(
      getUniqueMotionElements('.dashboard-profile-chip, .listing-job-card__logo, .home-modern-job-card__brand img, .home-mini-job__brand img, .company-card img'),
      'image-float',
      {
        step: 45,
        duration: 760,
        maxDelay: 260,
      },
    );

    markMotionList(
      getUniqueMotionElements('.site-action, .home-nav-action, .site-nav__link, .home-nav-links a, .jobs-filter-chip, .listing-job-card__actions button, .home-modern-job-card__actions button, .auth-button, .auth-submit, .auth-secondary, .dashboard-pill-button, .dashboard-action-button, .dashboard-cta-button, .dashboard-icon-button, .dashboard-nav__link, .mobile-site-drawer__link, .mobile-site-drawer__action, button[type="submit"], [data-search-action], [data-apply-job], [data-job-details], [data-company-details], [data-companies-filter], [data-link]'),
      'pop',
      {
        step: 30,
        duration: 640,
        maxDelay: 260,
        hover: 'button',
        force: true,
      },
    );
  };

  const queueSiteMotionRefresh = () => {
    if (siteMotionRefreshFrame) return;

    siteMotionRefreshFrame = window.requestAnimationFrame(() => {
      siteMotionRefreshFrame = null;
      decorateSiteMotionTargets();
      observeSiteMotionTargets();
    });
  };

  const initSiteAnimations = () => {
    decorateSiteMotionTargets();
    observeSiteMotionTargets();

    if (siteMotionMutationObserver || prefersReducedMotion()) return;

    siteMotionMutationObserver = new MutationObserver((mutations) => {
      const hasMeaningfulNode = mutations.some(({ addedNodes }) =>
        Array.from(addedNodes).some((node) => {
          if (node.nodeType !== Node.ELEMENT_NODE) return false;
          return !(node.classList?.contains('site-toast') || node.closest?.('.site-toast'));
        }),
      );

      if (hasMeaningfulNode) {
        queueSiteMotionRefresh();
      }
    });

    siteMotionMutationObserver.observe(document.body, {
      childList: true,
      subtree: true,
    });

    window.RahmaRefreshMotion = queueSiteMotionRefresh;
  };

  const syncRuntimeFromStorage = (event) => {
    if (event.key === ADMIN_RUNTIME_KEY) {
      window.location.reload();
    }
  };

  initPageState();
  initLegacyMojibakeDomRepair();
  window.setInterval(() => {
    if (syncAdminRuntimeFromSharedFile()) {
      window.location.reload();
    }
  }, 2500);
  window.addEventListener('storage', syncRuntimeFromStorage);
  initAdminAccessGuard();
  initMobileBrandHomeLinks();
  initPasswordVisibilityToggles();
  initPublicHeaderChrome();
  initSiteMobileDrawer();
  initHomeSearch();
  initHomeSearchLive();
  initHomeHeroVideo();
  initHomeRuntimeContent();
  initHomeUsefulStats();
  initCompanyOnlySections();
  bootstrapCompanyRuntimeFromProfile();
  void startFirebasePublicSync();
  renderPublicJobsPage();
  renderPublicCompaniesPage();
  initJobsSearch();
  initMobileMenus();
  initCompaniesPagination();
  initContactForm();
  initJobDetailsPage();
  initJobDetailsActions();
  initCompanyDetailsPage();
  initJobApplicationFlow();
  initApplicationTrackingPage();
  void renderCompanyDashboard();
  renderAdminApplications();
  initTechnicalPartnerSignature();
  ensurePublicFavicon();
  syncPublicSeoMeta();
  initSiteAnimations();
  initPublicExperienceEnhancements();

  document.addEventListener('click', (event) => {
    const link = event.target.closest('a');
    if (link?.dataset.logout !== undefined) {
      event.preventDefault();
      const logoutTarget = sanitizeInternalNavigationTarget(
        link.getAttribute('href') || buildLoginUrl('company-dashboard.html'),
        buildLoginUrl('company-dashboard.html'),
      );
      void signOutCompanySession().finally(() => {
        navigateToInternal(logoutTarget, buildLoginUrl('company-dashboard.html'));
      });
      return;
    }

    if (link?.dataset.socialProvider) {
      event.preventDefault();
      const socialAction = link.dataset.socialAction || 'login';
      handleSocialProviderAction(link.dataset.socialProvider, socialAction);
      return;
    }

    if (link?.getAttribute('aria-disabled') === 'true') {
      event.preventDefault();
      const disabledMessage = link.dataset.disabledMessage || link.dataset.toast;
      if (disabledMessage) {
        showToast(disabledMessage);
      }
      return;
    }

    if (link && link.getAttribute('href') === '#') {
      event.preventDefault();
      const message = link.dataset.toast || 'الميزة دي لسه تحت التطوير.';
      showToast(message);
      return;
    }

    if (link?.dataset.applyCurrent !== undefined && window.rahmaOpenApplicationModal) {
      event.preventDefault();
      window.rahmaOpenApplicationModal();
      return;
    }

    const button = event.target.closest('button');
    if (!button) return;

    if (button.dataset.searchAction) {
      return;
    }

    if (button.dataset.socialProvider) {
      event.preventDefault();
      const socialAction = button.dataset.socialAction || 'login';
      handleSocialProviderAction(button.dataset.socialProvider, socialAction);
      return;
    }

    if (button.dataset.copyCurrentUrl !== undefined) {
      event.preventDefault();
      copyTextToClipboard(window.location.href).then((copied) => {
        showToast(copied ? 'تم نسخ رابط الصفحة.' : 'تعذر نسخ رابط الصفحة.');
      });
      return;
    }

    if (button.dataset.applyJob !== undefined) {
      event.preventDefault();
      const targetUrl = buildApplyUrl(button.dataset);
      window.location.href = targetUrl;
      return;
    }

    if (button.dataset.applyCurrent !== undefined) {
      event.preventDefault();
      window.rahmaOpenApplicationModal?.();
      return;
    }

    if (button.dataset.jobDetails !== undefined) {
      event.preventDefault();
      window.location.href = buildJobDetailsUrl(button.dataset);
      return;
    }

    if (button.dataset.companyDetails !== undefined) {
      event.preventDefault();
      window.location.href = buildCompanyDetailsUrl(button.dataset);
      return;
    }

    if (button.dataset.link) {
      event.preventDefault();
      navigateToInternal(button.dataset.link);
      return;
    }

    if (button.dataset.toast) {
      event.preventDefault();
      showToast(button.dataset.toast);
      return;
    }
  });

})();

