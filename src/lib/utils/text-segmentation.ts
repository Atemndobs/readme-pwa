import * as cheerio from 'cheerio';
import { split } from 'sentence-splitter';

export const MAX_SEGMENT_LENGTH = 500; // Maximum characters per segment
const BLOCK_ELEMENTS = ['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'li', 'blockquote', 'div'];

export interface TextSegment {
  id: string;
  text: string;
  type: 'heading' | 'paragraph' | 'list' | 'quote' | 'text';
  level?: number;
  pauseDuration?: number; // Duration to pause after this segment
}

// Pause durations in milliseconds
export const PAUSE_DURATIONS = {
  heading: 1000,
  paragraph: 800,
  list: 400,
  quote: 600,
  text: 200,
} as const;

function splitIntoSentences(text: string): string[] {
  const sentences = split(text);
  const result: string[] = [];
  let currentSegment = '';

  for (const sentence of sentences) {
    if (sentence.type !== 'Sentence') continue;
    
    const sentenceText = sentence.raw.trim();
    if (!sentenceText) continue;

    if (!currentSegment) {
      currentSegment = sentenceText;
    } else if ((currentSegment + ' ' + sentenceText).length <= MAX_SEGMENT_LENGTH) {
      currentSegment += ' ' + sentenceText;
    } else {
      result.push(currentSegment);
      currentSegment = sentenceText;
    }
  }

  if (currentSegment) {
    result.push(currentSegment);
  }

  return result;
}

function getElementType(element: cheerio.Element): TextSegment['type'] {
  const name = (element as any).name;
  if (!name) return 'text';
  const tagName = name.toLowerCase();
  if (['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(tagName)) return 'heading';
  if (tagName === 'li') return 'list';
  if (tagName === 'blockquote') return 'quote';
  if (tagName === 'p') return 'paragraph';
  return 'text';
}

function getHeadingLevel(element: cheerio.Element): number | undefined {
  const name = (element as any).name;
  if (!name) return undefined;
  const tagName = name.toLowerCase();
  if (tagName.startsWith('h') && tagName.length === 2) {
    return parseInt(tagName[1]);
  }
  return undefined;
}

function generateId() {
  return Math.random().toString(36).substring(7);
}

export function segmentText(html: string): TextSegment[] {
  // If the input is plain text, wrap it in a paragraph tag
  const isHTML = /<[a-z][\s\S]*>/i.test(html);
  const content = isHTML ? html : `<p>${html}</p>`;
  
  const $ = cheerio.load(content);
  const segments: TextSegment[] = [];
  const seenTexts = new Set<string>(); // Track unique text segments

  // Process block elements
  $(BLOCK_ELEMENTS.join(', ')).each((_, element) => {
    const $element = $(element);
    const text = $element.text().trim();
    if (!text) return;

    const type = getElementType(element);
    const level = type === 'heading' ? getHeadingLevel(element) : undefined;

    // Split long text into sentences while preserving type
    const textSegments = splitIntoSentences(text);
    textSegments.forEach((segmentText) => {
      // Only add if this exact text hasn't been seen before
      if (!seenTexts.has(segmentText)) {
        seenTexts.add(segmentText);
        segments.push({
          id: generateId(),
          text: segmentText,
          type,
          level,
          pauseDuration: PAUSE_DURATIONS[type],
        });
      }
    });
  });

  // Only process body text if no block elements were found and the text isn't wrapped
  if (segments.length === 0 && !isHTML) {
    const textSegments = splitIntoSentences(html.trim());
    textSegments.forEach((segmentText) => {
      if (!seenTexts.has(segmentText)) {
        seenTexts.add(segmentText);
        segments.push({
          id: generateId(),
          text: segmentText,
          type: 'text',
          pauseDuration: PAUSE_DURATIONS.text,
        });
      }
    });
  }

  return segments;
}
