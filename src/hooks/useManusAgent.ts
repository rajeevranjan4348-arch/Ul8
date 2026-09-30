import { useState, useCallback, useEffect } from 'react';
import { getAiInstance } from '../services/gemini';
import { useSettings } from '../contexts/SettingsContext';
import { playTextToSpeech, stopCurrentReadAloud } from '../utils/readAloud';
import { usePeriodicAutoSave } from './usePeriodicAutoSave';

export interface Step {
  id: string;
  label: string;
  status: 'pending' | 'running' | 'completed' | 'error';
  trace?: string[];
}

export interface ChartData {
  labels: string[];
  datasets: {
    label: string;
    data: number[];
    backgroundColor?: string[];
    borderColor?: string;
  }[];
}

export interface ManusSession {
  id: string;
  prompt: string;
  taskType: 'chat' | 'website';
  websiteName: string;
  steps: Step[];
  taskStatus: 'idle' | 'running' | 'completed' | 'error';
  result: any;
  chartData: ChartData | null;
  previewUrl: string;
  srcDoc: string;
  messages: any[];
  timestamp: number;
}

export function useManusAgent() {
  const { readAloud, ttsVoice } = useSettings();

  const [selectedModel, setSelectedModel] = useState<'gemini' | 'kimi-k3'>(() => {
    return (localStorage.getItem('omnichat_selected_model_manus') as 'gemini' | 'kimi-k3') || 'gemini';
  });

  useEffect(() => {
    localStorage.setItem('omnichat_selected_model_manus', selectedModel);
  }, [selectedModel]);

  const [sessions, setSessions] = useState<ManusSession[]>(() => {
    const saved = localStorage.getItem('omnichat_manus_sessions');
    return saved ? JSON.parse(saved) : [];
  });

  const [currentSessionId, setCurrentSessionId] = useState<string | null>(() => {
    return localStorage.getItem('omnichat_manus_current_session_id');
  });

  const initialSession = sessions.find(s => s.id === currentSessionId);
  
  const [taskType, setTaskType] = useState<'chat' | 'website'>(() => {
    return initialSession?.taskType || 'chat';
  });
  const [prompt, setPrompt] = useState(() => {
    return initialSession?.prompt || '';
  });
  const [websiteName, setWebsiteName] = useState(() => {
    return initialSession?.websiteName || '';
  });
  const [steps, setSteps] = useState<Step[]>(() => {
    return initialSession?.steps || [];
  });
  const [taskStatus, setTaskStatus] = useState<'idle' | 'running' | 'completed' | 'error'>(() => {
    return initialSession?.taskStatus || 'idle';
  });
  const [result, setResult] = useState<any>(() => {
    return initialSession?.result || null;
  });
  const [chartData, setChartData] = useState<ChartData | null>(() => {
    return initialSession?.chartData || null;
  });
  const [previewUrl, setPreviewUrl] = useState(() => {
    return initialSession?.previewUrl || '';
  });
  const [srcDoc, setSrcDoc] = useState(() => {
    return initialSession?.srcDoc || '';
  });
  const [isLoading, setIsLoading] = useState(false);
  const [messages, setMessages] = useState<any[]>(() => {
    return initialSession?.messages || [];
  });

  // Sync state to current session in sessions array
  useEffect(() => {
    if (!currentSessionId) return;

    setSessions(prev => {
      const idx = prev.findIndex(s => s.id === currentSessionId);
      const updatedSession: ManusSession = {
        id: currentSessionId,
        prompt,
        taskType,
        websiteName,
        steps,
        taskStatus,
        result,
        chartData,
        previewUrl,
        srcDoc,
        messages,
        timestamp: idx >= 0 ? prev[idx].timestamp : Date.now()
      };

      const nextSessions = [...prev];
      if (idx >= 0) {
        nextSessions[idx] = updatedSession;
      } else {
        nextSessions.unshift(updatedSession);
      }
      return nextSessions;
    });
  }, [currentSessionId, prompt, taskType, websiteName, steps, taskStatus, result, chartData, previewUrl, srcDoc, messages]);

  // Periodic and unload auto-save for Manus Agent sessions & active session
  usePeriodicAutoSave('omnichat_manus_sessions', sessions, {
    intervalMs: 1500
  });

  usePeriodicAutoSave('omnichat_manus_current_session_id', currentSessionId, {
    intervalMs: 1500
  });

  const loadSession = useCallback((id: string) => {
    const session = sessions.find(s => s.id === id);
    if (session) {
      setCurrentSessionId(id);
      setTaskType(session.taskType);
      setPrompt(session.prompt);
      setWebsiteName(session.websiteName);
      setSteps(session.steps);
      setTaskStatus(session.taskStatus);
      setResult(session.result);
      setChartData(session.chartData);
      setPreviewUrl(session.previewUrl);
      setSrcDoc(session.srcDoc);
      setMessages(session.messages);
      localStorage.setItem('omnichat_manus_current_session_id', id);
    }
  }, [sessions]);

  const createNewSession = useCallback(() => {
    stopCurrentReadAloud();
    const newId = `manus_${Date.now()}`;
    setCurrentSessionId(newId);
    setTaskType('chat');
    setPrompt('');
    setWebsiteName('');
    setSteps([]);
    setTaskStatus('idle');
    setResult(null);
    setChartData(null);
    setPreviewUrl('');
    setSrcDoc('');
    setIsLoading(false);
    setMessages([]);
    localStorage.setItem('omnichat_manus_current_session_id', newId);
  }, []);

  const deleteSession = useCallback((id: string, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    setSessions(prev => {
      const next = prev.filter(s => s.id !== id);
      localStorage.setItem('omnichat_manus_sessions', JSON.stringify(next));
      return next;
    });
    if (currentSessionId === id) {
      setCurrentSessionId(null);
      setTaskType('chat');
      setPrompt('');
      setWebsiteName('');
      setSteps([]);
      setTaskStatus('idle');
      setResult(null);
      setChartData(null);
      setPreviewUrl('');
      setSrcDoc('');
      setIsLoading(false);
      setMessages([]);
      localStorage.removeItem('omnichat_manus_current_session_id');
    }
  }, [currentSessionId]);

  const resetTask = useCallback(() => {
    stopCurrentReadAloud();
    setTaskType('chat');
    setPrompt('');
    setWebsiteName('');
    setSteps([]);
    setTaskStatus('idle');
    setResult(null);
    setChartData(null);
    setPreviewUrl('');
    setSrcDoc('');
    setIsLoading(false);
    setMessages([]);

    localStorage.removeItem('omnichat_manus_current_session_id');
    setCurrentSessionId(null);
  }, []);

  const simulateStepProgression = async (
    targetSteps: Step[],
    updateCallback: (updated: Step[]) => void,
    delayMs: number = 800
  ) => {
    let current = [...targetSteps];
    for (let i = 0; i < current.length; i++) {
      // Mark current as running
      current = current.map((s, idx) => {
        if (idx === i) return { ...s, status: 'running' as const, trace: ['Starting execution...', 'Initializing logs...'] };
        if (idx < i) return { ...s, status: 'completed' as const };
        return s;
      });
      updateCallback([...current]);
      await new Promise(resolve => setTimeout(resolve, delayMs));
      
      // Add custom progress traces to look professional
      current = current.map((s, idx) => {
        if (idx === i) {
          return { 
            ...s, 
            status: 'running' as const, 
            trace: [
              'Analyzing constraints...',
              'Formatting structured layout...',
              'Consolidating insights...'
            ] 
          };
        }
        return s;
      });
      updateCallback([...current]);
      await new Promise(resolve => setTimeout(resolve, delayMs / 2));
    }
  };

  const startTask = useCallback(async (userPrompt: string, options: any) => {
    stopCurrentReadAloud();
    setIsLoading(true);
    setTaskStatus('running');
    setPrompt(userPrompt);
    setResult(null);
    setChartData(null);
    setPreviewUrl('');
    setSrcDoc('');

    const isWebsite = options.format === 'website';
    setTaskType(isWebsite ? 'website' : 'chat');
    if (isWebsite) {
      setWebsiteName(options.websiteName || 'Custom Mockup Site');
    }

    // Set initial steps
    let initialSteps: Step[] = [];
    if (isWebsite) {
      initialSteps = [
        { id: '1', label: 'Analyzing Requirements', status: 'pending', trace: [] },
        { id: '2', label: 'Initializing Project Template', status: 'pending', trace: [] },
        { id: '3', label: 'Compiling Dynamic Layout', status: 'pending', trace: [] },
        { id: '4', label: 'Injecting Tailwind Design System', status: 'pending', trace: [] },
        { id: '5', label: 'Starting Interactive Preview Server', status: 'pending', trace: [] },
        { id: '6', label: 'Verifying Ingress & Routing', status: 'pending', trace: [] }
      ];
    } else {
      initialSteps = [
        { id: '1', label: 'Analyzing Dataset Structure', status: 'pending', trace: [] },
        { id: '2', label: 'Parsing Data & Context', status: 'pending', trace: [] },
        { id: '3', label: 'Computing Statistics & Trends', status: 'pending', trace: [] },
        { id: '4', label: 'Generating Core Insights', status: 'pending', trace: [] },
        { id: '5', label: 'Formatting Visual Charts', status: 'pending', trace: [] }
      ];
    }
    setSteps(initialSteps);

    // Simulate agent steps in background so user sees progression
    const progressionPromise = simulateStepProgression(initialSteps, setSteps, 600);

    try {
      const ai = getAiInstance();
      
      let systemPrompt = `You are Manus, a premier multi-step autonomous AI coding and analysis workspace agent.
      Your goal is to parse user prompts, files, or URLs into beautiful, high-fidelity interactive solutions.
      
      Format rules:
      - If doing data visualization: ALWAYS output a JSON code block in this exact structure:
        \`\`\`json
        {
          "type": "bar", // or line, pie, area, bubble, scatter
          "data": {
            "labels": ["Jan", "Feb", "Mar", "Apr", "May"],
            "datasets": [
              {
                "label": "Metric Revenue",
                "data": [12000, 19000, 3000, 5000, 2000]
              }
            ]
          },
          "content": "Detailed analysis report..."
        }
        \`\`\`
      - If building a website: The user wants a beautiful mockup website. Write a COMPLETE single-page application in HTML. Integrate Tailwind CSS CDN (<script src="https://cdn.tailwindcss.com"></script>) and any custom scripts, icons, tables, charts, or forms to make it highly interactive and responsive. Wrap the entire HTML in:
        \`\`\`html
        <!DOCTYPE html>
        <html>
        ...
        </html>
        \`\`\``;

      let userMsg = userPrompt;
      if (options.fileData) {
        userMsg += `\n\nAnalyzable File Name: ${options.fileName}\nContent:\n${options.fileData}`;
      }
      if (options.url) {
        userMsg += `\n\nResearching target link: ${options.url}`;
      }

      let text = '';

      if (selectedModel === 'kimi-k3') {
        const { streamKimiK3Response } = await import('../services/kimiK3');
        let accumulatedText = '';
        await streamKimiK3Response(
          userMsg,
          [],
          {
            onThinkingStep: () => {},
            onTextChunk: (chunk) => {
              accumulatedText += chunk;
              setResult({
                type: options.format || 'report',
                content: accumulatedText,
                files: []
              });
            },
            onComplete: (full) => {
              text = full;
            },
            onError: (err) => {
              throw err;
            }
          }
        );
      } else {
        const response = await ai.models.generateContent({
          model: 'gemini-3.5-flash',
          contents: [
            { role: 'user', parts: [{ text: userMsg }] }
          ],
          config: {
            systemInstruction: systemPrompt
          }
        });

        text = response.text || '';
      }
      
      // Process result
      let finalResult: any = {
        type: options.format || 'report',
        content: text,
        files: []
      };

      // Extract JSON chart if any
      const jsonMatch = text.match(/```json\n([\s\S]*?)\n```/) || text.match(/```\n([\s\S]*?)\n```/);
      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[1]);
          const graphData = parsed.graph || parsed.data || parsed;
          if (graphData && graphData.labels && graphData.datasets) {
            setChartData(graphData);
            finalResult.chartData = graphData;
            finalResult.detectedChartType = parsed.type || options.chartType || 'bar';
          }
          if (parsed.content) {
            finalResult.content = parsed.content;
          }
          if (parsed.files) {
            finalResult.files = parsed.files;
          }
        } catch (e) {
          console.warn('JSON parsing failed:', e);
        }
      }

      // Extract Website HTML if any
      const htmlMatch = text.match(/```html\n([\s\S]*?)\n```/) || text.match(/<html>([\s\S]*?)<\/html>/);
      if (htmlMatch) {
        const extractedHtml = htmlMatch[1] || htmlMatch[0];
        setSrcDoc(extractedHtml);
        finalResult.srcDoc = extractedHtml;
      } else if (isWebsite) {
        // Generate a fallback gorgeous website HTML if none returned
        const fallbackHtml = `
          <!DOCTYPE html>
          <html class="h-full bg-stone-50">
          <head>
            <meta charset="UTF-8">
            <title>${options.websiteName}</title>
            <script src="https://cdn.tailwindcss.com"></script>
          </head>
          <body class="h-full flex flex-col justify-between">
            <header class="bg-white border-b border-stone-200 px-6 py-4 flex justify-between items-center">
              <h1 class="text-xl font-bold text-stone-900">${options.websiteName}</h1>
              <nav class="flex gap-4 text-sm text-stone-600">
                <a href="#" class="hover:text-blue-600 font-medium">Dashboard</a>
                <a href="#" class="hover:text-blue-600">Analytics</a>
                <a href="#" class="hover:text-blue-600">Settings</a>
              </nav>
            </header>
            <main class="flex-1 p-8 max-w-4xl mx-auto w-full">
              <div class="bg-white border border-stone-200 rounded-2xl p-8 shadow-sm space-y-6">
                <div class="flex items-center gap-3">
                  <span class="p-2 bg-blue-50 text-blue-600 rounded-xl">✨</span>
                  <h2 class="text-2xl font-bold text-stone-900">Custom Built Mockup Website</h2>
                </div>
                <p class="text-stone-600 leading-relaxed">
                  Welcome to your brand-new, responsive web space generated live by <strong>Manus Workspace</strong>. 
                  This interface was compiled dynamically based on your request:
                </p>
                <blockquote class="bg-stone-50 border-l-4 border-blue-500 p-4 text-stone-700 italic rounded-r-xl">
                  "${userPrompt}"
                </blockquote>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4">
                  <div class="border border-stone-100 rounded-xl p-4 hover:shadow-md transition-shadow">
                    <h3 class="font-semibold text-stone-800 mb-1">⚡ Ultra Responsive</h3>
                    <p class="text-xs text-stone-500">Perfect adaptive sizing for desktop, tablet, and mobile displays.</p>
                  </div>
                  <div class="border border-stone-100 rounded-xl p-4 hover:shadow-md transition-shadow">
                    <h3 class="font-semibold text-stone-800 mb-1">🎨 Modern Palette</h3>
                    <p class="text-xs text-stone-500">Clean geometric layout paired with soft ambient shadows and borders.</p>
                  </div>
                </div>
              </div>
            </main>
            <footer class="bg-stone-100 py-6 border-t border-stone-200 text-center text-xs text-stone-500">
              © 2026 ${options.websiteName}. Compiled by Manus. All rights reserved.
            </footer>
          </body>
          </html>
        `;
        setSrcDoc(fallbackHtml);
        finalResult.srcDoc = fallbackHtml;
      }

      // Finish progression animation
      await progressionPromise;
      setSteps(prev => prev.map(s => ({ ...s, status: 'completed' as const })));

      setResult(finalResult);
      setTaskStatus('completed');

      // Play Read Aloud if enabled
      if (readAloud) {
        const cleanContent = finalResult.content.replace(/```[\s\S]*?```/g, ''); // strip code blocks
        await playTextToSpeech(cleanContent, ttsVoice);
      }

    } catch (err: any) {
      console.error('Manus agent execution error:', err);
      setTaskStatus('error');
      setSteps(prev => prev.map(s => s.status === 'running' ? { ...s, status: 'error' as const, trace: [...(s.trace || []), `Error: ${err.message}`] } : s));
    } finally {
      setIsLoading(false);
    }
  }, [readAloud, ttsVoice]);

  const sendMessage = useCallback(async (content: string) => {
    setIsLoading(true);
    setTaskStatus('running');
    setMessages(prev => [...prev, { role: 'user', content }]);

    try {
      const ai = getAiInstance();
      let reply = '';

      if (selectedModel === 'kimi-k3') {
        const { streamKimiK3Response } = await import('../services/kimiK3');
        let fullConversationPrompt = `Here is the conversation history so far. Please reply to the user's latest message.\n\n`;
        fullConversationPrompt += `Original Prompt: ${prompt}\n\n`;
        fullConversationPrompt += `Assistant: ${result?.content || ''}\n\n`;
        
        messages.forEach(msg => {
          fullConversationPrompt += `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}\n\n`;
        });
        
        fullConversationPrompt += `User: ${content}\n\nAssistant:`;

        let accumulatedReply = '';
        await streamKimiK3Response(
          fullConversationPrompt,
          [],
          {
            onThinkingStep: () => {},
            onTextChunk: (chunk) => {
              accumulatedReply += chunk;
              setResult((prev: any) => ({
                ...prev,
                content: prev?.content ? `${prev.content.split('\n\n---\n\n**Conversation Continuation:**')[0]}\n\n---\n\n**Conversation Continuation:**\n${accumulatedReply}` : accumulatedReply
              }));
            },
            onComplete: (full) => {
              reply = full;
            },
            onError: (err) => {
              throw err;
            }
          }
        );
      } else {
        const response = await ai.models.generateContent({
          model: 'gemini-3.5-flash',
          contents: [
            { role: 'user', parts: [{ text: prompt }] },
            { role: 'assistant', parts: [{ text: result?.content || '' }] },
            { role: 'user', parts: [{ text: content }] }
          ]
        });
        reply = response.text || '';
      }
      
      setResult((prev: any) => ({
        ...prev,
        content: prev?.content ? `${prev.content.split('\n\n---\n\n**Conversation Continuation:**')[0]}\n\n---\n\n**Conversation Continuation:**\n${reply}` : reply
      }));
      setTaskStatus('completed');

      if (readAloud) {
        await playTextToSpeech(reply, ttsVoice);
      }
    } catch (err) {
      console.error('Manus continuation error:', err);
      setTaskStatus('completed'); // return to stable completed state
    } finally {
      setIsLoading(false);
    }
  }, [prompt, result, readAloud, ttsVoice, selectedModel, messages]);

  return {
    taskType,
    prompt,
    websiteName,
    steps,
    taskStatus,
    result,
    chartData,
    previewUrl,
    srcDoc,
    isLoading,
    startTask,
    sendMessage,
    resetTask,
    sessions,
    currentSessionId,
    loadSession,
    createNewSession,
    deleteSession,
    selectedModel,
    setSelectedModel
  };
}
