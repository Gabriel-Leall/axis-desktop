import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { Check, Loader2, ArrowRight } from 'lucide-react'
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

type Step = 'obstacle' | 'goal' | 'loading' | 'login' | 'done'

const OBSTACLES = [
  { id: 'procrastination', label: 'Procrastinação', desc: 'Deixar as coisas importantes para depois.' },
  { id: 'organization', label: 'Falta de Organização', desc: 'Sentimento de caos e excesso de informações.' },
  { id: 'habits', label: 'Esquecer Hábitos', desc: 'Dificuldade em manter a consistência diária.' },
]

const GOALS = [
  { id: 'focus', label: 'Foco Profundo', desc: 'Sessões de trabalho ininterruptas e valiosas.' },
  { id: 'morning', label: 'Rotina Matinal', desc: 'Começar o dia no controle, antes de todos.' },
  { id: 'planning', label: 'Planejamento Semanal', desc: 'Saber exatamente o que fazer a cada dia.' },
]

export function OnboardingPage() {
  const [step, setStep] = useState<Step>('obstacle')
  const [selectedGoal, setSelectedGoal] = useState<string | null>(null)
  
  const completeOnboarding = useOnboardingStore(state => state.completeOnboarding)
  const addHabit = useHabitsStore(state => state.addHabit)
  const addTask = useTasksStore(state => state.addTask)
  
  const startOAuthFlow = useGitHubStore(state => state.startOAuthFlow)
  const isAuthenticated = useGitHubStore(state => state.isAuthenticated)

  useEffect(() => {
    if (step === 'loading') {
      const timer = setTimeout(() => {
        setStep('login')
      }, 2000)
      return () => clearTimeout(timer)
    }
  }, [step])

  const currentStep = (step === 'login' && isAuthenticated) ? 'done' : step

  const handleGoalSelect = (goalId: string) => {
    setSelectedGoal(goalId)
    setStep('loading')
  }

  const handleFinish = async () => {
    // Populate data based on the chosen goal
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
        // Fallback or generic defaults
        await addHabit({ name: 'Hábitos fundamentais', color: '#f59e0b', frequency: 'daily' })
      }
    } catch (e) {
      console.error('Failed to populate default data', e)
    }

    completeOnboarding()
  }

  return (
    <div className="flex h-screen w-full flex-col overflow-hidden bg-background">
      <TitleBar className="bg-transparent border-b-0 absolute top-0 w-full z-50" />
      
      <div className="flex flex-1 flex-row overflow-hidden relative">
        {/* Left Side: Form Content */}
        <div className="flex-1 flex flex-col items-center justify-center p-6 relative">
          {/* Pill Stepper */}
          <div className="absolute top-12 left-0 w-full flex items-center justify-center gap-2 z-10">
            {['Obstáculo', 'Meta', 'Conexão', 'Pronto'].map((label, idx) => {
              const stepMap: Record<string, number> = { obstacle: 0, goal: 1, loading: 2, login: 3, done: 4 }
              const currentIdx = stepMap[currentStep] ?? 0
              const isActive = idx <= currentIdx
              const isCurrent = idx === currentIdx
              return (
                <div key={label} className="flex items-center gap-2">
                  <div className={`flex items-center justify-center w-8 h-8 rounded-full text-xs font-medium transition-colors ${isActive ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                    {idx + 1}
                  </div>
                  <span className={`text-xs font-medium ${isCurrent ? 'text-foreground' : 'text-muted-foreground'}`}>
                    {label}
                  </span>
                  {idx < 3 && (
                    <div className={`w-8 h-0.5 mx-1 ${isActive && idx < currentIdx ? 'bg-primary' : 'bg-muted'}`} />
                  )}
                </div>
              )
            })}
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
                Vamos personalizar sua experiência para resolver isso primeiro.
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
                  onClick={() => setStep('done')}
                  className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors py-2"
                >
                  Pular por enquanto
                </button>
              </div>
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
                Nós configuramos tudo o que você precisa para começar. Entre agora para salvar seu progresso e acessar o Dashboard.
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

        </AnimatePresence>
      </div>

      {/* Right Side: Image Placeholder */}
      <div className="hidden lg:flex w-1/2 bg-muted relative items-center justify-center overflow-hidden border-l border-border/50">
        <img 
          src="https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&q=80" 
          alt="Onboarding" 
          className="w-full h-full object-cover opacity-90" 
        />
        <div className="absolute inset-0 bg-linear-to-t from-background/80 via-transparent to-transparent pointer-events-none" />
      </div>

      </div>
    </div>
  )
}
