import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { LayoutGrid } from 'lucide-react'
import { useGridStore, WIDGET_REGISTRY } from '@/store/grid-store'

/**
 * Dropdown menu to toggle widget visibility on the bento grid.
 */
export function WidgetToggleMenu() {
  const widgetVisibility = useGridStore(state => state.widgetVisibility)
  const toggleWidget = useGridStore(state => state.toggleWidget)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="size-7">
          <LayoutGrid className="size-4" />
          <span className="sr-only">Toggle widgets</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuLabel className="text-xs">Widgets</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {WIDGET_REGISTRY.map(widget => (
          <DropdownMenuCheckboxItem
            key={widget.id}
            checked={widgetVisibility[widget.id] ?? true}
            onCheckedChange={() => toggleWidget(widget.id)}
          >
            <span className="text-sm">{widget.label}</span>
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
