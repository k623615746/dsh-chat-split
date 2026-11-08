/**
 * 片段 01 — 共享前置：React 句柄、常量、样式注入、通用小工具。
 *
 * 后续片段全部靠这里声明的符号活着；本片段不含任何业务语义。
 */

try { window.__dcsLoad = 'bundle-evaluated' } catch (error) { void error }

const React = require('react')
const h = React.createElement
const { useSyncExternalStore, useCallback, useEffect, useMemo, useRef, useState } = React

/** react-dom 的 createPortal：把网格挂进宿主正文区（拿不到就退化成原位渲染）。 */
let createPortal = null
try {
  const reactDom = require('react-dom')
  if (reactDom !== null && reactDom !== undefined && typeof reactDom.createPortal === 'function') createPortal = reactDom.createPortal
} catch (error) {
  void error
}

/** 包身份（样式标记、日志前缀、诊断挂在同一个名字下）。 */
const PACKAGE = 'dsh-chat-split'

/** 主面板 key 与左栏图标 id 必须一致：左栏点击 → layout.selectPanel(id)。 */
const PANEL_ID = 'chat-split'

/** 分屏正文用的会话作用域子槽（声明在 main 面板 entry 的 children 里）。 */
const SLOT_PANE = 'chat-split.pane'

/** 悬浮网格的会话作用域子槽（声明在 shell.overlay 那层 entry 的 children 里）。
 *  与 SLOT_PANE 分开命名：同一个槽名被两个父 entry 声明会冲突。 */
const SLOT_OVERLAY = 'chat-split.overlaypane'
/** 其他插件常用的全局槽名，集中在这里，槽改名只改一处。 */
const SLOTS = {
  main: 'main',
  panellist: 'sidebar.panellist',
  overlay: 'shell.overlay',
}

/** 持久化 key 与 schema 版本。 */
const STORE_KEY = 'dcs.split.v1'
const SCHEMA_VERSION = 1

/** 最多几个对话栏。 */
const MAX_PANES = 4

/** 拖拽自定义 MIME：用来区分「从侧栏拖来的会话」和「本面板内部换位」。 */
const MIME_SESSION = 'text/plain'
const MIME_PANE = 'application/x-dsh-chat-split-pane'

/** 会话保留来源标识：只作为 retainedBy 计数 map 的 key，与 mainView 互不干扰。 */
const RETAIN_SOURCE = 'chatSplit'

const log = typeof console !== 'undefined' && console !== null ? console : { log() {}, warn() {}, error() {} }

/** 插件样式表：只写 `.dcs-` 前缀的规则，不碰 :root / body，不用 !important。 */
let styleEl = null

function installStyles(ctx) {
  if (styleEl !== null) return
  styleEl = document.createElement('style')
  styleEl.setAttribute('data-plugin', PACKAGE)
  styleEl.textContent = CSS_TEXT
  document.head.appendChild(styleEl)
  ctx.effect(() => () => {
    try {
      styleEl.remove()
    } catch (error) {
      void error
    }
    styleEl = null
  }, PACKAGE + ': styles')
}

/** 观察一个 DSH 快照式 Observable（sessions.list / workspaces.list）。 */
function useObservable(observable, fallback) {
  const subscribe = useCallback(
    (listener) => {
      if (observable === undefined || observable === null || typeof observable.subscribe !== 'function') return () => {}
      const stop = observable.subscribe(listener)
      return typeof stop === 'function' ? stop : () => {}
    },
    [observable],
  )
  const read = useCallback(() => {
    try {
      if (observable !== undefined && observable !== null && typeof observable.getSnapshot === 'function') return observable.getSnapshot()
    } catch (error) {
      log.error('[dcs] observable read failed', error)
    }
    return fallback
  }, [observable, fallback])
  return useSyncExternalStore(subscribe, read, read)
}

/** 稳定 key（会话 pane 的身份，删除中间一个时其他 pane 不会重挂）。 */
let keySeed = 0
function nextPaneKey() {
  keySeed += 1
  return 'pane-' + Date.now().toString(36) + '-' + keySeed.toString(36)
}

/** 数字夹取。 */
function clampIndex(value, min, max) {
  const n = Number.isFinite(value) ? Math.trunc(value) : min
  return Math.max(min, Math.min(max, n))
}

/** 读取一条会话在标题栏里要显示的信息。 */
function describeSession(list, sessionId) {
  if (typeof sessionId !== 'string' || sessionId.length === 0) return null
  const rows = list !== null && list !== undefined && list.byId ? list.byId : null
  const row = rows === null ? undefined : rows[sessionId]
  if (row === undefined || row === null) return { id: sessionId, title: '', blank: true, missing: true }
  const raw = typeof row.title === 'string' ? row.title.trim() : ''
  return {
    id: sessionId,
    title: raw,
    blank: row.blank === true,
    archived: row.archived === true,
    missing: false,
  }
}

/** 会话所属工作区（跨工作区分屏要靠它给标题加来源）。 */
function workspaceOf(workspaceState, sessionId) {
  const items = workspaceState !== null && workspaceState !== undefined && Array.isArray(workspaceState.items) ? workspaceState.items : []
  for (const item of items) {
    if (item === null || item === undefined) continue
    if (Array.isArray(item.sessionIds) && item.sessionIds.includes(sessionId)) {
      return { id: item.workspaceId, title: typeof item.title === 'string' && item.title.length > 0 ? item.title : item.path || '' }
    }
  }
  return null
}

/** 会话是否仍然可选（未归档、不是待启动的空壳会话）。 */
function sessionSelectable(row) {
  if (row === null || row === undefined) return false
  if (row.archived === true) return false
  if (row.blank === true) return false
  return true
}
