/** Tab order: Plan · Pack · Budget · Home · Explore · Memories · Docs (Home centered) */
export const TAB = {
  plan: 0,
  pack: 1,
  budget: 2,
  home: 3,
  explore: 4,
  memories: 5,
  docs: 6,
} as const

export type TabId = (typeof TAB)[keyof typeof TAB]

export const HASH_TABS: Record<string, TabId> = {
  plan: TAB.plan,
  pack: TAB.pack,
  budget: TAB.budget,
  home: TAB.home,
  explore: TAB.explore,
  memories: TAB.memories,
  docs: TAB.docs,
}
