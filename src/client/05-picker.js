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
