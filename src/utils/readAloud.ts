import { generateSpeech } from '../services/gemini';

let currentAudio: HTMLAudioElement | null = null;

export function stopCurrentReadAloud() {
  if (currentAudio) {
    try {
      currentAudio.pause();
      currentAudio.currentTime = 0;
    } catch (e) {
      // Ignored
    }
    currentAudio = null;
  }
}

export async function playTextToSpeech(text: string, voiceName: string = "Zephyr") {
  try {
    stopCurrentReadAloud();
    
    // Clean up text for better pronunciation (remove markdown syntax like *, #, `, etc.)
    const cleanText = text
      .replace(/[*#`_\-]/g, '') // strip md formatting
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // strip md links
      .substring(0, 400); // safety length limit for speech response
      
    if (!cleanText.trim()) return null;

    const response = await generateSpeech(cleanText, voiceName);
    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    
    if (base64Audio) {
      const url = `data:audio/mp3;base64,${base64Audio}`;
      const audio = new Audio(url);
      currentAudio = audio;
      await audio.play();
      return audio;
    }
  } catch (err) {
    console.error("[Read Aloud Error] Failed to play speech:", err);
  }
  return null;
}
