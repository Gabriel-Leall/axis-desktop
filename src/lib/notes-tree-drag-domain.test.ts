import { describe, expect, it } from 'vitest'
import { flattenNoteTree, type NoteWorkspaceTree } from './notes-domain'
import {
  getNotesTreeDropValidation,
  projectNotesTreeMove,
  type NotesTreeDragItem,
} from './notes-tree-drag-domain'

function note(id: string, path: string) {
  return {
    kind: 'note' as const,
    note: {
      id,
      path,
      title: id,
      content: '',
      created_at: '2026-06-21T00:00:00.000Z',
      updated_at: '2026-06-21T00:00:00.000Z',
      word_count: 0,
    },
  }
}

const tree: NoteWorkspaceTree = {
  workspace: 'inbox',
  items: [
    {
      kind: 'folder',
      path: 'inbox/projects',
      name: 'Projects',
      children: [
        {
          kind: 'folder',
          path: 'inbox/projects/axis',
          name: 'Axis',
          children: [note('nested', 'inbox/projects/axis/nested.md')],
        },
        note('plan', 'inbox/projects/plan.md'),
      ],
    },
    {
      kind: 'folder',
      path: 'inbox/target',
      name: 'Target',
      children: [],
    },
    note('root', 'inbox/root.md'),
  ],
}

describe('getNotesTreeDropValidation', () => {
  it('accepts an Inbox note dropped on an Inbox folder', () => {
    expect(
      getNotesTreeDropValidation(
        tree,
        { kind: 'note', id: 'root' },
        'inbox/projects'
      )
    ).toEqual({ valid: true, destinationFolder: 'inbox/projects' })
  })

  it.each([
    ['a note', { kind: 'note', id: 'plan' } satisfies NotesTreeDragItem],
    [
      'the source folder',
      { kind: 'folder', path: 'inbox/projects' } satisfies NotesTreeDragItem,
    ],
    [
      'a descendant folder',
      {
        kind: 'folder',
        path: 'inbox/projects/axis',
      } satisfies NotesTreeDragItem,
    ],
  ])('rejects a folder dropped on %s', (_, target) => {
    expect(
      getNotesTreeDropValidation(
        tree,
        { kind: 'folder', path: 'inbox/projects' },
        target
      )
    ).toEqual({ valid: false })
  })

  it.each(['archive', 'trash'] as const)(
    'rejects %s as a destination workspace',
    workspace => {
      expect(
        getNotesTreeDropValidation(
          { ...tree, workspace },
          { kind: 'note', id: 'root' },
          'inbox/projects'
        )
      ).toEqual({ valid: false })
    }
  )

  it('rejects moving a folder into its current parent folder', () => {
    expect(
      getNotesTreeDropValidation(
        tree,
        { kind: 'folder', path: 'inbox/projects/axis' },
        'inbox/projects'
      )
    ).toEqual({ valid: false })
  })

  it('rejects moving a note into its current parent folder', () => {
    expect(
      getNotesTreeDropValidation(
        tree,
        { kind: 'note', id: 'plan' },
        'inbox/projects'
      )
    ).toEqual({ valid: false })
  })
})

describe('projectNotesTreeMove', () => {
  it('moves a folder subtree while retaining stable note IDs', () => {
    const moved = projectNotesTreeMove(
      tree,
      { kind: 'folder', path: 'inbox/projects' },
      'inbox/target'
    )

    expect(moved).toEqual({
      workspace: 'inbox',
      items: [
        {
          kind: 'folder',
          path: 'inbox/target',
          name: 'Target',
          children: [
            {
              kind: 'folder',
              path: 'inbox/target/projects',
              name: 'Projects',
              children: [
                {
                  kind: 'folder',
                  path: 'inbox/target/projects/axis',
                  name: 'Axis',
                  children: [
                    expect.objectContaining({
                      kind: 'note',
                      note: expect.objectContaining({
                        id: 'nested',
                        path: 'inbox/target/projects/axis/nested.md',
                      }),
                    }),
                  ],
                },
                expect.objectContaining({
                  kind: 'note',
                  note: expect.objectContaining({
                    id: 'plan',
                    path: 'inbox/target/projects/plan.md',
                  }),
                }),
              ],
            },
          ],
        },
        note('root', 'inbox/root.md'),
      ],
    })
    expect(flattenNoteTree(moved?.items ?? [])).toHaveLength(3)
  })
})
