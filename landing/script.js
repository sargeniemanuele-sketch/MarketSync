/* MarketSync — minimal landing-page JS
   Mobile menu toggle + smooth-scroll close + dynamic year. */

(function () {
  'use strict';

  // ---- Mobile menu toggle ----
  const toggle = document.getElementById('menuToggle');
  const drawer = document.getElementById('mobileNav');

  if (toggle && drawer) {
    toggle.addEventListener('click', function () {
      const isOpen = !drawer.hidden;
      drawer.hidden = isOpen;
      toggle.setAttribute('aria-expanded', String(!isOpen));
    });

    // Close drawer on any nav link click
    drawer.addEventListener('click', function (e) {
      const t = e.target;
      if (t && t.tagName === 'A') {
        drawer.hidden = true;
        toggle.setAttribute('aria-expanded', 'false');
      }
    });

    // Close drawer on resize up to desktop
    let lastWidth = window.innerWidth;
    window.addEventListener('resize', function () {
      if (window.innerWidth > 720 && lastWidth <= 720) {
        drawer.hidden = true;
        toggle.setAttribute('aria-expanded', 'false');
      }
      lastWidth = window.innerWidth;
    });
  }

  // ---- Smooth-scroll fallback (covers browsers without scroll-behavior) ----
  document.querySelectorAll('a[href^="#"]').forEach(function (a) {
    a.addEventListener('click', function (e) {
      const id = a.getAttribute('href');
      if (!id || id === '#') return;
      const target = document.querySelector(id);
      if (!target) return;
      e.preventDefault();
      const header = document.querySelector('.site-header');
      const offset = header ? header.getBoundingClientRect().height : 0;
      const top = target.getBoundingClientRect().top + window.pageYOffset - offset;
      window.scrollTo({ top: top, behavior: 'smooth' });
    });
  });

  // ---- Dynamic year in footer ----
  const yearEl = document.getElementById('year');
  if (yearEl) {
    yearEl.textContent = String(new Date().getFullYear());
  }

  // ---- GTM event helpers (attiva dopo aver configurato GTM) ----
  // function pushEvent(eventName, params) {
  //   window.dataLayer = window.dataLayer || [];
  //   window.dataLayer.push(Object.assign({ event: eventName }, params));
  // }
  //
  // Esempi di eventi da collegare ai CTA:
  // pushEvent('cta_click', { cta_label: 'Richiedi accesso', cta_location: 'hero' });
  // pushEvent('cta_click', { cta_label: 'Accedi', cta_location: 'header' });
  // pushEvent('cta_click', { cta_label: 'Richiedi accesso', cta_location: 'final_cta' });
})();
