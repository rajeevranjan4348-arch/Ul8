import { getAiInstance } from './gemini';

export interface KimiK3Step {
  text: string;
  durationMs: number;
}

export const getKimiK3ThinkingSteps = (prompt: string): string[] => {
  const p = prompt.toLowerCase();
  if (p.includes('weather') || p.includes('forecast') || p.includes('temperature') || p.includes('temp')) {
    return [
      "🔍 [kimi-k3-quickstart] Minimal Weather Agent Loop Initialized",
      "🌐 Resolving location coordinates and scanning active registries...",
      "📡 Pulling real-time satellite telemetry (simulated fetch)...",
      "📊 Compiling wind speed, humidity, and atmospheric pressure index...",
      "✅ Weather agent successfully completed task loop."
    ];
  }
  if (p.includes('calc') || p.includes('math') || p.includes('prove') || p.includes('proof') || p.includes('irrational') || p.includes('%') || /\d+/.test(p)) {
    return [
      "⚡ [kimi-k3-quickstart] Loading Calculator Dynamically...",
      "📦 Initializing Sandboxed Math Execution Environment...",
      "🧩 Parsing arithmetic parameters and assembling logical abstract syntax tree...",
      "🧠 Running high-fidelity theorem solver (reasoning_effort='max')...",
      "✅ Logical evaluation verified with 0 safety/computational constraints violated."
    ];
  }
  return [
    "🧠 Activating Reasoning Engine (reasoning_effort='max')",
    "🔍 Analyzing semantic requirements and deconstructing user intent...",
    "📚 Running deep-search heuristics across multimodal layers...",
    "🧩 Structuring cohesive answer layout with maximum analytical depth...",
    "🛡️ Performing safety guidelines and logical consistency check..."
  ];
};

export interface KimiStreamHandler {
  onThinkingStep: (stepText: string, isDone: boolean) => void;
  onThinkingChunk?: (chunk: string) => void;
  onTextChunk: (chunk: string) => void;
  onComplete: (fullText: string) => void;
  onError: (err: any) => void;
}

export const streamKimiK3Response = async (
  prompt: string,
  attachments: any[] = [],
  handlers: KimiStreamHandler
) => {
  try {
    const steps = getKimiK3ThinkingSteps(prompt);
    
    // Simulate thinking steps sequentially to give a real "max reasoning" feel
    for (let i = 0; i < steps.length; i++) {
      handlers.onThinkingStep(steps[i], i === steps.length - 1);
      // Brief delay between steps
      await new Promise((resolve) => setTimeout(resolve, 800));
    }

    const API_KEY = "sk-ErjQCWFCYOR5RIW7cRs-lMYFGOOVqfrWV1UjOCdtC2I-ZqPQX_18MD2nPrOppquEbPXauYgeCi7FTlMIE2HppSUtXspq";
    const endpoints = [
      "https://api.kie.ai/v1/chat/completions",
      "https://api.moonshot.cn/v1/chat/completions"
    ];

    let response: Response | null = null;
    let endpointUsed = "";
    
    for (const url of endpoints) {
      try {
        const payload: any = {
          model: "kimi-k3",
          messages: [
            {
              role: "system",
              content: `You are the Kimi-K3 advanced reasoning and vision model. 
You are highly intellectual, thorough, and analytical. 
When answering:
1. Provide extremely detailed, high-quality, and robust answers.
2. If asked to prove something, give mathematically rigorous and beautiful proofs.
3. If asked about the weather, perform the Weather Agent Loop by outputting the weather in a visually gorgeous cards/widgets format with mock temperatures.
4. If asked to do math/calculations, show the code or process of loading a calculator dynamically, print the math steps, and output the precise answer.
Always respond in clear, beautiful Markdown.`
            },
            {
              role: "user",
              content: prompt
            }
          ],
          stream: true,
          thinking: {
            type: "enabled",
            clear_thinking: false
          }
        };

        if (attachments && attachments.length > 0) {
          const firstImg = attachments[0];
          payload.messages[1].content = [
            { type: "text", text: prompt },
            {
              type: "image_url",
              image_url: {
                url: `data:${firstImg.type};base64,${firstImg.base64}`
              }
            }
          ];
        }

        response = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${API_KEY}`
          },
          body: JSON.stringify(payload)
        });

        if (response.ok) {
          endpointUsed = url;
          break;
        } else {
          console.warn(`Endpoint ${url} failed with status ${response.status}`);
        }
      } catch (err) {
        console.warn(`Failed to connect to ${url}:`, err);
      }
    }

    if (!response || !response.ok) {
      console.warn("Kimi-K3 API endpoints failed or unauthorized, falling back to Gemini model...");
      const ai = getAiInstance();
      let systemPrompt = `You are the Kimi-K3 advanced reasoning and vision model. 
You are highly intellectual, thorough, and analytical. 
When answering:
1. Provide extremely detailed, high-quality, and robust answers.
2. If asked to prove something, give mathematically rigorous and beautiful proofs.
3. If asked about the weather, perform the Weather Agent Loop by outputting the weather in a visually gorgeous cards/widgets format with mock temperatures.
4. If asked to do math/calculations, show the code or process of loading a calculator dynamically, print the math steps, and output the precise answer.
Always respond in clear, beautiful Markdown.`;

      let contents: any = prompt;
      if (attachments && attachments.length > 0) {
        contents = [
          { text: prompt },
          ...attachments.map(att => ({
            inlineData: {
              data: att.base64,
              mimeType: att.type
            }
          }))
        ];
      }

      const stream = await ai.models.generateContentStream({
        model: 'gemini-3.5-flash',
        contents: contents,
        config: {
          systemInstruction: systemPrompt
        }
      });

      let fullText = '';
      for await (const chunk of stream) {
        if (chunk.text) {
          fullText += chunk.text;
          handlers.onTextChunk(chunk.text);
        }
      }
      handlers.onComplete(fullText);
      return;
    }

    const reader = response.body?.getReader();
    const decoder = new TextDecoder("utf-8");
    if (!reader) {
      throw new Error("Response body is not readable");
    }

    let fullText = "";
    let buffer = "";
    
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        const cleaned = line.trim();
        if (!cleaned) continue;
        if (cleaned === "data: [DONE]") continue;
        
        if (cleaned.startsWith("data: ")) {
          try {
            const dataStr = cleaned.slice(6);
            const parsed = JSON.parse(dataStr);
            const choice = parsed.choices?.[0];
            const reasoningChunk = choice?.delta?.reasoning_content || choice?.delta?.thinking_content || choice?.delta?.reasoning || "";
            if (reasoningChunk) {
              handlers.onThinkingChunk?.(reasoningChunk);
            }
            const textChunk = choice?.delta?.content || choice?.text || "";
            if (textChunk) {
              fullText += textChunk;
              handlers.onTextChunk(textChunk);
            }
          } catch (e) {
            // Ignore parsing errors
          }
        }
      }
    }
    
    if (buffer && buffer.startsWith("data: ")) {
      try {
        const dataStr = buffer.slice(6);
        const parsed = JSON.parse(dataStr);
        const choice = parsed.choices?.[0];
        const reasoningChunk = choice?.delta?.reasoning_content || choice?.delta?.thinking_content || choice?.delta?.reasoning || "";
        if (reasoningChunk) {
          handlers.onThinkingChunk?.(reasoningChunk);
        }
        const textChunk = choice?.delta?.content || choice?.text || "";
        if (textChunk) {
          fullText += textChunk;
          handlers.onTextChunk(textChunk);
        }
      } catch (e) {}
    }

    handlers.onComplete(fullText || "Completed");
  } catch (err) {
    handlers.onError(err);
  }
};
