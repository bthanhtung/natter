import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';

const script = readFileSync(new URL('./inject.js', import.meta.url), 'utf8');
const css = readFileSync(new URL('./inject.css', import.meta.url), 'utf8');

function sandbox({ host = 'www.facebook.com', path = '/messages', platform = 'windows', title = 'Messenger', frame = false, bridge = true, serviceWorker = false, theme, savedTheme, systemDark = false, opener = false } = {}) {
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
  const page = { loginVisible: false, chatVisible: false, list: null };
  const styleSheets = [];

  class Element {
    constructor(tagName) {
      this.tagName = tagName.toUpperCase();
      this.children = [];
      this.attributes = new Map();
      this.handlers = new Map();
      this.className = '';
      this.textContent = '';
      this.style = {};
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
      if (selector.startsWith('[role="navigation"]')) return page.list;
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
  if (opener) window.opener = {};
  if (serviceWorker) window.ServiceWorkerRegistration = class { showNotification() {} };
  if (bridge) window.__TAURI_INTERNALS__ = { invoke(command, args) { calls.push({ command, args }); return Promise.resolve(command === 'get_theme' ? savedTheme : undefined); } };
  const context = vm.createContext({
    window, document, location, history, MutationObserver, EventTarget,
    Promise, Number, String, URL,
    getComputedStyle: element => ({ fontWeight: element.weight || '400', getPropertyValue: name => (element.vars && element.vars[name]) || '' }),
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

test('the badge counts unread chat rows when the title changes, and only sends changes', () => {
  const page = sandbox({ title: '(2) Messenger | Facebook' });
  const span = (text, weight) => ({ firstElementChild: null, textContent: text, weight });
  const row = (...spans) => ({ getElementsByTagName: () => spans });
  const rows = [row(span('Alice', '400'), span('hi', '400'), span('badge', '700'))];
  page.page.list = { querySelectorAll: () => rows };
  page.evaluate();
  page.flush();
  rows.push(row(span('', '700'), { firstElementChild: {}, textContent: 'x', weight: '700' }, span('Bob', '700')));
  page.mutateTitle('(3) Messenger | Facebook');
  page.mutateTitle('(3) Messenger | Facebook');
  page.flush();
  rows.splice(1);
  page.mutateTitle('(2) Messenger | Facebook');
  page.flush();
  page.mutateTitle('(2) Messenger | Facebook');
  page.flush();
  assert.deepEqual(page.calls.filter(call => call.command === 'set_unread').map(call => call.args.count), [0, 1, 0]);
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

test('macOS gets the overlay chrome and a draggable strip; glass only when chosen', () => {
  const macos = sandbox({ platform: 'macos' });
  macos.evaluate();
  macos.evaluate();
  assert.ok(macos.htmlClasses.has('pm-mac'));
  assert.equal(macos.htmlClasses.has('pm-glass'), false);
  const strips = macos.elements.filter(element => element.id === 'pm-drag');
  assert.equal(strips.length, 1);
  assert.ok(strips[0].hasAttribute('data-tauri-drag-region'));
  const glass = sandbox({ platform: 'macos' });
  glass.window.__PM_GLASS__ = true;
  glass.evaluate();
  assert.ok(glass.htmlClasses.has('pm-mac') && glass.htmlClasses.has('pm-glass'));
  const windows = sandbox();
  windows.evaluate();
  assert.equal(windows.htmlClasses.has('pm-mac') || windows.htmlClasses.has('pm-glass'), false);
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

  const system = sandbox({ theme: 'system', systemDark: true, savedTheme: 'light' });
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
  assert.equal(style.textContent, 'html.pm-forced.pm-dark:root,html.pm-forced.pm-dark .__fb-light-mode{--a: black;}html.pm-forced:not(.pm-dark):root,html.pm-forced:not(.pm-dark) .__fb-dark-mode{--a: white;}');
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

test('call popups and other Facebook pages are left untouched', () => {
  for (const options of [{ path: '/groupcall/ROOM:1/' }, { opener: true }, { path: '/profile.php' }]) {
    const page = sandbox(options);
    page.evaluate();
    assert.equal(page.window.__PM_INIT__, undefined, JSON.stringify(options));
    assert.equal(page.document.getElementById('pm-style'), null);
    assert.equal(page.events.has('click'), false);
  }
});

test('call buttons Facebook disables get the app hint and continue in the browser, except on Windows', () => {
  const rect = top => ({ top, bottom: top + 36, right: 1080 });
  const chat = { getBoundingClientRect: () => rect(0) };
  const button = { getBoundingClientRect: () => rect(42), closest: selector => (selector === '[role="main"]' ? chat : null), contains: node => node === button };
  const target = { closest: selector => (selector.includes('aria-disabled') ? button : null) };
  const page = sandbox({ platform: 'macos' });
  page.window.innerWidth = 1100;
  page.html.lang = 'vi';
  page.evaluate();
  let stopped = false;
  page.events.get('mouseover')({ target, stopPropagation() { stopped = true; } });
  const tip = page.document.getElementById('pm-tip');
  assert.ok(stopped && tip && tip.hidden === false);
  assert.equal(tip.style.top, '86px');
  assert.match(tip.textContent, /^App không hỗ trợ tính năng này/);
  page.events.get('mouseout')({ target, relatedTarget: {}, stopPropagation() {} });
  assert.equal(tip.hidden, true);
  const click = { button: 0, target, prevented: false, preventDefault() { this.prevented = true; }, stopImmediatePropagation() {} };
  page.events.get('click')(click);
  assert.ok(click.prevented);
  assert.deepEqual(page.calls.filter(call => call.command === 'call_in_browser').map(call => call.args.url), ['https://www.facebook.com/messages']);
  const low = { getBoundingClientRect: () => rect(400), closest: () => chat };
  page.events.get('click')({ button: 0, target: { closest: selector => (selector.includes('aria-disabled') ? low : null) }, preventDefault() { throw new Error('composer buttons are not calls'); }, stopImmediatePropagation() {} });

  const windows = sandbox();
  windows.evaluate();
  const winClick = { button: 0, target, prevented: false, preventDefault() { this.prevented = true; }, stopImmediatePropagation() {} };
  windows.events.get('click')(winClick);
  assert.equal(winClick.prevented, false);
});

test('by default the page follows Facebook\'s own Dark mode, re-read after clicks', () => {
  const page = sandbox();
  page.htmlClasses.add('__fb-light-mode');
  page.html.vars = { '--primary-text': '#080809' };
  page.evaluate();
  assert.ok(page.htmlClasses.has('pm-theme-facebook') && !page.htmlClasses.has('pm-dark'));
  assert.equal(page.htmlClasses.has('pm-forced'), false);
  // Facebook switches itself to dark; the app follows and leaves Facebook's classes alone.
  page.htmlClasses.delete('__fb-light-mode');
  page.htmlClasses.add('__fb-dark-mode');
  page.html.vars = { '--primary-text': '#E2E5E9' };
  page.events.get('click')({ button: 2, target: null });
  page.flush();
  assert.ok(page.htmlClasses.has('pm-dark') && page.htmlClasses.has('__fb-dark-mode') && !page.htmlClasses.has('__fb-light-mode'));
  // A forced theme replaces them, and following Facebook again restores them once.
  page.window.__PM_APPLY_THEME__('light');
  assert.ok(page.htmlClasses.has('pm-forced') && page.htmlClasses.has('__fb-light-mode') && !page.htmlClasses.has('__fb-dark-mode'));
  page.window.__PM_APPLY_THEME__('facebook');
  assert.ok(!page.htmlClasses.has('pm-forced') && page.htmlClasses.has('__fb-dark-mode') && !page.htmlClasses.has('__fb-light-mode'));
  page.htmlClasses.delete('__fb-dark-mode');
  page.htmlClasses.add('__fb-light-mode');
  page.html.vars = { '--primary-text': '#080809' };
  page.events.get('click')({ button: 2, target: null });
  page.flush();
  assert.ok(page.htmlClasses.has('__fb-light-mode') && !page.htmlClasses.has('__fb-dark-mode') && !page.htmlClasses.has('pm-dark'));
});
