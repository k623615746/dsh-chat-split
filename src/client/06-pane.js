/**
 * 片段 06 — 单个对话栏（cell）。
 *
 * 一屏 = 「保留一个会话引用」+「在 SessionProvider 里渲染会话作用域子槽」。
 * 子槽条目（片段 08）再去渲染宿主的 conversation.content，所以每屏都是真正的
 * 对话正文（消息、工具卡片、输入框都在），不是截图或跳转。
 */

/** 保留一个会话：拿到 SessionReference，卸载时释放。 */
function useSessionReference(sessions, sessionId, known) {
  const [entry, setEntry] = useState({ id: null, reference: null, error: null })

  useEffect(() => {
    if (typeof sessionId !== 'string' || sessionId.length === 0) {
      setEntry({ id: null, reference: null, error: null })
      return undefined
    }
    // 会话快照还没加载到这一条时，retain 会抛 "unknown session"；
    // 这时先空着，等 known 变 true 重跑一次。
    if (known === false) {
      setEntry({ id: sessionId, reference: null, error: null })
      return undefined
    }
    if (sessions === undefined || sessions === null || typeof sessions.retain !== 'function') {
      setEntry({ id: sessionId, reference: null, error: 'sessions 服务不可用' })
      return undefined
    }
    let reference = null
    try {
      reference = sessions.retain(sessionId, { source: RETAIN_SOURCE })
    } catch (error) {
      setEntry({ id: sessionId, reference: null, error: String(error && error.message ? error.message : error) })
      return undefined
    }
    try {
      const ready = reference.ready
      if (ready !== null && ready !== undefined && typeof ready.catch === 'function') ready.catch(() => {})
    } catch (error) {
      void error
    }
    setEntry({ id: sessionId, reference, error: null })
    return () => {
      try {
        reference.release()
      } catch (error) {
        log.error('[dcs] release failed', error)
      }
    }
  }, [sessions, sessionId, known])

  return entry
}

/** 拖拽载荷判定：本面板内部换位，或从侧栏拖来的会话 id。 */
function dragPayloadKind(dataTransfer) {
  if (dataTransfer === null || dataTransfer === undefined) return null
  let types = []
  try {
    types = Array.from(dataTransfer.types || [])
  } catch (error) {
    void error
    return null
  }
  if (types.includes(MIME_PANE)) return 'pane'
  if (types.includes(MIME_SESSION)) return 'session'
  return null
}

function PaneEmpty(props) {
  const { index, usedIds, list, workspaceState, onAssign } = props
  const [picking, setPicking] = useState(false)
  return h(
    'div',
    { className: 'dcs-empty' },
    h(
      'div',
      { className: 'dcs-empty-slot' },
      h('span', { className: 'dcs-empty-icon' }, h(IconSplitBig, { size: 26 })),
      h('div', { className: 'dcs-empty-title' }, '第 ' + (index + 1) + ' 屏是空的'),
      h('div', { className: 'dcs-empty-hint' }, '从左侧栏拖一个对话进来，或者'),
      h(
        'button',
        {
          type: 'button',
          className: 'dcs-pill',
          onClick: (event) => {
            event.stopPropagation()
            setPicking((value) => !value)
          },
        },
        h(IconSearch, { size: 13 }),
        '选择对话',
      ),
    ),
    picking
      ? h(SessionPicker, {
          sessions: list,
          workspaceState,
          usedIds,
          label: '选择要放进这一屏的对话',
          onPick: (sessionId) => {
            setPicking(false)
            onAssign(index, sessionId)
          },
          onClose: () => {
            setPicking(false)
          },
        })
      : null,
  )
}

function PaneCell(props) {
  const { index, pane, services, list, workspaceState, renderSlot, SessionProvider, slot, usedIds, isActive, focusedIndex, canClose, onAssign, onDropSession, onSwap, onActivate, onFocusToggle, onClear, onClose } = props
  const paneSlot = typeof slot === 'string' && slot.length > 0 ? slot : SLOT_PANE
  const sessions = services === undefined || services === null ? undefined : services.sessions
  const hasSession = typeof pane.sessionId === 'string' && pane.sessionId.length > 0
  const info = describeSession(list, pane.sessionId)
  const row = hasSession && list !== null && list !== undefined && list.byId ? list.byId[pane.sessionId] : undefined
  const known = row !== undefined && row !== null
  const reference = useSessionReference(sessions, pane.sessionId, known)
  const [dropping, setDropping] = useState(false)
  const [notice, setNotice] = useState(null)
  const noticeTimer = useRef(null)

  useEffect(
    () => () => {
      if (noticeTimer.current !== null) window.clearTimeout(noticeTimer.current)
    },
    [],
  )

  const flash = useCallback((text) => {
    setNotice(text)
    if (noticeTimer.current !== null) window.clearTimeout(noticeTimer.current)
    noticeTimer.current = window.setTimeout(() => {
      setNotice(null)
      noticeTimer.current = null
    }, 2200)
  }, [])

  const acceptDrop = useCallback(
    (event) => {
      event.preventDefault()
      setDropping(false)
      const dataTransfer = event.dataTransfer
      const kind = dragPayloadKind(dataTransfer)
      if (kind === 'pane') {
        const from = Number(dataTransfer.getData(MIME_PANE))
        if (Number.isFinite(from)) onSwap(from, index)
        return
      }
      const sessionId = String(dataTransfer.getData(MIME_SESSION) || '').trim()
      if (sessionId.length === 0) {
        flash('只能拖入左侧栏里的对话')
        return
      }
      const snapshot = list === null || list === undefined ? null : list.byId
      if (snapshot === null || snapshot === undefined || snapshot[sessionId] === undefined) {
        flash('这条内容不是对话，换成左侧栏的会话试试')
        return
      }
      onDropSession(sessionId)
    },
    [flash, list, onDropSession, onSwap],
  )

  const workspace = hasSession ? workspaceOf(workspaceState, pane.sessionId) : null

  let body
  if (!hasSession) {
    body = h(PaneEmpty, { index, usedIds, list, workspaceState, onAssign })
  } else if (reference.reference !== null && reference.reference !== undefined && SessionProvider !== undefined && typeof renderSlot === 'function') {
    body = h(SessionProvider, { session: reference.reference, children: renderSlot(paneSlot, {}) })
  } else if (reference.error !== null) {
    body = h('div', { className: 'dcs-pane-fallback' }, '这一屏打不开：' + reference.error)
  } else if (!known) {
    body = h('div', { className: 'dcs-pane-fallback' }, '正在打开对话…')
  } else if (SessionProvider === undefined || typeof renderSlot !== 'function') {
    body = h('div', { className: 'dcs-pane-fallback' }, '宿主没有下发会话作用域能力（SessionProvider / renderSlot 缺失）')
  } else {
    body = h('div', { className: 'dcs-pane-fallback' }, '正在打开对话…')
  }

  const running = row !== null && row !== undefined && row.running === true
  const label =
    !hasSession ? '空栏位' : info !== null && info.missing ? '对话已不存在' : info !== null && info.title.length > 0 ? info.title : '未命名对话'

  return h(
    'section',
    {
      className: 'dcs-cell',
      'data-active': isActive ? '1' : undefined,
      'data-drop': dropping ? '1' : undefined,
      'data-hidden': focusedIndex !== null && focusedIndex !== index ? '1' : undefined,
      'data-last': index === 2 ? '1' : undefined,
      'data-pane': index,
      'aria-label': '第 ' + (index + 1) + ' 屏' + (hasSession ? '：' + label : ''),
      onPointerDownCapture: () => {
        onActivate(index)
      },
      onDragOver: (event) => {
        if (dragPayloadKind(event.dataTransfer) === null) return
        event.preventDefault()
        try {
          event.dataTransfer.dropEffect = 'move'
        } catch (error) {
          void error
        }
        if (!dropping) setDropping(true)
      },
      onDragLeave: (event) => {
        const next = event.relatedTarget
        if (next !== null && next !== undefined && event.currentTarget.contains(next)) return
        setDropping(false)
      },
      onDrop: acceptDrop,
    },
    // 每屏自己的头：序号 + 工作区 + 标题 + 运行点 + 工具。
    // 顶栏不汇总这些信息（那里归宿主顶栏）。
    h(
      'header',
      {
        className: 'dcs-panehead',
        'data-empty': hasSession ? undefined : '1',
        'data-active': isActive ? '1' : undefined,
        title: (workspace !== null ? workspace.title + ' · ' : '') + label,
      },
      h('span', { className: 'dcs-panehead-index' }, String(index + 1)),
      workspace !== null && hasSession ? h('span', { className: 'dcs-panehead-ws' }, workspace.title) : null,
      h('span', { className: 'dcs-panehead-title' }, label),
      h('span', { className: 'dcs-panehead-dot', 'data-running': running ? '1' : undefined, 'aria-hidden': 'true' }),
      h(
        'div',
        { className: 'dcs-panehead-tools' },
        h(
          'button',
          {
            type: 'button',
            className: 'dcs-btn',
            'data-on': focusedIndex === index ? '1' : undefined,
            title: focusedIndex === index ? '还原分屏（Esc）' : '让这一屏铺满',
            'aria-label': focusedIndex === index ? '还原分屏' : '铺满这一屏',
            onClick: (event) => {
              event.stopPropagation()
              onFocusToggle(index)
            },
          },
          focusedIndex === index ? h(IconShrink, { size: 13 }) : h(IconExpand, { size: 13 }),
        ),
        hasSession
          ? h(
              'button',
              {
                type: 'button',
                className: 'dcs-btn',
                title: '清空这一屏（对话本身不受影响）',
                'aria-label': '清空这一屏',
                onClick: (event) => {
                  event.stopPropagation()
                  onClear(index)
                },
              },
              h(IconEject, { size: 13 }),
            )
          : null,
        canClose
          ? h(
              'button',
              {
                type: 'button',
                className: 'dcs-btn',
                title: '关闭这一屏',
                'aria-label': '关闭这一屏',
                onClick: (event) => {
                  event.stopPropagation()
                  onClose(index)
                },
              },
              h(IconClose, { size: 13 }),
            )
          : null,
      ),
    ),
    h('div', { className: 'dcs-cell-body' }, body),
    notice !== null ? h('div', { className: 'dcs-toast' }, notice) : null,
  )
}
