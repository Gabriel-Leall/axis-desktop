# UI Changes

> **Nota:** Este arquivo documenta mudanças e correções de UI a serem implementadas. Ele NÃO deve ser subido para o repositório.

---

## Pending Changes

### Toggle Buttons nas Configurações do Pomodoro

**Localização:** `src/pages/PomodoroPage.tsx` — componente `Toggle` na `SettingsSection` (linhas 343-372)

**Problema:** O círculo indicador (thumb) do toggle está ultrapassando os limites do botão, causando overflow visual.

**Descrição:** O toggle é um botão `role="switch"` com um círculo interno que se move entre as posições. Quando está `checked` ou não, o círculo deve ficar contido dentro do botão, mas atualmente está vazando para fora.

**Screenshot/Referência visual:**

```
Atual (bugado):
┌──────────────────────┐
│                  │   ● ← círculo vazando
└──────────────────────┘

Esperado:
┌────────────────────────┐
│                ●    │  ← círculo contido
└────────────────────────┘
```

**Solução sugerida:**

1. Verificar o `overflow: hidden` no container principal do toggle
2. Ajustar o tamanho do thumb (`span`) para garantir que caiba dentro do padding do container
3. Garantir que o `border-radius` do thumb seja menor que o espaço disponível

**Tags:** `pomodoro`, `toggle`, `overflow`, `ui-bug`

---

### Scroll Bars e Resize dos Widgets

**Localização:** `src/components/grid/BentoGrid.tsx` e componentes relacionados (`WidgetCard`, resize handles)

**Problema 1 — Scroll bars visíveis:** Os widgets estão mostrando barras de scroll lateral (vertical e/ou horizontal) mesmo quando não há conteúdo que exija scroll.

**Problema 2 — Resize restrito:** O resize dos widgets só funciona pelo canto inferior direito. O usuário não consegue redimensionar pelas outras bordas ou cantos.

**Descrição:**

1. **Scroll bars:** O conteúdo interno do widget está estourando ou o `overflow` está configurado incorretamente, causando barras de scroll indesejadas.

2. **Resize:** O sistema de resize atual só detecta eventos de drag no canto inferior direito. Deveria permitir resize por qualquer borda (top, bottom, left, right) e canto (top-left, top-right, bottom-left, bottom-right).

**Solução sugerida - Scroll bars:**

1. Verificar `overflow` nos containers internos do widget
2. Remover `overflow-x` ou `overflow-y` desnecessários
3. Usar `overflow: hidden` no container principal se não quiser scroll

**Solução sugerida - Resize:**

1. Adicionar handles de resize em todas as 8 posições (4 bordas + 4 cantos)
2. Usar bibliotecas como `react-resizable` ou implementar manualmente com CSS `resize: both`
3. Adicionar detectores de mouse em cada borda/canto com cursor apropriado
4. Calcular deltas de mouse e aplicar ao width/height do widget

**Exemplo de handles necessários:**

```
┌─[↓]──────────────────────[↓]─┐
│[←]                         [→]│
│[←]      Widget Content      [→]│
│[←]                         [→]│
└─[↑]──────────────────────[↑]─┘
```

**Tags:** `widgets`, `scroll`, `resize`, `bento-grid`, `ui-bug`

---

### [Opcional] Editor de Notas WYSIWYG Inline (estilo Notion/Obsidian)

**Localização:** `src/pages/NotesPage.tsx` + estilos em `src/App.css`

**Objetivo:** Permitir edição rica no próprio texto (inline), sem preview lateral.

**Descrição:**

- O usuário deve escrever e visualizar a formatação no mesmo fluxo de digitação.
- Não usar layout de preview ao lado para acompanhar resultado.
- Manter persistência em Markdown no backend/store.

**Ajustes de UX sugeridos (opcional):**

1. Toolbar compacta com ações essenciais (heading, negrito, itálico, listas, quote, link, code)
2. Atalhos visíveis e consistentes (`Ctrl/Cmd+B`, `Ctrl/Cmd+I`)
3. Altura total do editor ocupando o painel principal
4. Tipografia de leitura confortável (linha mais espaçada e hierarquia clara de headings)
5. Modo de foco opcional (menos distrações visuais)

**Critério de aceitação:**

- Usuário não precisa olhar para outro painel para validar formatação.
- A experiência final deve priorizar edição contínua no corpo do texto.

**Tags:** `notes`, `editor`, `wysiwyg`, `ux`, `optional`

---

### Kanban: Polir Drag do Card e Drop em In Progress

**Localização:** `src/pages/KanbanPage.tsx` e `src/components/grid/widgets/KanbanWidget.tsx`

**Problema:** A experiência de arrastar card está ruim porque o drag fica concentrado em uma área lateral/handle. O esperado é poder segurar o card inteiro para arrastar, sem perder a ação de click para abrir detalhes.

**Descrição:**

1. Permitir drag ao segurar o card inteiro (não só um lado/handle)
2. Diferenciar claramente `click` (abrir/selecionar card) de `hold + move` (drag)
3. Melhorar confiabilidade do drop na coluna `In Progress` e em áreas de coluna vazias

**Solução sugerida:**

1. Ajustar `activationConstraint` do sensor (distância/tempo) para reduzir conflito com click
2. Aplicar estados visuais durante drag (`hover`, `isOver`, placeholder de drop)
3. Revisar cálculo de destino (`over column`, `over card`) para não falhar em colunas com poucos cards

**Critério de aceitação:**

- Usuário consegue arrastar segurando qualquer parte do card.
- Clique simples ainda abre detalhes sem iniciar drag acidental.
- Drop em `In Progress` funciona de forma previsível.

**Tags:** `kanban`, `drag-drop`, `dnd`, `ux`

---

### Toolbar: Ajustar Design e UX/UI

**Localização:** `src/pages/NotesPage.tsx` + estilos em `src/App.css`

**Problema:** Toolbar atual ainda pode ficar visualmente pesada ou pouco clara em alguns estados, prejudicando ritmo de escrita.

**Descrição:**

1. Refinar contraste, espaçamento e feedback de hover/active/focus
2. Garantir ícones e ações principais com hierarquia visual consistente
3. Melhorar responsividade da toolbar em larguras menores

**Solução sugerida:**

1. Revisar paddings, bordas e opacidade dos botões
2. Adicionar estados de foco acessíveis e indicadores mais claros de ação ativa
3. Ajustar comportamento overflow/wrap para evitar toolbar quebrada

**Critério de aceitação:**

- Toolbar fica visualmente mais limpa e previsível.
- Usuário identifica ações principais sem esforço.
- Em tela menor, toolbar continua usável sem poluir a interface.

**Tags:** `toolbar`, `notes`, `ui`, `ux`, `polish`

---

## Implemented Changes

_(Nenhuma mudança implementada ainda)_

---

## Notas

- Este arquivo é apenas para referência de desenvolvimento
- Não commitar este arquivo
- Use-o para rastrear correções de UI pendentes durante o desenvolvimento
