/**
 * 片段 03 — 分屏状态 store。
 *
 * 一个模块级单例 + 一份不可变快照 + Set 订阅者，React 侧走 useSyncExternalStore。
 * 落盘只存「会话 id 列表 + 当前聚焦」，不存任何聊天内容或令牌。
 */

const PERSIST_DEBOUNCE_MS = 300

/** 新 pane。 */
function makePane(sessionId) {
  return { key: nextPaneKey(), sessionId: typeof sessionId === 'string' && sessionId.length > 0 ? sessionId : null }
}

function defaultState() {
  return { panes: [makePane(null)], active: 0, focus: null, seeded: false, overlay: false }
}

/** 只保留可安全落盘的部分。 */
function persistable(state) {
  return {
    v: SCHEMA_VERSION,
    panes: state.panes.map((pane) => (typeof pane.sessionId === 'string' ? pane.sessionId : null)),
    active: state.active,
    focus: typeof state.focus === 'number' ? state.focus : null,
    overlay: state.overlay === true,
  }
}

function restoreState() {
  let raw = null
  try {
    raw = window.localStorage.getItem(STORE_KEY)
  } catch (error) {
    void error
    return defaultState()
  }
  if (raw === null || raw.length === 0) return defaultState()
  let parsed = null
  try {
    parsed = JSON.parse(raw)
  } catch (error) {
    void error
    return defaultState()
  }
  if (parsed === null || typeof parsed !== 'object' || parsed.v !== SCHEMA_VERSION) return defaultState()
  const ids = Array.isArray(parsed.panes) ? parsed.panes.slice(0, MAX_PANES) : []
  if (ids.length === 0) return defaultState()
  const panes = ids.map((id) => makePane(typeof id === 'string' ? id : null))
  const focus = typeof parsed.focus === 'number' && parsed.focus >= 0 && parsed.focus < panes.length ? parsed.focus : null
  return { panes, active: clampIndex(parsed.active, 0, panes.length - 1), focus, seeded: true, overlay: parsed.overlay === true }
}

const store = {
  state: defaultState(),
  listeners: new Set(),
  timer: null,
}

function getState() {
  return store.state
}

function subscribe(listener) {
  store.listeners.add(listener)
  return () => {
    store.listeners.delete(listener)
  }
}

function flush() {
  store.timer = null
  try {
    window.localStorage.setItem(STORE_KEY, JSON.stringify(persistable(store.state)))
  } catch (error) {
    void error
  }
}

function schedulePersist() {
  if (store.timer !== null) return
  store.timer = window.setTimeout(flush, PERSIST_DEBOUNCE_MS)
}

function commit(next) {
  store.state = next
  schedulePersist()
  for (const listener of Array.from(store.listeners)) {
    try {
      listener()
    } catch (error) {
      log.error('[dcs] store listener failed', error)
    }
  }
}

/** 启动：读盘（失败就回到默认一屏）。 */
function bootStore() {
  store.state = restoreState()
}

/** 卸载前把最后一次改动写盘。 */
function flushStore() {
  if (store.timer !== null) {
    window.clearTimeout(store.timer)
    store.timer = null
  }
  flush()
}

/* ── 动作 ───────────────────────────────────────────────────────────── */

function addPane(sessionId) {
  const state = getState()
  if (state.panes.length >= MAX_PANES) return -1
  const panes = state.panes.concat([makePane(sessionId === undefined ? null : sessionId)])
  commit({ ...state, panes, active: panes.length - 1, focus: state.focus })
  return panes.length - 1
}

function removePaneAt(index) {
  const state = getState()
  if (state.panes.length <= 1) return
  const target = clampIndex(index, 0, state.panes.length - 1)
  const panes = state.panes.filter((_, position) => position !== target)
  const focus = state.focus === null ? null : state.focus === target ? null : state.focus > target ? state.focus - 1 : state.focus
  const active = clampIndex(state.active > target ? state.active - 1 : state.active, 0, panes.length - 1)
  commit({ ...state, panes, active, focus })
}

function setPaneSession(index, sessionId) {
  const state = getState()
  const target = clampIndex(index, 0, state.panes.length - 1)
  if (state.panes[target].sessionId === sessionId) return
  const panes = state.panes.map((pane, position) => (position === target ? { ...pane, sessionId } : pane))
  commit({ ...state, panes, active: target })
}

function clearPaneSession(index) {
  setPaneSession(index, null)
}

function setActivePane(index) {
  const state = getState()
  const active = clampIndex(index, 0, state.panes.length - 1)
  if (state.active === active) return
  commit({ ...state, active })
}

function setFocus(index) {
  const state = getState()
  const focus = index === null || index === undefined ? null : clampIndex(index, 0, state.panes.length - 1)
  if (state.focus === focus) return
  commit({ ...state, focus, active: focus === null ? state.active : focus })
}

/** 悬浮网格开关：宿主会话面板不动，网格盖在正文区上，顶栏因此保留。 */
function setOverlay(on) {
  const state = getState()
  const overlay = on === true
  if (state.overlay === overlay) return
  commit({ ...state, overlay })
}

function toggleOverlay() {
  setOverlay(getState().overlay !== true)
}

function toggleFocus(index) {
  const state = getState()
  setFocus(state.focus === index ? null : index)
}

/** 两个 pane 互换会话（拖拽换位）。 */
function swapPanes(from, to) {
  const state = getState()
  const a = clampIndex(from, 0, state.panes.length - 1)
  const b = clampIndex(to, 0, state.panes.length - 1)
  if (a === b) return
  const panes = state.panes.map((pane, position) => {
    if (position === a) return { ...pane, sessionId: state.panes[b].sessionId }
    if (position === b) return { ...pane, sessionId: state.panes[a].sessionId }
    return pane
  })
  commit({ ...state, panes, active: b })
}

/** 首次打开：把当前正在看的会话放进第一屏，省掉一次手动拖拽。 */
function seedFromCurrent(paneSessionIds) {
  const state = getState()
  if (state.seeded === true) return
  if (state.panes.some((pane) => typeof pane.sessionId === 'string')) {
    commit({ ...state, seeded: true })
    return
  }
  if (typeof paneSessionIds !== 'string' || paneSessionIds.length === 0) {
    commit({ ...state, seeded: true })
    return
  }
  const panes = state.panes.map((pane, position) => (position === 0 ? { ...pane, sessionId: paneSessionIds } : pane))
  commit({ ...state, panes, seeded: true })
}

/** React 侧订阅。 */
function useSplitState() {
  return useSyncExternalStore(subscribe, getState, getState)
}
