import { useState } from 'react'
import { WidgetCard } from '../WidgetCard'
import { StickyNote } from 'lucide-react'

/**
 * Quick Notes widget — simple text area for scratch notes.
 */
export function NotesWidget() {
  const [text, setText] = useState('')

  return (
    <WidgetCard title="Quick Notes" icon={StickyNote}>
      <textarea
        value={text}
        onChange={e => setText(e.target.value)}
        placeholder="Type your notes here..."
        className="h-full w-full resize-none bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
      />
    </WidgetCard>
  )
}
