import { getAiInstance } from './gemini';

export interface OcrResult {
  text: string;
  wordCount: number;
  charCount: number;
  mode: 'full' | 'table' | 'summary' | 'handwriting';
}

export const performOcrOnImage = async (
  base64Image: string,
  mimeType: string = 'image/jpeg',
  mode: 'full' | 'table' | 'summary' | 'handwriting' = 'full',
  customPrompt?: string
): Promise<OcrResult> => {
  const ai = getAiInstance();

  let prompt = '';
  if (customPrompt) {
    prompt = customPrompt;
  } else if (mode === 'table') {
    prompt = `Extract all tabular data, figures, numbers, and structured lists from this image. 
Format the result as clean Markdown tables with header rows. 
Include any footnotes, totals, or annotations surrounding the table.
Only output markdown without extra meta-commentary.`;
  } else if (mode === 'summary') {
    prompt = `First, transcribe all text present in the image accurately. 
Then, provide a clear structured summary outlining:
1. Document Type / Purpose
2. Key Statements / Highlights
3. Full Extracted Text

Format clearly with Markdown headings and bullet points.`;
  } else if (mode === 'handwriting') {
    prompt = `You are an expert handwriting recognition and OCR specialist. 
Carefully transcribe all handwritten text, cursive notes, drawings with text, or annotations from this image. 
Preserve line breaks, indentations, and list items. If any word is uncertain, place it in brackets with a question mark like [word?].
Only output the transcription.`;
  } else {
    prompt = `You are a high-precision OCR (Optical Character Recognition) engine. 
Extract ALL visible text contained within this image with 100% precision. 
Maintain the layout, paragraph structure, headings, bullet points, and formatting in Markdown wherever possible. 
Do not skip small text, headers, footers, watermarks, or code snippets. 
Only return the extracted text. If no text is found, return "No readable text detected in this image."`;
  }

  // Ensure clean base64 string without data prefix
  const cleanBase64 = base64Image.includes(',') ? base64Image.split(',')[1] : base64Image;
  const cleanMime = mimeType || 'image/jpeg';

  const response = await ai.models.generateContent({
    model: 'gemini-3.5-flash',
    contents: [
      {
        parts: [
          {
            inlineData: {
              data: cleanBase64,
              mimeType: cleanMime,
            },
          },
          { text: prompt },
        ],
      },
    ],
  });

  const text = (response.text || 'No text detected').trim();
  const words = text.split(/\s+/).filter(Boolean);

  return {
    text,
    wordCount: words.length,
    charCount: text.length,
    mode,
  };
};
