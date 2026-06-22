import { ViewPlugin, Decoration, DecorationSet, ViewUpdate, EditorView, WidgetType } from '@codemirror/view'
import { RangeSetBuilder } from '@codemirror/state'

const getActiveLine = (view: EditorView) =>
  view.state.doc.lineAt(view.state.selection.main.head).number

// Widget 类型定义
class HrWidget extends WidgetType {
  toDOM() {
    const hr = document.createElement('hr')
    hr.className = 'cm-hr'
    return hr
  }
}

class BulletWidget extends WidgetType {
  toDOM() {
    const span = document.createElement('span')
    span.className = 'cm-bullet'
    span.textContent = '•'
    return span
  }
}

class NumberWidget extends WidgetType {
  constructor(private number: string) { super() }
  toDOM() {
    const span = document.createElement('span')
    span.className = 'cm-ordered-number'
    span.textContent = this.number
    return span
  }
  eq(other: NumberWidget) { return this.number === other.number }
}

class ImageWidget extends WidgetType {
  constructor(private src: string, private alt: string) { super() }
  toDOM() {
    const img = document.createElement('img')
    img.src = this.src
    img.alt = this.alt
    img.className = 'cm-inline-image'
    img.onerror = () => { img.style.display = 'none' }
    return img
  }
  eq(other: ImageWidget) { return this.src === other.src && this.alt === other.alt }
}

class CheckboxWidget extends WidgetType {
  constructor(private checked: boolean) { super() }
  toDOM() {
    const input = document.createElement('input')
    input.type = 'checkbox'
    input.checked = this.checked
    input.className = 'cm-checkbox'
    input.disabled = true
    return input
  }
  eq(other: CheckboxWidget) { return this.checked === other.checked }
}

class CodeBlockHeaderWidget extends WidgetType {
  constructor(private lang: string) { super() }
  toDOM(view: EditorView) {
    const div = document.createElement('div')
    div.className = 'cm-codeblock-header'

    const langSpan = document.createElement('span')
    langSpan.className = 'cm-codeblock-lang'
    langSpan.textContent = this.lang

    div.appendChild(langSpan)

    // 点击代码块头部时，将光标定位到该行以进入编辑模式
    div.addEventListener('mousedown', (e) => {
      e.preventDefault()
      e.stopPropagation()
      const pos = view.posAtDOM(div)
      if (pos >= 0) {
        view.dispatch({
          selection: { anchor: pos, head: pos },
          scrollIntoView: true
        })
        view.focus()
      }
    })

    return div
  }
  eq(other: CodeBlockHeaderWidget) { return this.lang === other.lang }
}

interface DecoRange {
  from: number
  to: number
  deco: Decoration
}

// 工具函数
const isRangeOccupied = (start: number, end: number, occupied: [number, number][]): boolean =>
  occupied.some(([s, e]) => start < e && end > s)

// 行内元素处理
function processInlineElements(
  decos: DecoRange[],
  lineFrom: number,
  text: string
) {
  const occupied: [number, number][] = []
  let match: RegExpExecArray | null

  // 图片 ![alt](url)
  for (const re = /!\[([^\]]*)\]\(([^)]+)\)/g; (match = re.exec(text)); ) {
    const start = lineFrom + match.index
    const end = start + match[0].length
    if (!isRangeOccupied(start, end, occupied)) {
      occupied.push([start, end])
      decos.push({ from: start, to: end, deco: Decoration.replace({ widget: new ImageWidget(match[2], match[1]) }) })
    }
  }

  // 链接 [text](url)
  for (const re = /\[([^\]]+)\]\(([^)]+)\)/g; (match = re.exec(text)); ) {
    const start = lineFrom + match.index
    const end = start + match[0].length
    if (isRangeOccupied(start, end, occupied)) continue
    occupied.push([start, end])
    decos.push({ from: start, to: start + 1, deco: Decoration.mark({ class: 'cm-hidden-marker' }) })
    decos.push({ from: start + 1, to: start + 1 + match[1].length, deco: Decoration.mark({ class: 'cm-link' }) })
    decos.push({ from: start + 1 + match[1].length, to: end, deco: Decoration.mark({ class: 'cm-hidden-marker' }) })
  }

  // 粗体 **text** 或 __text__
  for (const re = /(\*\*|__)(.+?)\1/g; (match = re.exec(text)); ) {
    const start = lineFrom + match.index
    const end = start + match[0].length
    if (isRangeOccupied(start, end, occupied)) continue
    occupied.push([start, end])
    const len = match[1].length
    decos.push({ from: start, to: start + len, deco: Decoration.mark({ class: 'cm-hidden-marker' }) })
    decos.push({ from: start + len, to: start + len + match[2].length, deco: Decoration.mark({ class: 'cm-bold' }) })
    decos.push({ from: start + len + match[2].length, to: end, deco: Decoration.mark({ class: 'cm-hidden-marker' }) })
  }

  // 删除线 ~~text~~
  for (const re = /~~(.+?)~~/g; (match = re.exec(text)); ) {
    const start = lineFrom + match.index
    const end = start + match[0].length
    if (isRangeOccupied(start, end, occupied)) continue
    occupied.push([start, end])
    decos.push({ from: start, to: start + 2, deco: Decoration.mark({ class: 'cm-hidden-marker' }) })
    decos.push({ from: start + 2, to: start + 2 + match[1].length, deco: Decoration.mark({ class: 'cm-strikethrough' }) })
    decos.push({ from: start + 2 + match[1].length, to: end, deco: Decoration.mark({ class: 'cm-hidden-marker' }) })
  }

  // 斜体 *text* 或 _text_
  for (const re = /(?<!\*|_)(\*|_)(?!\1)(.+?)(?<!\1)\1(?!\*|_)/g; (match = re.exec(text)); ) {
    const start = lineFrom + match.index
    const end = start + match[0].length
    if (isRangeOccupied(start, end, occupied)) continue
    occupied.push([start, end])
    const len = match[1].length
    decos.push({ from: start, to: start + len, deco: Decoration.mark({ class: 'cm-hidden-marker' }) })
    decos.push({ from: start + len, to: start + len + match[2].length, deco: Decoration.mark({ class: 'cm-italic' }) })
    decos.push({ from: start + len + match[2].length, to: end, deco: Decoration.mark({ class: 'cm-hidden-marker' }) })
  }

  // 行内代码 `code`
  for (const re = /`([^`]+)`/g; (match = re.exec(text)); ) {
    const start = lineFrom + match.index
    const end = start + match[0].length
    if (isRangeOccupied(start, end, occupied)) continue
    occupied.push([start, end])
    decos.push({ from: start, to: start + 1, deco: Decoration.mark({ class: 'cm-hidden-marker' }) })
    decos.push({ from: start + 1, to: start + 1 + match[1].length, deco: Decoration.mark({ class: 'cm-inline-code' }) })
    decos.push({ from: start + 1 + match[1].length, to: end, deco: Decoration.mark({ class: 'cm-hidden-marker' }) })
  }

  // 任务列表 - [ ] 或 - [x]
  for (const re = /(\s*[-*+]\s+)\[([ xX])\]\s+/g; (match = re.exec(text)); ) {
    const checkboxStart = lineFrom + match.index + match[1].length
    if (!isRangeOccupied(checkboxStart, checkboxStart + 3, occupied)) {
      occupied.push([checkboxStart, checkboxStart + 3])
      decos.push({ from: checkboxStart, to: checkboxStart + 3, deco: Decoration.replace({ widget: new CheckboxWidget(match[2] !== ' ') }) })
    }
  }
}

// 创建 Markdown 行内装饰
function buildDecorations(view: EditorView, activeLine: number): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>()
  const doc = view.state.doc
  const decos: DecoRange[] = []
  let inCodeBlock = false
  let codeBlockLang = ''
  let inBlockquote = false

  for (let i = 1; i <= doc.lines; i++) {
    const line = doc.line(i)
    const text = line.text

    // 代码块标记（必须在行首，不能有缩进）
    if (/^`{3,}/.test(text)) {
      if (!inCodeBlock) {
        inCodeBlock = true
        codeBlockLang = text.trim().slice(3).trim() || 'code'
        decos.push({
          from: line.from,
          to: line.from,
          deco: Decoration.line({ attributes: { class: 'cm-codeblock-line-start' } })
        })
        if (i !== activeLine) {
          decos.push({
            from: line.from,
            to: line.to,
            deco: Decoration.replace({ widget: new CodeBlockHeaderWidget(codeBlockLang) })
          })
        }
      } else {
        inCodeBlock = false
        decos.push({
          from: line.from,
          to: line.from,
          deco: Decoration.line({ attributes: { class: 'cm-codeblock-line-end' } })
        })
        if (i !== activeLine) {
          decos.push({
            from: line.from,
            to: line.to,
            deco: Decoration.mark({ class: 'cm-hidden-marker' })
          })
        }
      }
      continue
    }

    if (inCodeBlock) {
      decos.push({
        from: line.from,
        to: line.from,
        deco: Decoration.line({ attributes: { class: 'cm-codeblock-line' } })
      })
      continue
    }

    // 引用块 lazy continuation 检测
    const isBlockTerminator =
      text.trim() === '' ||
      /^`{3,}/.test(text)

    if (inBlockquote && !text.startsWith('>')) {
      if (isBlockTerminator) {
        inBlockquote = false
      } else {
        decos.push({ from: line.from, to: line.from, deco: Decoration.line({ attributes: { class: 'cm-blockquote-line' } }) })
        decos.push({ from: line.from, to: line.to, deco: Decoration.mark({ class: 'cm-blockquote' }) })
        if (i !== activeLine) {
          processInlineElements(decos, line.from, text)
        }
        continue
      }
    }

    if (text.startsWith('>')) {
      inBlockquote = true
      const quoteMatch = text.match(/^>\s*/)
      if (quoteMatch) {
        decos.push({ from: line.from, to: line.from, deco: Decoration.line({ attributes: { class: 'cm-blockquote-line' } }) })
        decos.push({ from: line.from, to: line.from + quoteMatch[0].length, deco: Decoration.mark({ class: 'cm-hidden-marker' }) })
        decos.push({ from: line.from + quoteMatch[0].length, to: line.to, deco: Decoration.mark({ class: 'cm-blockquote' }) })
        // 处理引用块内的行内元素
        if (i !== activeLine) {
          processInlineElements(decos, line.from + quoteMatch[0].length, text.slice(quoteMatch[0].length))
        }
      }
      continue
    }

    if (i === activeLine) continue

    // 标题行
    const headingMatch = text.match(/^(#{1,6})\s+(.+)$/)
    if (headingMatch) {
      const level = headingMatch[1].length
      decos.push({ from: line.from, to: line.from + level + 1, deco: Decoration.mark({ class: 'cm-hidden-marker' }) })
      decos.push({ from: line.from + level + 1, to: line.to, deco: Decoration.mark({ class: `cm-heading-${level}` }) })
      continue
    }

    // 分割线
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(text.trim())) {
      decos.push({ from: line.from, to: line.to, deco: Decoration.replace({ widget: new HrWidget() }) })
      continue
    }

    // 无序列表（支持 - text 等，必须带空格）
    const ulMatch = text.match(/^(\s*)([-*+])\s+(.+)$/)
    if (ulMatch && ulMatch[3].trim().length > 0) {
      const markerEnd = line.from + ulMatch[1].length + ulMatch[2].length
      const contentStart = markerEnd + 1

      decos.push({ from: line.from, to: line.from, deco: Decoration.line({ attributes: { class: 'cm-list-line' } }) })
      decos.push({ from: line.from + ulMatch[1].length, to: contentStart, deco: Decoration.mark({ class: 'cm-hidden-marker' }) })
      decos.push({ from: contentStart, to: line.to, deco: Decoration.mark({ class: 'cm-list-item' }) })
      decos.push({ from: line.from + ulMatch[1].length, to: line.from + ulMatch[1].length, deco: Decoration.widget({ widget: new BulletWidget(), side: -1 }) })
      continue
    }

    // 有序列表（支持 1. text 等，必须带空格）
    const olMatch = text.match(/^(\s*)(\d+\.)\s+(.+)$/)
    if (olMatch && olMatch[3].trim().length > 0) {
      const markerEnd = line.from + olMatch[1].length + olMatch[2].length
      const contentStart = markerEnd + 1

      decos.push({ from: line.from, to: line.from, deco: Decoration.line({ attributes: { class: 'cm-list-line' } }) })
      decos.push({ from: line.from + olMatch[1].length, to: contentStart, deco: Decoration.mark({ class: 'cm-hidden-marker' }) })
      decos.push({ from: contentStart, to: line.to, deco: Decoration.mark({ class: 'cm-list-item' }) })
      decos.push({ from: line.from + olMatch[1].length, to: line.from + olMatch[1].length, deco: Decoration.widget({ widget: new NumberWidget(olMatch[2]), side: -1 }) })
      continue
    }

    // 行内元素处理
    processInlineElements(decos, line.from, text)
  }

  // 对所有装饰进行排序，以符合 RangeSetBuilder 的严格要求
  decos.sort((a, b) => {
    if (a.from !== b.from) {
      return a.from - b.from
    }
    const aSide = (a.deco as any).startSide ?? 0
    const bSide = (b.deco as any).startSide ?? 0
    if (aSide !== bSide) {
      return aSide - bSide
    }
    return a.to - b.to
  })

  // 依次添加至 builder
  for (const deco of decos) {
    builder.add(deco.from, deco.to, deco.deco)
  }

  return builder.finish()
}

// 创建原地预览插件
export function createLivePreviewPlugin() {
  return ViewPlugin.fromClass(
    class {
      decorations: DecorationSet
      activeLine: number

      constructor(view: EditorView) {
        this.activeLine = getActiveLine(view)
        this.decorations = buildDecorations(view, this.activeLine)
      }

      update(update: ViewUpdate) {
        const newActiveLine = getActiveLine(update.view)
        if (update.docChanged || newActiveLine !== this.activeLine) {
          this.activeLine = newActiveLine
          this.decorations = buildDecorations(update.view, this.activeLine)
        }
      }
    },
    { decorations: (v) => v.decorations }
  )
}
