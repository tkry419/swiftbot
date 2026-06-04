// TRANSLATE ENGINE - WORLDWIDE SUPPORT
import { getCache } from '../system/cache.js'

// CACHE YA TRANSLATIONS - KUZUIA API CALLS MARA KWA MARA
const translationCache = new Map()
const CACHE_LIMIT = 500

// GOOGLE TRANSLATE API - FREE VERSION
async function googleTranslate(text, targetLang, sourceLang = 'auto') {
  try {
    // Clean text
    const cleanText = text.trim()
    if (!cleanText) return text

    // Check cache first
    const cacheKey = `${sourceLang}:${targetLang}:${cleanText}`
    if (translationCache.has(cacheKey)) {
      return translationCache.get(cacheKey)
    }

    // Encode text
    const encodedText = encodeURIComponent(cleanText)
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sourceLang}&tl=${targetLang}&dt=t&q=${encodedText}`

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0'
      }
    })

    if (!response.ok) throw new Error('Translate API failed')

    const data = await response.json()
    if (!data ||!data[0]) throw new Error('Invalid response')

    // Join all translated parts
    let translated = ''
    for (const part of data[0]) {
      if (part[0]) translated += part[0]
    }

    // Cache result
    if (translationCache.size >= CACHE_LIMIT) {
      const firstKey = translationCache.keys().next().value
      translationCache.delete(firstKey)
    }
    translationCache.set(cacheKey, translated)

    return translated || text
  } catch (e) {
    console.log('[TRANSLATE] Error:', e.message)
    return text // Fallback to original
  }
}

// DETECT LANGUAGE - AUTO
export async function detectLanguage(text) {
  try {
    const encodedText = encodeURIComponent(text.slice(0, 100))
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=en&dt=t&q=${encodedText}`

    const response = await fetch(url)
    if (!response.ok) return 'en'

    const data = await response.json()
    return data[2] || 'en' // Language code
  } catch {
    return 'en'
  }
}

// MAIN TRANSLATE FUNCTION - INATUMIWA KILA MAHALI
export async function translateText(text, targetLang = null, sourceLang = 'auto') {
  try {
    // Get bot language if not provided
    const botLang = targetLang || getCache('botLanguage') || 'en'

    // Skip if same language or English to English
    if (botLang === 'en' && sourceLang === 'en') return text
    if (botLang === sourceLang) return text
    if (!text || text.length < 2) return text

    // Skip if text has only emojis/numbers
    if (/^[\d\s\W]+$/.test(text)) return text

    const translated = await googleTranslate(text, botLang, sourceLang)
    return translated
  } catch (e) {
    console.log('[TRANSLATE] Failed:', e.message)
    return text
  }
}

// TRANSLATE OBJECT - KWA MENUS/BOXES
export async function translateObject(obj, targetLang = null) {
  try {
    const botLang = targetLang || getCache('botLanguage') || 'en'
    if (botLang === 'en') return obj

    const translated = {}
    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'string') {
        translated[key] = await translateText(value, botLang)
      } else if (typeof value === 'object' && value!== null) {
        translated[key] = await translateObject(value, botLang)
      } else {
        translated[key] = value
      }
    }
    return translated
  } catch {
    return obj
  }
}

// SUPPORTED LANGUAGES - KWA.setlang list
export const SUPPORTED_LANGUAGES = {
  en: 'English',
  sw: 'Swahili',
  fr: 'French',
  es: 'Spanish',
  de: 'German',
  it: 'Italian',
  pt: 'Portuguese',
  ru: 'Russian',
  ja: 'Japanese',
  ko: 'Korean',
  zh: 'Chinese',
  ar: 'Arabic',
  hi: 'Hindi',
  tr: 'Turkish',
  id: 'Indonesian',
  ms: 'Malay',
  th: 'Thai',
  vi: 'Vietnamese',
  pl: 'Polish',
  nl: 'Dutch',
  ro: 'Romanian',
  el: 'Greek',
  he: 'Hebrew',
  uk: 'Ukrainian',
  cs: 'Czech',
  hu: 'Hungarian',
  sv: 'Swedish',
  da: 'Danish',
  fi: 'Finnish',
  no: 'Norwegian',
  sk: 'Slovak',
  bg: 'Bulgarian',
  hr: 'Croatian',
  sr: 'Serbian',
  sl: 'Slovenian',
  et: 'Estonian',
  lv: 'Latvian',
  lt: 'Lithuanian',
  fa: 'Persian',
  ur: 'Urdu',
  bn: 'Bengali',
  ta: 'Tamil',
  te: 'Telugu',
  mr: 'Marathi',
  gu: 'Gujarati',
  kn: 'Kannada',
  ml: 'Malayalam',
  pa: 'Punjabi'
}

// GET LANGUAGE NAME
export function getLanguageName(code) {
  return SUPPORTED_LANGUAGES[code] || code.toUpperCase()
}

// CLEAR TRANSLATION CACHE - KWA.clearcache
export function clearTranslationCache() {
  translationCache.clear()
  console.log('[TRANSLATE] Cache cleared')
}