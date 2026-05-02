import type { ReactNode } from 'react'
import { Label } from '@/components/ui/label'

interface SettingsFieldProps {
  label: string
  children: ReactNode
  description?: string
}

interface SettingsSectionProps {
  title: string
  children: ReactNode
}

export function SettingsField({
  label,
  children,
  description,
}: SettingsFieldProps) {
  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium text-foreground">{label}</Label>
      {children}
      {description && (
        <p className="text-sm text-neutral-500 mt-1.5">{description}</p>
      )}
    </div>
  )
}

export function SettingsSection({ title, children }: SettingsSectionProps) {
  return (
    <div className="mt-8 mb-4">
      <h3 className="text-xs font-bold tracking-wider text-neutral-500 uppercase">
        {title}
      </h3>
      <div className="space-y-4 mt-4">{children}</div>
    </div>
  )
}
