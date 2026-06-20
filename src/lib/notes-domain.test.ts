import { describe, expect, it } from 'vitest'
import * as notesDomain from './notes-domain'
import type { NoteTreeItem } from './notes-domain'

const treeFixture = [
  {
    kind: 'folder',
    path: 'inbox/projects',
    name: 'projects',
    children: [
      {
        kind: 'note',
        note: {
          id: 'plan-id',
          path: 'inbox/projects/plan.md',
          title: 'Plan',
          content: '# Plan',
          created_at: '2026-06-19T10:00:00.000Z',
          updated_at: '2026-06-19T10:00:00.000Z',
          word_count: 1,
          tags: [],
          wiki_links: [],
        },
      },
    ],
  },
  {
    kind: 'note',
    note: {
      id: 'root-id',
      path: 'inbox/root.md',
      title: 'Root',
      content: '# Root',
      created_at: '2026-06-19T10:00:00.000Z',
      updated_at: '2026-06-19T10:00:00.000Z',
      word_count: 1,
      tags: [],
      wiki_links: [],
    },
  },
] as const

describe('flattenNoteTree', () => {
  it('returns nested notes without treating folders as notes', () => {
    const flattenNoteTree = (
      notesDomain as typeof notesDomain & {
        flattenNoteTree: (items: typeof treeFixture) => { id: string }[]
      }
    ).flattenNoteTree

    expect(flattenNoteTree(treeFixture)).toEqual([
      expect.objectContaining({ id: 'plan-id' }),
      expect.objectContaining({ id: 'root-id' }),
    ])
  })

  it('returns no notes for an empty tree', () => {
    expect(notesDomain.flattenNoteTree([])).toEqual([])
  })

  it('preserves depth-first order through multiple folder levels', () => {
    const deepTree: NoteTreeItem[] = [
      {
        kind: 'folder',
        path: 'inbox/projects',
        name: 'Projects',
        children: [
          {
            kind: 'folder',
            path: 'inbox/projects/axis',
            name: 'Axis',
            children: [
              {
                kind: 'note',
                note: {
                  id: 'deep-id',
                  path: 'inbox/projects/axis/deep.md',
                  title: 'Deep',
                  content: '# Deep',
                  created_at: '2026-06-19T10:00:00.000Z',
                  updated_at: '2026-06-19T10:00:00.000Z',
                  word_count: 1,
                },
              },
            ],
          },
        ],
      },
      {
        kind: 'note',
        note: {
          id: 'after-id',
          path: 'inbox/after.md',
          title: 'After',
          content: '# After',
          created_at: '2026-06-19T10:00:00.000Z',
          updated_at: '2026-06-19T10:00:00.000Z',
          word_count: 1,
        },
      },
    ]

    expect(notesDomain.flattenNoteTree(deepTree).map(note => note.id)).toEqual([
      'deep-id',
      'after-id',
    ])
  })
})
