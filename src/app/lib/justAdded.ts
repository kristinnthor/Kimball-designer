/**
 * Items the user just added, so only the new item's first field takes focus,
 * not every unnamed item when a phase opens.
 */
const added = new Map<string, number>();

export function markAdded(id: string) {
  added.set(id, Date.now());
}

export function wasJustAdded(id: string): boolean {
  const at = added.get(id);
  return at !== undefined && Date.now() - at < 1500;
}
