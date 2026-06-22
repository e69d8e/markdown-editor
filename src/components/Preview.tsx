import { useRef, useEffect, forwardRef, useImperativeHandle } from 'react'
import 'highlight.js/styles/github.css'
import '../styles/Preview.css'

interface PreviewProps {
  html: string
  onScroll?: (scrollRatio: number) => void
}

export interface PreviewRef {
  scrollToRatio: (ratio: number) => void
}

const Preview = forwardRef<PreviewRef, PreviewProps>(({ html, onScroll }, ref) => {
  const containerRef = useRef<HTMLDivElement>(null)

  useImperativeHandle(ref, () => ({
    scrollToRatio: (ratio: number) => {
      if (!containerRef.current) return
      const { scrollHeight, clientHeight } = containerRef.current
      const maxScroll = scrollHeight - clientHeight
      if (maxScroll > 0) {
        containerRef.current.scrollTop = ratio * maxScroll
      }
    }
  }))

  const handleScroll = () => {
    if (!containerRef.current || !onScroll) return
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current
    const maxScroll = scrollHeight - clientHeight
    const ratio = maxScroll > 0 ? scrollTop / maxScroll : 0
    onScroll(ratio)
  }

  const handleCopyClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement
    if (target.classList.contains('code-block-copy')) {
      const wrapper = target.closest('.code-block-wrapper')
      const pre = wrapper?.querySelector('pre')
      if (pre) {
        const text = pre.textContent || ''
        navigator.clipboard.writeText(text).then(() => {
          const originalText = target.textContent
          target.textContent = '已复制'
          target.classList.add('copied')
          setTimeout(() => {
            target.textContent = originalText
            target.classList.remove('copied')
          }, 2000)
        })
      }
    }
  }

  return (
    <div
      ref={containerRef}
      className="preview-container"
      onScroll={handleScroll}
      onClick={handleCopyClick}
    >
      <div
        className="preview-content markdown-body"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  )
})

Preview.displayName = 'Preview'

export default Preview
