import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';

const script = readFileSync(new URL('./inject.js', import.meta.url), 'utf8');
const css = readFileSync(new URL('./inject.css', import.meta.url), 'utf8');

function sandbox({ host = 'www.facebook.com', path = '/messages', platform = 'windows', title = 'Messenger', frame = false, bridge = true, serviceWorker = false } = {}) {
  const calls = [];
  const timers = new Map();
  const observers = [];
  const events = new Map();
  let timerId = 0;
  const elements = [];
  const htmlClasses = new Set();
  const location = { hostname: host, pathname: path };

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
    contains: name => htmlClasses.has(name),
    toggle(name, active) { if (active) htmlClasses.add(name); else htmlClasses.delete(name); }
  };
  const head = new Element('head');
  head.appendChild(new Element('title'));
  const document = {
    documentElement: html,
    head,
    title,
    readyState: 'complete',
    visibilityState: 'hidden',
    hasFocus: () => false,
    querySelector: () => null,
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
    replaceState(_state, _unused, url) { location.pathname = url; }
  };
  const window = {
    location, document, history, MutationObserver, EventTarget,
    __PM_PLATFORM__: platform,
    __PM_CSS__: css,
    addEventListener(name, callback) { events.set(name, callback); }
  };
  window.top = frame ? {} : window;
  if (serviceWorker) window.ServiceWorkerRegistration = class { showNotification() {} };
  if (bridge) window.__TAURI_INTERNALS__ = { invoke(command, args) { calls.push({ command, args }); return Promise.resolve(); } };
  const context = vm.createContext({
    window, document, location, history, MutationObserver, EventTarget,
    Promise, Number, String,
    setTimeout(callback) { const id = ++timerId; timers.set(id, callback); return id; },
    clearTimeout(id) { timers.delete(id); }
  });
  const evaluate = () => vm.runInContext(script, context);
  const flush = () => { const pending = [...timers.values()]; timers.clear(); pending.forEach(callback => callback()); };
  const mutateTitle = value => {
    document.title = value;
    observers.filter(observer => observer.target?.tagName === 'TITLE').forEach(observer => observer.callback());
  };
  return { window, document, html, head, calls, events, observers, evaluate, flush, mutateTitle, elements };
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
  assert.equal(page.elements.filter(element => element.id === 'pm-titlebar').length, 1);
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
  assert.deepEqual(page.calls.filter(call => call.command === 'set_unread').map(call => call.args.count), [3, 12, 0]);
  assert.equal(page.observers.filter(observer => observer.target).length, 2);
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

test('page mode tracks login routes and SPA navigation without removing the strip', () => {
  const page = sandbox({ path: '/login' });
  page.evaluate();
  assert.equal(page.html.classList.contains('pm-active'), false);
  assert.ok(page.document.getElementById('pm-titlebar'));
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

test('platform titlebar has accessible controls without draggable buttons', () => {
  const windows = sandbox();
  windows.evaluate();
  const bar = windows.document.getElementById('pm-titlebar');
  const buttons = bar.children.filter(element => element.tagName === 'BUTTON');
  assert.equal(buttons.length, 3);
  assert.ok(bar.hasAttribute('data-tauri-drag-region'));
  assert.ok(buttons.every(button => button.hasAttribute('aria-label') && !button.hasAttribute('data-tauri-drag-region')));
  buttons[2].handlers.get('click')();
  assert.equal(windows.calls.find(call => call.command === 'window_control')?.args.action, 'close');
  const macos = sandbox({ platform: 'macos' });
  macos.evaluate();
  assert.equal(macos.document.getElementById('pm-titlebar').children.length, 0);
  assert.equal(macos.html.classList.contains('pm-macos'), true);
});

test('missing IPC never throws during init, notification, or control', () => {
  const page = sandbox({ bridge: false });
  assert.doesNotThrow(() => { page.evaluate(); page.flush(); new page.window.Notification('A'); });
  assert.doesNotThrow(() => page.document.getElementById('pm-titlebar').children[1].handlers.get('click')());
});
