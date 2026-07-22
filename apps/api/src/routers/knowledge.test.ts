import { describe, it, expect } from 'vitest';
import { extractTextFromPdf } from './knowledge';

describe('PDF Text Extractor Heuristics', () => {
  it('should extract text from a simple PDF operator stream', () => {
    const rawPdfStream = `
      BT
      /F1 12 Tf
      70 50 Td
      (Welcome to INDRA AI) Tj
      ET
      BT
      /F1 12 Tf
      70 70 Td
      [(This) 10 ( is) -5 ( a) 15 ( test)] TJ
      ET
    `;
    const buffer = Buffer.from(rawPdfStream, 'utf-8');
    const result = extractTextFromPdf(buffer);
    
    expect(result).toContain('Welcome to INDRA AI');
    expect(result).toContain('This is a test');
  });

  it('should return empty string if no text operators are found', () => {
    const emptyPdfStream = '%PDF-1.4 ... binary data ...';
    const buffer = Buffer.from(emptyPdfStream, 'utf-8');
    const result = extractTextFromPdf(buffer);
    expect(result).toBe('');
  });
});
