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
/* 宿主会话正文区：隐藏它原来那份单会话滚动体，网格接管这块空间。
   0.2.2 起宿主的滚动体被包进 hoc 槽 conversation.hero.frame（一层 display:contents 的 wrapper），
   不再是 [data-conversation-content] 的直系子节点，所以这里用后代选择器；
   网格里每屏自己的滚动体也在同一棵子树上，用下面第二条按特异性盖回来。 */
[data-conversation-content][data-dcs-host="1"] [data-conversation-scroll]{display:none}
.dcs-hostgrid [data-conversation-region="chat"] [data-conversation-scroll]{display:flex}
.dcs-hostgrid{flex:1;min-height:0;min-width:0;display:flex;flex-direction:column;overflow:hidden}
.dcs-hostgrid > .dcs-root{height:100%}
.dcs-root[data-variant="overlay"]{padding:8px}
/* 侧栏入口：图标本身当按钮，点一下开/关悬浮网格 */
.dcs-entry{display:inline-flex;align-items:center;justify-content:center;cursor:pointer;color:inherit}
.dcs-entry[data-active="1"]{color:var(--dsw-alias-state-business-primary)}
.dcs-redirect{display:flex;align-items:center;justify-content:center;height:100%;color:var(--dsw-alias-label-tertiary);font-size:13px}
`
