/**
 * 片段 07 — 网格本体：1/2/3/4 屏布局 + 焦点模式 + 控制条。
 *
 * 布局：count=1 一屏铺满；count=2 左右并排；count>=3 两列两行（3 屏时第三格跨两列）。
 * 标题信息不在这里汇总 —— 序号 / 工作区 / 对话标题都在各屏自己的 `.dcs-panehead` 上。
 * 控制条（分屏数 + 加 + 减 + 关）在悬浮形态下由 075 用 portal 塞进宿主顶栏那条页签行，
 * 面板形态下就画在网格上方。
 */

/** 首次打开时挑一个能放的对话：优先当前主视图正在看的那条。 */
function pickInitialSession(sessions, workspaceState) {
  const rows = sessions !== null && sessions !== undefined && sessions.byId ? sessions.byId : {}
  for (const id of Object.keys(rows)) {
    const row = rows[id]
    if (row === null || row === undefined) continue
    const held = row.retainedBy !== null && row.retainedBy !== undefined ? row.retainedBy.mainView : 0
    if (typeof held === 'number' && held > 0 && sessionSelectable(row)) return id
  }
  const items = workspaceState !== null && workspaceState !== undefined && Array.isArray(workspaceState.items) ? workspaceState.items : []
  for (const item of items) {
    const ids = item !== null && item !== undefined && Array.isArray(item.sessionIds) ? item.sessionIds : []
    for (const id of ids) {
      if (sessionSelectable(rows[id])) return id
    }
  }
  return null
}

/** kit 下发的 hook 可能缺席（老版本宿主），缺席时返回 undefined 而不是打断渲染。 */
function useSessionsSnapshot(hook) {
  return typeof hook === 'function' ? hook((snapshot) => snapshot) : undefined
}

function useWorkspacesSnapshot(hook) {
  return typeof hook === 'function' ? hook((snapshot) => snapshot) : undefined
}

/**
 * 独立于所有分屏的宿主顶栏（只在「面板形态」用）。
 * 注意：不能复用宿主的 conversation.header —— 该槽已由 ui-conversation 的
 * ConversationRoot entry 在自己 children 里声明，我再声明一次会让 ui-conversation
 * 激活失败（13 个 client entry 连锁 pending），所以这里只用快照自绘。
 */
function SplitHostHeader(props) {
  const { sessionId, list, workspaceState } = props
  const info = describeSession(list, sessionId)
  const workspace = workspaceOf(workspaceState, sessionId)
  const row = list !== null && list !== undefined && list.byId ? list.byId[sessionId] : undefined
  const running = row !== undefined && row !== null && row.running === true
  const hasSession = typeof sessionId === 'string' && sessionId.length > 0
  const label = hasSession ? (info !== null && info.title.length > 0 ? info.title : '未命名对话') : '未选择对话'
  return h(
    'div',
    { className: 'dcs-hostbar', 'data-idle': hasSession ? undefined : '1' },
    h('span', { className: 'dcs-hostbar-ws' }, workspace === null ? '未归档' : workspace.title),
    h('span', { className: 'dcs-hostbar-title', title: label }, label),
    h('span', { className: 'dcs-hostbar-dot', 'data-running': running ? '1' : undefined, 'aria-hidden': 'true' }),
  )
}

/**
 * 分屏操控条：分屏数 + 加一屏 + 减一屏 + 关闭分屏。
 * 自带状态（直接读 store），所以既能在网格上方画，也能被 portal 塞进宿主页签行。
 */
function SplitControls(props) {
  const { variant, onClose } = props
  const state = useSplitState()
  const count = state.panes.length
  const inHeader = variant === 'header'
  const close = () => {
    if (typeof onClose === 'function') {
      onClose()
      return
    }
    setOverlay(false)
  }
  return h(
    'div',
    {
      className: inHeader ? 'dcs-headtools' : 'dcs-top',
      'data-variant': inHeader ? 'header' : 'panel',
      role: 'toolbar',
      'aria-label': '分屏操控',
    },
    h('span', { className: 'dcs-headtools-label' }, '分屏操控'),
    h('span', { className: 'dcs-count', title: '已开分屏 / 上限' }, count + '/' + MAX_PANES),
    h(
      'button',
      {
        type: 'button',
        className: 'dcs-btn',
        disabled: count >= MAX_PANES,
        title: count >= MAX_PANES ? '最多 ' + MAX_PANES + ' 屏' : '再加一屏',
        'aria-label': '再加一屏',
        onClick: () => {
          if (count >= MAX_PANES) return
          addPane('')
          setActivePane(count)
        },
      },
      h(IconPlus, { size: 13 }),
    ),
    h(
      'button',
      {
        type: 'button',
        className: 'dcs-btn',
        disabled: count <= 1,
        title: count <= 1 ? '至少留一屏' : '减一屏',
        'aria-label': '减一屏',
        onClick: () => {
          if (count <= 1) return
          removePaneAt(count - 1)
        },
      },
      h(IconMinus, { size: 13 }),
    ),
    h(
      'button',
      {
        type: 'button',
        className: 'dcs-btn',
        title: '关闭分屏',
        'aria-label': '关闭分屏',
        onClick: close,
      },
      h(IconClose, { size: 13 }),
    ),
  )
}

function SplitPanel(props) {
  const { services, renderSlot, SessionProvider, useSessions, useWorkspaces, variant, slot, hideControls, onCloseSplit, lang } = props
  // 'overlay' = 挂在宿主会话正文区里（顶栏归宿主）；'panel' = 侧栏入口打开的独立面板。
  const inOverlay = variant === 'overlay'
  const state = useSplitState()
  const layout = services === null || services === undefined ? undefined : services.layout
  // 会话/工作区快照只能来自 kit 下发的 hook —— ctx.sessions / ctx.workspaces 的服务面上
  // 没有 list 快照属性，早先读服务属性拿到的是 undefined，选择器因此永远是空的。
  const sessionsSnapshot = useSessionsSnapshot(useSessions)
  const workspaceState = useWorkspacesSnapshot(useWorkspaces)
  const list = useMemo(
    () => ({
      byId: sessionsSnapshot === undefined || sessionsSnapshot === null || sessionsSnapshot.byId === undefined ? {} : sessionsSnapshot.byId,
      projectionsBySession: sessionsSnapshot === undefined || sessionsSnapshot === null || sessionsSnapshot.projectionsBySession === undefined ? {} : sessionsSnapshot.projectionsBySession,
    }),
    [sessionsSnapshot],
  )
  const panes = state.panes.length > 0 ? state.panes : [{ key: 'fallback', sessionId: '' }]
  const count = panes.length
  const focusedIndex = state.focus
  const activeIndex = state.active
  const activePane = panes[clampIndex(activeIndex, 0, panes.length - 1)]
  const activeSessionId = activePane !== undefined && typeof activePane.sessionId === 'string' ? activePane.sessionId : ''

  const usedIds = useMemo(() => {
    const set = new Set()
    for (const pane of panes) {
      if (typeof pane.sessionId === 'string' && pane.sessionId.length > 0) set.add(pane.sessionId)
    }
    return set
  }, [panes])

  useEffect(() => {
    if (state.seeded) return
    seedFromCurrent(pickInitialSession(list, workspaceState))
  }, [state.seeded, list, workspaceState])

  useEffect(() => {
    if (focusedIndex === null) return undefined
    const onKeyDown = (event) => {
      if (event.key !== 'Escape') return
      if (event.defaultPrevented) return
      setFocus(null)
    }
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [focusedIndex])

  const onAssign = useCallback((index, sessionId) => {
    setPaneSession(index, sessionId)
    setActivePane(index)
  }, [])
  /**
   * 拖入即分屏：这是用户要的主路径。
   * 已开过的会话 → 跳到那一屏；有空屏 → 直接落进空屏；否则新开一屏（上限 4）。
   */
  const onDropSession = useCallback((sessionId) => {
    const current = getState()
    const existing = current.panes.findIndex((pane) => pane.sessionId === sessionId)
    if (existing >= 0) {
      setActivePane(existing)
      return existing
    }
    const emptyIndex = current.panes.findIndex((pane) => typeof pane.sessionId !== 'string' || pane.sessionId.length === 0)
    if (emptyIndex >= 0) {
      setPaneSession(emptyIndex, sessionId)
      setActivePane(emptyIndex)
      return emptyIndex
    }
    const next = addPane(sessionId)
    if (next >= 0) setActivePane(next)
    return next
  }, [])
  const onSwap = useCallback((from, to) => {
    swapPanes(from, to)
  }, [])
  // 点开某屏的子智能体清单后选一条：复用「拖入即分屏」的那套落位规则。
  // 四屏全满时没有空位可用，就把「点出清单的那一屏」让给对方 —— 就近替换，语义可预期。
  const onOpenSubagent = useCallback((index, sessionId) => {
    const placed = onDropSession(sessionId)
    if (placed >= 0) return
    setPaneSession(index, sessionId)
    setActivePane(index)
  }, [onDropSession])
  const onActivate = useCallback((index) => {
    setActivePane(index)
  }, [])
  const onFocusToggle = useCallback((index) => {
    toggleFocus(index)
  }, [])
  const onClear = useCallback((index) => {
    clearPaneSession(index)
  }, [])
  const onClose = useCallback((index) => {
    removePaneAt(index)
  }, [])
  const closeSplit = useCallback(() => {
    if (typeof onCloseSplit === 'function') {
      onCloseSplit()
      return
    }
    setOverlay(false)
  }, [onCloseSplit])

  const showControls = hideControls !== true
  return h(
    'div',
    { className: 'dcs-root', 'data-variant': inOverlay ? 'overlay' : 'panel', 'data-focus': focusedIndex !== null ? '1' : undefined },
    // 悬浮形态下宿主顶栏就在网格上方，自己再画一条就重复了。
    inOverlay ? null : h(SplitHostHeader, { sessionId: activeSessionId, list, workspaceState }),
    showControls ? h(SplitControls, { variant: 'panel', onClose: closeSplit }) : null,
    h(
      'div',
      { className: 'dcs-grid', 'data-count': String(count) },
      panes.map((pane, index) =>
        h(PaneCell, {
          key: pane.key,
          index,
          pane,
          services,
          list,
          workspaceState,
          renderSlot,
          SessionProvider,
          slot,
          lang: lang === 'en' ? 'en' : 'zh',
          usedIds,
          isActive: activeIndex === index,
          focusedIndex,
          canClose: count > 1,
          onAssign,
          onDropSession,
          onOpenSubagent,
          onSwap,
          onActivate,
          onFocusToggle,
          onClear,
          onClose,
        }),
      ),
    ),
  )
}
