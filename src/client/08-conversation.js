/**
 * 片段 08 — 分屏里的对话正文。
 *
 * 挂在 `chat-split.pane`（会话作用域子槽）上，由 PaneCell 的 SessionProvider
 * 提供绑定，所以这里能直接拿到 sessionId / useSession / useConversation。
 * 渲染方式是宿主自己的 conversation.content 工厂 + views 覆盖，跟右侧栏
 * 子代理聊天面板同一套做法：不复制对话实现，只借它的渲染。
 */

function SplitConversationView(props) {
  return props.renderSlot('conversation.session', { view: 'chat' })
}

function SplitPaneConversation(props) {
  const { sessionId, useSession, useConversation, useSessions, renderFactorySlot } = props
  const session = useSession((value) => value)
  const conversation = useConversation((value) => value)
  const summary = useSessions((state) => (state !== null && state !== undefined && state.byId ? state.byId[sessionId] : undefined))

  if (session === null || session === undefined) {
    return h('div', { className: 'dcs-pane-fallback' }, '正在打开对话…')
  }
  if (typeof renderFactorySlot !== 'function') {
    return h('div', { className: 'dcs-pane-fallback' }, '宿主的对话渲染不可用（conversation.content 工厂缺失）')
  }

  const activeTargets = conversation !== null && conversation !== undefined && conversation.activeTargets ? conversation.activeTargets.size : 0
  const shellPhase =
    activeTargets > 0 || (session.blank !== true && session.awaitingFirstTurn !== true) || session.running === true
      ? 'active'
      : session.promptAttempted === true
        ? 'engaging'
        : 'blank'
  const summaryBlank = summary === null || summary === undefined ? undefined : summary.blank
  const settling = shellPhase === 'blank' && session.openState === 'loading' && summaryBlank !== true
  // hero 不能用在分屏里：ConversationContent 的 inert 判据是
  // `sessionId === void 0 || hero && chipTitle === void 0`，分屏没有它内部那份
  // workspace chip 状态，一旦判成 hero 就等于 disabled —— 输入框占位文字常驻、
  // 键不进字、也发不出去，正是用户报的那两个症状。分屏一律走 active。
  const hero = false
  const phase = settling ? 'settling' : 'active'

  return h(
    'div',
    { className: 'dcs-convo', 'data-phase': phase },
    renderFactorySlot('conversation.content', { variant: 'embedded', phase, hero }, { slots: { views: SplitConversationView } }),
  )
}
