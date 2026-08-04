import { useState, type FormEvent } from 'react'
import {
  ArrowRight,
  Bell,
  Check,
  CheckCircle2,
  Circle,
  Clock3,
  Loader2,
  Monitor,
  PanelTopOpen,
  Play,
  Plus,
  Target,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { TitleBar } from '@/components/titlebar/TitleBar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { getLocalISODate } from '@/lib/calendar-domain'
import { commands, unwrapResult } from '@/lib/tauri-bindings'
import { cn } from '@/lib/utils'
import { useDailyPlanStore } from '@/store/daily-plan-store'
import { useOnboardingStore } from '@/store/onboarding-store'
import { usePomodoroStore } from '@/store/pomodoro-store'
import { useTasksStore } from '@/store/tasks-store'
import { useUIStore } from '@/store/ui-store'

type OnboardingStep = 1 | 2 | 3 | 4
type CaptureKind = 'task' | 'note' | 'event'

const STEP_ICONS = [Target, CheckCircle2, Clock3, PanelTopOpen] as const

export function OnboardingPage() {
  const [taskTitle, setTaskTitle] = useState('')
  const [focusTaskId, setFocusTaskId] = useState<string | null>(null)
  const [step, setStep] = useState<OnboardingStep>(1)
  const [isSaving, setIsSaving] = useState(false)
  const [captureText, setCaptureText] = useState('')
  const [captureKind, setCaptureKind] = useState<CaptureKind>('task')
  const [isCapturing, setIsCapturing] = useState(false)
  const [captureSaved, setCaptureSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { t } = useTranslation()

  const examples = [
    t('onboarding.examples.clients'),
    t('onboarding.examples.week'),
    t('onboarding.examples.delivery'),
  ]

  const addTask = useTasksStore(state => state.addTask)
  const initializeTodayPlan = useDailyPlanStore(
    state => state.initializeTodayPlan
  )
  const updateFocus = useDailyPlanStore(state => state.updateFocus)
  const startContextualFocus = usePomodoroStore(
    state => state.startContextualFocus
  )
  const completeOnboarding = useOnboardingStore(
    state => state.completeOnboarding
  )
  const navigateTo = useUIStore(state => state.navigateTo)

  const handleCreateFocus = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const title = taskTitle.trim()
    if (!title || isSaving) return

    setIsSaving(true)
    setError(null)

    try {
      const task = await addTask(title, { priority: 'high' })
      await initializeTodayPlan()

      if (!useDailyPlanStore.getState().activePlan) {
        throw new Error('Daily plan was not initialized')
      }

      await updateFocus(task.id, 'manual')
      setFocusTaskId(task.id)
      setStep(2)
    } catch (saveError) {
      console.error('Failed to create initial focus', saveError)
      setError(t('onboarding.error.save'))
    } finally {
      setIsSaving(false)
    }
  }

  const handleStartSession = async () => {
    if (!focusTaskId || isSaving) return

    setIsSaving(true)
    setError(null)
    const started = await startContextualFocus(focusTaskId)

    if (started) {
      setStep(4)
    } else {
      setError(t('onboarding.error.session'))
    }

    setIsSaving(false)
  }

  const handleFinish = () => {
    completeOnboarding()
    navigateTo('pomodoro')
  }

  const handleQuickCapture = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const content = captureText.trim()
    if (!content || isCapturing) return

    setIsCapturing(true)
    setError(null)

    try {
      if (captureKind === 'task') {
        await addTask(content, { priority: 'medium' })
      } else if (captureKind === 'note') {
        await unwrapResult(
          await commands.createNote({ title: null, content, folder: null })
        )
      } else {
        const today = getLocalISODate()
        const tomorrow = getLocalISODate(new Date(Date.now() + 86_400_000))
        const now = new Date().toISOString()
        await unwrapResult(
          await commands.createEvent({
            id: crypto.randomUUID(),
            title: content,
            description: null,
            start_date: today,
            end_date: tomorrow,
            all_day: true,
            color: null,
            created_at: now,
            updated_at: now,
          })
        )
      }

      setCaptureText('')
      setCaptureSaved(true)
    } catch (captureError) {
      console.error('Failed to save onboarding quick capture', captureError)
      setError(t('onboarding.error.capture'))
    } finally {
      setIsCapturing(false)
    }
  }

  const heading = t(`onboarding.screen${step}.title`)

  return (
    <div className="flex h-screen w-full flex-col overflow-hidden bg-background">
      <TitleBar
        className="absolute top-0 z-50 w-full border-b-0 bg-transparent"
        showClock={false}
      />

      <div className="flex flex-1 overflow-hidden pt-8">
        <aside className="hidden w-64 shrink-0 flex-col justify-between border-r border-border bg-card px-7 py-8 lg:flex">
          <div className="flex flex-col gap-12">
            <div className="flex items-center gap-3">
              <div className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                <Target className="size-5" />
              </div>
              <div>
                <p className="font-semibold text-foreground">axis</p>
                <p className="text-xs text-muted-foreground">
                  {t('onboarding.brandTagline')}
                </p>
              </div>
            </div>

            <ol
              className="flex flex-col gap-5"
              aria-label={t('onboarding.progressLabel')}
            >
              {STEP_ICONS.map((Icon, index) => {
                const itemStep = (index + 1) as OnboardingStep
                const isCurrent = itemStep === step
                const isComplete = itemStep < step

                return (
                  <li
                    className={cn(
                      'flex items-center gap-3 text-sm transition-colors duration-200',
                      isCurrent && 'font-semibold text-foreground',
                      !isCurrent && 'text-muted-foreground'
                    )}
                    key={itemStep}
                  >
                    <span
                      className={cn(
                        'flex size-7 items-center justify-center rounded-full border transition-[background-color,color,transform] duration-200 motion-safe:animate-[onboarding-marker-in_240ms_cubic-bezier(0.22,1,0.36,1)]',
                        isCurrent &&
                          'border-primary bg-primary text-primary-foreground',
                        isComplete &&
                          'border-primary/25 bg-primary/10 text-primary',
                        !isCurrent &&
                          !isComplete &&
                          'border-border bg-secondary text-muted-foreground'
                      )}
                    >
                      {isComplete ? (
                        <Check className="size-3.5" />
                      ) : (
                        <Icon className="size-3.5" />
                      )}
                    </span>
                    {t(
                      `onboarding.step.${['now', 'nextFocus', 'session', 'quickCapture'][index]}`
                    )}
                  </li>
                )
              })}
            </ol>
          </div>

          <OnboardingStepCard step={step} />
        </aside>

        <main className="flex flex-1 items-center justify-center overflow-y-auto px-6 py-12 lg:px-16">
          <section
            aria-labelledby="onboarding-heading"
            className="w-full max-w-2xl motion-safe:animate-[onboarding-step-in_280ms_cubic-bezier(0.22,1,0.36,1)]"
            key={step}
          >
            {step === 1 ? (
              <form
                className="flex flex-col gap-8"
                onSubmit={event => void handleCreateFocus(event)}
              >
                <OnboardingIntro step={step} title={heading} />
                <div className="flex flex-col gap-2">
                  <label
                    className="text-sm font-medium text-foreground"
                    htmlFor="initial-focus-task"
                  >
                    {t('onboarding.taskLabel')}
                  </label>
                  <Input
                    autoFocus
                    id="initial-focus-task"
                    onChange={event => setTaskTitle(event.target.value)}
                    placeholder={t('onboarding.taskPlaceholder')}
                    value={taskTitle}
                    className="h-14 border-2 border-border bg-popover px-4 text-base shadow-none transition-[border-color,box-shadow] duration-200 focus-visible:border-ring"
                  />
                </div>
                <div className="flex flex-col gap-3">
                  <p className="text-sm font-medium text-foreground">
                    {t('onboarding.examplesLabel')}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {examples.map(example => (
                      <button
                        className="rounded-lg border border-border bg-secondary px-3 py-2 text-sm text-muted-foreground transition-[background-color,color,transform] duration-200 hover:bg-accent hover:text-accent-foreground active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        key={example}
                        onClick={() => setTaskTitle(example)}
                        type="button"
                      >
                        {example}
                      </button>
                    ))}
                  </div>
                </div>
                <OnboardingError error={error} />
                <div className="flex items-center justify-between gap-4 pt-2">
                  <p className="text-sm text-muted-foreground">
                    {t('onboarding.duration')}
                  </p>
                  <Button
                    disabled={!taskTitle.trim() || isSaving}
                    size="lg"
                    type="submit"
                  >
                    {isSaving ? (
                      <Loader2 className="animate-spin" />
                    ) : (
                      <ArrowRight />
                    )}
                    {t('onboarding.submit')}
                  </Button>
                </div>
              </form>
            ) : step === 2 ? (
              <div className="flex flex-col gap-8">
                <OnboardingIntro step={step} title={heading} />
                <FocusPreview taskTitle={taskTitle} />
                <div className="flex items-center justify-between gap-4">
                  <Button
                    onClick={() => setStep(1)}
                    type="button"
                    variant="ghost"
                  >
                    {t('onboarding.back')}
                  </Button>
                  <Button onClick={() => setStep(3)} size="lg" type="button">
                    <ArrowRight />
                    {t('onboarding.screen2.submit')}
                  </Button>
                </div>
              </div>
            ) : step === 3 ? (
              <div className="flex flex-col items-center text-center">
                <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm font-medium text-foreground">
                  <Target className="size-4" />
                  <span>{taskTitle}</span>
                </div>
                <div className="mt-8 flex size-64 items-center justify-center rounded-full border-8 border-primary motion-safe:animate-[onboarding-marker-in_360ms_cubic-bezier(0.22,1,0.36,1)] sm:size-80">
                  <div>
                    <p className="text-5xl font-semibold tabular-nums tracking-tight text-foreground sm:text-6xl">
                      25:00
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {t('onboarding.screen3.timerCaption')}
                    </p>
                  </div>
                </div>
                <div className="mt-8 max-w-xl">
                  <h1
                    className="text-4xl font-semibold tracking-tight text-foreground lg:text-5xl"
                    id="onboarding-heading"
                  >
                    {heading}
                  </h1>
                  <p className="mt-4 text-lg leading-relaxed text-muted-foreground">
                    {t('onboarding.screen3.description')}
                  </p>
                </div>
                <OnboardingError error={error} />
                <Button
                  className="mt-7"
                  disabled={isSaving}
                  onClick={() => void handleStartSession()}
                  size="lg"
                  type="button"
                >
                  {isSaving ? <Loader2 className="animate-spin" /> : <Play />}
                  {t('onboarding.screen3.submit')}
                </Button>
                <p className="mt-5 text-sm text-muted-foreground">
                  {t('onboarding.screen3.hint')}
                </p>
              </div>
            ) : (
              <div className="flex flex-col items-center text-center">
                <p className="rounded-full border border-border bg-card px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {t('onboarding.screen4.eyebrow')}
                </p>
                <h1
                  className="mt-8 max-w-3xl text-4xl font-semibold tracking-tight text-foreground lg:text-5xl"
                  id="onboarding-heading"
                >
                  {heading}
                </h1>
                <p className="mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground">
                  {t('onboarding.screen4.description')}
                </p>
                <form
                  aria-label={t('onboarding.quickPane.title')}
                  className="mt-8 w-full max-w-xl overflow-hidden rounded-2xl border border-border bg-card text-left"
                  onSubmit={event => void handleQuickCapture(event)}
                >
                  <div className="flex items-center justify-between border-b border-border px-5 py-3">
                    <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
                      <span className="size-2 rounded-full bg-muted-foreground" />
                      {t('onboarding.quickPane.title')}
                    </p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <kbd className="rounded border border-border px-2 py-1 font-mono">
                        Alt
                      </kbd>
                      <span>+</span>
                      <kbd className="rounded border border-border px-2 py-1 font-mono">
                        Space
                      </kbd>
                    </div>
                  </div>
                  <div className="p-5">
                    <label
                      className="sr-only"
                      htmlFor="onboarding-quick-capture"
                    >
                      {t('onboarding.quickPane.inputLabel')}
                    </label>
                    <div className="flex items-center gap-3 rounded-xl border-2 border-border bg-popover px-4 transition-[border-color] duration-200 focus-within:border-ring">
                      <Plus className="size-5 shrink-0 text-muted-foreground" />
                      <Input
                        className="h-14 border-0 bg-transparent px-0 shadow-none dark:bg-transparent focus-visible:shadow-none focus-visible:ring-0"
                        id="onboarding-quick-capture"
                        onChange={event => {
                          setCaptureText(event.target.value)
                          setCaptureSaved(false)
                        }}
                        placeholder={t('onboarding.quickPane.placeholder')}
                        value={captureText}
                      />
                    </div>
                    <div className="mt-5 flex items-center justify-between gap-4">
                      <div className="flex items-center gap-1" role="tablist">
                        {(['task', 'note', 'event'] as const).map(kind => (
                          <button
                            aria-selected={captureKind === kind}
                            className={cn(
                              'rounded-lg px-3 py-2 text-sm transition-colors',
                              captureKind === kind
                                ? 'bg-secondary font-medium text-foreground'
                                : 'text-muted-foreground hover:text-foreground'
                            )}
                            key={kind}
                            onClick={() => setCaptureKind(kind)}
                            role="tab"
                            type="button"
                          >
                            {t(`onboarding.quickPane.kind.${kind}`)}
                          </button>
                        ))}
                      </div>
                      <Button
                        disabled={!captureText.trim() || isCapturing}
                        type="submit"
                      >
                        {isCapturing ? (
                          <Loader2 className="animate-spin" />
                        ) : null}
                        {t('onboarding.quickPane.save')}
                      </Button>
                    </div>
                  </div>
                </form>
                <p className="mt-7 flex items-center gap-2 text-sm text-muted-foreground">
                  <CheckCircle2 className="size-4" />
                  {captureSaved
                    ? t('onboarding.quickPane.saved')
                    : t('onboarding.quickPane.assurance')}
                </p>
                <Button
                  className="mt-8"
                  onClick={handleFinish}
                  size="lg"
                  type="button"
                >
                  {t('onboarding.screen4.submit')}
                </Button>
              </div>
            )}
          </section>
        </main>

        <aside className="hidden w-72 shrink-0 border-l border-border bg-secondary p-8 xl:block">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            {t('onboarding.today')}
          </p>
          <FocusPreview
            taskTitle={taskTitle || t('onboarding.previewEmpty')}
            compact
          />
          <div className="mt-5 flex items-start gap-3 text-sm leading-relaxed text-muted-foreground">
            <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-foreground" />
            <p>
              {t(
                step > 1
                  ? 'onboarding.previewFocused'
                  : 'onboarding.previewDescription'
              )}
            </p>
          </div>
        </aside>
      </div>
    </div>
  )
}

function OnboardingIntro({
  step,
  title,
}: {
  step: OnboardingStep
  title: string
}) {
  const { t } = useTranslation()

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
        {t(`onboarding.screen${step}.eyebrow`)}
      </p>
      <h1
        className="text-4xl font-semibold tracking-tight text-foreground lg:text-5xl"
        id="onboarding-heading"
      >
        {title}
      </h1>
      <p className="max-w-xl text-lg leading-relaxed text-muted-foreground">
        {t(`onboarding.screen${step}.description`)}
      </p>
    </div>
  )
}

function OnboardingStepCard({ step }: { step: OnboardingStep }) {
  const { t } = useTranslation()

  if (step === 1) {
    return (
      <div className="flex flex-col gap-4 rounded-xl border border-border bg-secondary p-5 text-xs leading-relaxed text-muted-foreground">
        <Monitor className="size-4 text-foreground" />
        <p>{t('onboarding.stepCard.desktop')}</p>
      </div>
    )
  }

  if (step === 2) {
    return (
      <p className="text-sm leading-relaxed text-muted-foreground">
        {t('onboarding.stepCard.focus')}
      </p>
    )
  }

  if (step === 3) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Bell className="size-4 shrink-0" />
        <p>{t('onboarding.stepCard.session')}</p>
      </div>
    )
  }

  return (
    <p className="text-sm leading-relaxed text-muted-foreground">
      {t('onboarding.stepCard.capture')}
    </p>
  )
}

function FocusPreview({
  compact = false,
  taskTitle,
}: {
  compact?: boolean
  taskTitle: string
}) {
  const { t } = useTranslation()

  return (
    <div
      className={cn(
        'flex flex-col gap-4 rounded-xl border border-border bg-card p-5',
        compact && 'mt-8'
      )}
    >
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-muted-foreground">
          {t('onboarding.nextTask')}
        </p>
        <Circle className="size-4 text-muted-foreground" />
      </div>
      <p className="text-sm font-medium leading-relaxed text-foreground">
        {taskTitle}
      </p>
    </div>
  )
}

function OnboardingError({ error }: { error: string | null }) {
  if (!error) return null

  return (
    <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
      {error}
    </p>
  )
}
