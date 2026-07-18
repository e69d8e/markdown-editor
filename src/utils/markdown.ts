import { EditorView } from '@codemirror/view'

/**
 * 在选区前后插入 Markdown 语法标记
 */
export function insertMarkdown(view: EditorView, before: string, after: string): boolean {
  const { from, to } = view.state.selection.main
  const selected = view.state.sliceDoc(from, to) || '文本'
  const replacement = before + selected + after

  view.dispatch({
    changes: { from, to, insert: replacement },
    selection: {
      anchor: from + before.length,
      head: from + before.length + selected.length
    }
  })
  view.focus()
  return true
}

/**
 * 替换当前行的前缀（标题、列表、引用）
 */
export function insertLinePrefix(view: EditorView, prefix: string): void {
  const { from, to } = view.state.selection.main
  const line = view.state.doc.lineAt(from)
  // 去除已有的标题/列表/引用前缀再添加新前缀
  const stripped = line.text.replace(/^(#{1,6}\s+|[-*+]\s+|\d+\.\s+|>\s+)/, '')
  const replacement = prefix + stripped

  const lengthDiff = replacement.length - line.text.length
  const newAnchor = Math.max(line.from, from + lengthDiff)
  const newHead = Math.max(line.from, to + lengthDiff)

  view.dispatch({
    changes: { from: line.from, to: line.to, insert: replacement },
    selection: { anchor: newAnchor, head: newHead }
  })
  view.focus()
}
