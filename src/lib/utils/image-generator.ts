import { VoiceId } from "../store/settings"
import { getCachedImageForContent } from "../api/unsplash"

// Function to extract image URL from text content (e.g., from markdown or HTML)
export function extractImageFromContent(text: string): string | null {
  // Match markdown image syntax ![alt](url)
  const markdownMatch = text.match(/!\[.*?\]\((.*?)\)/)
  if (markdownMatch) return markdownMatch[1]

  // Match HTML img tags
  const htmlMatch = text.match(/<img.*?src=["'](.*?)["']/)
  if (htmlMatch) return htmlMatch[1]

  // Match plain URLs that look like images
  const urlMatch = text.match(/(https?:\/\/.*\.(?:png|jpg|jpeg|gif|webp))/i)
  if (urlMatch) return urlMatch[1]

  return null
}

// Generate a unique color based on text content
function generateColorFromText(text: string): string {
  let hash = 0
  for (let i = 0; i < text.length; i++) {
    hash = text.charCodeAt(i) + ((hash << 5) - hash)
  }
  const hue = hash % 360
  return `hsl(${hue}, 70%, 50%)`
}

// Generate a gradient background based on text and voice
export function generateGradientBackground(text: string, voice: VoiceId, baseColor?: string): string {
  const color1 = baseColor || generateColorFromText(text)
  const color2 = generateColorFromText(voice + text)
  
  return `linear-gradient(45deg, ${color1}, ${color2})`
}

// Get image for audio content
export async function getAudioImage(text: string, voice: VoiceId): Promise<{
  url: string | null;
  background: string;
}> {
  // First, try to extract image from content
  const extractedImage = extractImageFromContent(text)
  if (extractedImage) {
    return {
      url: extractedImage,
      background: generateGradientBackground(text, voice)
    }
  }

  // Try to get an image from Unsplash
  const unsplashImage = await getCachedImageForContent(text)
  if (unsplashImage) {
    return {
      url: unsplashImage.url,
      background: generateGradientBackground(text, voice, unsplashImage.color)
    }
  }

  // Generate gradient background as fallback
  return {
    url: null,
    background: generateGradientBackground(text, voice)
  }
}
