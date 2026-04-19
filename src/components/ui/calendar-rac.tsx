'use client'

import { cn } from '@/lib/utils'
import { getLocalTimeZone, today } from '@internationalized/date'
import type { ComponentProps } from 'react'
import {
  Button,
  CalendarCell as CalendarCellRac,
  CalendarGridBody as CalendarGridBodyRac,
  CalendarGridHeader as CalendarGridHeaderRac,
  CalendarGrid as CalendarGridRac,
  CalendarHeaderCell as CalendarHeaderCellRac,
  Calendar as CalendarRac,
  Heading as HeadingRac,
  RangeCalendar as RangeCalendarRac,
  composeRenderProps,
} from 'react-aria-components'
import { ChevronLeft, ChevronRight } from 'lucide-react'

interface BaseCalendarProps {
  className?: string
  taskDates?: string[]
  compact?: boolean
}

type CalendarProps = ComponentProps<typeof CalendarRac> & BaseCalendarProps
type RangeCalendarProps = ComponentProps<typeof RangeCalendarRac> &
  BaseCalendarProps

const CalendarHeader = ({ compact = false }: { compact?: boolean }) => (
  <header
    className={cn(
      'flex w-full items-center justify-between',
      compact ? 'pb-1.5' : 'pb-3'
    )}
  >
    <Button
      slot="previous"
      className={cn(
        'flex items-center justify-center rounded-md text-muted-foreground/60 transition-colors hover:bg-accent hover:text-foreground focus:outline-none data-[focus-visible]:outline data-[focus-visible]:outline-2 data-[focus-visible]:outline-ring/70',
        compact ? 'size-5.5' : 'size-7'
      )}
    >
      <ChevronLeft size={compact ? 13 : 16} strokeWidth={2} />
    </Button>
    <HeadingRac
      className={cn(
        'font-medium uppercase tracking-wider text-muted-foreground/90',
        compact ? 'text-[10px]' : 'text-xs'
      )}
    />
    <Button
      slot="next"
      className={cn(
        'flex items-center justify-center rounded-md text-muted-foreground/60 transition-colors hover:bg-accent hover:text-foreground focus:outline-none data-[focus-visible]:outline data-[focus-visible]:outline-2 data-[focus-visible]:outline-ring/70',
        compact ? 'size-5.5' : 'size-7'
      )}
    >
      <ChevronRight size={compact ? 13 : 16} strokeWidth={2} />
    </Button>
  </header>
)

const CalendarGridComponent = ({
  isRange = false,
  taskDates = [],
  compact = false,
}: {
  isRange?: boolean
  taskDates?: string[]
  compact?: boolean
}) => {
  const now = today(getLocalTimeZone())

  return (
    <CalendarGridRac className="w-full table-fixed border-collapse">
      <CalendarGridHeaderRac>
        {day => (
          <CalendarHeaderCellRac
            className={cn(
              'p-0 text-center font-semibold uppercase text-muted-foreground/55',
              compact ? 'h-5.5 text-[9px]' : 'h-7 text-[11px]'
            )}
          >
            {day.slice(0, 1)}
          </CalendarHeaderCellRac>
        )}
      </CalendarGridHeaderRac>
      <CalendarGridBodyRac
        className={cn('[&_td]:p-0', compact && '[&_tr]:h-8')}
      >
        {date => {
          const isToday = date.compare(now) === 0
          const hasTask = taskDates.includes(date.toString())

          return (
            <CalendarCellRac
              date={date}
              className={cn(
                'relative mx-auto my-0.5 flex h-9 w-9 items-center justify-center whitespace-nowrap rounded-lg border border-transparent text-sm font-medium text-foreground outline-offset-2 duration-150 focus:outline-none data-[disabled]:pointer-events-none data-[unavailable]:pointer-events-none data-[focus-visible]:z-10',
                compact && 'my-0.5 h-7 w-7 text-xs',
                // Hover & Selected states
                'data-[hovered]:bg-accent data-[selected]:bg-primary data-[hovered]:text-foreground data-[selected]:text-primary-foreground',
                // Disabled states
                'data-[outside-month]:text-muted-foreground/40 data-[unavailable]:line-through data-[disabled]:opacity-30 data-[unavailable]:opacity-30',
                // Focus outline
                'data-[focus-visible]:outline data-[focus-visible]:outline-2 data-[focus-visible]:outline-ring/70',
                // Range-specific styles
                isRange &&
                  'data-[selected]:rounded-none data-[selection-end]:rounded-e-lg data-[selection-start]:rounded-s-lg data-[invalid]:bg-red-100 data-[selected]:bg-accent data-[selected]:text-foreground data-[selection-end]:bg-primary data-[selection-start]:bg-primary data-[selection-end]:text-primary-foreground data-[selection-start]:text-primary-foreground',
                // Today styles
                isToday &&
                  !isRange &&
                  'bg-foreground text-background shadow-sm hover:bg-foreground/90 data-[selected]:bg-primary data-[selected]:text-primary-foreground',
                // Task indicator
                hasTask &&
                  cn(
                    'after:pointer-events-none after:absolute after:bottom-[10%] after:start-1/2 after:z-10 after:size-[4px] after:-translate-x-1/2 after:rounded-full',
                    isToday ? 'after:bg-background' : 'after:bg-primary'
                  )
              )}
            />
          )
        }}
      </CalendarGridBodyRac>
    </CalendarGridRac>
  )
}

const Calendar = ({
  className,
  taskDates,
  compact = false,
  ...props
}: CalendarProps) => {
  return (
    <CalendarRac
      {...props}
      className={composeRenderProps(className, className =>
        cn('w-full', className)
      )}
    >
      <CalendarHeader compact={compact} />
      <CalendarGridComponent taskDates={taskDates} compact={compact} />
    </CalendarRac>
  )
}

const RangeCalendar = ({
  className,
  taskDates,
  compact = false,
  ...props
}: RangeCalendarProps) => {
  return (
    <RangeCalendarRac
      {...props}
      className={composeRenderProps(className, className =>
        cn('w-full', className)
      )}
    >
      <CalendarHeader compact={compact} />
      <CalendarGridComponent isRange taskDates={taskDates} compact={compact} />
    </RangeCalendarRac>
  )
}

export { Calendar, RangeCalendar }
