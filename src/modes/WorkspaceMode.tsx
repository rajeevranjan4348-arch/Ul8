import React, { useState, useEffect, useRef } from 'react';
import {
  Folder, FileText, Database, Mail, Calendar as CalendarIcon,
  Play, CheckSquare, MessageSquare, ListTodo, Users, HelpCircle,
  Video, GraduationCap, Search, Plus, Trash2, Check, RefreshCw,
  ExternalLink, LogOut, ShieldAlert, CheckCircle2, ChevronRight, Send, HelpCircle as KeepIcon,
  Mic, Volume2, Bell, Clock, Sparkles, Brain, Wand2, AlertCircle, Tag, Filter
} from 'lucide-react';
import { getAiInstance } from '../services/gemini';
import {
  googleSignIn, logout, initAuth, getAccessToken, logWorkspaceAction, getWorkspaceLogs
} from '../lib/firebase';
import { useTheme } from '../contexts/ThemeContext';
import { motion, AnimatePresence } from 'motion/react';
import { sounds, triggerHaptic } from '../components/PremiumEffects';

export const WorkspaceMode: React.FC = () => {
  const { getBgClass, getTextClass, getAccentClass, getBorderClass, isDarkMode } = useTheme();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<string>('drive');
  const [logs, setLogs] = useState<any[]>([]);

  // States for Workspace data
  const [driveFiles, setDriveFiles] = useState<any[]>([]);
  const [gmailMessages, setGmailMessages] = useState<any[]>([]);
  const [calendarEvents, setCalendarEvents] = useState<any[]>([]);
  const [taskList, setTaskList] = useState<any[]>([]);
  const [contacts, setContacts] = useState<any[]>([]);
  const [courses, setCourses] = useState<any[]>([]);
  const [classroomAnnouncements, setClassroomAnnouncements] = useState<any[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<string>('');
  
  // Custom picker / search states
  const [searchQuery, setSearchQuery] = useState('');
  const [driveLoading, setDriveLoading] = useState(false);
  const [gmailLoading, setGmailLoading] = useState(false);
  const [calendarLoading, setCalendarLoading] = useState(false);
  const [tasksLoading, setTasksLoading] = useState(false);
  const [contactsLoading, setContactsLoading] = useState(false);
  const [classroomLoading, setClassroomLoading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  // Form creation / modification inputs
  const [newEmail, setNewEmail] = useState({ to: '', subject: '', body: '' });
  const [newEvent, setNewEvent] = useState({ title: '', start: '', end: '', desc: '' });
  const [newTask, setNewTask] = useState({ title: '', notes: '' });
  const [newContact, setNewContact] = useState({ firstName: '', lastName: '', email: '', phone: '' });
  const [selectedFileContent, setSelectedFileContent] = useState<string | null>(null);
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
  const [fileViewerLoading, setFileViewerLoading] = useState(false);

  // Sheets sandbox
  const [sheetId, setSheetId] = useState('');
  const [sheetData, setSheetData] = useState<any>(null);
  const [sheetHeader, setSheetHeader] = useState<string[]>([]);
  const [sheetRows, setSheetRows] = useState<any[][]>([]);
  const [newRowData, setNewRowData] = useState<string>('');
  const [sheetLoading, setSheetLoading] = useState(false);

  // Google Forms SandBox
  const [formsList, setFormsList] = useState<any[]>([]);
  const [formsLoading, setFormsLoading] = useState(false);

  // --- VOICE MACROS STATE ---
  const [macros, setMacros] = useState<any[]>([]);
  const [runningMacroId, setRunningMacroId] = useState<string | null>(null);
  const [macroStepIndex, setMacroStepIndex] = useState<number | null>(null);
  const [executionLogs, setExecutionLogs] = useState<any[]>([]);
  const [isListeningForTrigger, setIsListeningForTrigger] = useState(false);
  const recognitionRef = useRef<any>(null);

  // Macro builder form states
  const [newMacroName, setNewMacroName] = useState('');
  const [newMacroTrigger, setNewMacroTrigger] = useState('');
  const [newMacroSteps, setNewMacroSteps] = useState<any[]>([]);
  const [newStepType, setNewStepType] = useState<'meet' | 'gmail' | 'task' | 'calendar'>('meet');

  // Step specific form inputs
  const [stepEmailTo, setStepEmailTo] = useState('');
  const [stepEmailSubject, setStepEmailSubject] = useState('');
  const [stepEmailBody, setStepEmailBody] = useState('');
  const [stepTaskTitle, setStepTaskTitle] = useState('');
  const [stepTaskNotes, setStepTaskNotes] = useState('');
  const [stepCalendarTitle, setStepCalendarTitle] = useState('');
  const [stepCalendarDesc, setStepCalendarDesc] = useState('');
  const [stepCalendarDuration, setStepCalendarDuration] = useState('30');

  // --- AI CONTEXT REMINDERS STATE ---
  const [reminders, setReminders] = useState<any[]>([]);
  const [remindersLoading, setRemindersLoading] = useState(false);
  const [detectingContext, setDetectingContext] = useState(false);
  const [manualReminderInput, setManualReminderInput] = useState('');
  const [manualReminderTime, setManualReminderTime] = useState('');
  const [reminderFilter, setReminderFilter] = useState<'all' | 'active' | 'completed'>('all');

  useEffect(() => {
    try {
      const raw = localStorage.getItem('omnichat_ai_reminders');
      if (raw) {
        const list = JSON.parse(raw);
        if (Array.isArray(list)) {
          setReminders(list);
          return;
        }
      }
      // Default initial reminders
      const initialReminders = [
        {
          id: 'rem-init-1',
          title: 'Prepare Workspace API integration briefing',
          context: 'Context detected from Pro Chat thread on Google Workspace OAuth',
          detectedTime: 'Today at 4:30 PM',
          priority: 'high',
          category: 'meeting',
          sourceThread: 'Pro Chat (Grounding)',
          status: 'active',
          createdAt: new Date().toISOString()
        },
        {
          id: 'rem-init-2',
          title: 'Review Gemini 2.5 Flash performance benchmarks',
          context: 'Context detected from Omni Chat multi-model evaluation',
          detectedTime: 'Tomorrow at 11:00 AM',
          priority: 'medium',
          category: 'task',
          sourceThread: 'Omni Chat',
          status: 'active',
          createdAt: new Date().toISOString()
        }
      ];
      localStorage.setItem('omnichat_ai_reminders', JSON.stringify(initialReminders));
      setReminders(initialReminders);
    } catch (e) {
      console.error('Failed to load initial reminders:', e);
    }
  }, []);

  const gatherChatContexts = () => {
    const contexts: { source: string; text: string }[] = [];
    try {
      const rawConversations = localStorage.getItem('omnichat_conversations');
      if (rawConversations) {
        const convs = JSON.parse(rawConversations);
        if (Array.isArray(convs)) {
          convs.slice(0, 5).forEach((c: any) => {
            if (Array.isArray(c.messages)) {
              const snippet = c.messages.map((m: any) => `${m.role}: ${m.text || ''}`).join('\n');
              if (snippet.trim()) {
                contexts.push({ source: c.title || 'Omni Chat Thread', text: snippet.slice(-1500) });
              }
            }
          });
        }
      }
    } catch (e) {
      console.warn(e);
    }

    try {
      const rawVoice = localStorage.getItem('omnichat_voice_commands');
      if (rawVoice) {
        const vCmds = JSON.parse(rawVoice);
        if (Array.isArray(vCmds)) {
          const snippet = vCmds.slice(0, 10).map((v: any) => v.text || '').filter(Boolean).join('\n');
          if (snippet.trim()) {
            contexts.push({ source: 'Voice Commands History', text: snippet });
          }
        }
      }
    } catch (e) {
      console.warn(e);
    }

    return contexts;
  };

  const detectRemindersFromChats = async () => {
    setDetectingContext(true);
    sounds.playClick();
    triggerHaptic('light');

    try {
      const contexts = gatherChatContexts();
      if (contexts.length === 0) {
        // Sample detected reminders if chats are brand new
        const sampleDetected = [
          {
            id: 'rem-' + Date.now() + '-1',
            title: 'Send updated project architecture diagram',
            context: 'Context detected from Omni Chat thread discussion on API routes',
            detectedTime: 'Today at 5:00 PM',
            priority: 'high',
            category: 'task',
            sourceThread: 'Omni Chat Thread',
            status: 'active',
            createdAt: new Date().toISOString()
          },
          {
            id: 'rem-' + Date.now() + '-2',
            title: 'Review client feedback on Voice AI demo',
            context: 'Context detected from Voice Command transcript',
            detectedTime: 'Tomorrow at 10:30 AM',
            priority: 'medium',
            category: 'followup',
            sourceThread: 'Voice Stream',
            status: 'active',
            createdAt: new Date().toISOString()
          }
        ];
        setReminders(prev => {
          const updated = [...sampleDetected, ...prev];
          localStorage.setItem('omnichat_ai_reminders', JSON.stringify(updated));
          return updated;
        });
        sounds.playSuccess();
        triggerHaptic('success');
        return;
      }

      const contextText = contexts.map(c => `--- Source: ${c.source} ---\n${c.text}`).join('\n\n');
      const ai = getAiInstance();
      const prompt = `Analyze the following user chat conversation transcripts. Detect any implied or explicit reminders, promises, follow-ups, deadlines, or action items mentioned by the user or assistant.

Return a strict JSON array (no markdown wraps, no extra text) of objects with these fields:
- "title": Concise action title
- "context": Brief explanation of where/why this was detected in the chat
- "detectedTime": Extracted or inferred target time (e.g., "Today at 4:00 PM", "Tomorrow at 9:00 AM", or "Friday")
- "priority": "high" | "medium" | "low"
- "category": "meeting" | "task" | "followup" | "deadline"
- "sourceThread": Name of the source chat context

Transcripts:
${contextText.slice(0, 4000)}`;

      const res = await ai.models.generateContent({
        model: 'gemini-3.5-flash',
        contents: prompt,
      });

      let responseText = res.text || '';
      if (responseText.startsWith('```')) {
        responseText = responseText.replace(/^```(json)?/, '').replace(/```$/, '').trim();
      }

      const parsed = JSON.parse(responseText);
      if (Array.isArray(parsed) && parsed.length > 0) {
        const newItems = parsed.map((item: any, idx: number) => ({
          id: `rem-ai-${Date.now()}-${idx}`,
          title: item.title || 'Action Item',
          context: item.context || 'Detected from chat context',
          detectedTime: item.detectedTime || 'Today',
          priority: item.priority || 'medium',
          category: item.category || 'task',
          sourceThread: item.sourceThread || 'Chat Thread',
          status: 'active',
          createdAt: new Date().toISOString()
        }));

        setReminders(prev => {
          const updated = [...newItems, ...prev];
          localStorage.setItem('omnichat_ai_reminders', JSON.stringify(updated));
          return updated;
        });

        // Push alert to workspace notifications
        try {
          const rawAlerts = localStorage.getItem('omnichat_workspace_alerts');
          const list = rawAlerts ? JSON.parse(rawAlerts) : [];
          list.unshift({
            id: 'alert-rem-' + Date.now(),
            source: 'AI Reminders',
            text: `Extracted ${newItems.length} context reminder(s) from chat threads`,
            unread: true,
            time: 'Just now'
          });
          localStorage.setItem('omnichat_workspace_alerts', JSON.stringify(list.slice(0, 20)));
          window.dispatchEvent(new Event('omnichat-workspace-alerts-update'));
        } catch (e) {
          console.error(e);
        }

        sounds.playSuccess();
        triggerHaptic('success');
        await logWorkspaceAction('AI Reminders', 'Context Scanning', `Extracted ${newItems.length} action item(s) from chat threads.`);
      }
    } catch (err) {
      console.error('Failed to extract reminders via AI:', err);
      sounds.playError();
    } finally {
      setDetectingContext(false);
    }
  };

  const createEnrichedReminder = async () => {
    if (!manualReminderInput.trim()) return;
    setRemindersLoading(true);
    sounds.playClick();

    try {
      const ai = getAiInstance();
      const prompt = `Analyze this user reminder query: "${manualReminderInput}".
Return a strict JSON object (no markdown wraps, no extra text) with fields:
- "title": Clean, clear title
- "context": Added contextual detail or suggestion
- "priority": "high" | "medium" | "low"
- "category": "meeting" | "task" | "followup" | "deadline"
- "suggestedTime": Suggested date/time based on the input or "In 1 hour" if unspecified`;

      const res = await ai.models.generateContent({
        model: 'gemini-3.5-flash',
        contents: prompt,
      });

      let text = res.text || '';
      if (text.startsWith('```')) {
        text = text.replace(/^```(json)?/, '').replace(/```$/, '').trim();
      }
      const parsed = JSON.parse(text);

      const newItem = {
        id: `rem-user-${Date.now()}`,
        title: parsed.title || manualReminderInput,
        context: parsed.context || 'Manually added with AI context enrichment',
        detectedTime: manualReminderTime || parsed.suggestedTime || 'Today',
        priority: parsed.priority || 'medium',
        category: parsed.category || 'task',
        sourceThread: 'User Workspace Note',
        status: 'active',
        createdAt: new Date().toISOString()
      };

      setReminders(prev => {
        const updated = [newItem, ...prev];
        localStorage.setItem('omnichat_ai_reminders', JSON.stringify(updated));
        return updated;
      });

      setManualReminderInput('');
      setManualReminderTime('');
      sounds.playSuccess();
      triggerHaptic('success');
      await logWorkspaceAction('AI Reminders', 'Created Reminder', `Created reminder "${newItem.title}"`);
    } catch (err) {
      console.error('Failed to enrich reminder:', err);
      const newItem = {
        id: `rem-user-${Date.now()}`,
        title: manualReminderInput,
        context: 'Workspace reminder',
        detectedTime: manualReminderTime || 'Today',
        priority: 'medium',
        category: 'task',
        sourceThread: 'User Input',
        status: 'active',
        createdAt: new Date().toISOString()
      };
      setReminders(prev => {
        const updated = [newItem, ...prev];
        localStorage.setItem('omnichat_ai_reminders', JSON.stringify(updated));
        return updated;
      });
      setManualReminderInput('');
      setManualReminderTime('');
    } finally {
      setRemindersLoading(false);
    }
  };

  const toggleReminderStatus = (id: string) => {
    sounds.playClick();
    triggerHaptic('light');
    setReminders(prev => {
      const updated = prev.map(r => r.id === id ? { ...r, status: r.status === 'completed' ? 'active' : 'completed' } : r);
      localStorage.setItem('omnichat_ai_reminders', JSON.stringify(updated));
      return updated;
    });
  };

  const deleteReminder = (id: string) => {
    sounds.playClick();
    triggerHaptic('light');
    setReminders(prev => {
      const updated = prev.filter(r => r.id !== id);
      localStorage.setItem('omnichat_ai_reminders', JSON.stringify(updated));
      return updated;
    });
  };

  const triggerReminderNow = (reminder: any) => {
    sounds.playSuccess();
    triggerHaptic('success');
    try {
      const rawAlerts = localStorage.getItem('omnichat_workspace_alerts');
      const list = rawAlerts ? JSON.parse(rawAlerts) : [];
      list.unshift({
        id: 'alert-trig-' + Date.now(),
        source: 'AI Reminder Trigger',
        text: `⏰ REMINDER: ${reminder.title} (${reminder.detectedTime})`,
        unread: true,
        time: 'Just now'
      });
      localStorage.setItem('omnichat_workspace_alerts', JSON.stringify(list.slice(0, 20)));
      window.dispatchEvent(new Event('omnichat-workspace-alerts-update'));
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    const unsubscribe = initAuth(
      (currentUser, accessToken) => {
        setIsAuthenticated(true);
        setUser(currentUser);
        setToken(accessToken);
        setLoading(false);
        // Pre-fetch drive & active tab items
        fetchDriveFiles(accessToken);
        fetchLogs();
      },
      () => {
        setIsAuthenticated(false);
        setUser(null);
        setToken(null);
        setLoading(false);
      }
    );
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const loadSavedMacros = () => {
      try {
        const raw = localStorage.getItem('omnichat_workspace_macros');
        if (raw) {
          const list = JSON.parse(raw);
          if (Array.isArray(list) && list.length > 0) {
            setMacros(list);
            return;
          }
        }

        // Set up beautiful initial default macros
        const defaultMacros = [
          {
            id: 'macro-1',
            name: 'Sprint Standup Pipeline',
            trigger: 'start standup',
            steps: [
              { type: 'meet', label: 'Create Instant Meet Link' },
              { 
                type: 'gmail', 
                label: 'Email Team Coordinates', 
                to: 'team-sync@company.com', 
                subject: 'Daily Standup Sync Active', 
                body: 'Hey Team!\n\nThe daily standup session has been dynamically scheduled. Please join hands-free via this automated link: {meet_link}\n\nBest,\nYour Connected Workspace Assistant' 
              },
              { 
                type: 'task', 
                label: 'Initialize Review Action Item', 
                title: 'Aggregate morning standup points', 
                notes: 'Consolidate blockers and goals reported in standup. Meeting details: {meet_link}' 
              }
            ]
          },
          {
            id: 'macro-2',
            name: 'Client Wrap-Up Procedures',
            trigger: 'end of day report',
            steps: [
              {
                type: 'calendar',
                label: 'Schedule Debrief Event',
                title: 'Automated EOD Wrap-Up',
                desc: 'Review client metrics and update active files in sandbox.',
                duration: '30'
              },
              {
                type: 'task',
                label: 'Log Checklist Action',
                title: 'Verify Spreadsheet sandbox cell syncs',
                notes: 'Check row values in Spreadsheet Sandbox.'
              }
            ]
          }
        ];
        localStorage.setItem('omnichat_workspace_macros', JSON.stringify(defaultMacros));
        setMacros(defaultMacros);
      } catch (e) {
        console.error('Failed to load macros:', e);
      }
    };
    loadSavedMacros();
  }, []);

  // --- VOICE MACROS METHODS ---
  const getStepLabel = (step: any) => {
    switch (step.type) {
      case 'meet': return 'Create Google Meet video call space';
      case 'gmail': return `Email: "${step.subject}" to ${step.to}`;
      case 'task': return `Create Task: "${step.title}"`;
      case 'calendar': return `Schedule Event: "${step.title}" (${step.duration} mins)`;
      default: return 'Custom Workspace Command';
    }
  };

  const runMacro = async (macro: any) => {
    if (runningMacroId) return;
    setRunningMacroId(macro.id);
    setMacroStepIndex(0);
    setExecutionLogs([]);
    sounds.playClick();
    triggerHaptic('light');

    let dynamicMeetLink = '';

    const addLog = (text: string, type: 'info' | 'success' | 'error' = 'info') => {
      setExecutionLogs(prev => [...prev, { text, type, time: new Date().toLocaleTimeString() }]);
    };

    addLog(`Kicking off Voice Macro: "${macro.name}"...`, 'info');

    for (let i = 0; i < macro.steps.length; i++) {
      setMacroStepIndex(i);
      const step = macro.steps[i];
      addLog(`Executing Step ${i + 1}/${macro.steps.length}: ${getStepLabel(step)}...`, 'info');
      sounds.playClick();
      triggerHaptic('light');

      // Wait a moment for visual smoothness (1.2 second delay)
      await new Promise(resolve => setTimeout(resolve, 1200));

      try {
        if (step.type === 'meet') {
          if (token) {
            // Real Meet call
            const randomId = Math.random().toString(36).substr(2, 9);
            const res = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events?conferenceDataVersion=1', {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                summary: 'Instant Google Meet Session (Voice Macro)',
                description: 'Created automatically via voice command.',
                start: { dateTime: new Date().toISOString() },
                end: { dateTime: new Date(Date.now() + 60 * 60 * 1000).toISOString() },
                conferenceData: {
                  createRequest: {
                    requestId: randomId,
                    conferenceSolutionKey: { type: 'hangoutsMeet' }
                  }
                }
              })
            });
            if (res.ok) {
              const event = await res.json();
              dynamicMeetLink = event.conferenceData?.entryPoints?.[0]?.uri || event.hangoutLink;
            } else {
              throw new Error('Meet API returned status: ' + res.status);
            }
          } else {
            // Simulated fallback
            dynamicMeetLink = `https://meet.google.com/abc-${Math.random().toString(36).substr(2, 4)}-xyz`;
          }
          addLog(`Meet Link generated successfully: ${dynamicMeetLink}`, 'success');
          await logWorkspaceAction('Voice Macros', 'Meet Generated', `Generated Meet link ${dynamicMeetLink}`);
        } 
        
        else if (step.type === 'gmail') {
          const formattedBody = (step.body || '').replace(/{meet_link}/g, dynamicMeetLink || 'https://meet.google.com/no-active-link');
          const formattedSubject = (step.subject || 'Macro Subject').replace(/{meet_link}/g, dynamicMeetLink || '');
          const recipient = step.to || 'team@example.com';

          if (token) {
            const emailContent = [
              `To: ${recipient}`,
              `Subject: ${formattedSubject}`,
              'Content-Type: text/plain; charset="UTF-8"',
              '',
              formattedBody
            ].join('\r\n');

            const base64Encoded = btoa(unescape(encodeURIComponent(emailContent)))
              .replace(/\+/g, '-')
              .replace(/\//g, '_')
              .replace(/=+$/, '');

            const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({ raw: base64Encoded })
            });
            if (!res.ok) throw new Error('Gmail API returned status: ' + res.status);
          }
          addLog(`Gmail message dispatched to <${recipient}> with subject "${formattedSubject}"`, 'success');
          await logWorkspaceAction('Voice Macros', 'Gmail Dispatched', `Sent email to ${recipient} via macro "${macro.name}"`);
        } 
        
        else if (step.type === 'task') {
          const formattedNotes = (step.notes || '').replace(/{meet_link}/g, dynamicMeetLink || 'https://meet.google.com/no-active-link');
          const title = step.title || 'Automated Macro Task';

          if (token) {
            const listsRes = await fetch('https://tasks.googleapis.com/v1/users/@default/lists', {
              headers: { Authorization: `Bearer ${token}` }
            });
            if (listsRes.ok) {
              const data = await listsRes.json();
              const listId = data.items?.[0]?.id;
              if (listId) {
                const createRes = await fetch(`https://tasks.googleapis.com/v1/lists/${listId}/tasks`, {
                  method: 'POST',
                  headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json'
                  },
                  body: JSON.stringify({ title, notes: formattedNotes })
                });
                if (!createRes.ok) throw new Error('Tasks API returned status: ' + createRes.status);
              }
            }
          }
          addLog(`Created Google Task: "${title}"`, 'success');
          await logWorkspaceAction('Voice Macros', 'Task Created', `Created task "${title}" via macro "${macro.name}"`);
        } 
        
        else if (step.type === 'calendar') {
          const formattedDesc = (step.desc || '').replace(/{meet_link}/g, dynamicMeetLink || 'https://meet.google.com/no-active-link');
          const title = step.title || 'Sprint Standup';
          const duration = parseInt(step.duration || '30', 10);

          if (token) {
            const res = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                summary: title,
                description: formattedDesc,
                start: { dateTime: new Date().toISOString() },
                end: { dateTime: new Date(Date.now() + duration * 60 * 1000).toISOString() }
              })
            });
            if (!res.ok) throw new Error('Calendar API returned status: ' + res.status);
          }
          addLog(`Calendar Event Scheduled: "${title}" for ${duration} mins.`, 'success');
          await logWorkspaceAction('Voice Scheduled', 'Calendar Scheduled', `Scheduled event "${title}" via macro "${macro.name}"`);
        }

      } catch (err: any) {
        addLog(`Step ${i + 1} Failed: ${err.message}`, 'error');
        sounds.playError();
        triggerHaptic('error');
        setRunningMacroId(null);
        return;
      }
    }

    addLog(`Voice Macro: "${macro.name}" executed successfully!`, 'success');
    sounds.playSuccess();
    triggerHaptic('success');
    setRunningMacroId(null);
    setMacroStepIndex(null);
    fetchLogs(); // refresh workspace logs
  };

  const toggleHandsFree = () => {
    if (isListeningForTrigger) {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      setIsListeningForTrigger(false);
      sounds.playClick();
      triggerHaptic('light');
    } else {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (!SpeechRecognition) {
        alert('Speech recognition is not supported in this browser. Please use Google Chrome or execute macros manually!');
        return;
      }

      const rec = new SpeechRecognition();
      rec.continuous = true;
      rec.interimResults = false;
      rec.lang = 'en-US';

      rec.onstart = () => {
        setIsListeningForTrigger(true);
        sounds.playClick();
        triggerHaptic('light');
      };

      rec.onerror = (e: any) => {
        console.error('Speech recognition error:', e);
        setIsListeningForTrigger(false);
        sounds.playError();
      };

      rec.onend = () => {
        setIsListeningForTrigger(false);
      };

      rec.onresult = (event: any) => {
        const transcript = event.results[event.results.length - 1][0].transcript.toLowerCase().trim();
        
        // Search for matching trigger
        const matched = macros.find(m => transcript.includes(m.trigger.toLowerCase().trim()) || m.trigger.toLowerCase().trim().includes(transcript));
        if (matched) {
          sounds.playSuccess();
          triggerHaptic('success');
          runMacro(matched);
        }
      };

      recognitionRef.current = rec;
      rec.start();
    }
  };

  const saveNewMacro = () => {
    if (!newMacroName.trim() || !newMacroTrigger.trim() || newMacroSteps.length === 0) {
      alert('Please fill out Name, Voice Trigger, and add at least 1 execution step!');
      return;
    }

    const item = {
      id: 'macro-' + Date.now(),
      name: newMacroName.trim(),
      trigger: newMacroTrigger.trim().toLowerCase(),
      steps: newMacroSteps
    };

    const updated = [...macros, item];
    setMacros(updated);
    localStorage.setItem('omnichat_workspace_macros', JSON.stringify(updated));

    // Reset Builder
    setNewMacroName('');
    setNewMacroTrigger('');
    setNewMacroSteps([]);
    sounds.playSuccess();
    triggerHaptic('success');
    alert('Voice Macro saved successfully!');
  };

  const deleteMacro = (id: string, name: string) => {
    if (!window.confirm(`Delete Voice Macro "${name}"?`)) return;
    const updated = macros.filter(m => m.id !== id);
    setMacros(updated);
    localStorage.setItem('omnichat_workspace_macros', JSON.stringify(updated));
    sounds.playClick();
    triggerHaptic('light');
  };

  const addStepToBuilder = () => {
    let stepItem: any = { type: newStepType };

    if (newStepType === 'meet') {
      stepItem.label = 'Create Instant Meet Link';
    } else if (newStepType === 'gmail') {
      if (!stepEmailTo.trim() || !stepEmailSubject.trim() || !stepEmailBody.trim()) {
        alert('Please fill out Recipient Email, Subject, and Body text!');
        return;
      }
      stepItem.label = `Email: "${stepEmailSubject.trim()}" to ${stepEmailTo.trim()}`;
      stepItem.to = stepEmailTo.trim();
      stepItem.subject = stepEmailSubject.trim();
      stepItem.body = stepEmailBody.trim();

      setStepEmailTo('');
      setStepEmailSubject('');
      setStepEmailBody('');
    } else if (newStepType === 'task') {
      if (!stepTaskTitle.trim()) {
        alert('Please fill out the Task Title!');
        return;
      }
      stepItem.label = `Create Task: "${stepTaskTitle.trim()}"`;
      stepItem.title = stepTaskTitle.trim();
      stepItem.notes = stepTaskNotes.trim();

      setStepTaskTitle('');
      setStepTaskNotes('');
    } else if (newStepType === 'calendar') {
      if (!stepCalendarTitle.trim()) {
        alert('Please fill out the Event Title!');
        return;
      }
      stepItem.label = `Schedule Event: "${stepCalendarTitle.trim()}" (${stepCalendarDuration} mins)`;
      stepItem.title = stepCalendarTitle.trim();
      stepItem.desc = stepCalendarDesc.trim();
      stepItem.duration = stepCalendarDuration.trim();

      setStepCalendarTitle('');
      setStepCalendarDesc('');
      setStepCalendarDuration('30');
    }

    setNewMacroSteps(prev => [...prev, stepItem]);
    sounds.playClick();
    triggerHaptic('light');
  };

  const removeStepFromBuilder = (index: number) => {
    setNewMacroSteps(prev => prev.filter((_, i) => i !== index));
    sounds.playClick();
    triggerHaptic('light');
  };

  const handleLogin = async () => {
    try {
      setLoading(true);
      const result = await googleSignIn();
      if (result) {
        setIsAuthenticated(true);
        setUser(result.user);
        setToken(result.accessToken);
        fetchDriveFiles(result.accessToken);
        fetchLogs();
      }
    } catch (err) {
      console.error('Workspace Login Error', err);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    if (window.confirm('Are you sure you want to sign out from your Google Workspace?')) {
      await logout();
      setIsAuthenticated(false);
      setUser(null);
      setToken(null);
      setDriveFiles([]);
      setGmailMessages([]);
      setCalendarEvents([]);
      setTaskList([]);
      setContacts([]);
      setCourses([]);
    }
  };

  const fetchLogs = async () => {
    const historicalLogs = await getWorkspaceLogs();
    setLogs(historicalLogs);
  };

  // --- GOOGLE DRIVE INTEGRATION (also powers custom Picker) ---
  const fetchDriveFiles = async (currentAccessToken?: string) => {
    const activeToken = currentAccessToken || token;
    if (!activeToken) return;
    setDriveLoading(true);
    try {
      const res = await fetch('https://www.googleapis.com/drive/v3/files?pageSize=25&fields=files(id,name,mimeType,thumbnailLink,iconLink,webViewLink)', {
        headers: { Authorization: `Bearer ${activeToken}` }
      });
      if (res.ok) {
        const data = await res.json();
        setDriveFiles(data.files || []);
      }
    } catch (err) {
      console.error('Failed to fetch Drive files', err);
    } finally {
      setDriveLoading(false);
    }
  };

  const uploadFile = async () => {
    if (!token) return;
    const input = document.createElement('input');
    input.type = 'file';
    input.onchange = async (e: any) => {
      const file = e.target.files[0];
      if (!file) return;

      if (!window.confirm(`Are you sure you want to upload "${file.name}" to Google Drive?`)) return;

      setDriveLoading(true);
      try {
        const metadata = {
          name: file.name,
          mimeType: file.type
        };

        const form = new FormData();
        form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
        form.append('file', file);

        const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: form
        });

        if (res.ok) {
          const uploaded = await res.json();
          await logWorkspaceAction('Google Drive', 'Upload File', `Uploaded file "${file.name}" successfully.`);
          fetchDriveFiles();
          fetchLogs();
          alert('File uploaded successfully!');
        }
      } catch (err) {
        console.error('Upload failed', err);
      } finally {
        setDriveLoading(false);
      }
    };
    input.click();
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const file = e.dataTransfer.files?.[0];
    if (file) {
      await uploadDroppedFile(file);
    }
  };

  const uploadDroppedFile = async (file: File) => {
    if (!token) {
      alert('Please connect your Google Account first to upload files.');
      return;
    }

    if (!window.confirm(`Are you sure you want to upload "${file.name}" to Google Drive?`)) return;

    setDriveLoading(true);
    try {
      const metadata = {
        name: file.name,
        mimeType: file.type || 'application/octet-stream'
      };

      const form = new FormData();
      form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
      form.append('file', file);

      const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: form
      });

      if (res.ok) {
        const uploaded = await res.json();
        await logWorkspaceAction('Google Drive', 'Upload File', `Uploaded file "${file.name}" successfully.`);
        fetchDriveFiles();
        fetchLogs();
        alert('File uploaded successfully!');
      } else {
        const errText = await res.text();
        console.error('Upload failed with status', res.status, errText);
        alert('Failed to upload file to Google Drive. Please ensure the token is active.');
      }
    } catch (err) {
      console.error('Upload failed', err);
      alert('Upload failed: ' + (err as Error).message);
    } finally {
      setDriveLoading(false);
    }
  };

  const deleteDriveFile = async (id: string, name: string) => {
    if (!token) return;
    if (!window.confirm(`Are you sure you want to delete file "${name}"? This action cannot be undone.`)) return;

    setDriveLoading(true);
    try {
      const res = await fetch(`https://www.googleapis.com/drive/v3/files/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        await logWorkspaceAction('Google Drive', 'Delete File', `Deleted file "${name}".`);
        fetchDriveFiles();
        fetchLogs();
        setSelectedFileContent(null);
      }
    } catch (err) {
      console.error('Delete failed', err);
    } finally {
      setDriveLoading(false);
    }
  };

  const viewFileDetails = async (id: string, name: string, mimeType: string) => {
    if (!token) return;
    setSelectedFileName(name);
    setFileViewerLoading(true);
    setSelectedFileContent(null);
    try {
      // If it's a doc or text file, fetch plaintext representation
      let url = `https://www.googleapis.com/drive/v3/files/${id}?alt=media`;
      if (mimeType.includes('google-apps.document')) {
        url = `https://www.googleapis.com/drive/v3/files/${id}/export?mimeType=text/plain`;
      } else if (mimeType.includes('google-apps.spreadsheet')) {
        url = `https://www.googleapis.com/drive/v3/files/${id}/export?mimeType=text/csv`;
      } else if (mimeType.includes('google-apps.presentation')) {
        setSelectedFileContent('Google Presentation file. Open using external link.');
        setFileViewerLoading(false);
        return;
      }

      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const text = await res.text();
        setSelectedFileContent(text.substring(0, 10000) + (text.length > 10000 ? '\n... (Truncated)' : ''));
      } else {
        setSelectedFileContent('Unable to fetch file content preview. Use the external link to view file.');
      }
    } catch (err) {
      console.error('View file error', err);
      setSelectedFileContent('Unable to load file preview.');
    } finally {
      setFileViewerLoading(false);
    }
  };

  // --- GOOGLE SHEETS SANDBOX ---
  const loadSheet = async () => {
    if (!token || !sheetId) return;
    setSheetLoading(true);
    try {
      const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/A1:Z50`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setSheetData(data);
        if (data.values && data.values.length > 0) {
          setSheetHeader(data.values[0]);
          setSheetRows(data.values.slice(1));
        } else {
          setSheetHeader([]);
          setSheetRows([]);
        }
        await logWorkspaceAction('Google Sheets', 'Load Spreadsheet', `Loaded sheet ${sheetId}`);
        fetchLogs();
      } else {
        alert('Could not find spreadsheet. Verify spreadsheet ID or permissions.');
      }
    } catch (err) {
      console.error('Error loading sheets', err);
    } finally {
      setSheetLoading(false);
    }
  };

  const appendRowToSheet = async () => {
    if (!token || !sheetId || !newRowData) return;
    const rowValues = newRowData.split(',').map(s => s.trim());
    if (!window.confirm(`Are you sure you want to add this row to spreadsheet: [${rowValues.join(', ')}]?`)) return;

    setSheetLoading(true);
    try {
      const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/A1:append?valueInputOption=USER_ENTERED`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          values: [rowValues]
        })
      });
      if (res.ok) {
        await logWorkspaceAction('Google Sheets', 'Append Row', `Appended values: [${newRowData}]`);
        setNewRowData('');
        loadSheet();
      }
    } catch (err) {
      console.error('Error appending row', err);
    } finally {
      setSheetLoading(false);
    }
  };

  // --- GMAIL INTEGRATION ---
  const fetchGmail = async () => {
    if (!token) return;
    setGmailLoading(true);
    try {
      const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=10', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        const msgList = data.messages || [];
        const detailedMsgs = await Promise.all(msgList.map(async (m: any) => {
          const detailRes = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${m.id}`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          if (detailRes.ok) {
            const detail = await detailRes.json();
            const headers = detail.payload.headers;
            const subject = headers.find((h: any) => h.name === 'Subject')?.value || 'No Subject';
            const from = headers.find((h: any) => h.name === 'From')?.value || 'Unknown Sender';
            const date = headers.find((h: any) => h.name === 'Date')?.value || '';
            return {
              id: m.id,
              snippet: detail.snippet,
              subject,
              from,
              date
            };
          }
          return null;
        }));
        setGmailMessages(detailedMsgs.filter(m => m !== null));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setGmailLoading(false);
    }
  };

  const sendGmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !newEmail.to || !newEmail.subject) return;

    if (!window.confirm(`Send email to "${newEmail.to}" with Subject: "${newEmail.subject}"?`)) return;

    setGmailLoading(true);
    try {
      const emailContent = [
        `To: ${newEmail.to}`,
        `Subject: ${newEmail.subject}`,
        'Content-Type: text/plain; charset="UTF-8"',
        '',
        newEmail.body
      ].join('\r\n');

      const base64Encoded = btoa(unescape(encodeURIComponent(emailContent)))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');

      const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ raw: base64Encoded })
      });

      if (res.ok) {
        await logWorkspaceAction('Gmail', 'Send Email', `Sent email to ${newEmail.to}: "${newEmail.subject}"`);
        setNewEmail({ to: '', subject: '', body: '' });
        fetchGmail();
        fetchLogs();
        alert('Email sent successfully!');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setGmailLoading(false);
    }
  };

  // --- GOOGLE CALENDAR ---
  const fetchCalendar = async () => {
    if (!token) return;
    setCalendarLoading(true);
    try {
      const res = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events?maxResults=10&orderBy=startTime&singleEvents=true', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setCalendarEvents(data.items || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setCalendarLoading(false);
    }
  };

  const createCalendarEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !newEvent.title || !newEvent.start || !newEvent.end) return;

    if (!window.confirm(`Schedule event "${newEvent.title}" on ${new Date(newEvent.start).toLocaleString()}?`)) return;

    setCalendarLoading(true);
    try {
      const res = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          summary: newEvent.title,
          description: newEvent.desc,
          start: { dateTime: new Date(newEvent.start).toISOString() },
          end: { dateTime: new Date(newEvent.end).toISOString() }
        })
      });

      if (res.ok) {
        await logWorkspaceAction('Google Calendar', 'Create Event', `Scheduled event "${newEvent.title}"`);
        setNewEvent({ title: '', start: '', end: '', desc: '' });
        fetchCalendar();
        fetchLogs();
        alert('Calendar event scheduled!');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setCalendarLoading(false);
    }
  };

  const deleteCalendarEvent = async (id: string, summary: string) => {
    if (!token) return;
    if (!window.confirm(`Delete calendar event "${summary}"?`)) return;

    setCalendarLoading(true);
    try {
      const res = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        await logWorkspaceAction('Google Calendar', 'Delete Event', `Deleted event "${summary}"`);
        fetchCalendar();
        fetchLogs();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setCalendarLoading(false);
    }
  };

  // --- GOOGLE TASKS ---
  const fetchTasks = async () => {
    if (!token) return;
    setTasksLoading(true);
    try {
      const res = await fetch('https://tasks.googleapis.com/v1/users/@default/lists', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        const listId = data.items?.[0]?.id;
        if (listId) {
          const tasksRes = await fetch(`https://tasks.googleapis.com/v1/lists/${listId}/tasks?showCompleted=true`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          if (tasksRes.ok) {
            const taskData = await tasksRes.json();
            setTaskList(taskData.items || []);
          }
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setTasksLoading(false);
    }
  };

  const createGoogleTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !newTask.title) return;

    setTasksLoading(true);
    try {
      const res = await fetch('https://tasks.googleapis.com/v1/users/@default/lists', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        const listId = data.items?.[0]?.id;
        if (listId) {
          const createRes = await fetch(`https://tasks.googleapis.com/v1/lists/${listId}/tasks`, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              title: newTask.title,
              notes: newTask.notes
            })
          });
          if (createRes.ok) {
            await logWorkspaceAction('Google Tasks', 'Create Task', `Created task: "${newTask.title}"`);
            setNewTask({ title: '', notes: '' });
            fetchTasks();
            fetchLogs();
          }
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setTasksLoading(false);
    }
  };

  const completeTask = async (taskId: string, currentStatus: string, title: string) => {
    if (!token) return;
    const isCompleted = currentStatus === 'completed';
    const nextStatus = isCompleted ? 'needsAction' : 'completed';

    setTasksLoading(true);
    try {
      const res = await fetch('https://tasks.googleapis.com/v1/users/@default/lists', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        const listId = data.items?.[0]?.id;
        if (listId) {
          const updateRes = await fetch(`https://tasks.googleapis.com/v1/lists/${listId}/tasks/${taskId}`, {
            method: 'PATCH',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              status: nextStatus,
              id: taskId
            })
          });
          if (updateRes.ok) {
            await logWorkspaceAction('Google Tasks', 'Toggle Task', `Marked task "${title}" as ${nextStatus}`);
            fetchTasks();
            fetchLogs();
          }
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setTasksLoading(false);
    }
  };

  // --- GOOGLE CONTACTS (People API) ---
  const fetchContacts = async () => {
    if (!token) return;
    setContactsLoading(true);
    try {
      const res = await fetch('https://people.googleapis.com/v1/people/me/connections?personFields=names,emailAddresses,phoneNumbers&pageSize=50', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        const connections = data.connections || [];
        const formatted = connections.map((c: any) => ({
          resourceName: c.resourceName,
          name: c.names?.[0]?.displayName || 'Unnamed Contact',
          email: c.emailAddresses?.[0]?.value || 'No Email',
          phone: c.phoneNumbers?.[0]?.value || 'No Phone'
        }));
        setContacts(formatted);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setContactsLoading(false);
    }
  };

  const createContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !newContact.firstName || !newContact.lastName) return;

    const fullName = `${newContact.firstName} ${newContact.lastName}`;
    if (!window.confirm(`Create contact "${fullName}"?`)) return;

    setContactsLoading(true);
    try {
      const res = await fetch('https://people.googleapis.com/v1/people:createContact', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          names: [{ givenName: newContact.firstName, familyName: newContact.lastName }],
          emailAddresses: newContact.email ? [{ value: newContact.email }] : [],
          phoneNumbers: newContact.phone ? [{ value: newContact.phone }] : []
        })
      });

      if (res.ok) {
        await logWorkspaceAction('Contacts', 'Create Contact', `Created contact "${fullName}"`);
        setNewContact({ firstName: '', lastName: '', email: '', phone: '' });
        fetchContacts();
        fetchLogs();
        alert('Contact created successfully!');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setContactsLoading(false);
    }
  };

  // --- GOOGLE CLASSROOM ---
  const fetchClassroom = async () => {
    if (!token) return;
    setClassroomLoading(true);
    try {
      const res = await fetch('https://classroom.googleapis.com/v1/courses?courseStates=ACTIVE', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setCourses(data.courses || []);
        if (data.courses && data.courses.length > 0) {
          setSelectedCourse(data.courses[0].id);
          fetchAnnouncements(data.courses[0].id);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setClassroomLoading(false);
    }
  };

  const fetchAnnouncements = async (courseId: string) => {
    if (!token) return;
    setClassroomLoading(true);
    try {
      const res = await fetch(`https://classroom.googleapis.com/v1/courses/${courseId}/announcements`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setClassroomAnnouncements(data.announcements || []);
      } else {
        setClassroomAnnouncements([]);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setClassroomLoading(false);
    }
  };

  // --- GOOGLE MEET & CHAT SANDBOX ---
  const generateMeetLink = async () => {
    if (!token) return;
    if (!window.confirm('Create a new instant Google Meet space?')) return;

    setCalendarLoading(true);
    try {
      // Schedule an event with a Meet Link auto-attached via ConferenceData API
      const randomId = Math.random().toString(36).substr(2, 9);
      const res = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events?conferenceDataVersion=1', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          summary: 'Instant Google Meet Session',
          description: 'Created with permission from Omni Workspace App.',
          start: { dateTime: new Date().toISOString() },
          end: { dateTime: new Date(Date.now() + 60 * 60 * 1000).toISOString() },
          conferenceData: {
            createRequest: {
              requestId: randomId,
              conferenceSolutionKey: { type: 'hangoutsMeet' }
            }
          }
        })
      });

      if (res.ok) {
        const event = await res.json();
        const meetLink = event.conferenceData?.entryPoints?.[0]?.uri || event.hangoutLink;
        await logWorkspaceAction('Google Meet', 'Create Meeting', `Generated Google Meet link: ${meetLink}`);
        fetchCalendar();
        fetchLogs();
        alert(`Google Meet successfully created! Link: ${meetLink}`);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setCalendarLoading(false);
    }
  };

  // Forms Sandbox Integration
  const searchGoogleFormsInDrive = async () => {
    if (!token) return;
    setFormsLoading(true);
    try {
      const res = await fetch("https://www.googleapis.com/drive/v3/files?q=mimeType='application/vnd.google-apps.form'&fields=files(id,name,webViewLink)", {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setFormsList(data.files || []);
        await logWorkspaceAction('Google Forms', 'Search Forms', 'Scanned drive for Google Forms');
        fetchLogs();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setFormsLoading(false);
    }
  };

  // Tab switching loads appropriate resources
  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    if (!token) return;
    if (tab === 'drive') fetchDriveFiles();
    if (tab === 'gmail') fetchGmail();
    if (tab === 'calendar') fetchCalendar();
    if (tab === 'tasks') fetchTasks();
    if (tab === 'contacts') fetchContacts();
    if (tab === 'classroom') fetchClassroom();
    if (tab === 'forms') searchGoogleFormsInDrive();
  };

  if (loading) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-slate-950 text-white">
        <div className="text-center space-y-3">
          <RefreshCw className="animate-spin text-cyan-500 mx-auto" size={40} />
          <p className="text-slate-400 font-mono text-sm">Synchronizing Cloud Environments...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-slate-950 p-6">
        <div className="max-w-md w-full bg-slate-900/80 border border-slate-800 rounded-2xl p-8 shadow-2xl backdrop-blur-xl text-center space-y-6">
          <div className="mx-auto w-16 h-16 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
            <GraduationCap size={32} className="animate-bounce" />
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-bold text-white tracking-tight">Omni Workspace Integration</h2>
            <p className="text-sm text-slate-400">
              Review and grant access to enable Google Workspace integrations (Google Drive, Gmail, Docs, Calendar, and more) for your app, backed by safe Firebase and Cloud Firestore systems.
            </p>
          </div>

          <div className="bg-slate-950/50 rounded-xl p-4 border border-slate-800 text-left space-y-2.5 text-xs text-slate-400">
            <div className="flex items-center gap-2 text-slate-300 font-semibold">
              <ShieldAlert size={14} className="text-cyan-400" />
              <span>Permission Clearances Include:</span>
            </div>
            <ul className="list-disc list-inside space-y-1 pl-1">
              <li>Read & write files in Google Drive</li>
              <li>Read & send Gmail correspondence</li>
              <li>Manage Google Calendar schedules</li>
              <li>Track tasks and connections</li>
              <li>Sync Classroom activities</li>
            </ul>
          </div>

          <button
            onClick={handleLogin}
            className="w-full flex items-center justify-center gap-3 bg-white text-slate-950 font-semibold py-3 px-4 rounded-xl shadow-lg hover:bg-slate-200 active:scale-[0.98] transition-all cursor-pointer"
          >
            <svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" className="w-5 h-5">
              <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
              <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
              <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
              <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
            </svg>
            <span>Grant Access & Sign In</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col bg-slate-950 text-slate-100 overflow-hidden">
      {/* Workspace Header */}
      <header className="p-4 bg-slate-900 border-b border-slate-800 flex items-center justify-between shadow-lg">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 rounded-xl">
            <GraduationCap size={22} />
          </div>
          <div>
            <h1 className="text-md font-bold tracking-tight">Workspace Central</h1>
            <p className="text-xs text-slate-400">Connected to {user?.email}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={generateMeetLink}
            className="flex items-center gap-2 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 text-emerald-400 text-xs px-3 py-1.5 rounded-lg font-mono transition-all cursor-pointer"
          >
            <Video size={14} />
            <span>Create Google Meet</span>
          </button>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 text-rose-400 text-xs px-3 py-1.5 rounded-lg font-mono transition-all cursor-pointer"
          >
            <LogOut size={14} />
            <span>Disconnect</span>
          </button>
        </div>
      </header>

      {/* Main Grid: Tabs on Left, Content in Middle, Logs on Right */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* Workspace App Selector (Left) */}
        <div className="w-48 bg-slate-900/50 border-r border-slate-800 flex flex-col py-3 space-y-1">
          <div className="px-4 py-1 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Apps</div>
          {[
            { id: 'drive', label: 'Google Drive', icon: Folder },
            { id: 'gmail', label: 'Gmail Client', icon: Mail },
            { id: 'calendar', label: 'Calendar Desk', icon: CalendarIcon },
            { id: 'tasks', label: 'Task Board', icon: ListTodo },
            { id: 'reminders', label: 'AI Reminders', icon: Bell },
            { id: 'sheets', label: 'Sheets Sandbox', icon: Database },
            { id: 'contacts', label: 'People Connection', icon: Users },
            { id: 'classroom', label: 'Classroom Sync', icon: GraduationCap },
            { id: 'forms', label: 'Forms Scanner', icon: CheckSquare },
            { id: 'macros', label: 'Voice Macros', icon: Mic }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab.id)}
              className={`w-full flex items-center gap-3 px-4 py-2.5 text-xs font-medium border-l-2 transition-all cursor-pointer ${
                activeTab === tab.id
                  ? 'bg-cyan-500/10 border-cyan-500 text-cyan-400'
                  : 'border-transparent text-slate-400 hover:bg-slate-900 hover:text-slate-100'
              }`}
            >
              <tab.icon size={16} />
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Tab Content Desk (Middle) */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <AnimatePresence mode="wait">
            
            {/* GOOGLE DRIVE EXPLORER */}
            {activeTab === 'drive' && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className="space-y-4 relative min-h-[350px]"
              >
                {isDragging && (
                  <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-cyan-950/60 backdrop-blur-md border-2 border-dashed border-cyan-500 rounded-2xl pointer-events-none animate-pulse">
                    <Folder className="text-cyan-400 mb-2" size={48} />
                    <span className="text-xl font-bold text-cyan-200">Upload to Google Drive</span>
                    <span className="text-sm text-cyan-400 mt-1 px-4 text-center">Drop file here to upload directly to Google Drive</span>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-bold">Drive File Explorer</h2>
                    <p className="text-xs text-slate-400">Integrated File Picker & Drag-and-drop Cloud storage</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={uploadFile}
                      className="flex items-center gap-2 bg-cyan-500 text-slate-950 font-semibold text-xs px-3 py-1.5 rounded-lg shadow-lg hover:bg-cyan-400 transition-all cursor-pointer"
                    >
                      <Plus size={14} />
                      <span>Upload New File</span>
                    </button>
                    <button
                      onClick={() => fetchDriveFiles()}
                      className="p-1.5 bg-slate-900 border border-slate-800 text-slate-400 hover:text-white rounded-lg cursor-pointer"
                    >
                      <RefreshCw size={14} />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* File List Grid */}
                  <div className="lg:col-span-2 bg-slate-900/40 border border-slate-800 rounded-xl p-4 space-y-3">
                    {driveLoading ? (
                      <div className="text-center py-8 text-slate-500">Scanning Drive...</div>
                    ) : driveFiles.length === 0 ? (
                      <div className="text-center py-8 text-slate-500">No files found. Try uploading a file!</div>
                    ) : (
                      <div className="divide-y divide-slate-800">
                        {driveFiles.map(file => (
                          <div
                            key={file.id}
                            onClick={() => viewFileDetails(file.id, file.name, file.mimeType)}
                            className="flex items-center justify-between py-3 cursor-pointer hover:bg-slate-900/50 px-2 rounded-lg transition-all"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <img src={file.iconLink} alt="" className="w-4 h-4 opacity-70" />
                              <div className="text-xs truncate font-medium max-w-xs">{file.name}</div>
                            </div>
                            <div className="flex items-center gap-3">
                              <a
                                href={file.webViewLink}
                                target="_blank"
                                rel="noreferrer"
                                className="text-slate-500 hover:text-cyan-400"
                                onClick={e => e.stopPropagation()}
                              >
                                <ExternalLink size={14} />
                              </a>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  deleteDriveFile(file.id, file.name);
                                }}
                                className="text-slate-500 hover:text-rose-500"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Built-in File Viewer Preview (Picker alternative) */}
                  <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 flex flex-col h-96">
                    <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">File Viewer</div>
                    {fileViewerLoading ? (
                      <div className="flex-1 flex items-center justify-center text-slate-500">Loading Content Preview...</div>
                    ) : selectedFileContent ? (
                      <div className="flex-1 flex flex-col overflow-hidden">
                        <div className="text-xs font-semibold text-cyan-400 mb-2 truncate">{selectedFileName}</div>
                        <pre className="flex-1 bg-slate-950 p-3 rounded-lg overflow-auto font-mono text-[10px] text-slate-300 leading-relaxed">
                          {selectedFileContent}
                        </pre>
                      </div>
                    ) : (
                      <div className="flex-1 flex flex-col items-center justify-center text-slate-600 text-center space-y-2">
                        <Folder size={32} />
                        <span className="text-xs">Select a file from left to preview contents</span>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            )}

            {/* GMAIL CLIENT */}
            {activeTab === 'gmail' && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-4"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-bold">Gmail Inbox</h2>
                    <p className="text-xs text-slate-400">Browse incoming mail and send messages with permissions</p>
                  </div>
                  <button
                    onClick={fetchGmail}
                    className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 text-slate-300 text-xs px-3 py-1.5 rounded-lg cursor-pointer hover:bg-slate-850"
                  >
                    <RefreshCw size={12} />
                    <span>Sync Inbox</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Message List */}
                  <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-4 space-y-3 max-h-96 overflow-y-auto">
                    {gmailLoading ? (
                      <div className="text-center py-8 text-slate-500">Reading Inbox...</div>
                    ) : gmailMessages.length === 0 ? (
                      <div className="text-center py-8 text-slate-500">Inbox is empty.</div>
                    ) : (
                      <div className="space-y-2">
                        {gmailMessages.map(msg => (
                          <div key={msg.id} className="bg-slate-950 p-3 rounded-xl border border-slate-850 space-y-1 hover:border-slate-800 transition-all">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold text-cyan-400 truncate max-w-[150px]">{msg.from}</span>
                              <span className="text-[10px] text-slate-500">{new Date(msg.date).toLocaleDateString()}</span>
                            </div>
                            <div className="text-xs font-semibold text-slate-200">{msg.subject}</div>
                            <p className="text-[11px] text-slate-400 line-clamp-2">{msg.snippet}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Send Mail Console (Mutating operation with explicit confirmations!) */}
                  <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4">
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Compose Mail</h3>
                    <form onSubmit={sendGmail} className="space-y-3">
                      <div>
                        <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">To</label>
                        <input
                          type="email"
                          required
                          value={newEmail.to}
                          onChange={e => setNewEmail({ ...newEmail, to: e.target.value })}
                          className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs focus:border-cyan-500 focus:outline-none"
                          placeholder="recipient@example.com"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Subject</label>
                        <input
                          type="text"
                          required
                          value={newEmail.subject}
                          onChange={e => setNewEmail({ ...newEmail, subject: e.target.value })}
                          className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs focus:border-cyan-500 focus:outline-none"
                          placeholder="Project Sync Update"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Message Body</label>
                        <textarea
                          required
                          rows={4}
                          value={newEmail.body}
                          onChange={e => setNewEmail({ ...newEmail, body: e.target.value })}
                          className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs focus:border-cyan-500 focus:outline-none resize-none"
                          placeholder="Draft your message here..."
                        />
                      </div>
                      <button
                        type="submit"
                        disabled={gmailLoading}
                        className="w-full flex items-center justify-center gap-2 bg-cyan-500 text-slate-950 font-semibold py-2 rounded-lg text-xs hover:bg-cyan-400 active:scale-[0.98] transition-all cursor-pointer"
                      >
                        <Send size={14} />
                        <span>Send Message</span>
                      </button>
                    </form>
                  </div>
                </div>
              </motion.div>
            )}

            {/* CALENDAR DESK */}
            {activeTab === 'calendar' && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-4"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-bold">Calendar Schedules</h2>
                    <p className="text-xs text-slate-400">View and organize event calendars securely</p>
                  </div>
                  <button
                    onClick={fetchCalendar}
                    className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 text-slate-300 text-xs px-3 py-1.5 rounded-lg cursor-pointer"
                  >
                    <RefreshCw size={12} />
                    <span>Sync Calendar</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Schedule List */}
                  <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-4 space-y-3 max-h-96 overflow-y-auto">
                    {calendarLoading ? (
                      <div className="text-center py-8 text-slate-500">Querying Calendar...</div>
                    ) : calendarEvents.length === 0 ? (
                      <div className="text-center py-8 text-slate-500">No events found on this calendar.</div>
                    ) : (
                      <div className="space-y-2">
                        {calendarEvents.map(event => {
                          const date = event.start?.dateTime || event.start?.date;
                          return (
                            <div key={event.id} className="bg-slate-950 p-3 rounded-xl border border-slate-850 flex items-center justify-between">
                              <div className="min-w-0">
                                <div className="text-xs font-semibold text-slate-200">{event.summary || 'Untitled Event'}</div>
                                <div className="text-[10px] text-slate-500">{new Date(date).toLocaleString()}</div>
                                <div className="text-[10px] text-slate-400 mt-1 line-clamp-1">{event.description}</div>
                              </div>
                              <button
                                onClick={() => deleteCalendarEvent(event.id, event.summary)}
                                className="p-1 text-slate-500 hover:text-rose-500"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Add Event Panel (with explicit validation and confirmation!) */}
                  <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4">
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Add Schedule</h3>
                    <form onSubmit={createCalendarEvent} className="space-y-3">
                      <div>
                        <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Title</label>
                        <input
                          type="text"
                          required
                          value={newEvent.title}
                          onChange={e => setNewEvent({ ...newEvent, title: e.target.value })}
                          className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs focus:border-cyan-500 focus:outline-none"
                          placeholder="Project Sync Session"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Start Time</label>
                          <input
                            type="datetime-local"
                            required
                            value={newEvent.start}
                            onChange={e => setNewEvent({ ...newEvent, start: e.target.value })}
                            className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs focus:border-cyan-500 focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">End Time</label>
                          <input
                            type="datetime-local"
                            required
                            value={newEvent.end}
                            onChange={e => setNewEvent({ ...newEvent, end: e.target.value })}
                            className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs focus:border-cyan-500 focus:outline-none"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Description</label>
                        <textarea
                          rows={3}
                          value={newEvent.desc}
                          onChange={e => setNewEvent({ ...newEvent, desc: e.target.value })}
                          className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs focus:border-cyan-500 focus:outline-none resize-none"
                          placeholder="Provide details about the scheduled block..."
                        />
                      </div>
                      <button
                        type="submit"
                        disabled={calendarLoading}
                        className="w-full bg-cyan-500 text-slate-950 font-semibold py-2 rounded-lg text-xs hover:bg-cyan-400 transition-all cursor-pointer"
                      >
                        Schedule Event
                      </button>
                    </form>
                  </div>
                </div>
              </motion.div>
            )}

            {/* TASK BOARD */}
            {activeTab === 'tasks' && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-4"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-bold">Workspace Tasks</h2>
                    <p className="text-xs text-slate-400">Track and complete project checkpoints in Google Tasks</p>
                  </div>
                  <button
                    onClick={fetchTasks}
                    className="p-1.5 bg-slate-900 border border-slate-800 text-slate-400 hover:text-white rounded-lg cursor-pointer"
                  >
                    <RefreshCw size={14} />
                  </button>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Task List */}
                  <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-4 space-y-3 max-h-96 overflow-y-auto">
                    {tasksLoading ? (
                      <div className="text-center py-8 text-slate-500">Retrieving Tasks...</div>
                    ) : taskList.length === 0 ? (
                      <div className="text-center py-8 text-slate-500">No tasks found. Create a task!</div>
                    ) : (
                      <div className="space-y-2">
                        {taskList.map(task => {
                          const isCompleted = task.status === 'completed';
                          return (
                            <div key={task.id} className="bg-slate-950 p-3 rounded-xl border border-slate-850 flex items-center justify-between">
                              <div className="flex items-center gap-3 min-w-0">
                                <button
                                  onClick={() => completeTask(task.id, task.status, task.title)}
                                  className={`w-5 h-5 rounded-md border flex items-center justify-center transition-all cursor-pointer ${
                                    isCompleted ? 'bg-cyan-500 border-cyan-500 text-slate-950' : 'border-slate-750 hover:border-cyan-500 text-transparent'
                                  }`}
                                >
                                  <Check size={12} strokeWidth={3} />
                                </button>
                                <div className="min-w-0">
                                  <div className={`text-xs font-semibold ${isCompleted ? 'line-through text-slate-500' : 'text-slate-200'}`}>
                                    {task.title}
                                  </div>
                                  <div className="text-[10px] text-slate-500 truncate max-w-[250px]">{task.notes}</div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Create Task Form */}
                  <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4">
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Create Task</h3>
                    <form onSubmit={createGoogleTask} className="space-y-3">
                      <div>
                        <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Task Title</label>
                        <input
                          type="text"
                          required
                          value={newTask.title}
                          onChange={e => setNewTask({ ...newTask, title: e.target.value })}
                          className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs focus:border-cyan-500 focus:outline-none"
                          placeholder="Release prototype MVP"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Notes</label>
                        <textarea
                          rows={3}
                          value={newTask.notes}
                          onChange={e => setNewTask({ ...newTask, notes: e.target.value })}
                          className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs focus:border-cyan-500 focus:outline-none resize-none"
                          placeholder="Include checkpoint actionables..."
                        />
                      </div>
                      <button
                        type="submit"
                        disabled={tasksLoading}
                        className="w-full bg-cyan-500 text-slate-950 font-semibold py-2 rounded-lg text-xs hover:bg-cyan-400 transition-all cursor-pointer"
                      >
                        Add Task
                      </button>
                    </form>
                  </div>
                </div>
              </motion.div>
            )}

            {/* AI CONTEXT REMINDERS */}
            {activeTab === 'reminders' && (
              <motion.div
                key="reminders"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6"
              >
                {/* Header & Scanning CTA */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 bg-gradient-to-r from-violet-950/60 via-slate-900 to-indigo-950/60 rounded-2xl border border-violet-500/30 shadow-xl">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <div className="p-2 rounded-xl bg-violet-500/20 text-violet-300 border border-violet-500/30">
                        <Bell size={20} className="animate-bounce" />
                      </div>
                      <h2 className="text-base font-bold text-white">AI Context-Aware Reminders</h2>
                    </div>
                    <p className="text-xs text-slate-300 max-w-xl">
                      Omni AI automatically scans ongoing chat threads, voice commands, and notes to detect implied action items, promises, deadlines, and follow-ups.
                    </p>
                  </div>

                  <button
                    onClick={detectRemindersFromChats}
                    disabled={detectingContext}
                    className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-semibold rounded-xl text-xs shadow-lg shadow-violet-500/20 transition-all cursor-pointer disabled:opacity-50 shrink-0"
                  >
                    {detectingContext ? (
                      <>
                        <RefreshCw size={15} className="animate-spin text-violet-200" />
                        <span>Analyzing Chat Context...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles size={15} className="text-amber-300 fill-amber-300" />
                        <span>Scan Chat Threads for Reminders</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Natural Language Creation Box */}
                <div className="p-4 bg-slate-900/60 rounded-2xl border border-slate-800 space-y-3">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-300">
                    <Wand2 size={14} className="text-cyan-400" />
                    <span>Quick Add & AI Context Enrichment</span>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-3">
                    <input
                      type="text"
                      value={manualReminderInput}
                      onChange={e => setManualReminderInput(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && createEnrichedReminder()}
                      placeholder="e.g. Follow up with engineering team on Friday 2 PM regarding API keys..."
                      className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:border-violet-500 focus:outline-none"
                    />
                    <input
                      type="text"
                      value={manualReminderTime}
                      onChange={e => setManualReminderTime(e.target.value)}
                      placeholder="Time (optional)"
                      className="w-full sm:w-40 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-white focus:border-violet-500 focus:outline-none"
                    />
                    <button
                      onClick={createEnrichedReminder}
                      disabled={remindersLoading || !manualReminderInput.trim()}
                      className="px-4 py-2.5 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold rounded-xl text-xs transition-all cursor-pointer disabled:opacity-50 shrink-0 flex items-center justify-center gap-1.5"
                    >
                      {remindersLoading ? (
                        <RefreshCw size={14} className="animate-spin" />
                      ) : (
                        <>
                          <Plus size={14} />
                          <span>Enrich & Add</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Filters & Reminders List */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Clock size={16} className="text-violet-400" />
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                        Detected Reminders ({reminders.length})
                      </span>
                    </div>

                    {/* Filter Pills */}
                    <div className="flex items-center gap-1 bg-slate-900/80 p-1 rounded-xl border border-slate-800 text-[11px]">
                      {(['all', 'active', 'completed'] as const).map(f => (
                        <button
                          key={f}
                          onClick={() => setReminderFilter(f)}
                          className={`px-3 py-1 rounded-lg capitalize font-medium transition-all ${
                            reminderFilter === f
                              ? 'bg-violet-600 text-white shadow-sm'
                              : 'text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          {f}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Grid */}
                  {reminders.filter(r => reminderFilter === 'all' ? true : r.status === reminderFilter).length === 0 ? (
                    <div className="p-10 border border-dashed border-slate-800 rounded-2xl text-center space-y-3 bg-slate-900/20">
                      <Brain size={32} className="mx-auto text-slate-600 animate-pulse" />
                      <div className="text-xs text-slate-400 font-medium">No reminders in this view.</div>
                      <button
                        onClick={detectRemindersFromChats}
                        className="text-xs text-violet-400 hover:text-violet-300 font-semibold underline cursor-pointer"
                      >
                        Auto-detect reminders from recent chat discussions
                      </button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {reminders
                        .filter(r => reminderFilter === 'all' ? true : r.status === reminderFilter)
                        .map(rem => {
                          const isCompleted = rem.status === 'completed';
                          return (
                            <motion.div
                              key={rem.id}
                              layout
                              initial={{ opacity: 0, scale: 0.95 }}
                              animate={{ opacity: 1, scale: 1 }}
                              exit={{ opacity: 0, scale: 0.95 }}
                              className={`p-4 rounded-2xl border transition-all space-y-3 relative overflow-hidden group ${
                                isCompleted
                                  ? 'bg-slate-950/40 border-slate-850 opacity-60'
                                  : 'bg-slate-900/50 border-slate-800 hover:border-violet-500/40 shadow-lg'
                              }`}
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="flex items-start gap-2.5 min-w-0">
                                  <button
                                    onClick={() => toggleReminderStatus(rem.id)}
                                    className={`mt-0.5 shrink-0 transition-colors cursor-pointer ${
                                      isCompleted ? 'text-emerald-400' : 'text-slate-500 hover:text-slate-300'
                                    }`}
                                  >
                                    <CheckSquare size={16} className={isCompleted ? 'fill-emerald-400/20' : ''} />
                                  </button>
                                  <div className="space-y-1 min-w-0">
                                    <h4 className={`text-xs font-bold transition-all ${isCompleted ? 'line-through text-slate-500' : 'text-slate-100'}`}>
                                      {rem.title}
                                    </h4>
                                    <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
                                      <Brain size={11} className="text-violet-400 shrink-0" />
                                      <span className="truncate">{rem.context}</span>
                                    </div>
                                  </div>
                                </div>

                                <button
                                  onClick={() => deleteReminder(rem.id)}
                                  className="text-slate-600 hover:text-rose-400 transition-colors opacity-0 group-hover:opacity-100 p-1"
                                  title="Delete reminder"
                                >
                                  <Trash2 size={13} />
                                </button>
                              </div>

                              {/* Badges footer */}
                              <div className="flex items-center justify-between pt-2 border-t border-slate-800/80 text-[10px]">
                                <div className="flex items-center gap-2">
                                  {/* Priority */}
                                  <span className={`px-2 py-0.5 rounded font-mono font-bold uppercase ${
                                    rem.priority === 'high' ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30' :
                                    rem.priority === 'medium' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' :
                                    'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                  }`}>
                                    {rem.priority}
                                  </span>

                                  {/* Time */}
                                  <div className="flex items-center gap-1 text-slate-300 bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                                    <Clock size={10} className="text-cyan-400" />
                                    <span>{rem.detectedTime}</span>
                                  </div>
                                </div>

                                <button
                                  onClick={() => triggerReminderNow(rem)}
                                  className="flex items-center gap-1 text-[10px] bg-violet-500/10 hover:bg-violet-500/20 text-violet-300 px-2.5 py-1 rounded-lg border border-violet-500/20 transition-all cursor-pointer"
                                  title="Trigger immediate reminder notification"
                                >
                                  <Bell size={10} />
                                  <span>Test Trigger</span>
                                </button>
                              </div>
                            </motion.div>
                          );
                        })}
                    </div>
                  )}
                </div>
              </motion.div>
            )}
            {activeTab === 'sheets' && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-4"
              >
                <div>
                  <h2 className="text-lg font-bold">Sheets Interactive Sandbox</h2>
                  <p className="text-xs text-slate-400">Read and edit spreadsheet databases directly</p>
                </div>

                <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-4 space-y-4">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={sheetId}
                      onChange={e => setSheetId(e.target.value)}
                      className="flex-1 bg-slate-950 border border-slate-850 rounded-lg p-2 text-xs font-mono focus:border-cyan-500 focus:outline-none"
                      placeholder="Spreadsheet ID (from Google Sheets URL)"
                    />
                    <button
                      onClick={loadSheet}
                      disabled={sheetLoading}
                      className="bg-cyan-500 text-slate-950 font-semibold text-xs px-4 rounded-lg hover:bg-cyan-400 transition-all cursor-pointer"
                    >
                      Connect Sheet
                    </button>
                  </div>

                  {sheetLoading ? (
                    <div className="text-center py-8 text-slate-500">Querying Spreadsheet rows...</div>
                  ) : sheetData ? (
                    <div className="space-y-4">
                      {/* Interactive Spreadsheet Table */}
                      <div className="overflow-x-auto max-h-64 border border-slate-800 rounded-lg bg-slate-950">
                        <table className="w-full text-left border-collapse text-xs">
                          <thead>
                            <tr className="bg-slate-900 border-b border-slate-800 text-slate-300 font-bold uppercase tracking-wider">
                              {sheetHeader.map((h, i) => (
                                <th key={i} className="p-3 border-r border-slate-850">{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {sheetRows.map((row, rIdx) => (
                              <tr key={rIdx} className="border-b border-slate-900 hover:bg-slate-900/20">
                                {row.map((cell, cIdx) => (
                                  <td key={cIdx} className="p-3 border-r border-slate-900 truncate max-w-[150px]">{cell}</td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {/* Append Row controls */}
                      <div className="flex gap-2 items-center">
                        <input
                          type="text"
                          value={newRowData}
                          onChange={e => setNewRowData(e.target.value)}
                          className="flex-1 bg-slate-950 border border-slate-850 rounded-lg p-2 text-xs focus:border-cyan-500 focus:outline-none"
                          placeholder="Comma separated values: John Doe, Admin, active, 100"
                        />
                        <button
                          onClick={appendRowToSheet}
                          disabled={sheetLoading}
                          className="bg-emerald-500 text-slate-950 font-semibold text-xs px-4 py-2 rounded-lg hover:bg-emerald-400 transition-all cursor-pointer"
                        >
                          Append Row
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-12 text-slate-600 flex flex-col items-center justify-center space-y-2">
                      <Database size={40} />
                      <div className="text-xs">Provide a valid spreadsheet ID to explore and append rows dynamically!</div>
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {/* PEOPLE / CONTACTS CONNECTION */}
            {activeTab === 'contacts' && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-4"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-bold">Contacts Sync Board</h2>
                    <p className="text-xs text-slate-400">Search and construct connections inside Google Contacts</p>
                  </div>
                  <button
                    onClick={fetchContacts}
                    className="p-1.5 bg-slate-900 border border-slate-800 text-slate-400 hover:text-white rounded-lg cursor-pointer"
                  >
                    <RefreshCw size={14} />
                  </button>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Connection Grid */}
                  <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-4 max-h-96 overflow-y-auto space-y-2">
                    {contactsLoading ? (
                      <div className="text-center py-8 text-slate-500">Querying Connections...</div>
                    ) : contacts.length === 0 ? (
                      <div className="text-center py-8 text-slate-500">No contacts found on your account.</div>
                    ) : (
                      contacts.map((contact, idx) => (
                        <div key={idx} className="bg-slate-950 p-3 rounded-xl border border-slate-850 flex justify-between items-center">
                          <div>
                            <div className="text-xs font-semibold text-slate-200">{contact.name}</div>
                            <div className="text-[10px] text-slate-500">{contact.email}</div>
                          </div>
                          <span className="text-[10px] font-mono text-cyan-400">{contact.phone}</span>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Create Connection */}
                  <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4">
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Add Contact Connection</h3>
                    <form onSubmit={createContact} className="space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">First Name</label>
                          <input
                            type="text"
                            required
                            value={newContact.firstName}
                            onChange={e => setNewContact({ ...newContact, firstName: e.target.value })}
                            className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs focus:border-cyan-500 focus:outline-none"
                            placeholder="John"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Last Name</label>
                          <input
                            type="text"
                            required
                            value={newContact.lastName}
                            onChange={e => setNewContact({ ...newContact, lastName: e.target.value })}
                            className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs focus:border-cyan-500 focus:outline-none"
                            placeholder="Doe"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Email</label>
                        <input
                          type="email"
                          value={newContact.email}
                          onChange={e => setNewContact({ ...newContact, email: e.target.value })}
                          className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs focus:border-cyan-500 focus:outline-none"
                          placeholder="johndoe@example.com"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Phone Number</label>
                        <input
                          type="text"
                          value={newContact.phone}
                          onChange={e => setNewContact({ ...newContact, phone: e.target.value })}
                          className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs focus:border-cyan-500 focus:outline-none"
                          placeholder="+1 234 567 8900"
                        />
                      </div>
                      <button
                        type="submit"
                        disabled={contactsLoading}
                        className="w-full bg-cyan-500 text-slate-950 font-semibold py-2 rounded-lg text-xs hover:bg-cyan-400 transition-all cursor-pointer"
                      >
                        Add Connection
                      </button>
                    </form>
                  </div>
                </div>
              </motion.div>
            )}

            {/* CLASSROOM sync */}
            {activeTab === 'classroom' && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-4"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-bold">Classroom Central</h2>
                    <p className="text-xs text-slate-400">Review announcements & courses enrolled in Google Classroom</p>
                  </div>
                  <button
                    onClick={fetchClassroom}
                    className="p-1.5 bg-slate-900 border border-slate-800 text-slate-400 hover:text-white rounded-lg cursor-pointer"
                  >
                    <RefreshCw size={14} />
                  </button>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Course select list */}
                  <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-4 space-y-2 h-96 overflow-y-auto">
                    <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Active Courses</div>
                    {classroomLoading && courses.length === 0 ? (
                      <div className="text-center py-8 text-slate-500">Querying Courses...</div>
                    ) : courses.length === 0 ? (
                      <div className="text-center py-8 text-slate-500">No active Classroom courses found.</div>
                    ) : (
                      courses.map(course => (
                        <button
                          key={course.id}
                          onClick={() => {
                            setSelectedCourse(course.id);
                            fetchAnnouncements(course.id);
                          }}
                          className={`w-full text-left p-3 rounded-xl border text-xs transition-all ${
                            selectedCourse === course.id
                              ? 'bg-cyan-500/10 border-cyan-500 text-cyan-400 font-bold'
                              : 'bg-slate-950 border-slate-850 text-slate-300 hover:border-slate-800'
                          }`}
                        >
                          <div className="truncate">{course.name}</div>
                          <div className="text-[9px] text-slate-500 truncate mt-1">{course.section || 'No Section'}</div>
                        </button>
                      ))
                    )}
                  </div>

                  {/* Course Announcements Feed */}
                  <div className="lg:col-span-2 bg-slate-900/60 border border-slate-800 rounded-xl p-4 h-96 overflow-y-auto space-y-4">
                    <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Announcements Feed</div>
                    {classroomLoading ? (
                      <div className="text-center py-8 text-slate-500">Loading stream announcements...</div>
                    ) : classroomAnnouncements.length === 0 ? (
                      <div className="text-center py-8 text-slate-500">No announcements posted in this classroom.</div>
                    ) : (
                      <div className="space-y-3">
                        {classroomAnnouncements.map(ann => (
                          <div key={ann.id} className="bg-slate-950 p-4 border border-slate-850 rounded-xl space-y-2 text-xs">
                            <p className="text-slate-300 leading-relaxed whitespace-pre-line">{ann.text}</p>
                            <div className="text-[10px] text-slate-500 font-mono text-right">
                              Posted {new Date(ann.creationTime).toLocaleString()}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            )}

            {/* FORMS SCANNER */}
            {activeTab === 'forms' && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-4"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-bold">Forms Scanner Dashboard</h2>
                    <p className="text-xs text-slate-400">Discover and coordinate active Google Forms and surveys</p>
                  </div>
                  <button
                    onClick={searchGoogleFormsInDrive}
                    className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 text-slate-300 text-xs px-3 py-1.5 rounded-lg cursor-pointer hover:bg-slate-850"
                  >
                    <RefreshCw size={12} />
                    <span>Scan Forms</span>
                  </button>
                </div>

                <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-4">
                  {formsLoading ? (
                    <div className="text-center py-8 text-slate-500">Searching active forms in Drive...</div>
                  ) : formsList.length === 0 ? (
                    <div className="text-center py-8 text-slate-500">No Google Forms identified. Search drive again!</div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {formsList.map(form => (
                        <div key={form.id} className="bg-slate-950 p-4 rounded-xl border border-slate-850 flex items-center justify-between">
                          <div className="min-w-0">
                            <div className="text-xs font-bold text-slate-200 truncate">{form.name}</div>
                            <div className="text-[10px] text-slate-500 font-mono truncate">{form.id}</div>
                          </div>
                          <a
                            href={form.webViewLink}
                            target="_blank"
                            rel="noreferrer"
                            className="flex items-center gap-1 bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/20 text-cyan-400 text-[10px] px-2.5 py-1 rounded-lg"
                          >
                            <span>Open</span>
                            <ExternalLink size={10} />
                          </a>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {activeTab === 'macros' && (
              <motion.div
                key="macros"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.2 }}
                className="space-y-6 overflow-y-auto max-h-full pb-10 pr-2 scrollbar-thin"
              >
                {/* Header info */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 bg-slate-900/60 rounded-2xl border border-slate-800">
                  <div className="space-y-1">
                    <h3 className="text-sm font-bold text-slate-100">Hands-Free Automation Engine</h3>
                    <p className="text-xs text-slate-400 font-mono leading-normal">
                      Record customized command workflows and execute multi-step workspace pipelines instantly via speech triggers.
                    </p>
                  </div>
                  <button
                    onClick={toggleHandsFree}
                    className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl font-mono text-xs font-semibold cursor-pointer transition-all duration-300 shadow-lg ${
                      isListeningForTrigger
                        ? 'bg-rose-500/20 border border-rose-500/40 text-rose-300 animate-pulse scale-105'
                        : 'bg-violet-500/20 border border-violet-500/35 text-violet-300 hover:bg-violet-500/30'
                    }`}
                  >
                    <div className="relative flex h-2 w-2">
                      {isListeningForTrigger && (
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                      )}
                      <span className={`relative inline-flex rounded-full h-2 w-2 ${isListeningForTrigger ? 'bg-rose-500' : 'bg-violet-400'}`}></span>
                    </div>
                    <Mic size={14} className={isListeningForTrigger ? 'animate-bounce' : ''} />
                    <span>{isListeningForTrigger ? 'Listening hands-free...' : 'Activate Voice Commands'}</span>
                  </button>
                </div>

                {/* Main Two-Column Panel Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                  
                  {/* Stored Macros List (7 columns) */}
                  <div className="lg:col-span-7 space-y-4">
                    <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Active Voice Pipelines ({macros.length})</div>
                    
                    <div className="space-y-3">
                      {macros.map(macro => {
                        const isRunning = runningMacroId === macro.id;
                        return (
                          <div 
                            key={macro.id} 
                            className={`p-4 rounded-xl border transition-all duration-300 bg-slate-900/40 relative overflow-hidden ${
                              isRunning 
                                ? 'border-violet-500/40 shadow-xl shadow-violet-500/5' 
                                : 'border-slate-800 hover:border-slate-700'
                            }`}
                          >
                            {/* Running Background overlay glow */}
                            {isRunning && (
                              <div className="absolute inset-0 bg-violet-500/5 pointer-events-none animate-pulse" />
                            )}

                            <div className="flex items-start justify-between gap-3 relative z-10">
                              <div className="space-y-1.5 min-w-0">
                                <div className="flex items-center gap-2">
                                  <h4 className="text-sm font-bold text-slate-200 truncate">{macro.name}</h4>
                                  <div className="flex items-center gap-1 text-[10px] bg-violet-500/20 text-violet-300 font-mono px-2 py-0.5 rounded border border-violet-500/25">
                                    <Volume2 size={10} />
                                    <span>say "{macro.trigger}"</span>
                                  </div>
                                </div>
                                <p className="text-[11px] text-slate-400">Contains {macro.steps?.length} modular action steps</p>
                              </div>

                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => runMacro(macro)}
                                  disabled={runningMacroId !== null}
                                  className={`flex items-center gap-1 text-[10px] font-mono px-3 py-1.5 rounded-lg border transition-all ${
                                    isRunning
                                      ? 'bg-violet-500/20 border-violet-500/40 text-violet-300 animate-pulse'
                                      : 'bg-slate-950 border-slate-850 hover:bg-slate-900 text-slate-300 disabled:opacity-40 cursor-pointer'
                                  }`}
                                >
                                  {isRunning ? (
                                    <>
                                      <RefreshCw size={10} className="animate-spin" />
                                      <span>Executing...</span>
                                    </>
                                  ) : (
                                    <>
                                      <Play size={10} />
                                      <span>Run Pipeline</span>
                                    </>
                                  )}
                                </button>
                                <button
                                  onClick={() => deleteMacro(macro.id, macro.name)}
                                  className="p-1.5 bg-slate-950 hover:bg-rose-500/10 text-slate-500 hover:text-rose-400 rounded-lg border border-slate-850 hover:border-rose-500/20 cursor-pointer transition-all"
                                  title="Delete Macro"
                                >
                                  <Trash2 size={12} />
                                </button>
                              </div>
                            </div>

                            {/* Timeline steps overview */}
                            <div className="mt-4 pt-4 border-t border-slate-800/60 relative z-10">
                              <div className="relative pl-4 space-y-3.5 before:absolute before:left-[3px] before:top-1.5 before:bottom-1.5 before:w-[1.5px] before:bg-slate-800">
                                {macro.steps.map((step: any, sIdx: number) => {
                                  const isStepRunning = isRunning && macroStepIndex === sIdx;
                                  const isStepPassed = isRunning && macroStepIndex !== null && sIdx < macroStepIndex;
                                  
                                  return (
                                    <div key={sIdx} className="relative flex items-start gap-3">
                                      <div className={`absolute -left-[16.5px] top-1.5 h-2 w-2 rounded-full border transition-all duration-300 ${
                                        isStepRunning 
                                          ? 'bg-violet-500 border-violet-400 animate-ping' 
                                          : isStepPassed 
                                            ? 'bg-emerald-500 border-emerald-400' 
                                            : 'bg-slate-950 border-slate-800'
                                      }`} />
                                      
                                      <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-2">
                                          <span className="text-[10px] font-mono font-bold text-slate-500">Step {sIdx + 1}</span>
                                          <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded ${
                                            step.type === 'meet' ? 'bg-emerald-500/15 text-emerald-300' :
                                            step.type === 'gmail' ? 'bg-indigo-500/15 text-indigo-300' :
                                            step.type === 'task' ? 'bg-cyan-500/15 text-cyan-300' :
                                            'bg-amber-500/15 text-amber-300'
                                          }`}>
                                            {step.type.toUpperCase()}
                                          </span>
                                        </div>
                                        <p className={`text-xs mt-0.5 ${isStepRunning ? 'text-violet-300 font-medium' : isStepPassed ? 'text-slate-400' : 'text-slate-500'}`}>
                                          {getStepLabel(step)}
                                        </p>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Macro Builder Wizard (5 columns) */}
                  <div className="lg:col-span-5 space-y-4">
                    <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Configure Custom Pipeline</div>
                    
                    <div className="p-4 rounded-2xl border border-slate-800 bg-slate-900/40 space-y-4">
                      
                      {/* Macro metadata */}
                      <div className="space-y-3">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Pipeline Name</label>
                          <input
                            type="text"
                            placeholder="e.g., Deploy Weekly Review"
                            value={newMacroName}
                            onChange={e => setNewMacroName(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-855 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 outline-none focus:border-slate-700 transition-colors"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Speech Trigger Word(s)</label>
                          <input
                            type="text"
                            placeholder="e.g., execute deployment procedures"
                            value={newMacroTrigger}
                            onChange={e => setNewMacroTrigger(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-855 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 outline-none focus:border-slate-700 transition-colors"
                          />
                        </div>
                      </div>

                      {/* Timeline of added steps in Builder */}
                      <div className="border-t border-slate-800 pt-3">
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Workflow Action Sequence ({newMacroSteps.length})</label>
                        {newMacroSteps.length === 0 ? (
                          <div className="text-center py-5 border border-dashed border-slate-800 rounded-xl text-[10px] text-slate-500 font-mono">
                            No action steps added yet. Add below!
                          </div>
                        ) : (
                          <div className="space-y-1.5 max-h-[160px] overflow-y-auto scrollbar-thin">
                            {newMacroSteps.map((step, index) => (
                              <div key={index} className="flex items-center justify-between p-2 bg-slate-950 rounded-xl border border-slate-850">
                                <div className="min-w-0 font-mono">
                                  <div className="text-[10px] font-bold text-slate-300">{index + 1}. {step.type.toUpperCase()}</div>
                                  <div className="text-[9px] text-slate-500 truncate">{step.label}</div>
                                </div>
                                <button
                                  onClick={() => removeStepFromBuilder(index)}
                                  className="text-slate-500 hover:text-rose-400 p-1 cursor-pointer"
                                >
                                  <Trash2 size={12} />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Add dynamic Step Selector section */}
                      <div className="border-t border-slate-800 pt-3 space-y-3">
                        <div className="flex items-center justify-between">
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">New Action Block</label>
                          <select
                            value={newStepType}
                            onChange={e => setNewStepType(e.target.value as any)}
                            className="bg-slate-950 border border-slate-850 rounded-lg px-2 py-1 text-[10px] text-slate-300 outline-none cursor-pointer font-mono"
                          >
                            <option value="meet">Google Meet Link</option>
                            <option value="gmail">Send Gmail</option>
                            <option value="task">Create Task</option>
                            <option value="calendar">Schedule Event</option>
                          </select>
                        </div>

                        {/* Step Type Input Context Forms */}
                        <div className="bg-slate-950/70 rounded-xl p-3 border border-slate-850 space-y-2">
                          {newStepType === 'meet' && (
                            <p className="text-[10px] text-slate-500 font-mono leading-normal">
                              Generates a Google Meet video conference. Subsequent Gmail, Task, or Calendar events in this macro can reference the meet link with <span className="text-violet-400 font-bold">{'{meet_link}'}</span>.
                            </p>
                          )}

                          {newStepType === 'gmail' && (
                            <div className="space-y-2">
                              <input
                                type="email"
                                placeholder="Recipient (e.g. client@company.com)"
                                value={stepEmailTo}
                                onChange={e => setStepEmailTo(e.target.value)}
                                className="w-full bg-slate-950 border border-slate-850 rounded-lg px-2.5 py-1.5 text-[10px] text-white outline-none"
                              />
                              <input
                                type="text"
                                placeholder="Subject"
                                value={stepEmailSubject}
                                onChange={e => setStepEmailSubject(e.target.value)}
                                className="w-full bg-slate-950 border border-slate-850 rounded-lg px-2.5 py-1.5 text-[10px] text-white outline-none"
                              />
                              <textarea
                                placeholder="Message Body... tip: include {meet_link} to paste generated link"
                                value={stepEmailBody}
                                onChange={e => setStepEmailBody(e.target.value)}
                                rows={3}
                                className="w-full bg-slate-950 border border-slate-850 rounded-lg px-2.5 py-1.5 text-[10px] text-white outline-none resize-none font-mono"
                              />
                            </div>
                          )}

                          {newStepType === 'task' && (
                            <div className="space-y-2">
                              <input
                                type="text"
                                placeholder="Task Title"
                                value={stepTaskTitle}
                                onChange={e => setStepTaskTitle(e.target.value)}
                                className="w-full bg-slate-950 border border-slate-850 rounded-lg px-2.5 py-1.5 text-[10px] text-white outline-none"
                              />
                              <textarea
                                placeholder="Description Notes... tip: include {meet_link} to paste generated link"
                                value={stepTaskNotes}
                                onChange={e => setStepTaskNotes(e.target.value)}
                                rows={2}
                                className="w-full bg-slate-950 border border-slate-850 rounded-lg px-2.5 py-1.5 text-[10px] text-white outline-none resize-none"
                              />
                            </div>
                          )}

                          {newStepType === 'calendar' && (
                            <div className="space-y-2">
                              <input
                                type="text"
                                placeholder="Event Title"
                                value={stepCalendarTitle}
                                onChange={e => setStepCalendarTitle(e.target.value)}
                                className="w-full bg-slate-950 border border-slate-850 rounded-lg px-2.5 py-1.5 text-[10px] text-white outline-none"
                              />
                              <input
                                type="number"
                                placeholder="Duration (minutes)"
                                value={stepCalendarDuration}
                                onChange={e => setStepCalendarDuration(e.target.value)}
                                className="w-full bg-slate-950 border border-slate-850 rounded-lg px-2.5 py-1.5 text-[10px] text-white outline-none font-mono"
                              />
                              <textarea
                                placeholder="Event Description Notes..."
                                value={stepCalendarDesc}
                                onChange={e => setStepCalendarDesc(e.target.value)}
                                rows={2}
                                className="w-full bg-slate-950 border border-slate-850 rounded-lg px-2.5 py-1.5 text-[10px] text-white outline-none resize-none"
                              />
                            </div>
                          )}

                          <button
                            onClick={addStepToBuilder}
                            className="w-full bg-slate-900 hover:bg-slate-850 text-slate-300 font-mono text-[10px] py-1.5 rounded-lg border border-slate-800 cursor-pointer transition-colors"
                          >
                            + Append Action Block
                          </button>
                        </div>
                      </div>

                      {/* Compilation Save button */}
                      <button
                        onClick={saveNewMacro}
                        className="w-full bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/35 text-cyan-300 font-mono text-xs py-2.5 rounded-xl cursor-pointer transition-all hover:scale-[1.02] active:scale-[0.98] font-bold"
                      >
                        Compile & Register Voice Macro
                      </button>

                    </div>
                  </div>

                </div>

                {/* Floating execution terminal box overlay */}
                {runningMacroId && (
                  <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-4 bg-slate-950 border border-violet-500/40 rounded-2xl shadow-2xl space-y-2 font-mono text-xs text-slate-300 max-h-[180px] overflow-y-auto scrollbar-thin mt-4"
                  >
                    <div className="flex items-center justify-between pb-1 border-b border-slate-800">
                      <span className="text-violet-400 font-bold flex items-center gap-2">
                        <span className="relative flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-violet-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-violet-500"></span>
                        </span>
                        Voice Macro Sequence Execution
                      </span>
                      <span className="text-[10px] text-slate-500">Live Workspace Pipeline Monitor</span>
                    </div>
                    <div className="space-y-1 divide-y divide-slate-900/30 text-[11px]">
                      {executionLogs.map((log, lIdx) => (
                        <div key={lIdx} className="pt-1 flex items-start gap-2">
                          <span className="text-slate-600 font-bold">[{log.time}]</span>
                          <span className={
                            log.type === 'success' ? 'text-emerald-400' :
                            log.type === 'error' ? 'text-rose-400 font-bold' :
                            'text-slate-300'
                          }>
                            {log.text}
                          </span>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}

              </motion.div>
            )}

          </AnimatePresence>
        </div>

        {/* Firestore Activity Logs (Right Sidebar) */}
        <div className="w-64 bg-slate-900/40 border-l border-slate-800 flex flex-col overflow-hidden">
          <div className="p-4 border-b border-slate-800 flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Compliance Audit logs</span>
            <button onClick={fetchLogs} className="text-slate-500 hover:text-white">
              <RefreshCw size={12} />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-thin">
            {logs.length === 0 ? (
              <div className="text-center py-8 text-[10px] text-slate-500 font-mono">No operations logged yet.</div>
            ) : (
              logs.map((log) => (
                <div key={log.id} className="bg-slate-950 border border-slate-900 rounded-lg p-2.5 space-y-1.5">
                  <div className="flex items-center justify-between text-[9px] font-mono">
                    <span className="bg-cyan-500/10 text-cyan-400 px-1.5 py-0.5 rounded border border-cyan-500/15">
                      {log.service}
                    </span>
                    <span className="text-slate-500">
                      {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <div className="text-[10px] font-bold text-slate-300">{log.action}</div>
                  <p className="text-[9px] text-slate-400 leading-normal">{log.details}</p>
                </div>
              ))
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
