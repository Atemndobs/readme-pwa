interface URLFetchResponse {
  title: string
  text: string
  url: string
}

export class URLFetchError extends Error {
  constructor(message: string, public statusCode?: number) {
    super(message)
    this.name = 'URLFetchError'
  }
}

export async function fetchUrlContent(url: string): Promise<URLFetchResponse> {
  console.log('Fetching URL:', url) // Debug log
  try {
    const response = await fetch('/api/fetch-url', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ url }),
    })

    console.log('Response status:', response.status) // Debug log

    if (!response.ok) {
      let errorMessage = 'Failed to fetch URL content'
      try {
        const errorData = await response.json()
        console.error('Error data:', errorData) // Debug log
        errorMessage = errorData.error || errorMessage
      } catch {
        errorMessage = response.statusText || errorMessage
      }
      throw new URLFetchError(errorMessage, response.status)
    }

    const data = await response.json()
    console.log('Fetched data:', data) // Debug log
    return data as URLFetchResponse
  } catch (error) {
    console.error('URL fetch error:', error)
    if (error instanceof URLFetchError) {
      throw error
    }
    throw new URLFetchError(
      error instanceof Error ? error.message : 'Failed to fetch URL content'
    )
  }
}
