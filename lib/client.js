/**
 * dsh-chat-split — 客户端半边（生成产物，勿手改）。
 *
 * 源码：src/client/*.js，由 scripts/build-client.mjs 拼接。
 * 加载协议：DSH 客户端模块系统的 window.__ModuleLoader__.load({ id, factory })。
 * id 必须等于 loader entry 名（dsh-chat-split），否则模块系统报
 * "loaded without registering ..."。
 */

window.__ModuleLoader__.load({
  id: 'dsh-chat-split',
  factory: (require) => {
    var module = { exports: {} }
    var exports = module.exports
    Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' })

    /* ==== src/client/01-shared.js ==== */
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

    /* ==== src/client/02-css.js ==== */
    /**
     * 片段 02 — 样式表。整段是模板字符串，构建脚本会校验它没有被反引号截断。
     * 所有规则都挂 `.dcs-` 前缀，只读宿主 design token，不改全局变量。
     */

    const CSS_TEXT = `.dcs-root{
      box-sizing:border-box;
      display:flex;
      flex-direction:column;
      gap:8px;
      height:100%;
      min-height:0;
      padding:calc(var(--dsh-frame-top-clearance,0px) + 8px) 12px 12px;
      font-family:var(--dsw-font-family,inherit);
      color:var(--dsw-alias-label-primary);
    }
    .dcs-top{flex:none;display:flex;align-items:center;justify-content:flex-end;gap:6px;min-width:0;padding:0 2px 6px}
    .dcs-top[data-variant="overlay"]{padding:2px 2px 6px}
    /* 宿主顶栏：独立于分屏，永远在分屏之上；显示当前激活那一屏的会话信息。 */
    .dcs-hostbar{flex:none;display:flex;align-items:center;gap:8px;min-width:0;padding:0 2px 8px}
    /* 借用宿主 conversation.header 时的外壳：它自带内边距与高度，这里只负责占位与不被压缩。 */
    .dcs-hhost{flex:none;display:flex;flex-direction:column;min-width:0}
    .dcs-hhost > *{flex:none;min-width:0}
    .dcs-hostbar[data-idle]{opacity:.55}
    .dcs-hostbar-ws{flex:none;max-width:40%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:var(--dsw-font-size-caption,11px);color:var(--dsw-alias-label-tertiary);border:1px solid var(--dsw-alias-border-l2);border-radius:var(--dsw-radius-xs,4px);padding:1px 6px}
    .dcs-hostbar-title{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:var(--dsw-font-size-body,13px);font-weight:600;color:var(--dsw-alias-label-primary)}
    .dcs-hostbar-dot{flex:none;width:6px;height:6px;border-radius:999px;background:transparent}
    .dcs-hostbar-dot[data-running]{background:var(--dsw-alias-state-business-primary)}
    .dcs-chips{flex:1;display:flex;align-items:center;gap:8px;min-width:0}
    .dcs-chip{
      flex:1 1 0;
      min-width:0;
      display:flex;
      align-items:center;
      gap:7px;
      height:34px;
      padding:0 9px;
      border:1px solid transparent;
      border-radius:10px;
      background:transparent;
      color:var(--dsw-alias-label-tertiary);
      cursor:pointer;
      text-align:left;
      transition:background .15s ease,border-color .15s ease,color .15s ease;
    }
    .dcs-chip:focus-visible{outline:none;border-color:var(--dsw-focus-ring-color,var(--dsw-alias-border-l3))}
    .dcs-chip[data-active]{
      background:var(--dsw-alias-bg-layer-1);
      border-color:var(--dsw-alias-border-l1);
      color:var(--dsw-alias-label-primary);
    }
    .dcs-chip[data-empty] .dcs-chip-title{color:var(--dsw-alias-label-tertiary);font-weight:400}
    .dcs-chip-index{
      flex:none;
      display:inline-flex;
      align-items:center;
      justify-content:center;
      width:16px;height:16px;
      border-radius:5px;
      background:var(--dsw-alias-bg-layer-2);
      font-size:10px;
      line-height:1;
      font-variant-numeric:tabular-nums;
      color:var(--dsw-alias-label-tertiary);
    }
    .dcs-chip[data-active] .dcs-chip-index{background:var(--dsw-alias-state-business-tertiary,var(--dsw-alias-bg-layer-2));color:var(--dsw-alias-label-primary)}
    .dcs-chip-body{flex:1;min-width:0;display:flex;flex-direction:column;gap:1px}
    .dcs-chip-workspace{
      font-size:10px;
      line-height:12px;
      color:var(--dsw-alias-label-tertiary);
      white-space:nowrap;overflow:hidden;text-overflow:ellipsis;
    }
    .dcs-chip-title{
      font-size:12px;
      line-height:15px;
      font-weight:500;
      color:var(--dsw-alias-label-primary);
      white-space:nowrap;overflow:hidden;text-overflow:ellipsis;
    }
    .dcs-chip-dot{flex:none;width:6px;height:6px;border-radius:50%;background:var(--dsw-alias-border-l3)}
    .dcs-chip[data-running] .dcs-chip-dot{background:var(--dsw-alias-state-business-primary);box-shadow:0 0 0 3px color-mix(in srgb,var(--dsw-alias-state-business-primary) 18%,transparent)}
    .dcs-top-actions{flex:none;display:flex;align-items:center;gap:2px}
    .dcs-count{
      padding:0 4px;
      font-size:11px;
      font-variant-numeric:tabular-nums;
      color:var(--dsw-alias-label-tertiary);
      user-select:none;
    }
    .dcs-headtools{
      display:flex;align-items:center;gap:4px;
      margin-left:auto;padding-left:10px;
      flex:none;
    }
    .dcs-headtools-label{
      font-size:11px;
      letter-spacing:.02em;
      color:var(--dsw-alias-label-tertiary);
      margin-right:2px;
      user-select:none;
      white-space:nowrap;
    }
    .dcs-headtools .dcs-btn{width:22px;height:22px;border-radius:6px}
    .dcs-headtools .dcs-count{font-size:11px}
    .dcs-btn{
      display:inline-flex;align-items:center;justify-content:center;
      width:28px;height:28px;
      padding:0;
      border:0;border-radius:8px;
      background:transparent;
      color:var(--dsw-alias-label-tertiary);
      cursor:pointer;
      transition:background .15s ease,color .15s ease;
    }
    .dcs-btn:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}
    .dcs-btn:focus-visible{outline:none;box-shadow:0 0 0 2px var(--dsw-focus-ring-color,var(--dsw-alias-border-l3))}
    .dcs-btn[disabled]{opacity:.35;cursor:default;background:transparent;color:var(--dsw-alias-label-tertiary)}
    .dcs-btn[data-on]{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary)}
    .dcs-grid{flex:1;min-height:0;min-width:0;display:grid;gap:10px}
    .dcs-grid[data-count="1"]{grid-template-columns:minmax(0,1fr);grid-template-rows:minmax(0,1fr)}
    .dcs-grid[data-count="2"]{grid-template-columns:minmax(0,1fr) minmax(0,1fr);grid-template-rows:minmax(0,1fr)}
    .dcs-grid[data-count="3"],.dcs-grid[data-count="4"]{grid-template-columns:minmax(0,1fr) minmax(0,1fr);grid-template-rows:minmax(0,1fr) minmax(0,1fr)}
    .dcs-grid[data-count="3"] .dcs-cell[data-last]{grid-column:1 / span 2}
    .dcs-root[data-focus="1"] .dcs-grid{grid-template-columns:minmax(0,1fr);grid-template-rows:minmax(0,1fr)}
    .dcs-root[data-focus="1"] .dcs-cell[data-hidden]{display:none}
    .dcs-cell{
      position:relative;
      display:flex;flex-direction:column;
      min-width:0;min-height:0;
      border:1px solid var(--dsw-alias-border-l1);
      border-radius:12px;
      background:var(--dsw-alias-bg-layer-1);
      overflow:hidden;
      transition:border-color .15s ease,box-shadow .15s ease;
    }
    .dcs-cell[data-active]{border-color:var(--dsw-alias-border-l3)}
    .dcs-cell[data-drop]{
      border-color:var(--dsw-alias-state-business-primary);
      box-shadow:inset 0 0 0 1px var(--dsw-alias-state-business-primary);
    }
    .dcs-cell[data-drop]:after{
      content:"";
      position:absolute;inset:0;
      background:color-mix(in srgb,var(--dsw-alias-state-business-primary) 8%,transparent);
      pointer-events:none;
    }
    .dcs-cell-body{flex:1;min-height:0;min-width:0;display:flex;flex-direction:column;overflow:hidden}
    .dcs-cell-tools{
      position:absolute;top:6px;right:6px;
      z-index:3;
      display:flex;align-items:center;gap:2px;
      padding:2px;
      border:1px solid var(--dsw-alias-border-l1);
      border-radius:9px;
      background:color-mix(in srgb,var(--dsw-specific-menu,var(--dsw-alias-bg-layer-2)) 88%,transparent);
      backdrop-filter:var(--dsw-menu-backdrop-filter,none);
      opacity:0;
      transform:translateY(-2px);
      transition:opacity .14s ease,transform .14s ease;
    }
    .dcs-cell:hover .dcs-cell-tools,.dcs-cell-tools:focus-within{opacity:1;transform:none}
    .dcs-cell-tools .dcs-btn{width:24px;height:24px;border-radius:7px}
    .dcs-empty{
      flex:1;min-height:0;
      display:flex;align-items:center;justify-content:center;
      padding:14px;
    }
    .dcs-empty-slot{
      width:100%;height:100%;
      display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;
      padding:18px;
      border:1px dashed var(--dsw-alias-border-l2);
      border-radius:10px;
      text-align:center;
    }
    .dcs-empty-icon{color:var(--dsw-alias-label-tertiary);opacity:.75}
    .dcs-empty-title{font-size:13px;line-height:18px;color:var(--dsw-alias-label-secondary)}
    .dcs-empty-hint{font-size:11px;line-height:16px;color:var(--dsw-alias-label-tertiary)}
    .dcs-pill{
      display:inline-flex;align-items:center;gap:5px;
      height:26px;padding:0 11px;
      margin-top:2px;
      border:1px solid var(--dsw-alias-border-l2);
      border-radius:999px;
      background:var(--dsw-alias-bg-layer-2);
      color:var(--dsw-alias-label-primary);
      font-size:12px;
      cursor:pointer;
      transition:background .15s ease,border-color .15s ease;
    }
    .dcs-pill:hover{background:var(--dsw-alias-interactive-bg-hover);border-color:var(--dsw-alias-border-l3)}
    .dcs-pill:focus-visible{outline:none;box-shadow:0 0 0 2px var(--dsw-focus-ring-color,var(--dsw-alias-border-l3))}
    .dcs-picker{
      position:absolute;
      top:8px;right:8px;
      z-index:20;
      width:340px;max-width:calc(100% - 16px);
      max-height:calc(100% - 16px);
      display:flex;flex-direction:column;
      overflow:hidden;
      border:1px solid var(--dsw-alias-border-l1);
      border-radius:12px;
      background:var(--dsw-specific-menu,var(--dsw-alias-bg-layer-2));
      backdrop-filter:var(--dsw-menu-backdrop-filter,none);
      box-shadow:var(--dsw-elevation-prominent,0 12px 32px rgba(0,0,0,.28));
    }
    .dcs-picker-head{flex:none;display:flex;align-items:center;gap:6px;padding:6px 8px;border-bottom:.5px solid var(--dsw-alias-border-l2)}
    .dcs-picker-input{
      flex:1;min-width:0;height:26px;
      border:0;background:transparent;
      color:var(--dsw-alias-label-primary);
      font-size:12px;font-family:inherit;
      outline:none;
    }
    .dcs-picker-input::placeholder{color:var(--dsw-alias-label-tertiary)}
    .dcs-picker-list{
      flex:1;min-height:0;
      overflow:auto;
      padding:4px;
      display:flex;flex-direction:column;gap:1px;
      --dsh-scrollbar-thumb:var(--dsw-alias-scrollbar-bg-l2);
      --dsh-scrollbar-thumb-hover:var(--dsw-alias-scrollbar-hover-l2);
    }
    .dcs-picker-group{
      position:sticky;top:0;
      padding:6px 8px 3px;
      font-size:10px;line-height:14px;
      color:var(--dsw-alias-label-tertiary);
      background:var(--dsw-specific-menu,var(--dsw-alias-bg-layer-2));
    }
    .dcs-picker-row{
      display:flex;align-items:center;gap:6px;
      width:100%;
      padding:6px 8px;
      border:0;border-radius:8px;
      background:transparent;
      color:var(--dsw-alias-label-primary);
      cursor:pointer;
      text-align:left;
    }
    .dcs-picker-row:hover{background:var(--dsw-alias-interactive-bg-hover)}
    .dcs-picker-row:focus-visible{outline:none;box-shadow:inset 0 0 0 1px var(--dsw-alias-border-l3)}
    .dcs-picker-row[data-used]{opacity:.5}
    .dcs-picker-row-title{flex:1;min-width:0;font-size:12px;line-height:17px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .dcs-picker-row-note{flex:none;font-size:10px;color:var(--dsw-alias-label-tertiary)}
    .dcs-picker-empty{padding:16px 10px;text-align:center;font-size:11px;line-height:17px;color:var(--dsw-alias-label-tertiary)}
    .dcs-pane-fallback{
      flex:1;display:flex;align-items:center;justify-content:center;
      padding:18px;
      font-size:12px;
      color:var(--dsw-alias-label-tertiary);
    }
    /* 分屏里的对话正文：宿主 conversation.content（embedded 变体）自己管内部滚动，
       这里只负责把它撑满格子的剩余高度。 */
    .dcs-convo{
      flex:1;
      min-height:0;
      min-width:0;
      display:flex;
      flex-direction:column;
      overflow:hidden;
    }
    .dcs-convo > *{flex:1;min-height:0}
    /* 拖错东西时的短提示，2.2s 后自动消失。 */
    .dcs-toast{
      position:absolute;
      left:10px;right:10px;bottom:10px;
      z-index:6;
      padding:6px 10px;
      border:1px solid var(--dsw-alias-border-l1);
      border-radius:8px;
      background:color-mix(in srgb,var(--dsw-specific-menu,var(--dsw-alias-bg-layer-2)) 94%,transparent);
      color:var(--dsw-alias-label-secondary);
      font-size:11px;line-height:16px;
      pointer-events:none;
    }
    @media (prefers-reduced-motion:reduce){
      .dcs-chip,.dcs-btn,.dcs-cell,.dcs-cell-tools,.dcs-pill{transition:none}
    }
    /* 拖到对话区时的一点点回执：不需要先点侧栏入口也能分屏 */
    html[data-dcs-drop="1"] [data-slot="main"] [data-conversation-session]{
      outline:2px dashed var(--dsw-alias-state-business-primary);
      outline-offset:-6px;
      border-radius:var(--dsw-radius-lg);
    }

    /* 每屏自己的头：序号 / 工作区 / 标题 / 运行点 / 工具 */
    .dcs-panehead{
      flex:none;display:flex;align-items:center;gap:6px;min-width:0;
      padding:6px 8px;border-bottom:1px solid var(--dsw-alias-border-l1);
      background:var(--dsw-alias-bg-layer-1);
    }
    .dcs-panehead[data-active]{background:var(--dsw-alias-bg-layer-2)}
    .dcs-panehead-index{
      flex:none;min-width:16px;height:16px;padding:0 4px;border-radius:var(--dsw-radius-xs,4px);
      display:inline-flex;align-items:center;justify-content:center;
      font-size:var(--dsw-font-size-caption,11px);font-variant-numeric:tabular-nums;
      color:var(--dsw-alias-label-secondary);background:var(--dsw-alias-bg-layer-3,var(--dsw-alias-bg-layer-2));
    }
    .dcs-panehead[data-active] .dcs-panehead-index{background:var(--dsw-alias-state-business-tertiary,var(--dsw-alias-bg-layer-3));color:var(--dsw-alias-label-primary)}
    .dcs-panehead-ws{
      flex:none;max-width:38%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
      font-size:var(--dsw-font-size-caption,11px);color:var(--dsw-alias-label-tertiary);
      border:1px solid var(--dsw-alias-border-l1);border-radius:var(--dsw-radius-xs,4px);padding:0 5px;
    }
    .dcs-panehead-title{
      flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
      font-size:var(--dsw-font-size-body,13px);font-weight:600;color:var(--dsw-alias-label-primary);
    }
    .dcs-panehead[data-empty] .dcs-panehead-title{font-weight:400;color:var(--dsw-alias-label-tertiary)}
    /* 工作模式（标准/PTC/极简/创造）与子智能体数量：跟在标题后面，长了也不挤掉标题 */
    .dcs-panehead-chip{
      flex:none;max-width:34%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
      font-size:var(--dsw-font-size-caption,11px);color:var(--dsw-alias-label-secondary);
      background:var(--dsw-alias-bg-layer-3,var(--dsw-alias-bg-layer-2));
      border-radius:var(--dsw-radius-xs,4px);padding:1px 6px;
    }
    /* 子智能体：计数当按钮，点开是这一屏自己的清单（标题 + 运行点），再点一条放进另一屏 */
    .dcs-panehead-sub{position:relative;flex:none;display:inline-flex;min-width:0;max-width:none}
    .dcs-panehead-subbtn{
      display:inline-flex;align-items:center;gap:3px;cursor:pointer;font:inherit;
      max-width:none;white-space:nowrap;
      border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-2);
      font-size:var(--dsw-font-size-caption,11px);color:var(--dsw-alias-label-secondary);
    }
    .dcs-panehead-subbtn:hover{color:var(--dsw-alias-label-primary);background:var(--dsw-alias-interactive-bg-hover)}
    .dcs-panehead-subbtn[data-open="1"]{color:var(--dsw-alias-label-primary);border-color:var(--dsw-alias-border-l3);background:var(--dsw-alias-bg-layer-3,var(--dsw-alias-bg-layer-2))}
    .dcs-caret{font-size:9px;line-height:1;opacity:.7}
    .dcs-sublist{
      position:absolute;top:calc(100% + 6px);right:0;z-index:30;min-width:200px;width:max-content;max-width:min(320px,62vw);
      max-height:264px;overflow:auto;padding:4px;
      border-radius:var(--dsw-radius-md);background:var(--dsw-alias-bg-layer-2);
      border:1px solid var(--dsw-alias-border-l2);box-shadow:var(--dsw-elevation-prominent,var(--dsw-elevation-panel));
    }
    .dcs-subrow{
      display:flex;align-items:center;gap:6px;width:100%;padding:5px 8px;
      border:none;border-radius:var(--dsw-radius-xs,4px);background:transparent;
      color:var(--dsw-alias-label-primary);font-size:12px;line-height:18px;text-align:left;cursor:pointer;
    }
    .dcs-subrow:hover{background:var(--dsw-alias-interactive-bg-hover)}
    .dcs-subrow-dot{flex:none;width:6px;height:6px;border-radius:999px;background:var(--dsw-alias-border-l3)}
    .dcs-subrow-dot[data-running="1"]{background:var(--dsw-alias-state-business-primary)}
    .dcs-subrow-label{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .dcs-panehead-dot{flex:none;width:6px;height:6px;border-radius:999px;background:transparent}
    .dcs-panehead-dot[data-running]{background:var(--dsw-alias-state-business-primary)}
    .dcs-panehead-tools{flex:none;display:flex;align-items:center;gap:2px;opacity:.35;transition:opacity 120ms ease}
    .dcs-cell:hover .dcs-panehead-tools,.dcs-panehead-tools:focus-within{opacity:1}
    .dcs-panehead-tools .dcs-btn{width:22px;height:22px;border-radius:6px}

    /* 宿主会话面板不动，网格盖在正文区上，顶栏与页签因此保留 */
    /* 宿主会话正文区：隐藏它原来那份单会话滚动体，网格接管这块空间 */
    [data-conversation-content][data-dcs-host="1"] > [data-conversation-scroll]{display:none}
    .dcs-hostgrid{flex:1;min-height:0;min-width:0;display:flex;flex-direction:column;overflow:hidden}
    .dcs-hostgrid > .dcs-root{height:100%}
    .dcs-root[data-variant="overlay"]{padding:8px}
    /* 侧栏入口：图标本身当按钮，点一下开/关悬浮网格 */
    .dcs-entry{display:inline-flex;align-items:center;justify-content:center;cursor:pointer;color:inherit}
    .dcs-entry[data-active="1"]{color:var(--dsw-alias-state-business-primary)}
    .dcs-redirect{display:flex;align-items:center;justify-content:center;height:100%;color:var(--dsw-alias-label-tertiary);font-size:13px}
    `

    /* ==== src/client/03-store.js ==== */
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

    /* ==== src/client/04-icons.js ==== */
    /**
     * 片段 04 — 图标。全部线条图标，跟随 currentColor，尺寸由调用方给。
     * 不引宿主 icon 包：客户端模块只解析平台外部符号，跨包引用会拿到 undefined。
     */

    function svgProps(size, extra) {
      const base = {
        width: size,
        height: size,
        viewBox: '0 0 24 24',
        fill: 'none',
        stroke: 'currentColor',
        strokeWidth: 1.6,
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
        'aria-hidden': 'true',
        focusable: 'false',
      }
      return extra === undefined ? base : { ...base, ...extra }
    }

    /** 左栏图标：四宫格。 */
    function IconSplit(props) {
      const size = props && props.size ? props.size : 18
      return h(
        'svg',
        svgProps(size),
        h('rect', { x: 3, y: 3, width: 8, height: 8, rx: 1.8 }),
        h('rect', { x: 13, y: 3, width: 8, height: 8, rx: 1.8 }),
        h('rect', { x: 3, y: 13, width: 8, height: 8, rx: 1.8 }),
        h('rect', { x: 13, y: 13, width: 8, height: 8, rx: 1.8 }),
      )
    }

    function IconPlus(props) {
      const size = props && props.size ? props.size : 16
      return h('svg', svgProps(size), h('path', { d: 'M12 5v14M5 12h14' }))
    }

    function IconMinus(props) {
      const size = props && props.size ? props.size : 16
      return h('svg', svgProps(size), h('path', { d: 'M5 12h14' }))
    }

    /** 铺满：向外箭头。 */
    function IconExpand(props) {
      const size = props && props.size ? props.size : 15
      return h(
        'svg',
        svgProps(size),
        h('path', { d: 'M9 4H4v5' }),
        h('path', { d: 'M15 4h5v5' }),
        h('path', { d: 'M15 20h5v-5' }),
        h('path', { d: 'M9 20H4v-5' }),
      )
    }

    /** 还原：向内箭头。 */
    function IconShrink(props) {
      const size = props && props.size ? props.size : 15
      return h(
        'svg',
        svgProps(size),
        h('path', { d: 'M4 9h5V4' }),
        h('path', { d: 'M20 9h-5V4' }),
        h('path', { d: 'M20 15h-5v5' }),
        h('path', { d: 'M4 15h5v5' }),
      )
    }

    function IconClose(props) {
      const size = props && props.size ? props.size : 14
      return h('svg', svgProps(size), h('path', { d: 'M6 6l12 12M18 6L6 18' }))
    }

    function IconEject(props) {
      const size = props && props.size ? props.size : 14
      return h('svg', svgProps(size), h('path', { d: 'M5 12h14' }), h('path', { d: 'M9 8l-4 4 4 4' }))
    }

    function IconSearch(props) {
      const size = props && props.size ? props.size : 14
      return h('svg', svgProps(size), h('circle', { cx: 11, cy: 11, r: 6.2 }), h('path', { d: 'M16 16l3.5 3.5' }))
    }

    /** 空屏里的大图标：两个并排的对话窗。 */
    function IconSplitBig(props) {
      const size = props && props.size ? props.size : 26
      return h(
        'svg',
        svgProps(size, { strokeWidth: 1.4 }),
        h('rect', { x: 3, y: 4.5, width: 7.5, height: 15, rx: 2 }),
        h('rect', { x: 13.5, y: 4.5, width: 7.5, height: 15, rx: 2 }),
      )
    }

    /* ==== src/client/05-picker.js ==== */
    /**
     * 片段 05 — 会话选择器：空屏里点「选择对话」时弹出。
     *
     * 按工作区分组（跨工作区分屏要能一眼看出会话从哪来），带搜索与「已在用」标记。
     * 数据全部来自宿主快照：sessions.list.byId + workspaces.list.items。
     */

    function matchesQuery(text, query) {
      if (query.length === 0) return true
      return String(text === null || text === undefined ? '' : text).toLowerCase().includes(query)
    }

    /** 把两个快照拼成 [{ key, title, members: [{ id, title, blank }] }]。 */
    function buildPickerGroups(sessions, workspaceState, query) {
      const rows = sessions !== null && sessions !== undefined && sessions.byId ? sessions.byId : {}
      const items = workspaceState !== null && workspaceState !== undefined && Array.isArray(workspaceState.items) ? workspaceState.items : []
      const needle = String(query || '').trim().toLowerCase()
      const seen = new Set()
      const groups = []

      for (const item of items) {
        if (item === null || item === undefined) continue
        const ids = Array.isArray(item.sessionIds) ? item.sessionIds : []
        const members = []
        for (const id of ids) {
          seen.add(id)
          const row = rows[id]
          if (!sessionSelectable(row)) continue
          const title = typeof row.title === 'string' && row.title.trim().length > 0 ? row.title.trim() : ''
          if (!matchesQuery(title, needle) && !matchesQuery(item.title, needle) && !matchesQuery(item.path, needle)) continue
          members.push({ id, title: title.length > 0 ? title : '未命名对话', blank: row.blank === true })
        }
        if (members.length > 0) {
          groups.push({
            key: item.workspaceId,
            title: typeof item.title === 'string' && item.title.length > 0 ? item.title : item.path || item.workspaceId,
            members,
          })
        }
      }

      const others = []
      for (const id of Object.keys(rows)) {
        if (seen.has(id)) continue
        const row = rows[id]
        if (!sessionSelectable(row)) continue
        const title = typeof row.title === 'string' && row.title.trim().length > 0 ? row.title.trim() : ''
        if (!matchesQuery(title, needle)) continue
        others.push({ id, title: title.length > 0 ? title : '未命名对话', blank: row.blank === true })
      }
      if (others.length > 0) groups.push({ key: '__others__', title: '未归档到工作区', members: others })

      return groups
    }

    function SessionPicker(props) {
      const { sessions, workspaceState, usedIds, onPick, onClose, label } = props
      const [query, setQuery] = useState('')
      const rootRef = useRef(null)
      const inputRef = useRef(null)
      const groups = useMemo(() => buildPickerGroups(sessions, workspaceState, query), [sessions, workspaceState, query])
      const total = groups.reduce((sum, group) => sum + group.members.length, 0)

      useEffect(() => {
        if (inputRef.current !== null) inputRef.current.focus()
      }, [])

      useEffect(() => {
        const onPointerDown = (event) => {
          const node = rootRef.current
          if (node === null) return
          if (event.target instanceof Node && node.contains(event.target)) return
          onClose()
        }
        document.addEventListener('pointerdown', onPointerDown, true)
        return () => {
          document.removeEventListener('pointerdown', onPointerDown, true)
        }
      }, [onClose])

      return h(
        'div',
        {
          className: 'dcs-picker',
          ref: rootRef,
          role: 'dialog',
          'aria-label': label,
          onPointerDown: (event) => {
            event.stopPropagation()
          },
          onDragStart: (event) => {
            event.stopPropagation()
          },
        },
        h(
          'div',
          { className: 'dcs-picker-head' },
          h(IconSearch, { size: 14 }),
          h('input', {
            ref: inputRef,
            className: 'dcs-picker-input',
            type: 'text',
            value: query,
            placeholder: '搜索对话或工作区',
            'aria-label': '搜索对话',
            onChange: (event) => {
              setQuery(event.target.value)
            },
            onKeyDown: (event) => {
              if (event.key === 'Escape') {
                event.stopPropagation()
                onClose()
              }
            },
          }),
          h(
            'button',
            { type: 'button', className: 'dcs-btn', title: '关闭', onClick: onClose },
            h(IconClose, { size: 13 }),
          ),
        ),
        h(
          'div',
          { className: 'dcs-picker-list' },
          total === 0
            ? h('div', { className: 'dcs-picker-empty' }, query.length === 0 ? '还没有可放的对话，先在左侧栏新建一个。' : '没有匹配的对话。')
            : groups.map((group) =>
                h(
                  'div',
                  { key: group.key },
                  h('div', { className: 'dcs-picker-group' }, group.title),
                  group.members.map((member) =>
                    h(
                      'button',
                      {
                        key: member.id,
                        type: 'button',
                        className: 'dcs-picker-row',
                        'data-used': usedIds.has(member.id) ? '1' : undefined,
                        title: member.title,
                        onClick: () => {
                          onPick(member.id)
                        },
                      },
                      h('span', { className: 'dcs-picker-row-title' }, member.title),
                      usedIds.has(member.id) ? h('span', { className: 'dcs-picker-row-note' }, '已在用') : null,
                    ),
                  ),
                ),
              ),
        ),
      )
    }

    /* ==== src/client/06-pane.js ==== */
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

    /* ==== src/client/07-split.js ==== */
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

    /* ==== src/client/075-overlay.js ==== */
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

    /** 宿主顶栏第二行（页签行）的容器；控制条挂在它右端，找不到就留在网格上方。 */
    function findHeaderBand() {
      if (typeof document === 'undefined' || typeof document.querySelector !== 'function') return null
      const tabs = document.querySelector('[data-conversation-tabs]')
      if (tabs === null || tabs.parentElement === null) return null
      return tabs.parentElement
    }

    /** 当前界面语言：宿主 locale 服务给的是 zh / en / ja…；非中文一律按英文文案兜底。 */
    function currentLang(locale) {
      const active = locale !== null && locale !== undefined && locale.snapshot !== undefined ? locale.snapshot.active : ''
      return /^en/i.test(String(active === undefined || active === null ? '' : active)) ? 'en' : 'zh'
    }

    function OverlayShell(props) {
      const { services, renderSlot, SessionProvider, useSessions, useWorkspaces, slot, Boundary, lang } = props
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
        let currentHost = null
        let currentBand = null
        const tick = () => {
          if (!alive) return
          if (currentHost === null || currentHost.isConnected !== true) {
            const next = findConversationBody()
            if (next !== currentHost) {
              currentHost = next
              setHost(next)
            }
          }
          if (currentBand === null || currentBand.isConnected !== true) {
            const next = findHeaderBand()
            if (next !== currentBand) {
              currentBand = next
              setBand(next)
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
        lang: lang === 'en' ? 'en' : 'zh',
        // 控制条已经进顶栏了就不再在网格里画一遍；进不去（顶栏还没渲染）时留在网格上方。
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

    /* ==== src/client/08-conversation.js ==== */
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

    /* ==== src/client/09-apply.js ==== */
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
        h(
          OverlayShell,
          Object.assign({}, props, {
            services,
            slot: SLOT_OVERLAY,
            Boundary: SplitBoundary,
            // 每屏信息头上的工作模式文案要跟界面语言走；locale 服务可能晚到，所以每次渲染都重取。
            lang: currentLang(readService(ctx, 'locale')),
          }),
        )

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


    return module.exports
  },
})
