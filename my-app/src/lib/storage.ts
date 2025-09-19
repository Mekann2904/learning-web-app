const STORAGE_PREFIX = "habit"
const CELEBRATION_SUFFIX = "celebrated"

type BrowserStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">

const getStorage = (): BrowserStorage | null => {
  if (typeof window === "undefined") return null
  try {
    return window.localStorage ?? null
  } catch (_error) {
    return null
  }
}

const getStorageKey = (year: number, month: number) => `${STORAGE_PREFIX}:${year.toString().padStart(4, "0")}-${month.toString().padStart(2, "0")}`

const getCelebrationKey = (year: number, month: number) => `${getStorageKey(year, month)}:${CELEBRATION_SUFFIX}`

export function getCelebrated(year: number, month: number): boolean {
  const storage = getStorage()
  if (!storage) return false
  return storage.getItem(getCelebrationKey(year, month)) === "1"
}

export function setCelebrated(year: number, month: number, celebrated: boolean) {
  const storage = getStorage()
  if (!storage) return
  if (!celebrated) {
    storage.removeItem(getCelebrationKey(year, month))
    return
  }
  storage.setItem(getCelebrationKey(year, month), "1")
}

export function clearCelebration(year: number, month: number) {
  const storage = getStorage()
  if (!storage) return
  storage.removeItem(getCelebrationKey(year, month))
}
