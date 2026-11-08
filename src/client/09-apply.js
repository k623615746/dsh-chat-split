/**
 * 片段 09 — 装配：侧栏入口 + 主面板 + 会话作用域子槽 + 样式/存储/诊断。
 *
 * 注册顺序有意义：先声明主面板（它的 children 里声明 `chat-split.pane`，
 * 才有 SessionProvider 与 renderSlot 授权），再注册该子槽的条目。
 */

const inject = ['slots', 'layout']

const DICTS = {
  zh: {
    'split.title': '对话分屏',
    'split.hint': '最多四屏，可分别显示不同工作区的对话',
  },
  en: {
    'split.title': 'Chat split',
    'split.hint': 'Up to four panes across workspaces',
  },
}

function readService(ctx, name) {
  try {
    return ctx.get(name)
  } catch (error) {
    log.warn('[dcs] service unavailable: ' + name, error)
    return undefined
  }
}

function SplitSidebarIcon(props) {
  const size = props !== null && props !== undefined && typeof props.size === 'number' ? props.size : 18
  return h(IconSplit, { size })
}

// 会话 id 有两种写法：带 `session-` 前缀（客户端可见）与裸 UUID（磁盘目录名）。
const SESSION_ID_RE = /^(?:session-)?[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * 拖到对话区即分屏：不需要先点左侧入口。
 *
 * 宿主侧栏的会话行在 dragstart 里把 sessionId 写进 `dataTransfer` 的 `text/plain`
 * （`ui-workspace/lib/client.js:2588`）。我们把监听装在 document 的捕获阶段，
 * 就能在它冒泡到任何 drop 处理之前接管：把「当前正在看的对话」和「被拖进来的对话」
 * 各放进一屏，然后切到分屏面板。
 *
 * 不接管的情况：落在自己的分屏面板里（各格自己有 drop）、落在侧栏行上（宿主用它
 * 做排序）、拖的不是会话（选中文字、拖项目、拖文件）。
 */
function installConversationDropBridge(ctx, services, openSplit) {
  if (typeof document === 'undefined') return () => {}

  let hintTimer = 0

  function clearHint() {
    if (hintTimer !== 0) {
      clearTimeout(hintTimer)
      hintTimer = 0
    }
    document.documentElement.removeAttribute('data-dcs-drop')
  }

  function raiseHint() {
    document.documentElement.setAttribute('data-dcs-drop', '1')
    if (hintTimer !== 0) clearTimeout(hintTimer)
    hintTimer = setTimeout(clearHint, 1500)
  }

  function ownerPanel(target) {
    return target instanceof Element ? target.closest('.dcs-root') : null
  }

  function foreignZone(target) {
    if (!(target instanceof Element)) return true
    // 侧栏：会话行要靠宿主自己的 drop 排序/移动
    if (target.closest('[data-row-key]') !== null) return true
    if (target.closest('[data-slot="sidebar"]') !== null) return true
    return false
  }

  function inMainColumn(target) {
    return target instanceof Element && target.closest('[data-slot="main"]') !== null
  }

  function accepts(event) {
    const transfer = event.dataTransfer
    if (transfer === null || transfer === undefined) return false
    const types = transfer.types
    if (types === null || types === undefined) return false
    let hasText = false
    for (let i = 0; i < types.length; i += 1) {
      const type = String(types[i]).toLowerCase()
      if (type === 'text/plain' || type === 'text') {
        hasText = true
        break
      }
    }
    if (!hasText) return false
    if (ownerPanel(event.target) !== null) return false
    if (foreignZone(event.target)) return false
    return inMainColumn(event.target)
  }

  function readSessionId(event) {
    let raw = ''
    try {
      raw = String(event.dataTransfer.getData('text/plain') || '')
    } catch (error) {
      raw = ''
    }
    const id = raw.trim()
    if (id === '' || id.length > 120) return ''
    if (/\s/.test(id)) return ''
    if (SESSION_ID_RE.test(id)) return id
    // 非 UUID 也放行，但必须真有一行侧栏会话条目 —— 挡住选中文字、拖项目之类
    const row = document.querySelector('[data-row-key="session:' + id.replace(/"/g, '\\"') + '"]')
    return row === null ? '' : id
  }

  function currentConversationId() {
    const nodes = document.querySelectorAll('[data-conversation-session]')
    for (let i = 0; i < nodes.length; i += 1) {
      const node = nodes[i]
      if (node.closest('.dcs-root') !== null) continue
      const id = node.getAttribute('data-conversation-session')
      if (id !== null && id !== '') return id
    }
    return ''
  }

  function ensurePane(sessionId) {
    const state = getState()
    for (let i = 0; i < state.panes.length; i += 1) {
      if (state.panes[i].sessionId === sessionId) {
        setActivePane(i)
        return
      }
    }
    for (let i = 0; i < state.panes.length; i += 1) {
      if (!state.panes[i].sessionId) {
        setPaneSession(i, sessionId)
        return
      }
    }
    if (state.panes.length < MAX_PANES) {
      addPane(sessionId)
      return
    }
    setPaneSession(state.active, sessionId)
  }

  function openPanel() {
    // 落点后进分屏视图（宿主顶栏保留）；视图不可用时 openSplit 内部会退回主面板。
    if (typeof openSplit === 'function') {
      openSplit()
      return
    }
    const layout = services.layout
    try {
      if (layout !== null && layout !== undefined && typeof layout.selectPanel === 'function') layout.selectPanel(PANEL_ID)
    } catch (error) {
      log.warn('[dcs] selectPanel failed', error)
    }
  }

  function onDragOver(event) {
    if (!accepts(event)) return
    event.preventDefault()
    try {
      event.dataTransfer.dropEffect = 'move'
    } catch (error) {
      void error
    }
    raiseHint()
  }

  function onDragLeave(event) {
    if (event.relatedTarget !== null && event.relatedTarget !== undefined) return
    clearHint()
  }

  function onDrop(event) {
    if (!accepts(event)) return
    const id = readSessionId(event)
    if (id === '') return
    event.preventDefault()
    event.stopPropagation()
    clearHint()
    const current = currentConversationId()
    setFocus(null)
    if (current !== '' && current !== id) ensurePane(current)
    ensurePane(id)
    if (typeof window !== 'undefined') {
      window.__dcsLastDrop = { sessionId: id, currentSessionId: current }
    }
    openPanel()
  }

  function onDragEnd() {
    clearHint()
  }

  document.addEventListener('dragover', onDragOver, true)
  document.addEventListener('dragleave', onDragLeave, true)
  document.addEventListener('drop', onDrop, true)
  document.addEventListener('dragend', onDragEnd, true)

  return () => {
    document.removeEventListener('dragover', onDragOver, true)
    document.removeEventListener('dragleave', onDragLeave, true)
    document.removeEventListener('drop', onDrop, true)
    document.removeEventListener('dragend', onDragEnd, true)
    clearHint()
  }
}

function applyInner(ctx, config) {
  // 服务必须惰性取：客户端各包按批装载，apply 跑的时候 sessions/workspaces 常常
  // 还没挂上来。写成一次性快照会把 undefined 永久冻结进组件，面板直接白屏。
  const services = {
    get sessions() {
      return readService(ctx, 'sessions')
    },
    get workspaces() {
      return readService(ctx, 'workspaces')
    },
    get layout() {
      return readService(ctx, 'layout')
    },
    get theme() {
      return readService(ctx, 'theme')
    },
  }

  installStyles(ctx)
  bootStore(ctx)

  try {
    const locale = readService(ctx, 'locale')
    if (locale !== undefined && locale !== null && typeof locale.register === 'function') locale.register(PACKAGE, DICTS)
  } catch (error) {
    log.warn('[dcs] locale registration failed', error)
  }

  const stops = []
  // 全局落点桥：即使不点侧栏入口，把对话拖进对话区也能直接进分屏。
  stops.push(installConversationDropBridge(ctx, services, () => openOverlay()))
  // React 的元素创建不会执行组件体，所以上面的 try/catch 只能兜住「建元素」。
  // 组件体内的异常必须靠错误边界接住，否则宿主只会渲染一个空的 data-slot-error。
  class SplitBoundary extends React.Component {
    constructor(props) {
      super(props)
      this.state = { error: null }
    }

    static getDerivedStateFromError(error) {
      return { error: error }
    }

    componentDidCatch(error) {
      if (typeof window !== 'undefined') window.__dcsRenderError = String((error !== null && error !== undefined && error.stack) || error)
    }

    render() {
      if (this.state.error !== null && this.state.error !== undefined) {
        return h('pre', { className: 'dcs-fatal' }, '[dcs] ' + String(this.state.error.message || this.state.error))
      }
      return this.props.children
    }
  }

  // ---- 悬浮模式：宿主面板不动，网格盖在会话正文上 -------------------------
  // 为什么不是「自己渲染宿主顶栏」或「做成会话视图」：
  //  · 在 main 的 children 里声明 'conversation.header' 会抢掉宿主的所有权，
  //    ui-conversation 直接激活失败（实测 13 个 entry pending）；
  //  · 做成 conversation.view 时，视图里的 conversation.content 会重新渲染
  //    conversation.session → conversation.view → 自己，宿主抛
  //    `recursive render of factory 'conversation.content'`。
  // 悬浮层不碰任何宿主槽：会话面板照常挂着，标题 / 页签 / 状态 / 侧栏全在，
  // 网格只覆盖正文那一块矩形。

  function openOverlay() {
    setOverlay(true)
    return true
  }

  function closeOverlay() {
    setOverlay(false)
    return true
  }

  /** 侧栏入口点一下：开/关悬浮网格。宿主自己的 selectPanel 由 stopPropagation 挡掉。 */
  function toggleOverlayFromSidebar() {
    if (getState().overlay === true) closeOverlay()
    else openOverlay()
  }

  // 兜底：万一有别的路径把 main 面板选中（比如 API 调 selectPanel），
  // 立刻退回会话面板并改开悬浮层，不让人停在空白页上。
  const PanelBody = () => {
    useEffect(() => {
      openOverlay()
      try {
        const layout = services.layout
        if (layout !== null && layout !== undefined && typeof layout.selectPanel === 'function') layout.selectPanel(null)
      } catch (error) {
        log.warn('[dcs] selectPanel(null) failed', error)
      }
    }, [])
    return h('div', { className: 'dcs-redirect' }, '正在切到悬浮分屏…')
  }
  PanelBody.displayName = 'ChatSplitRedirect'

  // 1) 主面板：key 与侧栏条目 id 一致，selectPanel 才能命中。
  //    全部走 ctx.slots.inject(...)：槽必须先由「某个父 entry 的 children 表」声明
  //    出来才能注册，inject 会等声明到位再执行，避免启动顺序不同直接抛
  //    `slot "…" is not declared` 把整个插件打成 failed。
  stops.push(
    ctx.slots.inject(SLOTS.main, () =>
      ctx.slots.register(
        {
          name: SLOTS.main,
          key: PANEL_ID,
          order: 40,
          children: {
            [SLOT_PANE]: { kind: 'single', scope: 'session' },
          },
          registrant: PACKAGE,
        },
        PanelBody,
      ),
    ),
  )

  // 2) 会话作用域子槽：每个分屏在自己的 SessionProvider 里渲染一次。
  stops.push(
    ctx.slots.inject(SLOT_PANE, () =>
      ctx.slots.register({ name: SLOT_PANE, registrant: PACKAGE }, (props) => h(SplitPaneConversation, props)),
    ),
  )

  // 悬浮层的组件必须由这里包一层：SplitBoundary 与 services 都是 applyInner 的闭包变量，
  // 模块顶层的 OverlayShell 取不到（早先直接引用导致 shell.overlay 整层塌成 error 占位）。
  const OverlayBody = (props) =>
    h(OverlayShell, Object.assign({}, props, { services, slot: SLOT_OVERLAY, Boundary: SplitBoundary }))

  // 3) 悬浮网格本体：注册进 shell.overlay（帧级浮动层，默认点得穿），
  //    自己声明一个会话作用域子槽，才拿得到 SessionProvider / renderSlot。
  stops.push(
    ctx.slots.inject(SLOTS.overlay, () =>
      ctx.slots.register(
        {
          name: SLOTS.overlay,
          id: PANEL_ID,
          order: 55,
          children: {
            [SLOT_OVERLAY]: { kind: 'single', scope: 'session' },
          },
          registrant: PACKAGE,
        },
        OverlayBody,
      ),
    ),
  )

  // 4) 悬浮网格里每一格的会话作用域子槽。
  stops.push(
    ctx.slots.inject(SLOT_OVERLAY, () =>
      ctx.slots.register({ name: SLOT_OVERLAY, registrant: PACKAGE }, (props) => h(SplitPaneConversation, props)),
    ),
  )

  // 5) 左侧栏入口。
  stops.push(
    ctx.slots.inject(SLOTS.panellist, () =>
      ctx.slots.register(
        {
          name: SLOTS.panellist,
          id: PANEL_ID,
          order: 62,
          label: DICTS.zh['split.title'],
          registrant: PACKAGE,
        },
        OverlaySidebarEntry,
      ),
    ),
  )

  // 通道 A：给别的插件留一个可编程入口。
  try {
    ctx.provide('chatSplit', {
      version: SCHEMA_VERSION,
      panelId: PANEL_ID,
      open() {
        openOverlay()
      },
      close() {
        closeOverlay()
      },
      state: getState,
      setPaneSession,
      addPane,
      removePaneAt,
      focus: setFocus,
      maxPanes: MAX_PANES,
    })
  } catch (error) {
    log.warn('[dcs] provide failed', error)
  }

  if (typeof window !== 'undefined') {
    window.__dcsDiag = {
      package: PACKAGE,
      panelId: PANEL_ID,
      slot: SLOT_PANE,
      state: () => getState(),
      flush: flushStore,
    }
  }

  ctx.effect(
    () => () => {
      for (const stop of stops) {
        try {
          if (typeof stop === 'function') stop()
        } catch (error) {
          log.warn('[dcs] unregister failed', error)
        }
      }
      flushStore()
    },
    PACKAGE + ': panel assembly',
  )

  log.info('[dcs] ready — 左侧栏入口「' + DICTS.zh['split.title'] + '」，最多 ' + MAX_PANES + ' 屏')
}

function apply(ctx, config) {
  try { return applyInner(ctx, config) } catch (error) {
    try { window.__dcsApplyError = String((error && error.stack) || error) } catch (mirrorError) { void mirrorError }
    throw error
  }
}

exports.apply = apply
exports.inject = inject
exports.name = PACKAGE
