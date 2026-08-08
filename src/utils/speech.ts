import { generateSpeech } from '../services/gemini';

let currentAudioSource: AudioBufferSourceNode | null = null;
let currentAudioCtx: AudioContext | null = null;

export const stopSpeech = () => {
  if (currentAudioSource) {
    try {
      currentAudioSource.stop();
    } catch (e) {
      // already stopped
    }
    currentAudioSource = null;
  }
  if (currentAudioCtx) {
    try {
      currentAudioCtx.close();
    } catch (e) {
      // already closed
    }
    currentAudioCtx = null;
  }
};

export const speakText = async (text: string, voiceName: string = "Zephyr") => {
  // Stop any currently playing audio first so voices don't overlap
  stopSpeech();

  // Clean up text
  const cleanText = text
    .replace(/[*_~`#]/g, '') // remove markdown styling
    .replace(/\[\d+\]/g, '') // remove citations like [1]
    .trim();

  if (!cleanText) return;

  try {
    const response = await generateSpeech(cleanText, voiceName);
    const inlineData = response.candidates?.[0]?.content?.parts?.[0]?.inlineData;
    
    if (inlineData && inlineData.data) {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      currentAudioCtx = audioCtx;

      const binaryString = window.atob(inlineData.data);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      
      const pcm16 = new Int16Array(bytes.buffer);
      const float32 = new Float32Array(pcm16.length);
      for (let i = 0; i < pcm16.length; i++) {
        float32[i] = pcm16[i] / 32768.0;
      }
      
      const audioBuffer = audioCtx.createBuffer(1, float32.length, 24000);
      audioBuffer.getChannelData(0).set(float32);
      
      const source = audioCtx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioCtx.destination);
      
      source.onended = () => {
        if (currentAudioSource === source) {
          currentAudioSource = null;
        }
      };
      
      currentAudioSource = source;
      source.start(0);
    }
  } catch (error) {
    console.error('speakText error:', error);
  }
};
