import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { Check, ArrowRight, Zap, Calendar, LayoutGrid } from 'lucide-react'
import { useOnboardingStore } from '@/store/onboarding-store'
import { useHabitsStore } from '@/store/habits-store'
import { useTasksStore } from '@/store/tasks-store'
import { useGitHubStore } from '@/store/github-store'
import { TitleBar } from '@/components/titlebar/TitleBar'

const GithubIcon = ({ className }: { className?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
    <path d="M9 18c-4.51 2-5-2-7-2" />
  </svg>
)

const GoogleIcon = ({ className }: { className?: string }) => (
  <svg 
    viewBox="0 0 24 24" 
    width="24" 
    height="24" 
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-1 .67-2.28 1.07-3.71 1.07-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
    <path d="M5.84 14.11c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.09H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.91l3.66-2.8z" fill="#FBBC05"/>
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.66l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.09l3.66 2.84c.87-2.6 3.3-4.55 6.16-4.55z" fill="#EA4335"/>
  </svg>
)

type Step = 'obstacle' | 'goal' | 'loading' | 'login' | 'done'



interface ObstacleOption { id: string; label: string; desc: string; tag: string }
interface GoalOption { id: string; label: string; desc: string; icon: React.ReactNode }

const OBSTACLES: ObstacleOption[] = [
  {
    id: 'procrastination',
    label: 'Procrastinação crônica',
    desc: 'As tarefas mais importantes ficam para depois — e o dia termina sem avançar nada que importa.',
    tag: 'Foco',
  },
  {
    id: 'organization',
    label: 'Excesso sem estrutura',
    desc: 'Muitas abas abertas, listas espalhadas e a sensação constante de que algo vai escapar.',
    tag: 'Organização',
  },
  {
    id: 'habits',
    label: 'Consistência zero',
    desc: 'Começa bem, perde o ritmo. Os hábitos existem no plano — mas não no dia a dia.',
    tag: 'Hábitos',
  },
]

const GOALS: GoalOption[] = [
  {
    id: 'focus',
    label: 'Foco profundo',
    desc: 'Blocos de trabalho ininterrupto. Menos distrações, mais produção real por hora.',
    icon: <Zap className="w-4 h-4" />,
  },
  {
    id: 'morning',
    label: 'Rotina matinal sólida',
    desc: 'Começar o dia antes de todos. Com ritmo, intenção e controle desde a primeira hora.',
    icon: <Calendar className="w-4 h-4" />,
  },
  {
    id: 'planning',
    label: 'Planejamento semanal',
    desc: 'Visão clara da semana. Saber exatamente o que fazer — sem improvisar, sem surpresas.',
    icon: <LayoutGrid className="w-4 h-4" />,
  },
]

const STEP_LABELS: Record<number, string> = { 0: 'Diagnóstico', 1: 'Objetivo', 2: 'Conta' }

/** Inline pill stepper — active step shows label, others are minimal capsules */
function PillStepper({ activeIndex }: { activeIndex: number }) {
  return (
    <div className="flex items-center gap-1.5">
      {[0, 1, 2].map(i => {
        const isPast    = i < activeIndex
        const isCurrent = i === activeIndex
        return (
          <motion.div
            key={i}
            layout
            transition={{ duration: 0.35, ease: [0.25, 0, 0, 1] }}
            className={[
              'flex items-center rounded-full border transition-all duration-300 overflow-hidden',
              isCurrent
                ? 'border-foreground/20 bg-foreground/5 px-2.5 py-1'
                : isPast
                  ? 'border-primary/30 bg-primary/8 w-6 h-5'
                  : 'border-border bg-transparent w-6 h-5',
            ].join(' ')}
          >
            {isCurrent && (
              <motion.span
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: 'auto' }}
                exit={{ opacity: 0, width: 0 }}
                transition={{ duration: 0.25, ease: 'easeOut' }}
                className="text-[10px] font-semibold tracking-[0.12em] uppercase text-foreground whitespace-nowrap"
              >
                {STEP_LABELS[i]}
              </motion.span>
            )}
            {!isCurrent && (
              <span className={[
                'block w-1.5 h-1.5 rounded-full mx-auto',
                isPast ? 'bg-primary/50' : 'bg-border',
              ].join(' ')} />
            )}
          </motion.div>
        )
      })}
    </div>
  )
}

export function OnboardingPage() {
  const [step, setStep]           = useState<Step>('obstacle')
  const [selectedGoal, setSelectedGoal] = useState<string | null>(null)
  const [loadingProgress, setLoadingProgress] = useState(0)

  const completeOnboarding = useOnboardingStore(state => state.completeOnboarding)
  const addHabit           = useHabitsStore(state => state.addHabit)
  const addTask            = useTasksStore(state => state.addTask)
  const startOAuthFlow     = useGitHubStore(state => state.startOAuthFlow)
  const isAuthenticated    = useGitHubStore(state => state.isAuthenticated)

  // Loading animation then advance — reset is done via functional updater, never synchronously
  useEffect(() => {
    if (step !== 'loading') return

    let frame = 0
    const progressInterval = setInterval(() => {
      frame += 1
      setLoadingProgress(frame === 1 ? 0 : prev => {
        if (prev >= 100) { clearInterval(progressInterval); return 100 }
        return prev + 2
      })
    }, 30)

    const timer = setTimeout(() => {
      clearInterval(progressInterval)
      setStep('login')
    }, 2000)

    return () => {
      clearTimeout(timer)
      clearInterval(progressInterval)
    }
  }, [step])

  const currentStep = (step === 'login' && isAuthenticated) ? 'done' : step

  const handleGoalSelect = (goalId: string) => {
    setSelectedGoal(goalId)
    setStep('loading')
  }

  const handleFinish = async () => {
    try {
      if (selectedGoal === 'morning') {
        await addHabit({ name: 'Beber água', color: '#3b82f6', frequency: 'daily' })
        await addHabit({ name: 'Ler 10 páginas', color: '#8b5cf6', frequency: 'daily' })
        await addTask('Planejar meu dia', { priority: 'high' })
      } else if (selectedGoal === 'focus') {
        await addHabit({ name: '1 hora sem celular', color: '#ef4444', frequency: 'daily' })
        await addTask('Sessão de trabalho profundo (90min)', { priority: 'high' })
      } else if (selectedGoal === 'planning') {
        await addHabit({ name: 'Revisão do dia', color: '#10b981', frequency: 'daily' })
        await addTask('Revisão Semanal de Metas', { priority: 'high' })
      } else {
        await addHabit({ name: 'Hábito diário', color: '#f59e0b', frequency: 'daily' })
      }
    } catch (e) {
      console.error('Failed to populate default data', e)
    }
    completeOnboarding()
  }

  // Shared transition config
  const transition = { duration: 0.38, ease: [0.25, 0, 0, 1] as const }
  const variants = {
    hidden:  { opacity: 0, y: 12 },
    visible: { opacity: 1, y: 0 },
    exit:    { opacity: 0, y: -12 },
  }

  return (
    <div className="flex h-screen w-full flex-col overflow-hidden bg-background">
      <TitleBar className="bg-transparent border-b-0 absolute top-0 w-full z-50" />

      <div className="flex flex-1 flex-row overflow-hidden relative">

        {/* ── Left Panel ────────────────────────────────────── */}
        <div className="flex-1 flex flex-col items-center justify-center px-10 py-8 relative">

          {/* Brand mark — top right */}
          <div className="absolute top-14 right-10 select-none">
            <span className="text-xs font-semibold tracking-[0.18em] uppercase text-muted-foreground/40">
              Axis
            </span>
          </div>

          <AnimatePresence mode="wait">

            {/* ── Step 1: Obstacle ──────────────────────────── */}
            {currentStep === 'obstacle' && (
              <motion.div
                key="obstacle"
                variants={variants}
                initial="hidden"
                animate="visible"
                exit="exit"
                transition={transition}
                className="max-w-lg w-full"
              >
                <div className="flex items-center gap-3 mb-5">
                  <span className="text-[10px] font-semibold tracking-[0.14em] uppercase text-muted-foreground/60">
                    Passo 1 de 3
                  </span>
                  <PillStepper activeIndex={0} />
                </div>
                <h1 className="text-[2rem] font-semibold tracking-tight leading-[1.15] text-foreground mb-3">
                  O que está travando<br />seu progresso?
                </h1>
                <p className="text-base text-muted-foreground mb-10 leading-relaxed max-w-sm">
                  Escolha o obstáculo que mais ressoa com você agora.
                </p>

                <div className="flex flex-col gap-2.5">
                  {OBSTACLES.map((obs, i) => (
                    <motion.button
                      key={obs.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.32, delay: i * 0.06, ease: [0.25, 0, 0, 1] }}
                      onClick={() => setStep('goal')}
                      className="group flex items-start justify-between gap-4 p-5 rounded-lg border border-border bg-card hover:bg-accent/30 hover:border-primary/20 transition-all duration-200 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background cursor-pointer"
                    >
                      <div className="flex flex-col gap-1 min-w-0">
                        <span className="text-sm font-semibold text-foreground leading-snug">
                          {obs.label}
                        </span>
                        <span className="text-sm text-muted-foreground leading-relaxed">
                          {obs.desc}
                        </span>
                      </div>
                      <div className="shrink-0 flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] font-medium tracking-wide uppercase text-muted-foreground/60 bg-muted px-2 py-0.5 rounded-sm">
                          {obs.tag}
                        </span>
                        <ArrowRight className="w-3.5 h-3.5 text-muted-foreground/30 group-hover:text-primary group-hover:translate-x-0.5 transition-all duration-200" />
                      </div>
                    </motion.button>
                  ))}
                </div>
              </motion.div>
            )}

            {/* ── Step 2: Goal ──────────────────────────────── */}
            {currentStep === 'goal' && (
              <motion.div
                key="goal"
                variants={variants}
                initial="hidden"
                animate="visible"
                exit="exit"
                transition={transition}
                className="max-w-lg w-full"
              >
                <div className="flex items-center gap-3 mb-5">
                  <span className="text-[10px] font-semibold tracking-[0.14em] uppercase text-muted-foreground/60">
                    Passo 2 de 3
                  </span>
                  <PillStepper activeIndex={1} />
                </div>
                <h1 className="text-[2rem] font-semibold tracking-tight leading-[1.15] text-foreground mb-3">
                  Qual resultado você<br />quer nos próximos 30 dias?
                </h1>
                <p className="text-base text-muted-foreground mb-10 leading-relaxed max-w-sm">
                  Seu dashboard e hábitos iniciais serão configurados com base nisso.
                </p>

                <div className="flex flex-col gap-2.5">
                  {GOALS.map((goal, i) => (
                    <motion.button
                      key={goal.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.32, delay: i * 0.06, ease: [0.25, 0, 0, 1] }}
                      onClick={() => handleGoalSelect(goal.id)}
                      className="group flex items-start justify-between gap-4 p-5 rounded-lg border border-border bg-card hover:bg-accent/30 hover:border-primary/20 transition-all duration-200 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background cursor-pointer"
                    >
                      <div className="flex items-start gap-3 min-w-0">
                        <span className="shrink-0 mt-0.5 text-muted-foreground/50 group-hover:text-primary transition-colors duration-200">
                          {goal.icon}
                        </span>
                        <div className="flex flex-col gap-1">
                          <span className="text-sm font-semibold text-foreground leading-snug">
                            {goal.label}
                          </span>
                          <span className="text-sm text-muted-foreground leading-relaxed">
                            {goal.desc}
                          </span>
                        </div>
                      </div>
                      <ArrowRight className="shrink-0 mt-0.5 w-3.5 h-3.5 text-muted-foreground/30 group-hover:text-primary group-hover:translate-x-0.5 transition-all duration-200" />
                    </motion.button>
                  ))}
                </div>
              </motion.div>
            )}

            {/* ── Step 3: Loading ───────────────────────────── */}
            {currentStep === 'loading' && (
              <motion.div
                key="loading"
                initial={{ opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.02 }}
                transition={{ duration: 0.45, ease: [0.25, 0, 0, 1] }}
                className="flex flex-col items-center justify-center gap-6 max-w-xs text-center"
              >
                {/* Progress ring */}
                <div className="relative w-16 h-16">
                  <svg className="w-full h-full -rotate-90" viewBox="0 0 64 64">
                    <circle
                      cx="32" cy="32" r="26"
                      fill="none"
                      stroke="var(--color-border)"
                      strokeWidth="2"
                    />
                    <motion.circle
                      cx="32" cy="32" r="26"
                      fill="none"
                      stroke="var(--color-primary)"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeDasharray={`${2 * Math.PI * 26}`}
                      strokeDashoffset={`${2 * Math.PI * 26 * (1 - loadingProgress / 100)}`}
                      style={{ transition: 'stroke-dashoffset 0.1s linear' }}
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-xs font-semibold text-foreground tabular-nums">
                      {Math.round(loadingProgress)}%
                    </span>
                  </div>
                </div>

                <div>
                  <h2 className="text-xl font-semibold text-foreground tracking-tight mb-2">
                    Configurando seu espaço
                  </h2>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Ajustando widgets, hábitos e protocolos com base nas suas respostas.
                  </p>
                </div>

                {/* Animated tasks */}
                <div className="flex flex-col gap-1.5 w-full text-left">
                  {[
                    'Criando estrutura do dashboard',
                    'Definindo hábitos iniciais',
                    'Aplicando preferências',
                  ].map((item, i) => (
                    <motion.div
                      key={item}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.3 + i * 0.35, duration: 0.3, ease: 'easeOut' }}
                      className="flex items-center gap-2"
                    >
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ delay: 0.5 + i * 0.35, duration: 0.2 }}
                        className="w-3.5 h-3.5 rounded-full bg-primary/10 flex items-center justify-center shrink-0"
                      >
                        <Check className="w-2 h-2 text-primary" />
                      </motion.div>
                      <span className="text-xs text-muted-foreground">{item}</span>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            )}

            {/* ── Step 4: Login ─────────────────────────────── */}
            {currentStep === 'login' && (
              <motion.div
                key="login"
                variants={variants}
                initial="hidden"
                animate="visible"
                exit="exit"
                transition={transition}
                className="max-w-sm w-full"
              >
                <div className="flex items-center gap-3 mb-5">
                  <span className="text-[10px] font-semibold tracking-[0.14em] uppercase text-muted-foreground/60">
                    Passo 3 de 3
                  </span>
                  <PillStepper activeIndex={2} />
                </div>
                <h1 className="text-[2rem] font-semibold tracking-tight leading-[1.15] text-foreground mb-3">
                  Salve seu progresso
                </h1>
                <p className="text-base text-muted-foreground mb-10 leading-relaxed">
                  Conecte sua conta para sincronizar dados e manter tudo seguro entre dispositivos.
                </p>

                <div className="flex flex-col gap-3 w-full">
                  <button
                    id="onboarding-google-connect"
                    onClick={() => {
                      // Placeholder for Google login
                      console.log('Google login clicked')
                      setStep('done')
                    }}
                    className="group flex items-center justify-center gap-2.5 px-5 py-3.5 text-sm font-medium text-foreground bg-background rounded-lg border border-border hover:bg-accent/50 transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background w-full cursor-pointer shadow-sm"
                  >
                    <GoogleIcon className="w-4 h-4" />
                    Continuar com Google
                    <ArrowRight className="w-3.5 h-3.5 opacity-40 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all duration-200" />
                  </button>

                  <button
                    id="onboarding-github-connect"
                    onClick={() => startOAuthFlow()}
                    className="group flex items-center justify-center gap-2.5 px-5 py-3.5 text-sm font-medium text-white bg-[#1b1f23] rounded-lg border border-[#1b1f23] hover:bg-[#272c31] transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background w-full cursor-pointer shadow-sm"
                  >
                    <GithubIcon className="w-4 h-4" />
                    Continuar com GitHub
                    <ArrowRight className="w-3.5 h-3.5 opacity-40 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all duration-200" />
                  </button>

                  <button
                    id="onboarding-skip"
                    onClick={() => setStep('done')}
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors duration-200 py-2.5 text-center cursor-pointer"
                  >
                    Pular por enquanto — configurar depois
                  </button>
                </div>
              </motion.div>
            )}

            {/* ── Step 5: Done ──────────────────────────────── */}
            {currentStep === 'done' && (
              <motion.div
                key="done"
                variants={variants}
                initial="hidden"
                animate="visible"
                transition={{ ...transition, duration: 0.55 }}
                className="max-w-sm w-full flex flex-col"
              >
                <motion.div
                  initial={{ scale: 0.6, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.1, duration: 0.4, ease: [0.34, 1.56, 0.64, 1] }}
                  className="w-10 h-10 rounded-full border border-border bg-card flex items-center justify-center mb-7"
                >
                  <Check className="w-4 h-4 text-foreground" />
                </motion.div>

                <h1 className="text-[2rem] font-semibold tracking-tight leading-[1.15] text-foreground mb-3">
                  Tudo pronto.
                </h1>
                <p className="text-base text-muted-foreground mb-10 leading-relaxed">
                  Seu espaço foi configurado. Hábitos, tarefas e dashboard aguardam — só falta você começar.
                </p>

                <button
                  id="onboarding-start"
                  onClick={handleFinish}
                  className="group flex items-center justify-center gap-2 px-5 py-3.5 text-sm font-medium text-primary-foreground bg-primary rounded-lg hover:opacity-90 transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background w-full cursor-pointer"
                >
                  Entrar no Dashboard
                  <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform duration-200" />
                </button>
              </motion.div>
            )}

          </AnimatePresence>
        </div>

        {/* ── Right Panel: Image ────────────────────────────── */}
        <div className="hidden lg:flex w-[46%] bg-muted relative items-center justify-center overflow-hidden border-l border-border/50">
          <img
            src="/Onboarding-Image.webp"
            alt="Onboarding visual"
            className="w-full h-full object-cover"
          />
          {/* Subtle vignette only at bottom */}
          <div className="absolute inset-0 bg-linear-to-t from-background/60 via-transparent to-transparent pointer-events-none" />
        </div>

      </div>
    </div>
  )
}
