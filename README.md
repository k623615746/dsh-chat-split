# dsh-chat-split — 对话分屏

左侧栏多一个入口，点开就是一块「最多四屏」的对话区：可以同时看不同工作区的不同对话，也可以把其中一个铺满。

![布局](icon.svg)

四屏并排时宿主顶栏、页签、侧栏都还在（截图取自本机 lab）：

![四屏](docs/split-4up.png)

## 它做什么

- **1–4 屏自由增减**：顶栏右侧 `+ / −`，上限 4，下限 1。
- **自动排布**：1 屏铺满；2 屏左右并排；3 屏两列两行（第三屏跨两列）；4 屏两列两行。
- **单屏铺满**：格子里点「铺满」图标或双击顶栏对应的标题条，`Esc` 还原。
- **拖进来就自动分屏**：从左侧栏把另一个对话拖进对话区，直接新开一屏（有空屏先填空屏，已开的会话则跳过去），不用先点 `+`；拖错的会提示，不会误清空。
- **面板没开也能拖**：一条对话正看着，直接把侧栏里另一条拖到它身上——不用先点左侧「对话分屏」——面板会自动打开，把「你正在看的」和「拖进来的」并排放好。落点会先出现一圈虚线回执。
- **格间换位**：拖着一屏的标题条到另一屏，两个会话对调位置。
- **宿主顶栏原样保留**：分屏不换会话面板，也不盖浮层——网格是 `<div data-conversation-content>` 里的一个**真子节点**，只把里面那份单会话正文换成网格。标题、模式、子智能体、重启、后台任务、硬件监控、页签行（对话/轨迹/画廊…）全部由宿主照常渲染，左侧栏也不动。网格与正文区同宽同高，跟着窗口缩放、跟着切会话走，不靠测量、不会漏出底下的旧会话。
- **分屏操控条在宿主顶栏里**：分屏数 `4/4`、`+`、`−`、`✕` 都不留在网格上，而是被 portal 塞进宿主顶栏那条页签行（`[data-conversation-tabs]` 的父节点）的最右端，前面标着「分屏操控」；页签行不存在时（空白会话）自动退回网格上方。
- **每屏自带信息头**：每屏顶部一条 `.dcs-panehead`，显示「序号 + 工作区 + 对话标题（+ 运行中状态点）」，右侧是该屏的铺满/清空/关闭按钮；哪屏是当前操作的那屏，信息头会换个底色。总顶栏只留「4/4 + − ✕」这组控制，不再汇总各屏标题。
- **空屏直接选**：格子里「选择对话」按工作区分组列出所有对话，支持搜索；已在其它屏的会话会标「已在用」。
- **记忆**：分屏组合（会话 id、当前屏、铺满状态）存在 `localStorage` 的 `dcs.split.v1`，重开面板原样回来。

## 安装

三种方式，任选一种（都需要能跑 pnpm 的 DSH 环境）：

```bash
# 1) npm（发布后可用，包名 dsh-chat-split）
dsh plugin install dsh-chat-split

# 2) 直接从 GitHub 装
dsh plugin install github:k623615746/dsh-chat-split

# 3) 用 Release 里的打包文件
dsh plugin install https://github.com/k623615746/dsh-chat-split/releases/download/v0.1.0/dsh-chat-split-0.1.0.tgz
```

在 GUI 里装：**插件市场 → 安装**，把上面第 2/3 行的 spec 粘进输入框即可；装完勾选启用，刷新页面，左侧栏就多一个「对话分屏」。

本地开发时也可以直接链目录：`dsh plugin install link:/absolute/path/to/dsh-chat-split`（改完 `npm run build` 再刷新）。

## 开发

```bash
npm run build          # src/client/*.js → lib/client.js
node scripts/check.mjs # 注册表 / 槽声明 / 持久化 key 的静态自检
```

`src/client` 里的片段按文件名顺序拼接进同一个 loader factory，共享作用域，所以顺序有意义（`01-shared` 的常量必须在最前，`09-apply` 最后装配）。

## 用起来

1. 左侧栏图标里找四宫格（`对话分屏`），点一下进入。
2. 第一次打开时，第一屏自动放上你当时正在看的对话；其余屏点「选择对话」或从侧栏拖。
3. 总顶栏点 `✕`（或再点一次左侧「对话分屏」）回到普通对话界面（分屏状态不丢）。

## 实现方式（给自己看的）

网格注册在宿主的 `shell.overlay`（帧级浮动层，默认点得穿）。entry 声明一个会话作用域子槽 `chat-split.overlaypane`（`single`/`session`），于是拿到 `SessionProvider` / `renderSlot`，每屏 `sessions.retain(sessionId, { source: 'chatSplit' })` 拿引用、包在 `<SessionProvider>` 里渲染该子槽，子槽组件再用 `renderFactorySlot('conversation.content', { variant: 'embedded', phase: 'active' })` 输出真对话（消息、工具卡片、输入框全在，跟右侧栏子代理聊天同一套做法）。

外壳组件拿到 `[data-conversation-content]` 后做三件事：给它打 `data-dcs-host="1"`（CSS 借此把宿主那份 `[data-conversation-scroll]` 置 `display:none`）、append 一个 `.dcs-hostgrid` 容器、用 `react-dom` 的 `createPortal` 把网格渲染进这个容器。于是网格就是正文区的子节点：

- 不测矩形、不算坐标，窗口缩放 / 顶栏换行 / 侧栏折叠都自动跟随；
- 宿主正文被藏掉，网格底下没有「上一个会话」可以透出来；
- 切会话时宿主会重建正文区，节点一旦 `isConnected === false`，rAF 轮询（只在断连时才查询 DOM，不读布局）会重新挂一次。

控制条走同一条路：`findHeaderBand()` 找 `[data-conversation-tabs]` 的父节点，往里 append 一个 `.dcs-headtools` 容器，再把 `SplitControls` portal 进去；`.dcs-headtools{margin-left:auto}` 让它在页签行里贴右。顶栏、页签、侧栏都在网格之外，由宿主照常渲染，所以天然保留、且独立于所有分屏。左侧栏入口是 `span.dcs-entry`，点击自己 `stopPropagation`，因此点图标是开/关网格，不会 `selectPanel`。`main#chat-split` 那份面板只作兜底（挂载即开网格并 `selectPanel(null)`）。

踩过的坑，都在源码注释里：

- 分屏里 `phase` 只能给 `active`、`hero` 必须 false。宿主 `ConversationContent` 的 `inert` 判据是 `sessionId === void 0 || hero && chipTitle === void 0`；分屏没有它内部那份 workspace chip 状态，一旦判成 `hero` 就等于 disabled —— 输入框占位文字常驻、打不进字、发不出消息。
- `shell.overlay` 的一个 occupant 抛错会把**整个浮动层**塌成 error 占位（其它插件的 toast/菜单一起消失）。错误边界与 `services` 都在 `applyInner()` 闭包里，模块顶层的 `OverlayShell` 取不到 —— 必须由 apply 里再包一层闭包组件（`OverlayBody`）把它们注进去。
- 宿主槽名（`conversation.header` / `conversation.session` / `main.conversation`）一个都不许再声明：一个槽名只能被一个父 entry 的 children 表声明，抢了就让 ui-conversation 激活失败、13 个 entry 连锁 pending。
- 想改成 `conversation.view` 视图也不行：视图里再渲染 `conversation.content` 会撞上宿主的递归守卫（`recursive render of factory 'conversation.content'`）。
- 会话/工作区快照只能从 kit 下发的 `useSessions` / `useWorkspaces` hook 取；`ctx.sessions` / `ctx.workspaces` 服务面上没有 `list` 属性，读它是 `undefined`。服务对象要写成 getter 惰性取，apply 时一次性快照会永久冻住 `undefined`。
- `sessions.retain(id)` 在会话快照还没加载到这条时会抛 `unknown session`。网格是从 `localStorage` 恢复的，往往比会话列表先挂载，所以 `useSessionReference(sessions, id, known)` 里用 `known` 门控：快照里还没出现这条就先空着，`known` 翻成 true 后 effect 重跑再 retain（屏里临时显示「正在打开对话…」）。

这与右侧栏子代理聊天的实现同源：`@deepseek-ai/dsh-client-ui-subagent`。

## 文件

```
src/client/01-shared.js       React 句柄、常量、样式注入、快照观察
src/client/02-css.js          .dcs-* 样式（只用宿主 design token）
src/client/03-store.js        分屏状态 + localStorage
src/client/04-icons.js        内联 SVG 图标
src/client/05-picker.js       按工作区分组的会话选择器
src/client/06-pane.js         单屏：信息头、retain 会话、拖放
src/client/075-overlay.js     外壳：把网格 portal 进正文区、把控制条 portal 进顶栏、侧栏开关
src/client/07-split.js        网格本体：布局 + 控制条 + 焦点模式
src/client/08-conversation.js 分屏里的对话正文（借宿主的 conversation.content）
src/client/09-apply.js        装配：五处注册 + 落点桥 + provide + 诊断 + 卸载
```

`lib/client.js` 是拼接产物，别手改。

```bash
node scripts/build-client.mjs   # 拼 src/client/*.js → lib/client.js
node scripts/check.mjs          # 无界面自检：在假运行时里跑一遍 apply()
```

## 排查

面板起来后，浏览器控制台里：

```js
window.__dcsDiag.state()   // { panes: [...], active, focus, overlay, seeded }
window.__dcsDiag.flush()   // 立即落盘
```

某屏显示「宿主没有下发会话作用域能力」= 子槽没拿到 `SessionProvider`/`renderSlot`，通常是宿主升级后槽语义变了。

`shell.overlay` 里出现 `data-slot-error` 时，控制台会打 `slot entry crashed in 'shell.overlay'`，同时这一层所有插件一起消失 —— 先看 `window.__dcsRenderError`（错误边界记下的栈）。
