import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { WidgetCard } from '../WidgetCard'
import { StickyNote } from 'lucide-react'

/**
 * Quick Notes widget — simple text area for scratch notes.
 */
export function NotesWidget() {
  const { t } = useTranslation()
  const [text, setText] = useState('')

  return (
    <WidgetCard title={t('widgets.notes.title')} icon={StickyNote}>
      <textarea
        value={text}
        onChange={e => setText(e.target.value)}
        placeholder={t('widgets.notes.placeholder')}
        className="h-full w-full resize-none bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
      />
    </WidgetCard>
  )
}
