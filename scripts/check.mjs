/**
 * 无界面自检：把 lib/client.js 扔进一个假的客户端运行时里跑一遍 apply()。
 *
 * 能抓到的问题：片段拼装断裂（TDZ）、注册项名字/字段写错、ctx.get 用到的服务名
 * 拼错、store 落盘 key 变了、卸载函数没返回。抓不到的问题：真实渲染（那要在
 * 宿主页面里看）。
 */

import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(HERE, '..')
const BUNDLE = path.join(ROOT, 'lib', 'client.js')

const code = fs.readFileSync(BUNDLE, 'utf8')

/* ── 假的平台 ─────────────────────────────────────────────────────── */

const memory = new Map()
const localStorage = {
  getItem: (key) => (memory.has(key) ? memory.get(key) : null),
  setItem: (key, value) => memory.set(key, String(value)),
  removeItem: (key) => memory.delete(key),
}

const ReactStub = {
  createElement: (type, props, ...children) => ({ type, props, children }),
  useSyncExternalStore: (subscribe, getSnapshot) => getSnapshot(),
  useCallback: (fn) => fn,
  useEffect: () => {},
  useMemo: (fn) => fn(),
  useRef: (value) => ({ current: value }),
  useState: (value) => [value, () => {}],
  Component: class Component {
    constructor(props) {
      this.props = props
    }
  },
}

const services = {
  sessions: {
    list: { getSnapshot: () => ({ byId: { s1: { id: 's1', title: '示例对话', blank: false } } }), subscribe: () => () => {} },
    retain: () => ({ sessionId: 's1', binding: {}, ready: Promise.resolve(), release() {} }),
  },
  workspaces: { list: { getSnapshot: () => ({ items: [] }), subscribe: () => () => {} } },
  layout: { selectPanel() {} },
  theme: undefined,
  locale: undefined,
}

const registrations = []
const provides = []
const effects = []
const logs = []

const ctx = {
  get: (name) => services[name],
  slots: {
    register: (spec, component) => {
      registrations.push({ spec, component })
      return () => {}
    },
    inject: (name, factory) => {
      factory()
      return () => {}
    },
    entriesOfSlot: () => [],
  },
  effect: (fn, label) => {
    effects.push({ fn, label })
    return () => {}
  },
  provide: (name, value) => {
    provides.push({ name, value })
  },
  logger: () => ({ info: (m) => logs.push(m), warn: (m) => logs.push(m), error: (m) => logs.push(m) }),
}

const documentStub = {
  createElement: () => ({ setAttribute() {}, remove() {}, textContent: '' }),
  head: { appendChild() {} },
  addEventListener() {},
  removeEventListener() {},
}

const sandbox = {
  console: { log() {}, warn() {}, error() {}, info() {} },
  document: documentStub,
  Node: class Node {},
  Symbol,
  Object,
  Array,
  Set,
  Map,
  JSON,
  Math,
  Date,
  Number,
  String,
  Promise,
  Error,
}
sandbox.window = {
  __ModuleLoader__: {
    load(entry) {
      sandbox.__entry = entry
    },
  },
  localStorage,
  document: documentStub,
  setTimeout: (fn, ms) => setTimeout(fn, ms),
  clearTimeout: (id) => clearTimeout(id),
  addEventListener() {},
  removeEventListener() {},
}
sandbox.globalThis = sandbox

/* ── 跑起来 ───────────────────────────────────────────────────────── */

const context = vm.createContext(sandbox)
vm.runInContext(code, context, { filename: BUNDLE })

const entry = sandbox.__entry
const failures = []

function check(condition, message) {
  if (!condition) failures.push(message)
}

check(entry !== undefined && entry !== null, '模块没有调用 window.__ModuleLoader__.load')
check(entry && entry.id === 'dsh-chat-split', 'loader entry id 不是 dsh-chat-split：' + (entry && entry.id))

const exportsObj = entry ? entry.factory((name) => {
  if (name === 'react') return ReactStub
  if (name === 'react-dom/client') return { createRoot: () => ({ render() {} }) }
  throw new Error('unexpected require: ' + name)
}) : {}

check(typeof exportsObj.apply === 'function', '模块没有导出 apply')
check(Array.isArray(exportsObj.inject) && exportsObj.inject.includes('slots'), 'inject 里缺少 slots')

if (typeof exportsObj.apply === 'function') exportsObj.apply(ctx, {})

const byName = (name) => registrations.filter((item) => item.spec.name === name)

check(registrations.length === 5, '注册项数量不是 5，而是 ' + registrations.length)
check(byName('main').length === 1, '没有注册 main 面板')
check(byName('sidebar.panellist').length === 1, '没有注册侧栏入口')

const main = byName('main')[0]
if (main) {
  check(main.spec.key === 'chat-split', 'main 面板 key 不是 chat-split')
  check(main.spec.children && main.spec.children['chat-split.pane'], 'main 面板没有声明 chat-split.pane 子槽')
  const pane = main.spec.children && main.spec.children['chat-split.pane']
  check(pane && pane.kind === 'single' && pane.scope === 'session', '子槽不是 single/session')
}

const icon = byName('sidebar.panellist')[0]
if (icon) {
  check(icon.spec.id === 'chat-split', '侧栏入口 id 与 main key 不一致（点了打不开面板）')
  check(typeof icon.spec.label === 'string' && icon.spec.label.length > 0, '侧栏入口没有 label')
}

check(byName('chat-split.pane').length === 1, '没有注册 chat-split.pane 的条目组件')

const overlay = byName('shell.overlay')[0]
if (overlay) {
  check(overlay.spec.id === 'chat-split', '悬浮层 id 不是 chat-split')
  const pane = overlay.spec.children && overlay.spec.children['chat-split.overlaypane']
  check(pane && pane.kind === 'single' && pane.scope === 'session', '悬浮层没有声明 single/session 的 chat-split.overlaypane 子槽')
}
check(byName('chat-split.overlaypane').length === 1, '没有注册 chat-split.overlaypane 的条目组件')
check(provides.some((item) => item.name === 'chatSplit'), '没有 provide chatSplit')

const api = provides.find((item) => item.name === 'chatSplit')
if (api) {
  const before = api.value.state().panes.length
  api.value.addPane('s1')
  const after = api.value.state().panes
  check(after.length === Math.min(before + 1, 4), 'addPane 没有加屏')
  api.value.maxPanes === 4 || failures.push('maxPanes 不是 4')
  for (let i = 0; i < 6; i += 1) api.value.addPane('s1')
  check(api.value.state().panes.length === 4, '分屏数越过了 4 的上限')
  api.value.focus(1)
  check(api.value.state().focus === 1, 'focus 没有生效')
}

const diag = sandbox.window.__dcsDiag
check(diag !== undefined && typeof diag.state === 'function', 'window.__dcsDiag 没有挂上')

if (typeof diag === 'object' && diag !== null && typeof diag.flush === 'function') diag.flush()
check(memory.has('dcs.split.v1'), '没有把分屏状态写进 localStorage（key 变了？）')
check((memory.get('dcs.split.v1') || '').includes('s1'), '落盘内容里没有会话 id')

for (const effect of effects) {
  try {
    const cleanup = effect.fn()
    if (typeof cleanup === 'function') cleanup()
  } catch (error) {
    failures.push('effect(' + effect.label + ') 执行失败：' + error.message)
  }
}

/* ── 结论 ─────────────────────────────────────────────────────────── */

if (failures.length > 0) {
  console.error('[dcs] check failed:')
  for (const failure of failures) console.error('  - ' + failure)
  process.exit(1)
}

console.log('[dcs] check ok — 5 处注册（含悬浮层）、侧栏 id 对齐、上限 4、落盘 key ' + 'dcs.split.v1')
console.log('[dcs] registrations: ' + registrations.map((item) => item.spec.name + (item.spec.key || item.spec.id ? '#' + (item.spec.key || item.spec.id) : '')).join(', '))
