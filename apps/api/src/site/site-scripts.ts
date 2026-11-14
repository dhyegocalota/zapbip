import { contentHashOf } from '../backoffice/assets/stylesheet';
import { JOIN_FRAGMENT, THEME_SWITCH_ID, TURNSTILE_SCRIPT_URL } from './site-constants';
import { SitePath } from './site-paths';
import { WEBMCP_SOURCE } from './site-webmcp-script';

const SCRIPT_SOURCE = `(function () {
  var DEMO_STEP_BOUNDARIES_SECONDS = [5.6, 7.4];
  var IN_VIEW_THRESHOLD = 0.25;
  var COPIED_RESET_MS = 2000;
  var TURNSTILE_FIELD = 'cf-turnstile-response';
  var TURNSTILE_SCRIPT_URL = '${TURNSTILE_SCRIPT_URL}';
  var TURNSTILE_WAKE_EVENTS = ['focusin', 'pointerenter', 'touchstart'];
  var REVEAL_SELECTOR = '.reveal, .why-item';
  var REVEAL_THRESHOLD = 0.2;
  var REVEAL_ROOT_MARGIN = '0px 0px -8% 0px';
  var TYPING_THRESHOLD = 0.3;
  var TYPING_CLASS = 'has-typing';
  var REVEAL_CLASS = 'has-reveal';
  var VISIBLE_CLASS = 'is-visible';
  var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function byId(id) {
    return document.getElementById(id);
  }

  var isTurnstileRequested = false;

  function loadTurnstile() {
    if (isTurnstileRequested) return;
    isTurnstileRequested = true;
    var script = document.createElement('script');
    script.src = TURNSTILE_SCRIPT_URL;
    script.async = true;
    document.head.appendChild(script);
  }

  function showNotice(form, templateId) {
    var template = byId(templateId);
    var existing = document.querySelector('.join-block > .notice');
    if (existing) existing.remove();
    form.parentNode.insertBefore(template.content.cloneNode(true), form);
  }

  function setupJoinForm() {
    var form = document.querySelector('.join-form');
    if (!form) return;
    var submit = form.querySelector('.join-submit');
    var label = submit.querySelector('[data-label]');
    var email = byId('join-email');
    var isSubmitting = false;
    TURNSTILE_WAKE_EVENTS.forEach(function (name) {
      form.addEventListener(name, loadTurnstile, { once: true });
    });
    form.addEventListener('submit', function (event) {
      var token = form.elements[TURNSTILE_FIELD];
      loadTurnstile();
      if (isSubmitting) {
        event.preventDefault();
        return;
      }
      if (!navigator.onLine) {
        event.preventDefault();
        showNotice(form, 'notice-offline');
        return;
      }
      if (!token || !token.value) {
        event.preventDefault();
        showNotice(form, 'notice-captcha');
        form.querySelector('.turnstile-slot').scrollIntoView({ block: 'nearest' });
        return;
      }
      isSubmitting = true;
      submit.setAttribute('aria-busy', 'true');
      submit.setAttribute('aria-disabled', 'true');
      label.textContent = submit.getAttribute('data-submitting-label');
      email.readOnly = true;
    });
  }

  function rememberPath(path) {
    history.replaceState(null, '', path);
    document.querySelectorAll('input[name="returnTo"]').forEach(function (field) {
      field.value = path;
    });
  }

  function goToJoin() {
    var email = byId('join-email');
    var target = email || byId('join');
    byId('join').scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth' });
    target.focus({ preventScroll: true });
  }

  function setupJoinLinks() {
    document.querySelectorAll('a[href="${JOIN_FRAGMENT}"]').forEach(function (link) {
      link.addEventListener('click', function (event) {
        event.preventDefault();
        goToJoin();
      });
    });
  }

  function setupAgentPicks() {
    var hint = byId('join-agent');
    document.querySelectorAll('a[data-picked-label], a[data-clear-agent]').forEach(function (link) {
      link.addEventListener('click', function (event) {
        var label = link.getAttribute('data-picked-label');
        event.preventDefault();
        if (hint) {
          hint.textContent = label || '';
          hint.hidden = !label;
        }
        rememberPath(link.getAttribute('href').split('#')[0]);
        goToJoin();
      });
    });
  }

  function setupStartTabs() {
    var tabs = Array.prototype.slice.call(document.querySelectorAll('.start-tab'));
    if (!tabs.length) return;
    var keys = { ArrowRight: 1, ArrowLeft: -1 };
    var list = tabs[0].parentNode;
    function fade() {
      list.classList.toggle('is-scrolled', list.scrollLeft > 0);
      list.classList.toggle('is-end', list.scrollLeft + list.clientWidth >= list.scrollWidth - 1);
    }
    function reveal(tab, behavior) {
      list.scrollTo({ left: tab.offsetLeft - (list.clientWidth - tab.offsetWidth) / 2, behavior: behavior });
    }
    list.addEventListener('scroll', fade);
    function select(tab, shouldFocus) {
      tabs.forEach(function (candidate) {
        var isSelected = candidate === tab;
        candidate.setAttribute('aria-selected', String(isSelected));
        candidate.tabIndex = isSelected ? 0 : -1;
        byId(candidate.getAttribute('aria-controls')).hidden = !isSelected;
      });
      rememberPath(tab.getAttribute('href').split('#')[0]);
      reveal(tab, reducedMotion ? 'auto' : 'smooth');
      if (shouldFocus) tab.focus({ preventScroll: true });
    }
    reveal(document.querySelector('.start-tab[aria-selected="true"]'), 'auto');
    fade();
    tabs.forEach(function (tab, index) {
      tab.tabIndex = tab.getAttribute('aria-selected') === 'true' ? 0 : -1;
      tab.addEventListener('click', function (event) {
        event.preventDefault();
        select(tab, false);
      });
      tab.addEventListener('keydown', function (event) {
        var target;
        if (event.key in keys) target = (index + keys[event.key] + tabs.length) % tabs.length;
        if (event.key === 'Home') target = 0;
        if (event.key === 'End') target = tabs.length - 1;
        if (target === undefined) return;
        event.preventDefault();
        select(tabs[target], true);
      });
    });
  }

  function setupStartCopy() {
    var announcement = byId('start-announcement');
    document.querySelectorAll('.start-copy').forEach(function (button) {
      var originalLabel = button.textContent;
      button.hidden = false;
      var code = button.closest('.start-panel').querySelector('code');
      var text = code.getAttribute('data-code');
      function copied() {
        button.setAttribute('data-copied', 'true');
        button.textContent = button.getAttribute('data-copied-label');
        announcement.textContent = button.getAttribute('data-copied-announcement');
        window.setTimeout(function () {
          button.removeAttribute('data-copied');
          button.textContent = originalLabel;
        }, COPIED_RESET_MS);
      }
      function selected() {
        var range = document.createRange();
        range.selectNodeContents(code);
        window.getSelection().removeAllRanges();
        window.getSelection().addRange(range);
        announcement.textContent = button.getAttribute('data-fallback-announcement');
      }
      button.addEventListener('click', function () {
        if (!navigator.clipboard) {
          selected();
          return;
        }
        navigator.clipboard.writeText(text).then(copied, selected);
      });
    });
  }

  function setupStartTyping() {
    var section = byId('start');
    if (!section || reducedMotion || !('IntersectionObserver' in window)) return;
    document.documentElement.classList.add(TYPING_CLASS);
    var observer = new IntersectionObserver(
      function (entries) {
        if (!entries[0].isIntersecting) return;
        section.classList.add('is-live');
        observer.disconnect();
      },
      { threshold: TYPING_THRESHOLD }
    );
    observer.observe(section);
  }

  function setupLanguageMenu() {
    var menu = document.querySelector('.lang-menu');
    if (!menu) return;
    var trigger = menu.querySelector('.lang-trigger');
    var options = Array.prototype.slice.call(menu.querySelectorAll('.lang-option'));
    function close(shouldFocus) {
      menu.removeAttribute('open');
      if (shouldFocus) trigger.focus();
    }
    document.addEventListener('click', function (event) {
      if (!menu.contains(event.target)) close(false);
    });
    menu.addEventListener('keydown', function (event) {
      if (!menu.open) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        close(true);
        return;
      }
      var step = event.key === 'ArrowDown' ? 1 : event.key === 'ArrowUp' ? -1 : 0;
      if (step === 0) return;
      event.preventDefault();
      var current = options.indexOf(document.activeElement);
      var next = current === -1 ? (step === 1 ? 0 : options.length - 1) : (current + step + options.length) % options.length;
      options[next].focus();
    });
  }

  function setupThemeSwitch() {
    var form = byId('${THEME_SWITCH_ID}');
    if (!form || !window.fetch) return;
    var returnTo = form.querySelector('input[name="returnTo"]');
    form.querySelectorAll('button[name="theme"]').forEach(function (button) {
      button.addEventListener('click', function (event) {
        event.preventDefault();
        document.documentElement.setAttribute('data-theme', button.value);
        form.querySelectorAll('button[name="theme"]').forEach(function (candidate) {
          candidate.setAttribute('aria-pressed', String(candidate === button));
        });
        var body = new URLSearchParams({ theme: button.value, returnTo: returnTo.value });
        fetch(form.action, { method: 'POST', body: body }).catch(function () {});
      });
    });
  }

  function setupReveal() {
    if (reducedMotion) return;
    if (!('IntersectionObserver' in window)) return;
    document.documentElement.classList.add(REVEAL_CLASS);
    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          entry.target.classList.add(VISIBLE_CLASS);
          observer.unobserve(entry.target);
        });
      },
      { threshold: REVEAL_THRESHOLD, rootMargin: REVEAL_ROOT_MARGIN }
    );
    document.querySelectorAll(REVEAL_SELECTOR).forEach(function (element) {
      observer.observe(element);
    });
  }

  function setupThanks() {
    var heading = byId('thanks-title');
    if (!heading) return;
    heading.focus();
    var button = document.querySelector('.copy-link');
    var field = byId('invite-link');
    var announcement = byId('copy-announcement');
    var label = button.querySelector('[data-label]');
    var originalLabel = label.textContent;
    function copied() {
      button.setAttribute('data-copied', 'true');
      label.textContent = button.getAttribute('data-copied-label');
      announcement.textContent = button.getAttribute('data-copied-announcement');
      window.setTimeout(function () {
        button.removeAttribute('data-copied');
        label.textContent = originalLabel;
      }, COPIED_RESET_MS);
    }
    function selected() {
      field.focus();
      field.select();
      announcement.textContent = button.getAttribute('data-fallback-announcement');
    }
    button.addEventListener('click', function () {
      if (!navigator.clipboard) {
        selected();
        return;
      }
      navigator.clipboard.writeText(field.value).then(copied, selected);
    });
  }

  function currentStepIndex(seconds) {
    return DEMO_STEP_BOUNDARIES_SECONDS.filter(function (boundary) {
      return seconds >= boundary;
    }).length;
  }

  function setupDemo() {
    var video = document.querySelector('.demo-video');
    var toggle = document.querySelector('.demo-toggle');
    var steps = document.querySelectorAll('.demo-steps li');
    var connection = navigator.connection;
    var isSaveData = Boolean(connection && connection.saveData);
    if (!video || reducedMotion || isSaveData) return;
    var isPausedByUser = false;
    var isLoaded = false;
    var isInView = false;
    function sync() {
      if (!isLoaded || isPausedByUser) return;
      if (isInView) {
        video.preload = 'auto';
        video.play().catch(function () {});
        return;
      }
      video.pause();
    }
    video.addEventListener('playing', function () {
      video.classList.add('is-playing');
      toggle.hidden = false;
    });
    video.addEventListener('timeupdate', function () {
      var index = currentStepIndex(video.currentTime);
      steps.forEach(function (step, position) {
        if (position === index) step.setAttribute('aria-current', 'step');
        if (position !== index) step.removeAttribute('aria-current');
      });
    });
    toggle.addEventListener('click', function () {
      isPausedByUser = !video.paused;
      toggle.setAttribute('aria-pressed', String(isPausedByUser));
      var nextLabel = isPausedByUser ? toggle.getAttribute('data-play-label') : toggle.getAttribute('data-pause-label');
      toggle.setAttribute('aria-label', nextLabel);
      if (isPausedByUser) video.pause();
      if (!isPausedByUser) sync();
    });
    new IntersectionObserver(
      function (entries) {
        isInView = entries[0].isIntersecting;
        sync();
      },
      { threshold: IN_VIEW_THRESHOLD }
    ).observe(video);
    function start() {
      isLoaded = true;
      sync();
    }
    if (document.readyState === 'complete') start();
    if (document.readyState !== 'complete') window.addEventListener('load', start);
  }

${WEBMCP_SOURCE}
  setupJoinForm();
  setupJoinLinks();
  setupAgentPicks();
  setupStartTabs();
  setupStartCopy();
  setupStartTyping();
  setupLanguageMenu();
  setupThemeSwitch();
  setupReveal();
  setupThanks();
  setupDemo();
  setupModelContext();
})();
`;

export const SITE_SCRIPT: string = SCRIPT_SOURCE;
export const SITE_SCRIPT_HREF = `${SitePath.Script}?v=${contentHashOf({ text: SITE_SCRIPT })}`;
