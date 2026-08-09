(() => {
  document.documentElement.classList.add('motion-ready');

  const header = document.querySelector('[data-header]');
  const updateHeader = () => header?.classList.toggle('scrolled', window.scrollY > 16);
  updateHeader();
  window.addEventListener('scroll', updateHeader, { passive: true });

  document.querySelectorAll('[data-year]').forEach((node) => {
    node.textContent = String(new Date().getFullYear());
  });

  const beta = window.UNIQUEFLOW_BETA || {};
  document.querySelectorAll('[data-beta-download]').forEach((link) => {
    if (beta.open && beta.downloadUrl) {
      link.href = beta.downloadUrl;
      link.rel = 'nofollow';
      return;
    }

    link.href = '#beta';
    link.setAttribute('aria-disabled', 'true');
    link.classList.add('button-disabled');
    link.addEventListener('click', (event) => {
      event.preventDefault();
      document.querySelector('[data-beta-status]')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  });

  document.querySelectorAll('[data-beta-version]').forEach((node) => {
    node.textContent = beta.version || '0.9.0-rc1';
  });
  document.querySelectorAll('[data-beta-size]').forEach((node) => {
    node.textContent = beta.size || '902 MiB';
  });
  document.querySelectorAll('[data-beta-sha]').forEach((node) => {
    node.textContent = beta.sha256 || '';
  });

  const items = document.querySelectorAll('.reveal');
  if (!('IntersectionObserver' in window) || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    items.forEach((item) => item.classList.add('visible'));
    return;
  }

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -40px' });
  items.forEach((item) => observer.observe(item));
})();
