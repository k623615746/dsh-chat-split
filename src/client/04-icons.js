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
