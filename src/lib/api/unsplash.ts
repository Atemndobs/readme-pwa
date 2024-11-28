// Note: You'll need to sign up for a free Unsplash API key at https://unsplash.com/developers
const UNSPLASH_ACCESS_KEY = process.env.NEXT_PUBLIC_UNSPLASH_ACCESS_KEY

interface UnsplashImage {
  id: string;
  urls: {
    raw: string;
    full: string;
    regular: string;
    small: string;
    thumb: string;
  };
  color: string;
}

// Extract relevant keywords from text
function extractKeywords(text: string): string[] {
  // Remove common words and punctuation
  const commonWords = new Set(['the', 'be', 'to', 'of', 'and', 'a', 'in', 'that', 'have', 'i', 'it', 'for', 'not', 'on', 'with', 'he', 'as', 'you', 'do', 'at'])
  const words = text
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .split(/\s+/)
    .filter(word => word.length > 3 && !commonWords.has(word))
  
  // Get unique words and take the first 3 most relevant ones
  return [...new Set(words)].slice(0, 3)
}

export async function getImageForContent(text: string): Promise<{
  url: string;
  color: string;
} | null> {
  if (!UNSPLASH_ACCESS_KEY) {
    console.warn('Unsplash API key not configured')
    return null
  }

  try {
    const keywords = extractKeywords(text)
    if (keywords.length === 0) return null

    const query = keywords.join(' ')
    const response = await fetch(
      `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=1&orientation=square`,
      {
        headers: {
          'Authorization': `Client-ID ${UNSPLASH_ACCESS_KEY}`
        }
      }
    )

    if (!response.ok) {
      throw new Error('Failed to fetch from Unsplash')
    }

    const data = await response.json()
    if (data.results && data.results.length > 0) {
      const image = data.results[0] as UnsplashImage
      return {
        url: image.urls.small,
        color: image.color
      }
    }

    return null
  } catch (error) {
    console.error('Error fetching Unsplash image:', error)
    return null
  }
}

// Cache for storing recently fetched images
const imageCache = new Map<string, { url: string; color: string; timestamp: number }>()
const CACHE_DURATION = 1000 * 60 * 60 * 24 // 24 hours

export async function getCachedImageForContent(text: string): Promise<{
  url: string;
  color: string;
} | null> {
  // Generate a cache key from the first 100 characters of text
  const cacheKey = text.slice(0, 100)
  
  // Check cache first
  const cached = imageCache.get(cacheKey)
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return {
      url: cached.url,
      color: cached.color
    }
  }

  // Fetch new image
  const result = await getImageForContent(text)
  if (result) {
    // Store in cache
    imageCache.set(cacheKey, {
      ...result,
      timestamp: Date.now()
    })
  }

  return result
}
