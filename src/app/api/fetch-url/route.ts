import { NextRequest, NextResponse } from 'next/server'
import * as cheerio from 'cheerio'
import { Readability } from '@mozilla/readability'
import { JSDOM } from 'jsdom'

export async function POST(request: NextRequest) {
  console.log('Received URL fetch request') // Debug log
  try {
    const { url } = await request.json()
    console.log('URL to fetch:', url) // Debug log

    if (!url) {
      return NextResponse.json(
        { error: 'URL is required' },
        { status: 400 }
      )
    }

    // Validate URL
    try {
      new URL(url)
    } catch (error) {
      return NextResponse.json(
        { error: 'Invalid URL format' },
        { status: 400 }
      )
    }

    // Fetch the URL content
    console.log('Fetching URL content...') // Debug log
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; ReadMePWA/1.0; +https://readme.atemkeng.eu)'
      }
    })

    console.log('URL fetch response status:', response.status) // Debug log

    if (!response.ok) {
      return NextResponse.json(
        { error: `Failed to fetch URL: ${response.statusText}` },
        { status: response.status }
      )
    }

    const html = await response.text()
    console.log('Received HTML content length:', html.length) // Debug log
    
    // Use Readability to extract the main content
    console.log('Parsing with Readability...') // Debug log
    const dom = new JSDOM(html, { url })
    const reader = new Readability(dom.window.document)
    const article = reader.parse()
    
    if (!article) {
      console.error('Readability failed to parse content') // Debug log
      return NextResponse.json(
        { error: 'Could not extract content from URL' },
        { status: 400 }
      )
    }

    console.log('Article parsed successfully:', { 
      title: article.title,
      contentLength: article.content.length 
    }) // Debug log

    // Load the content into cheerio to clean it up
    const $ = cheerio.load(article.content)

    // Remove unwanted elements
    $('script, style, noscript, iframe, img').remove()
    
    // Clean up the content
    $('*').each((_, elem) => {
      // Remove empty elements except line breaks
      if ($(elem).text().trim() === '' && !['br', 'hr'].includes(elem.tagName)) {
        $(elem).remove()
      }
      // Remove all attributes except specific ones we want to keep
      const attrs = elem.attributes
      for (let i = attrs.length - 1; i >= 0; i--) {
        const attrName = attrs[i].name
        if (!['class'].includes(attrName)) {
          $(elem).removeAttr(attrName)
        }
      }
    })

    // Add styling classes
    $('h1, h2, h3, h4, h5, h6').addClass('text-lg font-bold my-4')
    $('p').addClass('my-2')
    $('ul, ol').addClass('my-2 ml-4')
    $('li').addClass('my-1')
    $('blockquote').addClass('border-l-4 border-gray-300 pl-4 my-4 italic')
    $('pre, code').addClass('font-mono bg-gray-100 dark:bg-gray-800 rounded px-2')
    $('a').addClass('text-blue-500 hover:underline')

    // Format the content with proper spacing
    const formattedHtml = $.html()
      .replace(/>\s+</g, '>\n<') // Add newlines between tags
      .replace(/(<\/[^>]+>)(?!\n)/g, '$1\n') // Add newline after closing tags
      .trim()

    console.log('Sending response with content length:', formattedHtml.length) // Debug log

    return NextResponse.json({
      title: article.title,
      text: formattedHtml,
      url: url
    })
  } catch (error) {
    console.error('URL processing error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to process URL content' },
      { status: 500 }
    )
  }
}
