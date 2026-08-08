import { GoogleGenAI, ThinkingLevel, Modality } from "@google/genai";

const wrapAiWithFallback = (aiInstance: any) => {
  const isQuotaOrPermissionError = (err: any) => {
    const errMsg = String(err?.message || err || '').toLowerCase();
    const errStatus = String(err?.status || '').toLowerCase();
    const errCode = err?.code || err?.status || err?.statusCode;
    
    return (
      errMsg.includes("quota") ||
      errMsg.includes("limit") ||
      errMsg.includes("exhausted") ||
      errMsg.includes("429") ||
      errMsg.includes("permission") ||
      errMsg.includes("denied") ||
      errMsg.includes("403") ||
      errStatus.includes("resource_exhausted") ||
      errStatus.includes("permission_denied") ||
      errCode === 429 ||
      errCode === 403
    );
  };

  const getFallbackModel = (originalModel: string) => {
    if (!originalModel) return 'gemini-3.5-flash';
    if (originalModel.includes('-image')) {
      return 'gemini-3.1-flash-lite-image';
    }
    if (originalModel.includes('-tts') || originalModel.includes('speech')) {
      return 'gemini-3.1-flash-tts-preview';
    }
    if (originalModel === 'gemini-3.5-flash') {
      return 'gemini-3.1-flash-lite';
    }
    return 'gemini-3.5-flash';
  };

  const adjustConfigForFallback = (config: any) => {
    if (!config) return config;
    const newConfig = { ...config };
    // Strip or normalize any parameters if necessary
    return newConfig;
  };

  return new Proxy(aiInstance, {
    get(target, prop) {
      if (prop === 'models') {
        const originalModels = target.models;
        return new Proxy(originalModels, {
          get(modelsTarget, modelsProp) {
            if (modelsProp === 'generateContent') {
              return async function(params: any) {
                try {
                  return await modelsTarget.generateContent(params);
                } catch (err) {
                  if (isQuotaOrPermissionError(err)) {
                    const originalModel = params?.model || '';
                    const fallbackModel = getFallbackModel(originalModel);
                    console.warn(`[Gemini Fallback] Original model '${originalModel}' failed with quota/permission. Retrying with '${fallbackModel}'...`, err);
                    const fallbackParams = {
                      ...params,
                      model: fallbackModel,
                      config: adjustConfigForFallback(params?.config)
                    };
                    try {
                      return await modelsTarget.generateContent(fallbackParams);
                    } catch (fallbackErr) {
                      console.error(`[Gemini Fallback] Fallback model '${fallbackModel}' also failed:`, fallbackErr);
                      throw fallbackErr;
                    }
                  }
                  throw err;
                }
              };
            }
            
            if (modelsProp === 'generateContentStream') {
              return async function*(params: any) {
                try {
                  const stream = await modelsTarget.generateContentStream(params);
                  for await (const chunk of stream) {
                    yield chunk;
                  }
                } catch (err) {
                  if (isQuotaOrPermissionError(err)) {
                    const originalModel = params?.model || '';
                    const fallbackModel = getFallbackModel(originalModel);
                    console.warn(`[Gemini Fallback] Original model '${originalModel}' stream failed. Retrying stream with '${fallbackModel}'...`, err);
                    const fallbackParams = {
                      ...params,
                      model: fallbackModel,
                      config: adjustConfigForFallback(params?.config)
                    };
                    try {
                      const fallbackStream = await modelsTarget.generateContentStream(fallbackParams);
                      for await (const chunk of fallbackStream) {
                        yield chunk;
                      }
                      return;
                    } catch (fallbackErr) {
                      console.error(`[Gemini Fallback] Fallback model stream '${fallbackModel}' also failed:`, fallbackErr);
                      throw fallbackErr;
                    }
                  }
                  throw err;
                }
              };
            }
            
            const val = Reflect.get(modelsTarget, modelsProp);
            if (typeof val === 'function') {
              return val.bind(modelsTarget);
            }
            return val;
          }
        });
      }
      
      if (prop === 'chats') {
        const originalChats = target.chats;
        return new Proxy(originalChats, {
          get(chatsTarget, chatsProp) {
            if (chatsProp === 'create') {
              return function(createParams: any) {
                const originalChat = chatsTarget.create(createParams);
                
                return new Proxy(originalChat, {
                  get(chatTarget, chatProp) {
                    if (chatProp === 'sendMessage') {
                      return async function(sendParams: any) {
                        try {
                          return await chatTarget.sendMessage(sendParams);
                        } catch (err) {
                          if (isQuotaOrPermissionError(err)) {
                            const originalModel = createParams?.model || '';
                            const fallbackModel = getFallbackModel(originalModel);
                            console.warn(`[Gemini Fallback] chat.sendMessage failed with '${originalModel}'. Creating fallback chat with '${fallbackModel}'...`, err);
                            
                            const fallbackChatParams = {
                              ...createParams,
                              model: fallbackModel,
                              config: adjustConfigForFallback(createParams?.config)
                            };
                            const fallbackChat = chatsTarget.create(fallbackChatParams);
                            try {
                              return await fallbackChat.sendMessage(sendParams);
                            } catch (fallbackErr) {
                              console.error(`[Gemini Fallback] Fallback chat sendMessage also failed:`, fallbackErr);
                              throw fallbackErr;
                            }
                          }
                          throw err;
                        }
                      };
                    }
                    
                    if (chatProp === 'sendMessageStream') {
                      return async function*(sendParams: any) {
                        try {
                          const stream = await chatTarget.sendMessageStream(sendParams);
                          for await (const chunk of stream) {
                            yield chunk;
                          }
                        } catch (err) {
                          if (isQuotaOrPermissionError(err)) {
                            const originalModel = createParams?.model || '';
                            const fallbackModel = getFallbackModel(originalModel);
                            console.warn(`[Gemini Fallback] chat.sendMessageStream failed with '${originalModel}'. Creating fallback chat stream with '${fallbackModel}'...`, err);
                            
                            const fallbackChatParams = {
                              ...createParams,
                              model: fallbackModel,
                              config: adjustConfigForFallback(createParams?.config)
                            };
                            const fallbackChat = chatsTarget.create(fallbackChatParams);
                            try {
                              const fallbackStream = await fallbackChat.sendMessageStream(sendParams);
                              for await (const chunk of fallbackStream) {
                                yield chunk;
                              }
                              return;
                            } catch (fallbackErr) {
                              console.error(`[Gemini Fallback] Fallback chat sendMessageStream also failed:`, fallbackErr);
                              throw fallbackErr;
                            }
                          }
                          throw err;
                        }
                      };
                    }
                    
                    const val = Reflect.get(chatTarget, chatProp);
                    if (typeof val === 'function') {
                      return val.bind(chatTarget);
                    }
                    return val;
                  }
                });
              };
            }
            
            const val = Reflect.get(chatsTarget, chatsProp);
            if (typeof val === 'function') {
              return val.bind(chatsTarget);
            }
            return val;
          }
        });
      }
      
      const val = Reflect.get(target, prop);
      if (typeof val === 'function') {
        return val.bind(target);
      }
      return val;
    }
  });
};

export const getAiInstance = () => {
  const options: any = { apiKey: process.env.GEMINI_API_KEY };
  if (process.env.GEMINI_API_BASE_URL) {
    options.baseURL = process.env.GEMINI_API_BASE_URL;
  }
  const ai = new GoogleGenAI(options);
  return wrapAiWithFallback(ai);
};

export const getSearchGroundedResponse = async (message: string) => {
  const ai = getAiInstance();
  return await ai.models.generateContent({
    model: "gemini-3.5-flash",
    contents: message,
    config: {
      tools: [{ googleSearch: {} }],
    },
  });
};

export const getMapsGroundedResponse = async (message: string, lat: number, lng: number) => {
  const ai = getAiInstance();
  return await ai.models.generateContent({
    model: "gemini-3.5-flash",
    contents: message,
    config: {
      tools: [{ googleMaps: {} }],
      toolConfig: {
        retrievalConfig: {
          latLng: {
            latitude: lat,
            longitude: lng,
          },
        },
      },
    },
  });
};

export const transcribeAudio = async (base64Audio: string, mimeType: string) => {
  const ai = getAiInstance();
  return await ai.models.generateContent({
    model: "gemini-3.5-flash",
    contents: [
      {
        parts: [
          {
            inlineData: {
              data: base64Audio,
              mimeType: mimeType,
            },
          },
          { text: "Please transcribe this audio exactly as spoken." },
        ],
      },
    ],
  });
};

export const generateSpeech = async (text: string, voiceName: string = "Fenrir") => {
  const ai = getAiInstance();
  return await ai.models.generateContent({
    model: "gemini-3.1-flash-tts-preview",
    contents: [{ parts: [{ text }] }],
    config: {
      responseModalities: [Modality.AUDIO],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName },
        },
      },
    },
  });
};

export const analyzeScreenFrame = async (base64Image: string, mimeType: string = 'image/jpeg', customPrompt?: string) => {
  const ai = getAiInstance();
  const prompt = customPrompt || "Describe everything visible on the screen. Help the user interact with apps in real time.";
  return await ai.models.generateContent({
    model: "gemini-3.6-flash",
    contents: [
      {
        parts: [
          {
            inlineData: {
              data: base64Image,
              mimeType: mimeType,
            },
          },
          { text: prompt },
        ],
      },
    ],
  });
};

export const analyzeAndAutoFixError = async (errorMsg: string, stackTrace?: string, modeName?: string) => {
  try {
    const ai = getAiInstance();
    const prompt = `You are the OmniChat AI Self-Healing & Diagnostic Agent.
An unhandled application error occurred in mode/component: "${modeName || 'System'}".

ERROR DETAILS:
Error Message: ${errorMsg}
Stack Trace / Info: ${stackTrace || 'No stack trace provided'}

Tasks:
1. Identify the root cause of this error concisely (1-2 sentences).
2. Provide an actionable step-by-step fix or recovery strategy.
3. Suggest a clean JavaScript/React code fallback or configuration patch to prevent this crash in the future.

Respond in JSON format with keys:
"rootCause": string,
"suggestedFix": string,
"autoRecoveryCode": string (a safe JS/React fallback snippet),
"severity": "Low" | "Medium" | "High" | "Critical"
`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json'
      }
    });

    if (response.text) {
      return JSON.parse(response.text);
    }
  } catch (err) {
    console.error('Failed to run AI Auto-Fix analysis:', err);
  }

  return {
    rootCause: `Runtime exception caught: ${errorMsg}`,
    suggestedFix: 'State reset and soft-reboot initiated for the active component.',
    autoRecoveryCode: 'setErrorState(false); resetComponent();',
    severity: 'Medium'
  };
};

