/**
 * dsh-chat-split — 宿主半边。
 *
 * 这个插件的全部功能都在客户端（面板 + 分屏 + 会话渲染），宿主侧不需要注册
 * 服务、命令或 Web 路由。文件保留是为了满足 `main` 入口与 bundle 装载契约：
 * 一个插件可以有半边是空的，但不能没有入口。
 *
 * 注意：这里必须能被任意 profile 安全装载 —— 不做日志、不碰可选服务，
 * 避免因为某个服务缺失而让整个 entry 变成 failed（那样客户端仍然能加载，
 * 但启动界面会报「did not activate」）。
 */

export const name = 'dsh-chat-split'

export const inject = []

export const description = '最多四屏并排的对话分屏面板，可显示不同工作区的不同会话'

export function apply(ctx, config = {}) {
  // 宿主侧无动作：分屏面板完全由 ./client 在浏览器里注册。
  void ctx
  void config
}
