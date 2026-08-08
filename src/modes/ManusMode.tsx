import React, { useState } from 'react';
import { Home } from '../components/manus/Home';
import { ChatView } from '../components/manus/ChatView';
import { WebsiteBuilderView } from '../components/manus/WebsiteBuilderView';
import { useManusAgent } from '../hooks/useManusAgent';
import { AnimatePresence, motion } from 'motion/react';
import { Plus, Trash2, History, X, Cpu, FileText, BarChart3, Globe } from 'lucide-react';

export const ManusMode: React.FC = () => {
  const {
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
  } = useManusAgent();

  const [showHistory, setShowHistory] = useState(false);

  const handleExport = () => {
    const reportText = result?.content || 'Manus Task Summary';
    const blob = new Blob([reportText], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `manus-task-${Date.now()}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const getFormatIcon = (format: string) => {
    switch (format) {
      case 'website': return <Globe size={13} className="text-blue-500" />;
      case 'graph': return <BarChart3 size={13} className="text-emerald-500" />;
      case 'report': return <FileText size={13} className="text-orange-500" />;
      default: return <Cpu size={13} className="text-zinc-400" />;
    }
  };

  return (
    <div className="flex h-full w-full overflow-hidden bg-stone-50 dark:bg-zinc-950 text-gray-900 dark:text-zinc-100 relative">
      
      {/* ── Main Workspace Content Area ── */}
      <div className="flex-1 h-full overflow-hidden relative flex flex-col">
        {/* Simple top bar with history control / plus control */}
        <div className="absolute top-4 right-4 z-50 flex items-center gap-2">
          <select
            value={selectedModel}
            onChange={(e) => setSelectedModel(e.target.value as 'gemini' | 'kimi-k3')}
            className="bg-white dark:bg-zinc-900 text-gray-700 dark:text-zinc-300 text-xs px-2.5 py-2 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm focus:outline-none focus:border-blue-500 cursor-pointer transition-all hover:bg-gray-50 dark:hover:bg-zinc-850"
          >
            <option value="gemini">♊ Gemini 3.5</option>
            <option value="kimi-k3">👑 Kimi-K3 (Super Reasoning)</option>
          </select>

          <button
            onClick={createNewSession}
            className="p-2 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-zinc-900 shadow-sm hover:bg-gray-50 dark:hover:bg-zinc-850 text-gray-700 dark:text-zinc-300 transition-all flex items-center gap-1.5 text-xs font-semibold"
            title="New Chat Session"
          >
            <Plus size={14} className="text-blue-500" />
            <span className="hidden sm:inline">New Chat</span>
          </button>
          
          <button
            onClick={() => setShowHistory(!showHistory)}
            className={`p-2 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-zinc-900 shadow-sm hover:bg-gray-50 dark:hover:bg-zinc-850 text-gray-700 dark:text-zinc-300 transition-all flex items-center gap-1 ${
              showHistory ? 'ring-2 ring-blue-500/50' : ''
            }`}
            title="Toggle History Sidebar"
          >
            <History size={15} />
          </button>
        </div>

        {taskStatus === 'idle' ? (
          <Home onStartTask={startTask} />
        ) : taskType === 'website' ? (
          <WebsiteBuilderView
            websiteName={websiteName}
            steps={steps}
            status={taskStatus === 'running' ? 'running' : taskStatus === 'error' ? 'error' : 'completed'}
            onReset={resetTask}
            previewUrl={previewUrl}
            isLoading={isLoading}
            srcDoc={srcDoc}
          />
        ) : (
          <ChatView
            prompt={prompt}
            messages={[]}
            steps={steps}
            result={result}
            chartData={chartData}
            status={taskStatus}
            onReset={resetTask}
            onExport={handleExport}
            onSubmit={sendMessage}
            isLoading={isLoading}
          />
        )}
      </div>

      {/* ── Collapsible History Sidebar on the right ── */}
      <AnimatePresence initial={false}>
        {showHistory && (
          <motion.div
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 280, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 350, damping: 30 }}
            className="h-full shrink-0 border-l border-gray-200 dark:border-gray-800 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md overflow-hidden flex flex-col z-40"
          >
            <div className="p-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-500 dark:text-zinc-400 uppercase tracking-wider flex items-center gap-2">
                <History size={14} className="text-blue-500" />
                Manus Task History
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={createNewSession}
                  className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-805 text-gray-650 dark:text-zinc-300 transition-colors"
                  title="New Task"
                >
                  <Plus size={16} />
                </button>
                <button
                  onClick={() => setShowHistory(false)}
                  className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-805 text-gray-500 hover:text-gray-900 dark:hover:text-zinc-100 transition-colors"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-2 space-y-1 scrollbar-thin">
              {sessions.length === 0 ? (
                <div className="text-center py-10 text-gray-400 dark:text-zinc-500 text-xs">
                  No task runs recorded.
                </div>
              ) : (
                sessions.map((s) => (
                  <div
                    key={s.id}
                    onClick={() => loadSession(s.id)}
                    className={`w-full text-left p-3 rounded-xl flex items-center gap-3 transition-all cursor-pointer border select-none ${
                      currentSessionId === s.id
                        ? 'bg-blue-50 dark:bg-blue-950/20 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-900/40'
                        : 'hover:bg-gray-50 dark:hover:bg-zinc-850 text-gray-700 dark:text-zinc-300 border-transparent'
                    }`}
                  >
                    <div className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-zinc-800 flex items-center justify-center shrink-0 border border-gray-200 dark:border-gray-700">
                      {getFormatIcon(s.taskType)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-xs truncate">
                        {s.prompt || 'Untitled Task'}
                      </div>
                      <div className="text-[10px] text-gray-400 dark:text-zinc-500 mt-0.5 capitalize">
                        {s.taskStatus} • {s.taskType}
                      </div>
                    </div>
                    <button
                      onClick={(e) => deleteSession(s.id, e)}
                      className="p-1 rounded hover:bg-red-500/10 text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition-colors"
                      title="Delete Run"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
export default ManusMode;
