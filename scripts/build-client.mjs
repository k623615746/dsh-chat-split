/**
 * 客户端半边的构建：把 src/client/*.js 按文件名顺序拼进
 * window.__ModuleLoader__.load 的 factory 体里，产出 lib/client.js。
 *
 * 为什么不用打包器：DSH 的客户端模块系统只给 factory 一个 require，能解析的只有
 * 平台外部符号（react / react-dom / ...）。包内相对 import 解析不到，所以包内
 * 代码必须在同一个闭包里。拼字符串是最小、最可预测的做法。
 *
 * 拼装契约（每个片段都必须遵守）：
 *  - 01 片段负责声明 `React` / `h` 等共享符号，后续片段直接用，不重复 require；
 *  - 片段里不得出现顶层 `export`（要导出就赋给 `exports.xxx`）；
 *  - 片段之间靠声明顺序共享作用域，`const` 有 TDZ，被引用的东西必须先声明。
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(HERE, '..')
const SRC = path.join(ROOT, 'src', 'client')
const OUT = path.join(ROOT, 'lib', 'client.js')
const PACKAGE_NAME = 'dsh-chat-split'

const parts = fs
  .readdirSync(SRC)
  .filter((name) => name.endsWith('.js'))
  .sort()

if (parts.length === 0) {
  console.error('[dcs] no client parts under ' + SRC)
  process.exit(1)
}

/**
 * CSS 是一整段模板字符串，里面任何未转义的反引号都会把字符串提前截断。
 * 这里在构建期就拦住，而不是等页面上的样式表只剩几个字符。
 */
function assertCssTemplate(name, text) {
  const open = text.indexOf('const CSS_TEXT = `')
  if (open === -1) throw new Error('[dcs] ' + name + ' 缺少 `const CSS_TEXT = ` 模板字符串')
  const from = open + 'const CSS_TEXT = `'.length
  const close = text.indexOf('`', from)
  if (close === -1) throw new Error('[dcs] ' + name + ' 的 CSS_TEXT 模板字符串没有闭合')
  const inner = text.slice(from, close)
  if (!inner.trimStart().startsWith('.dcs-root{')) {
    throw new Error('[dcs] ' + name + ' 的 CSS_TEXT 在开头就被截断了：检查模板字符串里是否出现了未转义的反引号')
  }
  const escaped = text.indexOf('\\`', from)
  if (escaped !== -1 && escaped < close) {
    throw new Error('[dcs] ' + name + ' 的 CSS_TEXT 里出现转义反引号，CSS 里不需要它；改成普通文字')
  }
}

const body = parts
  .map((name) => {
    const text = fs.readFileSync(path.join(SRC, name), 'utf8')
    if (/^\s*export\s/m.test(text)) {
      throw new Error('[dcs] ' + name + ' contains a top-level export; assign to exports instead')
    }
    if (name === '02-css.js') assertCssTemplate(name, text)
    return '/* ==== src/client/' + name + ' ==== */\n' + text.trimEnd() + '\n'
  })
  .join('\n')

const banner = `/**
 * ${PACKAGE_NAME} — 客户端半边（生成产物，勿手改）。
 *
 * 源码：src/client/*.js，由 scripts/build-client.mjs 拼接。
 * 加载协议：DSH 客户端模块系统的 window.__ModuleLoader__.load({ id, factory })。
 * id 必须等于 loader entry 名（${PACKAGE_NAME}），否则模块系统报
 * "loaded without registering ..."。
 */

window.__ModuleLoader__.load({
  id: '${PACKAGE_NAME}',
  factory: (require) => {
    var module = { exports: {} }
    var exports = module.exports
    Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' })

${body
  .split('\n')
  .map((line) => (line.length === 0 ? '' : '    ' + line))
  .join('\n')}

    return module.exports
  },
})
`

fs.mkdirSync(path.dirname(OUT), { recursive: true })
fs.writeFileSync(OUT, banner, 'utf8')
console.log('[dcs] lib/client.js written from ' + parts.length + ' parts, ' + Buffer.byteLength(banner) + ' bytes')
