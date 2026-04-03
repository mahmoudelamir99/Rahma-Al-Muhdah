const fs = require('fs');
const vm = require('vm');
const { webcrypto } = require('crypto');

class StorageMock {
  constructor(initial = {}) {
    this.map = new Map(Object.entries(initial));
  }
  getItem(key) { return this.map.has(key) ? this.map.get(key) : null; }
  setItem(key, value) { this.map.set(key, String(value)); }
  removeItem(key) { this.map.delete(key); }
  clear() { this.map.clear(); }
}

class ElementMock {
  constructor({ tagName = 'div', dataset = {}, value = '', isBrand = false } = {}) {
    this.tagName = tagName.toUpperCase();
    this.dataset = { ...dataset };
    this.value = value;
    this.listeners = {};
    this.attributes = {};
    this.children = [];
    this.style = {};
    this.textContent = '';
    this.innerHTML = '';
    this.isConnected = true;
    this.isBrand = isBrand;
    this.classList = {
      add: () => {},
      remove: () => {},
      toggle: () => {},
      contains: () => false,
    };
  }
  appendChild(child) { this.children.push(child); return child; }
  removeChild(child) { this.children = this.children.filter((item) => item !== child); }
  setAttribute(name, value) { this.attributes[name] = String(value); }
  getAttribute(name) { return this.attributes[name] || null; }
  removeAttribute(name) { delete this.attributes[name]; }
  addEventListener(type, handler) { this.listeners[type] = handler; }
  querySelector() { return null; }
  querySelectorAll() { return []; }
  closest(selector) {
    if (selector === 'a') return null;
    if (selector === '.site-brand[data-mobile-home-link="true"]' && this.isBrand && this.dataset.mobileHomeLink === 'true') {
      return this;
    }
    return null;
  }
}

class FormMock extends ElementMock {
  constructor(fields = {}) {
    super({ tagName: 'form', dataset: { demoForm: 'true', authForm: 'admin-login' } });
    this.fields = fields;
  }
  querySelector(selector) {
    const nameMatch = selector.match(/^\[name="([^"]+)"\]$/);
    if (nameMatch) return this.fields[nameMatch[1]] || null;
    return null;
  }
}

function createSandbox({ pathname = '/admin-login.html', search = '', mobile = false, initialSession = null, formValues = null }) {
  const documentListeners = {};
  const brand = new ElementMock({ isBrand: true });
  const formFields = formValues
    ? Object.fromEntries(Object.entries(formValues).map(([name, value]) => [name, new ElementMock({ tagName: 'input', value })]))
    : {};
  const form = formValues ? new FormMock(formFields) : null;
  const body = new ElementMock({ tagName: 'body' });
  const document = {
    body,
    documentElement: { dataset: {} },
    createElement: () => new ElementMock(),
    querySelector: () => null,
    querySelectorAll: (selector) => {
      if (selector === '.site-brand') return [brand];
      if (selector === 'form[data-demo-form="true"]') return form ? [form] : [];
      return [];
    },
    addEventListener: (type, handler) => {
      (documentListeners[type] ||= []).push(handler);
    },
  };

  const location = {
    href: `https://example.com${pathname}${search}`,
    pathname,
    search,
    hash: '',
    replaced: null,
    replace(url) {
      this.replaced = url;
      this.href = url;
    },
  };

  const sessionSeed = initialSession
    ? { rahmaAuthSession: JSON.stringify(initialSession) }
    : {};

  const sandbox = {
    console,
    document,
    window: null,
    navigator: { clipboard: { writeText: async () => {} } },
    URL,
    URLSearchParams,
    TextEncoder,
    requestAnimationFrame: (cb) => cb(),
    setTimeout: (cb) => { cb(); return 1; },
    clearTimeout: () => {},
    crypto: webcrypto,
  };

  sandbox.window = {
    document,
    localStorage: new StorageMock(),
    sessionStorage: new StorageMock(sessionSeed),
    navigator: sandbox.navigator,
    location,
    crypto: webcrypto,
    matchMedia: () => ({
      matches: mobile,
      addEventListener() {},
      removeEventListener() {},
      addListener() {},
      removeListener() {},
    }),
    requestAnimationFrame: sandbox.requestAnimationFrame,
    setTimeout: sandbox.setTimeout,
    clearTimeout: sandbox.clearTimeout,
    URL,
    URLSearchParams,
  };

  sandbox.localStorage = sandbox.window.localStorage;
  sandbox.sessionStorage = sandbox.window.sessionStorage;
  sandbox.location = location;
  sandbox.documentListeners = documentListeners;
  sandbox.brand = brand;
  sandbox.form = form;
  return sandbox;
}

async function runScript(sandbox) {
  const source = fs.readFileSync('site.js', 'utf8');
  vm.runInNewContext(source, sandbox, { filename: 'site.js' });
  return sandbox;
}

(async () => {
  const results = [];

  {
    const sandbox = await runScript(createSandbox({
      pathname: '/admin-login.html',
      formValues: { identifier: 'admin', password: 'Admin@12345' },
    }));
    await sandbox.form.listeners.submit({ preventDefault() {} });
    const session = JSON.parse(sandbox.window.sessionStorage.getItem('rahmaAuthSession'));
    results.push({
      test: 'admin-login-success',
      pass: Boolean(session?.loggedIn && session?.role === 'admin' && sandbox.window.location.href === 'admin-panel.html'),
      details: { session, href: sandbox.window.location.href },
    });
  }

  {
    const sandbox = await runScript(createSandbox({ pathname: '/admin-panel.html' }));
    results.push({
      test: 'admin-guard-guest',
      pass: sandbox.window.location.replaced === 'admin-login.html',
      details: { replaced: sandbox.window.location.replaced },
    });
  }

  {
    const sandbox = await runScript(createSandbox({
      pathname: '/admin-login.html',
      initialSession: {
        loggedIn: true,
        role: 'admin',
        email: 'admin@alrahma.com',
        name: 'إدارة المنصة',
        loggedInAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      },
    }));
    results.push({
      test: 'admin-guard-existing-session',
      pass: sandbox.window.location.replaced === 'admin-panel.html',
      details: { replaced: sandbox.window.location.replaced },
    });
  }

  {
    const sandbox = await runScript(createSandbox({ pathname: '/jobs.html', mobile: true }));
    const clickHandlers = sandbox.documentListeners.click || [];
    clickHandlers.forEach((handler) => handler({ target: sandbox.brand, preventDefault() {} }));
    results.push({
      test: 'mobile-brand-home-link',
      pass: sandbox.brand.dataset.mobileHomeLink === 'true' && sandbox.brand.getAttribute('role') === 'link' && sandbox.brand.getAttribute('tabindex') === '0' && sandbox.window.location.href === 'index.html',
      details: {
        dataset: sandbox.brand.dataset,
        role: sandbox.brand.getAttribute('role'),
        tabindex: sandbox.brand.getAttribute('tabindex'),
        href: sandbox.window.location.href,
      },
    });
  }

  {
    const css = fs.readFileSync('site.css', 'utf8');
    const pass = /@media \(max-width: 640px\)/.test(css)
      && /html\s*\{\s*font-size:\s*15px;/.test(css)
      && /\.auth-panel\s*\{[\s\S]*padding:\s*1\.1rem !important;/.test(css)
      && /\.job-card,[\s\S]*padding:\s*1rem !important;/.test(css)
      && /data-mobile-home-link/.test(css);
    results.push({ test: 'mobile-css-overrides', pass });
  }

  {
    const profile = fs.readFileSync('profile.html', 'utf8');
    const adminPanel = fs.readFileSync('admin-panel.html', 'utf8');
    const companyDashboard = fs.readFileSync('company-dashboard.html', 'utf8');
    const pass = profile.includes('>0</span>')
      && !adminPanel.includes('شركة التقنية الحديثة')
      && !adminPanel.includes('حساب صاحب العمل')
      && !companyDashboard.includes('???');
    results.push({ test: 'static-cleanup', pass });
  }

  console.log(JSON.stringify(results, null, 2));
  const failed = results.filter((item) => !item.pass);
  process.exit(failed.length ? 1 : 0);
})();
