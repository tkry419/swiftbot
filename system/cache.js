// RAM CACHE - HAKUNA DATABASE CALLS MARA KWA MARA
const cacheStore = new Map()

// INIT CACHE - RESET KILA BOT IKIANZA
export async function initCache() {
  cacheStore.clear()
  console.log('[CACHE] Initialized')
}

// SET CACHE - HIFADHI VALUE
export function setCache(key, value) {
  try {
    cacheStore.set(key, value)
    return true
  } catch (e) {
    console.log('[CACHE] Set failed:', e.message)
    return false
  }
}

// GET CACHE - SOMA VALUE
export function getCache(key) {
  try {
    return cacheStore.has(key) ? cacheStore.get(key) : null
  } catch (e) {
    console.log('[CACHE] Get failed:', e.message)
    return null
  }
}

// DELETE CACHE - FUTA KEY MOJA
export function deleteCache(key) {
  try {
    return cacheStore.delete(key)
  } catch (e) {
    console.log('[CACHE] Delete failed:', e.message)
    return false
  }
}

// CLEAR ALL CACHE - FUTA YOTE
export function clearCache() {
  try {
    cacheStore.clear()
    console.log('[CACHE] Cleared all')
    return true
  } catch (e) {
    console.log('[CACHE] Clear failed:', e.message)
    return false
  }
}

// GET ALL CACHE - DEBUG TU
export function getAllCache() {
  return Object.fromEntries(cacheStore)
}

// CHECK IF KEY EXISTS
export function hasCache(key) {
  return cacheStore.has(key)
}

// GET CACHE SIZE - KWA RAM CONTROL
export function getCacheSize() {
  return cacheStore.size
}