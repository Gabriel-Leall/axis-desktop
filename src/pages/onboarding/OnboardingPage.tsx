import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { Check, Loader2, ArrowRight, ShieldCheck } from 'lucide-react'
import { useOnboardingStore } from '@/store/onboarding-store'
import { useHabitsStore } from '@/store/habits-store'
import { useTasksStore } from '@/store/tasks-store'
import { useGitHubStore } from '@/store/github-store'
import { useGoogleStore } from '@/store/google-store'
import { TitleBar } from '@/components/titlebar/TitleBar'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

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
    <path
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      fill="#4285F4"
    />
    <path
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-1 .67-2.28 1.07-3.71 1.07-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      fill="#34A853"
    />
    <path
      d="M5.84 14.11c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.09H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.91l3.66-2.8z"
      fill="#FBBC05"
    />
    <path
      d="M12 5.38c1.62 0 3.06.56 4.21 1.66l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.09l3.66 2.84c.87-2.6 3.3-4.55 6.16-4.55z"
      fill="#EA4335"
    />
  </svg>
)

type Step =
  | 'obstacle'
  | 'goal'
  | 'loading'
  | 'login'
  | 'done'
  | 'projectLoading'

const OBSTACLES = [
  {
    id: 'procrastination',
    label: 'Procrastinação',
    desc: 'Deixar as coisas importantes para depois.',
  },
  {
    id: 'organization',
    label: 'Falta de Organização',
    desc: 'Sentimento de caos e excesso de informações.',
  },
  {
    id: 'habits',
    label: 'Esquecer Hábitos',
    desc: 'Dificuldade em manter a consistência diária.',
  },
]

const GOALS = [
  {
    id: 'focus',
    label: 'Foco Profundo',
    desc: 'Sessões de trabalho ininterruptas e valiosas.',
  },
  {
    id: 'morning',
    label: 'Rotina Matinal',
    desc: 'Começar o dia no controle, antes de todos.',
  },
  {
    id: 'planning',
    label: 'Planejamento Semanal',
    desc: 'Saber exatamente o que fazer a cada dia.',
  },
]

export function OnboardingPage() {
  const [step, setStep] = useState<Step>('obstacle')
  const [selectedGoal, setSelectedGoal] = useState<string | null>(null)
  const [skipConfirmOpen, setSkipConfirmOpen] = useState(false)

  const completeOnboarding = useOnboardingStore(
    state => state.completeOnboarding
  )
  const addHabit = useHabitsStore(state => state.addHabit)
  const addTask = useTasksStore(state => state.addTask)

  const startOAuthFlow = useGitHubStore(state => state.startOAuthFlow)
  const isAuthenticated = useGitHubStore(state => state.isAuthenticated)
  const startGoogleOAuthFlow = useGoogleStore(state => state.startOAuthFlow)
  const googleIsAuthenticated = useGoogleStore(state => state.isAuthenticated)
  const googleIsLoading = useGoogleStore(state => state.isLoading)

  useEffect(() => {
    if (step === 'loading') {
      const timer = setTimeout(() => {
        setStep('login')
      }, 650)
      return () => clearTimeout(timer)
    }
  }, [step])

  const hasConnectedAccount = isAuthenticated || googleIsAuthenticated
  const currentStep = step === 'login' && hasConnectedAccount ? 'done' : step

  const handleGoalSelect = (goalId: string) => {
    setSelectedGoal(goalId)
    setStep('loading')
  }

  const handleFinish = async () => {
    setStep('projectLoading')

    // Populate data based on the chosen goal
    try {
      const addDefaultHabit = async (habit: Parameters<typeof addHabit>[0]) => {
        const exists = useHabitsStore
          .getState()
          .habits.some(
            existing =>
              existing.name.trim().toLowerCase() ===
              habit.name.trim().toLowerCase()
          )
        if (!exists) {
          await addHabit(habit)
        }
      }

      const addDefaultTask = async (
        title: string,
        options?: Parameters<typeof addTask>[1]
      ) => {
        const exists = useTasksStore
          .getState()
          .tasks.some(
            existing =>
              existing.title.trim().toLowerCase() === title.trim().toLowerCase()
          )
        if (!exists) {
          await addTask(title, options)
        }
      }

      if (selectedGoal === 'morning') {
        await Promise.all([
          addDefaultHabit({
            name: 'Beber água',
            color: '#3b82f6',
            frequency: 'daily',
          }),
          addDefaultHabit({
            name: 'Ler 10 páginas',
            color: '#8b5cf6',
            frequency: 'daily',
          }),
          addDefaultHabit({
            name: 'Alongamento matinal',
            color: '#10b981',
            frequency: 'daily',
          }),
          addDefaultTask('Planejar meu dia', { priority: 'high' }),
          addDefaultTask('Definir 3 prioridades do dia', {
            priority: 'high',
          }),
          addDefaultTask('Revisar agenda da manhã', {
            priority: 'medium',
          }),
        ])
      } else if (selectedGoal === 'focus') {
        await Promise.all([
          addDefaultHabit({
            name: '1 hora sem celular',
            color: '#ef4444',
            frequency: 'daily',
          }),
          addDefaultHabit({
            name: 'Bloquear notificações',
            color: '#f97316',
            frequency: 'daily',
          }),
          addDefaultTask('Sessão de trabalho profundo (90min)', {
            priority: 'high',
          }),
          addDefaultTask('Preparar ambiente de foco', {
            priority: 'medium',
          }),
          addDefaultTask('Registrar distrações do dia', {
            priority: 'medium',
          }),
        ])
      } else if (selectedGoal === 'planning') {
        await Promise.all([
          addDefaultHabit({
            name: 'Revisão do dia',
            color: '#10b981',
            frequency: 'daily',
          }),
          addDefaultHabit({
            name: 'Organizar inbox',
            color: '#06b6d4',
            frequency: 'daily',
          }),
          addDefaultTask('Revisão Semanal de Metas', { priority: 'high' }),
          addDefaultTask('Atualizar lista de projetos', {
            priority: 'medium',
          }),
          addDefaultTask('Escolher foco da semana', { priority: 'high' }),
        ])
      } else {
        // Fallback or generic defaults
        await Promise.all([
          addDefaultHabit({
            name: 'Hábitos fundamentais',
            color: '#f59e0b',
            frequency: 'daily',
          }),
          addDefaultTask('Organizar meu dashboard', {
            priority: 'medium',
          }),
        ])
      }
    } catch (e) {
      console.error('Failed to populate default data', e)
    }

    window.setTimeout(() => {
      completeOnboarding()
    }, 300)
  }

  const handleSkipAccount = () => {
    setSkipConfirmOpen(false)
    setStep('done')
  }

  return (
    <div className="flex h-screen w-full flex-col overflow-hidden bg-background">
      <TitleBar
        className="bg-transparent border-b-0 absolute top-0 w-full z-50"
        showClock={false}
      />

      <div className="flex flex-1 flex-row overflow-hidden relative">
        {/* Left Side: Form Content */}
        <div className="flex-1 flex flex-col items-center justify-center p-6 relative">
          {/* Progress Bar (scoped to left half on lg) */}
          <div className="absolute top-12 left-0 w-full h-1 bg-muted/30 z-10">
            <motion.div
              className="h-full bg-primary"
              initial={{ width: '0%' }}
              animate={{
                width:
                  currentStep === 'obstacle'
                    ? '25%'
                    : currentStep === 'goal'
                      ? '50%'
                      : currentStep === 'loading'
                        ? '75%'
                        : currentStep === 'login'
                          ? '90%'
                          : currentStep === 'projectLoading'
                            ? '96%'
                            : '100%',
              }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
            />
          </div>

          <AnimatePresence mode="wait">
            {currentStep === 'obstacle' && (
              <motion.div
                key="obstacle"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.4, ease: 'easeOut' }}
                className="max-w-xl w-full"
              >
                <h1 className="text-3xl font-medium tracking-tight mb-2 text-foreground">
                  Qual é o seu maior obstáculo hoje?
                </h1>
                <p className="text-muted-foreground mb-8 text-lg">
                  Vamos personalizar sua experiência para resolver isso
                  primeiro.
                </p>

                <div className="flex flex-col gap-3">
                  {OBSTACLES.map(obs => (
                    <button
                      key={obs.id}
                      onClick={() => {
                        setStep('goal')
                      }}
                      className="flex flex-col items-start p-5 rounded-lg border border-border bg-card hover:bg-accent/50 hover:border-accent-foreground/20 transition-all text-left focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background"
                    >
                      <span className="text-lg font-medium text-card-foreground mb-1">
                        {obs.label}
                      </span>
                      <span className="text-sm text-muted-foreground">
                        {obs.desc}
                      </span>
                    </button>
                  ))}
                </div>
              </motion.div>
            )}

            {currentStep === 'goal' && (
              <motion.div
                key="goal"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.4, ease: 'easeOut' }}
                className="max-w-xl w-full"
              >
                <h1 className="text-3xl font-medium tracking-tight mb-2 text-foreground">
                  O que você quer dominar primeiro?
                </h1>
                <p className="text-muted-foreground mb-8 text-lg">
                  Escolha o seu principal objetivo para os próximos 30 dias.
                </p>

                <div className="flex flex-col gap-3">
                  {GOALS.map(goal => (
                    <button
                      key={goal.id}
                      onClick={() => handleGoalSelect(goal.id)}
                      className="flex flex-col items-start p-5 rounded-lg border border-border bg-card hover:bg-accent/50 hover:border-accent-foreground/20 transition-all text-left focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background"
                    >
                      <span className="text-lg font-medium text-card-foreground mb-1">
                        {goal.label}
                      </span>
                      <span className="text-sm text-muted-foreground">
                        {goal.desc}
                      </span>
                    </button>
                  ))}
                </div>
              </motion.div>
            )}

            {currentStep === 'loading' && (
              <motion.div
                key="loading"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.05 }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
                className="flex flex-col items-center justify-center"
              >
                <Loader2 className="w-12 h-12 text-primary animate-spin mb-6" />
                <h2 className="text-2xl font-medium text-foreground tracking-tight">
                  Montando o seu Dashboard ideal...
                </h2>
                <p className="text-muted-foreground mt-2">
                  Ajustando widgets e protocolos iniciais.
                </p>
              </motion.div>
            )}

            {currentStep === 'login' && (
              <motion.div
                key="login"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.4, ease: 'easeOut' }}
                className="max-w-md w-full text-center flex flex-col items-center"
              >
                <h1 className="text-3xl font-medium tracking-tight mb-2 text-foreground">
                  Conecte sua conta
                </h1>
                <p className="text-muted-foreground mb-8 text-lg">
                  Sincronize seu progresso, hábitos e tarefas com segurança.
                </p>

                <div className="flex flex-col gap-4 w-full">
                  <button
                    onClick={() => startOAuthFlow()}
                    className="group relative inline-flex items-center justify-center gap-2 px-8 py-4 text-sm font-medium text-white bg-[#24292e] rounded-md overflow-hidden transition-all hover:bg-[#2f363d] focus:outline-none focus:ring-2 focus:ring-[#24292e] focus:ring-offset-2 focus:ring-offset-background w-full"
                  >
                    <GithubIcon className="w-5 h-5" />
                    Conectar com GitHub
                  </button>

                  <button
                    onClick={() => void startGoogleOAuthFlow()}
                    disabled={googleIsLoading}
                    className="group relative inline-flex items-center justify-center gap-2 px-8 py-4 text-sm font-medium text-foreground bg-background border border-border rounded-md overflow-hidden transition-all hover:bg-muted focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background disabled:cursor-not-allowed disabled:opacity-60 w-full"
                  >
                    <GoogleIcon className="w-5 h-5" />
                    {googleIsLoading ? 'Conectando...' : 'Continuar com Google'}
                  </button>

                  <button
                    onClick={() => setSkipConfirmOpen(true)}
                    className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors py-2"
                  >
                    Pular por enquanto
                  </button>
                </div>

                <AlertDialog
                  open={skipConfirmOpen}
                  onOpenChange={setSkipConfirmOpen}
                >
                  <AlertDialogContent className="sm:max-w-[520px]">
                    <AlertDialogHeader>
                      <div className="mb-1 flex size-10 items-center justify-center rounded-md border border-border bg-muted/60">
                        <ShieldCheck className="size-5 text-primary" />
                      </div>
                      <AlertDialogTitle>
                        Continuar sem conectar uma conta?
                      </AlertDialogTitle>
                      <AlertDialogDescription className="leading-relaxed">
                        Você pode usar o Axis agora e conectar uma conta depois
                        nas preferências. Sem login, alguns recursos ficam
                        limitados.
                      </AlertDialogDescription>
                    </AlertDialogHeader>

                    <div className="rounded-md border border-border bg-muted/35 p-4 text-left">
                      <p className="text-sm font-medium text-foreground">
                        Ao entrar com GitHub ou Google, você ganha:
                      </p>
                      <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                        <li>
                          Sincronização segura de progresso e preferências.
                        </li>
                        <li>Recuperação de dados ao trocar de dispositivo.</li>
                        <li>
                          Integrações com PRs, revisões e tarefas externas.
                        </li>
                        <li>Atualizações futuras vinculadas ao seu perfil.</li>
                      </ul>
                    </div>

                    <AlertDialogFooter>
                      <AlertDialogCancel>Voltar ao login</AlertDialogCancel>
                      <AlertDialogAction onClick={handleSkipAccount}>
                        Pular mesmo assim
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </motion.div>
            )}

            {currentStep === 'done' && (
              <motion.div
                key="done"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, ease: 'easeOut' }}
                className="max-w-md w-full text-center flex flex-col items-center"
              >
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-6">
                  <Check className="w-8 h-8 text-primary" />
                </div>
                <h1 className="text-3xl font-medium tracking-tight mb-4 text-foreground">
                  Seu protocolo está pronto.
                </h1>
                <p className="text-muted-foreground mb-10 text-lg leading-relaxed">
                  Nós configuramos tudo o que você precisa para começar. Entre
                  agora para salvar seu progresso e acessar o Dashboard.
                </p>

                <button
                  onClick={handleFinish}
                  className="group relative inline-flex items-center justify-center px-8 py-4 text-sm font-medium text-primary-foreground bg-primary rounded-md overflow-hidden transition-all hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background w-full"
                >
                  <span className="relative z-10 flex items-center gap-2">
                    Começar Agora
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </span>
                </button>
              </motion.div>
            )}

            {currentStep === 'projectLoading' && (
              <motion.div
                key="project-loading"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.35, ease: 'easeOut' }}
                className="w-full max-w-md"
              >
                <div className="mb-6 flex size-14 items-center justify-center rounded-lg border border-border bg-card">
                  <Loader2 className="size-7 animate-spin text-primary" />
                </div>
                <h1 className="text-3xl font-medium tracking-tight text-foreground">
                  Carregando seu projeto
                </h1>
                <p className="mt-3 text-base leading-relaxed text-muted-foreground">
                  Organizando dashboard, hábitos iniciais e tarefas para abrir
                  seu espaço de trabalho.
                </p>

                <div className="mt-8 space-y-3 rounded-md border border-border bg-muted/30 p-4">
                  {[
                    'Preparando estrutura diária',
                    'Aplicando seu objetivo principal',
                    'Abrindo o workspace Axis',
                  ].map(item => (
                    <div
                      key={item}
                      className="flex items-center gap-3 text-sm text-muted-foreground"
                    >
                      <span className="size-1.5 rounded-full bg-primary" />
                      {item}
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Right Side: Generated onboarding artwork */}
        <div className="hidden lg:flex w-1/2 bg-muted relative items-center justify-center overflow-hidden border-l border-border/50">
          <img
            src="/Onboarding-Image.webp"
            alt="Pessoa caminhando em direção a uma montanha nevada"
            className="w-full h-full object-cover opacity-90"
          />
          <div className="absolute inset-0 bg-linear-to-t from-background/80 via-transparent to-transparent pointer-events-none" />
        </div>
      </div>
    </div>
  )
}
