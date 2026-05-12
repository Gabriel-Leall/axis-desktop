import { LockOpen, Target, Zap } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

const bridgePillars: {
  title: string
  description: string
  icon: LucideIcon
}[] = [
  {
    title: 'Velocidade Zero-Lag',
    description:
      'Sem nuvem, sem lentidão. Suas tarefas, timers e hábitos respondem instantaneamente na sua máquina.',
    icon: Zap,
  },
  {
    title: 'Foco Inquebrável',
    description:
      'Sem abas de navegador para te distrair. Um ambiente fechado e projetado exclusivamente para execução e deep work.',
    icon: Target,
  },
  {
    title: 'Código Aberto & Transparente',
    description:
      'Seu painel de controle, suas regras. Totalmente open-source e construído para respeitar sua privacidade desde o dia 1.',
    icon: LockOpen,
  },
]

export function BridgeSection() {
  return (
    <section className="bridge-section" data-reveal={true} data-delay="5">
      <div className="bridge-grid">
        {bridgePillars.map(pillar => (
          <article key={pillar.title} className="bridge-card">
            <pillar.icon className="bridge-icon" strokeWidth={2.8} aria-hidden="true" />
            <h3>{pillar.title}</h3>
            <p>{pillar.description}</p>
          </article>
        ))}
      </div>
    </section>
  )
}
