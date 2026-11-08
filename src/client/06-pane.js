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

/**
 * 会话的工作模式（Agent preset）文案。
 * id 来自会话列表行的 `projectionValues.agentPreset`；shipped 的四个预设由宿主
 * 自己的词表翻译（`dsh-client-ui-agent-preset` 的 preset*Name），自定义预设只能显示原 id。
 */
const PRESET_NAMES = {
  standard: { zh: '标准模式', en: 'Standard mode' },
  ptc: { zh: 'PTC 模式', en: 'PTC mode' },
  minimal: { zh: '极简模式', en: 'Minimal mode' },
  cordis: { zh: '创造模式', en: 'Creator mode' },
}

function presetLabel(sessionId, list, lang) {
  if (list === null || list === undefined || list.byId === undefined) return ''
  const row = list.byId[sessionId]
  if (row === undefined || row === null) return ''
  const projections = row.projectionValues
  const id = projections === undefined || projections === null ? undefined : projections.agentPreset
  if (typeof id !== 'string' || id.length === 0) return ''
  const known = PRESET_NAMES[id]
  if (known === undefined) return id
  return lang === 'en' ? known.en : known.zh
}

/**
 * 该会话名下的子智能体清单（顶栏那个下拉用的是同一份数据）：
 * 优先读宿主投影的 `subagentCatalog`（entry.id / entry.label / entry.activity），
 * 退路是按列表行的 parentSessionId 数；运行状态优先取会话列表行，其次取投影。
 */
function subagentEntries(sessionId, list) {
  if (list === null || list === undefined) return []
  const byId = list.byId === undefined || list.byId === null ? {} : list.byId
  const projections = list.projectionsBySession
  let catalog
  if (projections !== undefined && projections !== null) {
    const entry = projections[sessionId]
    const values = entry === null || entry === undefined ? undefined : entry.values
    catalog = values === undefined || values === null ? undefined : values.subagentCatalog
  }
  if (!Array.isArray(catalog)) {
    const fallback = []
    for (const key in byId) {
      const row = byId[key]
      if (row === null || row === undefined) continue
      if (row.parentSessionId !== sessionId) continue
      fallback.push({ id: key, label: typeof row.title === 'string' && row.title.length > 0 ? row.title : key, running: row.running === true })
    }
    return fallback
  }
  const rows = []
  for (const entry of catalog) {
    if (entry === null || entry === undefined) continue
    const id = typeof entry.id === 'string' ? entry.id : ''
    if (id.length === 0) continue
    const row = byId[id]
    const rowTitle = row === null || row === undefined ? '' : typeof row.title === 'string' ? row.title : ''
    const label = rowTitle.length > 0 ? rowTitle : typeof entry.label === 'string' && entry.label.length > 0 ? entry.label : id
    const rowRunning = row !== null && row !== undefined && row.running === true
    rows.push({ id, label, running: rowRunning || entry.activity === 'running' })
  }
  return rows
}

function PaneCell(props) {
  const { index, pane, services, list, workspaceState, renderSlot, SessionProvider, slot, lang, usedIds, isActive, focusedIndex, canClose, onAssign, onDropSession, onSwap, onActivate, onFocusToggle, onClear, onClose, onOpenSubagent } = props
  const paneSlot = typeof slot === 'string' && slot.length > 0 ? slot : SLOT_PANE
  const sessions = services === undefined || services === null ? undefined : services.sessions
  const hasSession = typeof pane.sessionId === 'string' && pane.sessionId.length > 0
  const info = describeSession(list, pane.sessionId)
  const row = hasSession && list !== null && list !== undefined && list.byId ? list.byId[pane.sessionId] : undefined
  const known = row !== undefined && row !== null
  const presetText = known ? presetLabel(pane.sessionId, list, lang) : ''
  const subagents = known ? subagentEntries(pane.sessionId, list) : []
  const [subOpen, setSubOpen] = useState(false)
  const subRef = useRef(null)

  // 子智能体清单：点外面或按 Esc 收起。
  useEffect(() => {
    if (!subOpen) return undefined
    const onPointerDown = (event) => {
      const root = subRef.current
      if (root !== null && root !== undefined && event.target instanceof Node && root.contains(event.target)) return
      setSubOpen(false)
    }
    const onKeyDown = (event) => {
      if (event.key === 'Escape') setSubOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown, true)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [subOpen])

  // 换了会话 / 换了屏位就收起清单。
  useEffect(() => {
    setSubOpen(false)
  }, [pane.key, pane.sessionId])
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
      presetText.length > 0 ? h('span', { className: 'dcs-panehead-chip' }, presetText) : null,
      // 子智能体：和顶栏那个下拉同一份数据，点开能看每一条的具体标题与运行状态，
      // 再点一条就把它放进另一屏（空屏 → 落进去；已开 → 跳过去；没有空屏且未满 → 新开一屏）。
      subagents.length > 0
        ? h(
            'span',
            { className: 'dcs-panehead-sub', ref: subRef },
            h(
              'button',
              {
                type: 'button',
                className: 'dcs-panehead-chip dcs-panehead-subbtn',
                'data-open': subOpen ? '1' : undefined,
                title: lang === 'en' ? 'Show subagents' : '展开子智能体',
                'aria-expanded': subOpen ? 'true' : 'false',
                onClick: (event) => {
                  event.stopPropagation()
                  setSubOpen((value) => !value)
                },
              },
              String(subagents.length) + (lang === 'en' ? ' subagents' : ' 个子智能体'),
              h('span', { className: 'dcs-caret', 'aria-hidden': 'true' }, '▾'),
            ),
            subOpen
              ? h(
                  'div',
                  { className: 'dcs-sublist', role: 'menu' },
                  subagents.map((entry) =>
                    h(
                      'button',
                      {
                        key: entry.id,
                        type: 'button',
                        role: 'menuitem',
                        className: 'dcs-subrow',
                        title: entry.label,
                        onClick: (event) => {
                          event.stopPropagation()
                          setSubOpen(false)
                          onOpenSubagent(index, entry.id)
                        },
                      },
                      h('span', { className: 'dcs-subrow-dot', 'data-running': entry.running ? '1' : undefined, 'aria-hidden': 'true' }),
                      h('span', { className: 'dcs-subrow-label' }, entry.label),
                    ),
                  ),
                )
              : null,
          )
        : null,
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
