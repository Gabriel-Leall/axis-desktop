## Design Context

### Users

- Usuário principal: pessoa solo focada em auto produtividade.
- Contexto de uso: organização pessoal diária no desktop, com consultas rápidas ao longo do dia.
- Job to be done: controlar rotina com visão clara de hábitos, tarefas do dia e compromissos/pendências da semana.

### Brand Personality

- Voz e tom: direta, confiável e sem ruído visual.
- Personalidade (3 palavras): focada, clara, controlada.
- Objetivo emocional: reforçar foco e senso de controle durante todo o fluxo.

### Aesthetic Direction

- Direção visual: Minimalismo editorial premium. Interface ultra-limpa com foco em tipografia (Inter/Public Sans) e precisão de pixels.
- Referências: Sean Brydon (devl.dev), Linear (pela precisão), Vercel (pelo contraste), e interfaces de "Developer Tools" de luxo.
- Tema: "White Glacial" com base em tons frios (#EAF6FF ou #F4FAFF) como primária. Contraste obtido através de bordas sutis (1px) em azul gelo suave (#CFE9F7) em vez de sombras.
- Elementos Chave: Uso de Tailwind v4, componentes Base UI, e layouts de "Split-Panel" (imagem 2:3 à direita no login).
- Anti-referências: "AI Slop" (gradientes roxos genéricos), sombras (box-shadows) pesadas, e excesso de cores vibrantes.

### Accessibility

- Meta formal: WCAG AA.
- Requisitos operacionais:
  - contraste de texto/controles compatível com AA;
  - estados de foco sempre visíveis e consistentes;
  - suporte a redução de movimento quando aplicável;
  - evitar dependência exclusiva de cor para comunicar estado.

### Design Principles

1. Clareza operacional primeiro: a interface deve reduzir carga cognitiva e tornar o próximo passo óbvio.
2. Controle visível: status, progresso e prioridades sempre explícitos, sem ambiguidades.
3. Densidade com respiro: informação rica, mas com ritmo visual e hierarquia rigorosa.
4. Consistência cross-theme: light e dark com mesma semântica visual e comportamento.
5. Acessibilidade como baseline: toda decisão de UI deve manter conformidade WCAG AA.
6. Tactile Typography: Hierarquia clara usando variação de peso e tamanho de fonte, nunca cor excessiva.
7. Editorial Layouts: Telas de entrada (Login/Onboarding) devem parecer capas de revista técnica, usando o padrão Split-Panel com imagens verticais (2:3).
8. Ghost UI:Elementos de interface que "desaparecem" quando não estão em uso, focando apenas no conteúdo principal.
