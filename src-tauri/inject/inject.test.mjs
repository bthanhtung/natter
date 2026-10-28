import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';

const script = readFileSync(new URL('./inject.js', import.meta.url), 'utf8');
const css = readFileSync(new URL('./inject.css', import.meta.url), 'utf8');

function sandbox({ host = 'www.facebook.com', path = '/messages', platform = 'windows', title = 'Messenger', frame = false, bridge = true, serviceWorker = false, theme, savedTheme, systemDark = false } = {}) {
  const calls = [];
  const timers = new Map();
  const observers = [];
  const events = new Map();
  let timerId = 0;
  const elements = [];
  const htmlClasses = new Set();
  const location = {
    hostname: host, pathname: path, replaced: [],
    get href() { return `https://${this.hostname}${this.pathname}`; },
    replace(url) { this.replaced.push(url); }
  };
  let backs = 0;
  const page = { loginVisible: false, chatVisible: false };
  const styleSheets = [];

  class Element {
    constructor(tagName) {
      this.tagName = tagName.toUpperCase();
      this.children = [];
      this.attributes = new Map();
      this.handlers = new Map();
      this.className = '';
      this.textContent = '';
      elements.push(this);
    }
    set id(value) { this.attributes.set('id', value); }
    get id() { return this.attributes.get('id'); }
    appendChild(element) { this.children.push(element); return element; }
    setAttribute(key, value) { this.attributes.set(key, value); }
    hasAttribute(key) { return this.attributes.has(key); }
    addEventListener(name, callback) { this.handlers.set(name, callback); }
    querySelector(selector) { return selector === 'title' ? this.children.find(child => child.tagName === 'TITLE') || null : null; }
  }

  const html = new Element('html');
  html.classList = {
    add: name => htmlClasses.add(name),
    remove: name => htmlClasses.delete(name),
    contains: name => htmlClasses.has(name),
    toggle(name, active) { if (active) htmlClasses.add(name); else htmlClasses.delete(name); }
  };
  const head = new Element('head');
  head.appendChild(new Element('title'));
  const body = new Element('body');
  const document = {
    documentElement: html,
    head,
    body,
    title,
    readyState: 'complete',
    visibilityState: 'hidden',
    hasFocus: () => false,
    styleSheets,
    querySelector: selector => {
      if (page.loginVisible && selector.includes('input[name="pass"]')) return {};
      if (page.chatVisible && selector === '[role="main"]') return {};
      return null;
    },
    getElementById: id => elements.find(element => element.id === id) || null,
    createElement: tag => new Element(tag),
    addEventListener(name, callback) { events.set(`document:${name}`, callback); }
  };
  class MutationObserver {
    constructor(callback) { this.callback = callback; observers.push(this); }
    observe(element) { this.target = element; }
    disconnect() { this.target = null; }
  }
  const history = {
    pushState(_state, _unused, url) { location.pathname = url; },
    replaceState(_state, _unused, url) { location.pathname = url; },
    back() { backs++; }
  };
  const window = {
    location, document, history, MutationObserver, EventTarget,
    __PM_PLATFORM__: platform,
    __PM_THEME__: theme,
    __PM_CSS__: css,
    matchMedia: () => ({ matches: systemDark, addEventListener() {} }),
    addEventListener(name, callback) { events.set(name, callback); }
  };
  window.top = frame ? {} : window;
  if (serviceWorker) window.ServiceWorkerRegistration = class { showNotification() {} };
  if (bridge) window.__TAURI_INTERNALS__ = { invoke(command, args) { calls.push({ command, args }); return Promise.resolve(command === 'get_theme' ? savedTheme : undefined); } };
  const context = vm.createContext({
    window, document, location, history, MutationObserver, EventTarget,
    Promise, Number, String, URL,
    setTimeout(callback) { const id = ++timerId; timers.set(id, callback); return id; },
    clearTimeout(id) { timers.delete(id); }
  });
  const evaluate = () => vm.runInContext(script, context);
  const flush = () => { const pending = [...timers.values()]; timers.clear(); pending.forEach(callback => callback()); };
  const mutateTitle = value => {
    document.title = value;
    observers.filter(observer => observer.target?.tagName === 'TITLE').forEach(observer => observer.callback());
  };
  const mutateBody = () => observers.filter(observer => observer.target === body).forEach(observer => observer.callback());
  const mutateHead = records => observers.filter(observer => observer.target === head).forEach(observer => observer.callback(records));
  return { mutateHead, styleSheets, location, backs: () => backs, window, document, html, head, body, page, calls, events, observers, evaluate, flush, mutateTitle, mutateBody, elements, htmlClasses };
}

test('only top-level Facebook initializes and repeated injection is idempotent', () => {
  for (const options of [{ host: 'example.com' }, { frame: true }]) {
    const page = sandbox(options);
    page.evaluate();
    assert.equal(page.window.__PM_INIT__, undefined);
    assert.equal(page.document.getElementById('pm-style'), null);
  }
  const page = sandbox();
  page.evaluate();
  page.evaluate();
  assert.equal(page.elements.filter(element => element.id === 'pm-style').length, 1);
  assert.equal(page.document.getElementById('pm-titlebar'), null);
  assert.equal(page.document.getElementById('pm-style').textContent.includes('__PM_'), false);
  assert.match(page.document.getElementById('pm-style').textContent, /html\.pm-active \[role="region"\]\[aria-label="Tin" i\]/);
});

test('title changes debounce and only send changed counts', () => {
  const page = sandbox({ title: '(3) Messenger' });
  page.evaluate();
  page.flush();
  page.mutateTitle('(12+) Facebook');
  page.mutateTitle('(12+) Facebook');
  page.flush();
  page.mutateTitle('Messenger');
  page.flush();
  page.mutateTitle('Messenger');
  page.flush();
  page.mutateTitle('(123456789012) Messenger');
  page.flush();
  assert.deepEqual(page.calls.filter(call => call.command === 'set_unread').map(call => call.args.count), [3, 12, 0, 9999]);
  assert.equal(page.observers.filter(observer => observer.target).length, 3);
  page.events.get('pagehide')();
  assert.equal(page.observers.filter(observer => observer.target).length, 0);
});

test('notification shim forwards only while not focused and supports permission API', async () => {
  const page = sandbox({ serviceWorker: true });
  page.evaluate();
  const Notification = page.window.Notification;
  assert.equal(Notification.permission, 'granted');
  assert.equal(await Notification.requestPermission(), 'granted');
  let permission;
  await Notification.requestPermission(value => { permission = value; });
  assert.equal(permission, 'granted');
  const notification = new Notification('A', { body: 'B' });
  assert.ok(notification instanceof Notification);
  notification.close();
  await new page.window.ServiceWorkerRegistration().showNotification('C', { body: 'D' });
  page.document.visibilityState = 'visible';
  page.document.hasFocus = () => true;
  new Notification('Ignored');
  await new page.window.ServiceWorkerRegistration().showNotification('Ignored');
  assert.deepEqual(page.calls.filter(call => call.command === 'notify').map(call => [call.args.title, call.args.body]), [['A', 'B'], ['C', 'D']]);
});

test('page mode tracks login routes and SPA navigation', () => {
  const page = sandbox({ path: '/login' });
  page.evaluate();
  assert.equal(page.html.classList.contains('pm-active'), false);
  page.window.history.pushState({}, '', '/messages/t/123');
  assert.equal(page.html.classList.contains('pm-active'), true);
  page.window.history.replaceState({}, '', '/checkpoint/');
  assert.equal(page.html.classList.contains('pm-active'), false);
  page.window.history.replaceState({}, '', '/login.php');
  assert.equal(page.html.classList.contains('pm-active'), false);
  page.window.location.pathname = '/messages';
  page.events.get('popstate')();
  assert.equal(page.html.classList.contains('pm-active'), true);
});

test('missing IPC never throws during init, notification, or shortcuts', () => {
  const page = sandbox({ bridge: false });
  assert.doesNotThrow(() => { page.evaluate(); page.flush(); new page.window.Notification('A'); });
  assert.doesNotThrow(() => page.events.get('keydown')({ key: ',', ctrlKey: true, preventDefault() {} }));
});

test('login form rendered after load turns chrome removal off, throttled', () => {
  const page = sandbox();
  page.evaluate();
  assert.equal(page.html.classList.contains('pm-active'), true);
  page.page.loginVisible = true;
  page.mutateBody();
  page.mutateBody();
  assert.equal(page.html.classList.contains('pm-active'), true);
  page.flush();
  assert.equal(page.html.classList.contains('pm-active'), false);
});

test('Ctrl+, opens preferences except on macOS, which uses the app menu', () => {
  const page = sandbox();
  page.evaluate();
  let prevented = false;
  page.events.get('keydown')({ key: ',', ctrlKey: true, altKey: false, shiftKey: false, metaKey: false, preventDefault() { prevented = true; } });
  assert.ok(prevented);
  assert.ok(page.calls.some(call => call.command === 'open_preferences'));
  const macos = sandbox({ platform: 'macos' });
  macos.evaluate();
  assert.equal(macos.events.has('keydown'), false);
});

test('links and script navigation outside the chat open in the browser', () => {
  const page = sandbox();
  page.evaluate();
  const click = href => {
    const event = { button: 0, prevented: false, stopped: false, target: { closest: () => ({ href }) }, preventDefault() { this.prevented = true; }, stopImmediatePropagation() { this.stopped = true; } };
    page.events.get('click')(event);
    return event;
  };
  const external = () => page.calls.filter(call => call.command === 'open_external').map(call => call.args.url);
  for (const href of ['/messages/t/123', 'https://www.facebook.com/messenger_media/?attachment_id=1', 'https://l.facebook.com/l.php?u=x', 'https://example.com/', '/login/?next=x']) {
    assert.equal(click(href).prevented, false, href);
  }
  const profile = click('/profile.php?id=4');
  assert.ok(profile.prevented && profile.stopped);
  assert.deepEqual(external(), ['https://www.facebook.com/profile.php?id=4']);
  assert.equal(page.events.get('click')({ button: 1, target: { closest: () => ({ href: '/groups/1' }) } }), undefined);

  page.window.history.pushState({}, '', '/messages/t/9');
  assert.equal(page.backs(), 0);
  page.window.history.pushState({}, '', '/someone');
  assert.equal(page.backs(), 1);
  page.window.history.replaceState({}, '', '/watch');
  assert.deepEqual(page.location.replaced, ['https://www.facebook.com/someone']);
  assert.deepEqual(external().slice(1), ['https://www.facebook.com/someone', 'https://www.facebook.com/watch']);
});

test('the home feed is replaced by the chats', () => {
  for (const path of ['/', '/home.php']) {
    const page = sandbox({ path });
    page.evaluate();
    assert.deepEqual(page.location.replaced, ['/messages/']);
    assert.equal(page.document.getElementById('pm-style'), null);
  }
});

test('macOS gets the glass class and a draggable title strip; other platforms do not', () => {
  const macos = sandbox({ platform: 'macos' });
  macos.evaluate();
  macos.evaluate();
  assert.ok(macos.htmlClasses.has('pm-glass'));
  const strips = macos.elements.filter(element => element.id === 'pm-drag');
  assert.equal(strips.length, 1);
  assert.ok(strips[0].hasAttribute('data-tauri-drag-region'));
  const windows = sandbox();
  windows.evaluate();
  assert.equal(windows.htmlClasses.has('pm-glass'), false);
  assert.equal(windows.document.getElementById('pm-drag'), null);
});

test('themes set the page mode classes; a saved theme replaces the injected one', async () => {
  const page = sandbox({ theme: 'grey' });
  page.evaluate();
  assert.ok(page.htmlClasses.has('pm-theme-grey') && page.htmlClasses.has('__fb-dark-mode') && page.htmlClasses.has('pm-dark'));
  page.window.__PM_APPLY_THEME__('high_contrast');
  assert.ok(page.htmlClasses.has('pm-theme-high_contrast') && page.htmlClasses.has('__fb-light-mode'));
  assert.equal(page.htmlClasses.has('pm-theme-grey') || page.htmlClasses.has('pm-dark') || page.htmlClasses.has('__fb-dark-mode'), false);
  page.window.__PM_APPLY_THEME__('<script>');
  assert.ok(page.htmlClasses.has('pm-theme-high_contrast'));

  const system = sandbox({ systemDark: true, savedTheme: 'light' });
  system.evaluate();
  assert.ok(system.htmlClasses.has('pm-theme-system') && system.htmlClasses.has('pm-dark'));
  await Promise.resolve();
  assert.ok(system.htmlClasses.has('pm-theme-light') && !system.htmlClasses.has('pm-dark'));
});

test('Facebook mode variables are mirrored once, deduplicated, and extended by later styles', () => {
  const sheet = (rules, text = '.__fb-dark-mode{}') => ({ ownerNode: { nodeName: 'STYLE', textContent: text }, cssRules: rules });
  const rule = (selectorText, cssText) => ({ selectorText, style: { cssText } });
  const page = sandbox();
  page.styleSheets.push(
    sheet([rule(':root, .__fb-light-mode:root, .__fb-light-mode', '--a: white;'), rule('.__fb-dark-mode', '--a: black;'), rule('.x1 .__fb-dark-mode', '--ignored: 1;')]),
    sheet([rule('.__fb-dark-mode', '--a: black;')]),
    sheet([rule('.__fb-dark-mode', '--skipped: 1;')], 'no marker'),
    { ownerNode: { nodeName: 'LINK' }, get cssRules() { throw new Error('cross-origin'); } }
  );
  page.evaluate();
  const style = page.document.getElementById('pm-mode');
  assert.equal(style.textContent, 'html.pm-dark,html.pm-dark .__fb-light-mode{--a: black;}html:not(.pm-dark) .__fb-dark-mode{--a: white;}');
  page.mutateHead([{ addedNodes: [{ nodeName: 'STYLE', textContent: '.__fb-dark-mode', sheet: { cssRules: [rule('.__fb-dark-mode', '--b: gray;')] } }], removedNodes: [] }]);
  assert.match(style.textContent, /\{--a: black;--b: gray;\}/);
  page.mutateHead([{ addedNodes: [{ nodeName: 'LINK' }], removedNodes: [] }]);
  assert.equal(page.elements.filter(element => element.id === 'pm-mode').length, 1);
});

test('the body watch for login forms stops once the chats are on screen', () => {
  const page = sandbox();
  page.evaluate();
  const watching = () => page.observers.some(observer => observer.target === page.body);
  assert.ok(watching());
  page.page.chatVisible = true;
  page.mutateBody();
  page.flush();
  assert.equal(watching(), false);
  page.evaluate();
  assert.equal(watching(), false);
});
