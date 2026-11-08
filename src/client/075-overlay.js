/**
 * 片段 075 — 把分屏网格挂到宿主会话正文区里，把控制条挂进宿主顶栏。
 *
 * 目标是「顶栏还在、背景不串味」：
 *   - 不替换 main 面板（否则宿主的标题 / 模式 / 重启 / 后台任务 / 硬件监控 / 页签一起消失）；
 *   - 也不量矩形再盖一层（那样底下的旧会话会从缝隙和半透明背景里透出来）。
 * 做法是找到宿主的 `[data-conversation-content]`，把它的滚动体（宿主那份单会话正文）
 * 用属性选择器藏起来，然后在同一个 flex 列里 append 一个自己的容器，用 portal 把网格
 * 渲染进去。网格因此是正文区的真子节点：跟着窗口缩放、跟着顶栏高度变化，不用测量。
 *
 * 控制条（分屏数 / 加减 / 关闭）再单独 portal 到页签行 `[data-conversation-tabs]` 的父节点，
 * 也就是宿主顶栏的第二行右侧；那一行没有（空白会话不显示页签）时退回网格上方。
 */

/** 宿主会话正文区的根节点（它的子节点里，一个是滚动体，一个是宽度控件）。 */
function findConversationBody() {
  if (typeof document === 'undefined' || typeof document.querySelector !== 'function') return null
  return document.querySelector('[data-conversation-content]')
}

/** 宿主顶栏第二行（页签行）的容器；找不到就返回 null，控制条留在网格上方。 */
function findHeaderBand() {
  if (typeof document === 'undefined' || typeof document.querySelector !== 'function') return null
  const tabs = document.querySelector('[data-conversation-tabs]')
  if (tabs === null || tabs.parentElement === null) return null
  return tabs.parentElement
}

function OverlayShell(props) {
  const { services, renderSlot, SessionProvider, useSessions, useWorkspaces, slot, Boundary } = props
  const state = useSplitState()
  const open = state.overlay === true
  const [host, setHost] = useState(null)
  const [mount, setMount] = useState(null)
  const [band, setBand] = useState(null)
  const [tools, setTools] = useState(null)

  // 正文区与页签行都可能还没渲染出来（切会话、宿主重挂），也可能被换掉：
  // 只在「没有节点 / 节点掉线」时重新查一次，别的帧什么都不做，不量布局。
  useEffect(() => {
    if (!open) {
      setHost(null)
      setBand(null)
      return undefined
    }
    if (typeof window === 'undefined' || typeof window.requestAnimationFrame !== 'function') {
      setHost(findConversationBody())
      setBand(findHeaderBand())
      return undefined
    }
    let alive = true
    let frame = 0
    let current = null
    let currentBand = null
    const tick = () => {
      if (!alive) return
      if (current === null || current.isConnected !== true) {
        const next = findConversationBody()
        if (next !== current) {
          current = next
          setHost(next)
        }
      }
      if (currentBand === null || currentBand.isConnected !== true) {
        const nextBand = findHeaderBand()
        if (nextBand !== currentBand) {
          currentBand = nextBand
          setBand(nextBand)
        }
      }
      frame = window.requestAnimationFrame(tick)
    }
    frame = window.requestAnimationFrame(tick)
    return () => {
      alive = false
      if (frame !== 0) window.cancelAnimationFrame(frame)
    }
  }, [open])

  // 拿到正文区：标记它（CSS 用这个属性藏掉宿主自己的滚动体），并在里面挂一个容器。
  useEffect(() => {
    if (host === null || host === undefined) {
      setMount(null)
      return undefined
    }
    const node = document.createElement('div')
    node.className = 'dcs-hostgrid'
    node.setAttribute('data-dcs-hostgrid', '1')
    try {
      host.setAttribute('data-dcs-host', '1')
      host.appendChild(node)
    } catch (error) {
      log.error('[dcs] mount host grid failed', error)
      setMount(null)
      return undefined
    }
    setMount(node)
    return () => {
      setMount(null)
      try {
        if (node.parentNode === host) host.removeChild(node)
      } catch (error) {
        void error
      }
      try {
        host.removeAttribute('data-dcs-host')
      } catch (error) {
        void error
      }
    }
  }, [host])

  // 控制条容器：塞进页签行的父节点，靠 CSS 的 margin-left:auto 贴到最右边。
  useEffect(() => {
    if (band === null || band === undefined) {
      setTools(null)
      return undefined
    }
    const node = document.createElement('div')
    node.className = 'dcs-headtools'
    node.setAttribute('data-dcs-headtools', '1')
    try {
      band.setAttribute('data-dcs-headed', '1')
      band.appendChild(node)
    } catch (error) {
      log.error('[dcs] mount header tools failed', error)
      setTools(null)
      return undefined
    }
    setTools(node)
    return () => {
      setTools(null)
      try {
        if (node.parentNode === band) band.removeChild(node)
      } catch (error) {
        void error
      }
      try {
        band.removeAttribute('data-dcs-headed')
      } catch (error) {
        void error
      }
    }
  }, [band])

  if (!open) return null
  if (mount === null && tools === null) return null

  const closeSplit = () => {
    setOverlay(false)
  }
  const grid = h(SplitPanel, {
    services,
    renderSlot,
    SessionProvider,
    useSessions,
    useWorkspaces,
    variant: 'overlay',
    slot,
    // 控制条已经进顶栏了就不再在网格里画一遍；进不去（没有页签行）时留在网格上方。
    hideControls: tools !== null,
    onCloseSplit: closeSplit,
  })
  const body = typeof Boundary === 'function' ? h(Boundary, null, grid) : grid
  const controlBar = tools === null ? null : h(SplitControls, { variant: 'header', onClose: closeSplit })

  if (typeof createPortal !== 'function') {
    // 极端兜底：宿主没给 react-dom 的 createPortal 时，至少别白屏。
    return h('div', { className: 'dcs-hostgrid', 'data-dcs-hostgrid': '1' }, body, controlBar)
  }
  return h(
    React.Fragment,
    null,
    mount === null ? null : createPortal(body, mount),
    tools === null ? null : createPortal(controlBar, tools),
  )
}

/**
 * 左侧栏入口。宿主把 `sidebar.panellist` 的每一行包成「点了就 selectPanel(id)」的按钮；
 * 这里在自家图标上吃掉点击事件，改成开关分屏 —— 会话面板因此不会被换掉，
 * 顶栏、页签、侧栏始终是同一套。
 */
function OverlaySidebarEntry(props) {
  const state = useSplitState()
  const active = state.overlay === true
  const swallow = (event) => {
    event.stopPropagation()
    event.preventDefault()
  }
  return h(
    'span',
    {
      className: 'dcs-entry',
      'data-active': active ? '1' : undefined,
      title: active ? '关闭对话分屏' : '打开对话分屏',
      onPointerDown: swallow,
      onMouseDown: swallow,
      onClick: (event) => {
        swallow(event)
        toggleOverlay()
      },
    },
    h(SplitSidebarIcon, props),
  )
}
