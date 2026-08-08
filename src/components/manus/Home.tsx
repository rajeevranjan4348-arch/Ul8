import React, { useState, useRef } from 'react';
import { 
  Plus, 
  ArrowUp,
  Mic, 
  Cable,
  Layout, 
  FileText, 
  BarChart3, 
  Globe, 
  Table as TableIcon,
  PieChart,
  LineChart,
  ScatterChart,
  Flame,
  Link as LinkIcon,
  X
} from 'lucide-react';

const ACTION_CHIPS = [
  { label: "Build website", icon: Globe },
  { label: "Data analysis", icon: BarChart3 },
  { label: "Research link", icon: LinkIcon }
];

const OUTPUT_FORMATS = [
  { id: 'graph', label: 'Graph', icon: BarChart3, desc: 'Interactive charts' },
  { id: 'report', label: 'Report', icon: FileText, desc: 'Detailed analysis' },
  { id: 'slides', label: 'Slides', icon: Layout, desc: 'Presentation deck' },
  { id: 'website', label: 'Website', icon: Globe, desc: 'Single page site' },
  { id: 'spreadsheet', label: 'Spreadsheet', icon: TableIcon, desc: 'Tabular data' },
];

const CHART_TYPES = [
  { id: 'bar', label: 'Bar', icon: BarChart3 },
  { id: 'line', label: 'Line', icon: LineChart },
  { id: 'pie', label: 'Pie', icon: PieChart },
  { id: 'scatter', label: 'Scatter', icon: ScatterChart },
  { id: 'area', label: 'Area', icon: Flame },
  { id: 'bubble', label: 'Bubble', icon: PieChart },
];

interface HomeProps {
  onStartTask: (prompt: string, options: any) => void;
}

export function Home({ onStartTask }: HomeProps) {
  const [prompt, setPrompt] = useState('');
  const [activeIntent, setActiveIntent] = useState<{ label: string, icon: any, placeholder?: string } | null>(null);
  const [selectedFormat, setSelectedFormat] = useState<string | null>(null);
  const [selectedChart, setSelectedChart] = useState<string | null>(null);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [fileData, setFileData] = useState<string | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const processFile = async (file: File) => {
    setUploadedFile(file);
    setIsExtracting(true);
    
    try {
      const fileName = file.name.toLowerCase();
      
      if (fileName.endsWith('.csv') || fileName.endsWith('.json') || fileName.endsWith('.txt')) {
        const reader = new FileReader();
        reader.onload = (event) => {
          const text = event.target?.result as string;
          setFileData(text);
          if (!prompt.trim()) {
            setPrompt(`Analyze the contents of ${file.name} and summarize critical trends.`);
          }
          setIsExtracting(false);
        };
        reader.readAsText(file);
      } else {
        // Simple plain text reading fallback for PDF/Excel to mock the server extraction safely
        const reader = new FileReader();
        reader.onload = () => {
          setFileData(`[Simulated Raw Text Extract from ${file.name}]`);
          if (!prompt.trim()) {
            setPrompt(`Analyze the raw text structure of ${file.name} for key business metrics.`);
          }
          setIsExtracting(false);
        };
        reader.readAsText(file);
      }
    } catch (error) {
      console.error('File extraction error:', error);
      setIsExtracting(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await processFile(file);
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
      await processFile(file);
    }
  };

  const handleRemoveFile = () => {
    setUploadedFile(null);
    setFileData(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleStart = () => {
    if (!prompt.trim()) return;

    const options: any = { 
      format: selectedFormat || 'report', 
      chartType: selectedChart || 'auto',
      intent: activeIntent?.label
    };

    if (fileData) {
      options.fileData = fileData;
      options.fileName = uploadedFile?.name;
    }

    if (activeIntent?.label === 'Website') {
      options.websiteName = prompt.trim();
    }

    if (activeIntent?.label === 'Research') {
      options.url = prompt.trim();
    }

    onStartTask(prompt, options);
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6 bg-stone-50 dark:bg-zinc-950 min-h-full">
      <div className="w-full max-w-4xl space-y-12">
        <div className="text-center space-y-4">
          <h1 className="text-6xl font-serif font-bold tracking-tight text-stone-900 dark:text-zinc-100">
            What can I do for you?
          </h1>
          <p className="text-gray-500 text-lg">Assign a complex workspace task, and I'll build or analyze it.</p>
        </div>

        <div className="space-y-6">
          {uploadedFile && (
            <div className="flex gap-2 justify-center flex-wrap">
              <div className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-zinc-900 rounded-full border border-blue-100 dark:border-gray-850 shadow-sm">
                <FileText size={16} className="text-blue-600" />
                <span className="text-sm font-medium text-gray-800 dark:text-gray-200">{uploadedFile.name}</span>
                {isExtracting ? (
                  <div className="w-3 h-3 border-2 border-blue-600/30 border-t-blue-600 rounded-full animate-spin" />
                ) : (
                  <button onClick={handleRemoveFile} className="p-0.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors">
                    <X size={14} className="text-gray-500" />
                  </button>
                )}
              </div>
            </div>
          )}

          <div 
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`flex flex-col gap-3 rounded-[22px] transition-all relative py-4 max-h-[312px] w-full z-[2] shadow-xl border ${
              isDragging 
                ? 'bg-blue-50 border-blue-500 ring-2 ring-blue-500/20 dark:bg-blue-950/20 dark:border-blue-400' 
                : 'bg-white dark:bg-zinc-900 border-gray-200 dark:border-gray-800'
            }`}
          >
            {isDragging && (
              <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-blue-500/10 backdrop-blur-sm rounded-[22px] border-2 border-dashed border-blue-500 pointer-events-none animate-pulse">
                <Plus className="text-blue-500 mb-1" size={24} />
                <span className="text-sm font-semibold text-blue-500">Drop file here to analyze</span>
              </div>
            )}
            <div className="overflow-y-auto pl-4 pr-2">
              {activeIntent && (
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-600 text-white rounded-full mr-2 mb-2 align-middle">
                  <activeIntent.icon size={12} />
                  <span className="text-xs font-medium">{activeIntent.label}</span>
                  <button 
                    onClick={() => {
                      if (activeIntent.label === "Data analysis") {
                        setSelectedFormat(null);
                        setSelectedChart(null);
                      }
                      if (activeIntent.label === "Website") {
                        setSelectedFormat(null);
                      }
                      setActiveIntent(null);
                      setPrompt('');
                    }} 
                    className="p-0.5 hover:bg-white/20 rounded-full transition-colors"
                  >
                    <X size={10} />
                  </button>
                </div>
              )}
              <textarea 
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleStart();
                  }
                }}
                className="flex border-none focus:outline-none focus:ring-0 disabled:cursor-not-allowed disabled:opacity-50 overflow-hidden bg-transparent px-0 w-full placeholder:text-gray-400 text-lg shadow-none resize-none leading-relaxed min-h-[48px] dark:text-zinc-100" 
                rows={1}
                placeholder={activeIntent?.placeholder || "Assign a task or ask anything"} 
              />
            </div>
            <div className="px-3 flex justify-between items-center border-t border-gray-100 dark:border-gray-850 pt-3">
              <div className="flex gap-2 items-center flex-shrink-0">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.xlsx,.xls,.pdf,.txt,.json"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isExtracting}
                  className="rounded-full border border-gray-200 dark:border-gray-800 inline-flex items-center justify-center text-gray-500 hover:bg-gray-50 dark:hover:bg-zinc-800 w-8 h-8 p-0 shrink-0 relative" 
                >
                  <Plus size={18} />
                  {uploadedFile && (
                    <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-4 h-[2px] bg-blue-600 rounded-full shadow-md" />
                  )}
                </button>
                <div 
                  onClick={() => {
                    setSelectedFormat('spreadsheet');
                    setActiveIntent({
                      label: 'Tabular Data',
                      icon: TableIcon,
                      placeholder: 'Describe the spreadsheet structure or data you wish to draft'
                    });
                  }}
                  className="flex items-center gap-1 p-1 pl-2 pr-2 cursor-pointer rounded-[100px] border border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-zinc-850"
                >
                  <Cable size={14} className="text-gray-500" />
                  <span className="text-xs text-gray-500">Spreadsheet</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button 
                  onClick={handleStart}
                  disabled={!prompt.trim()}
                  className={`inline-flex items-center justify-center font-medium transition-colors gap-1.5 text-sm rounded-full w-8 h-8 ${
                    prompt.trim() 
                      ? "bg-blue-600 text-white cursor-pointer hover:bg-blue-700" 
                      : "bg-gray-100 text-gray-400 dark:bg-zinc-800 dark:text-zinc-600 cursor-not-allowed"
                  }`}
                >
                  <ArrowUp size={15} />
                </button>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap justify-center gap-3">
            {ACTION_CHIPS.map((chip) => (
              <button
                key={chip.label}
                onClick={() => {
                  if (chip.label === "Research link") {
                    setActiveIntent({ 
                      label: "Research", 
                      icon: chip.icon,
                      placeholder: "Enter URL to research (e.g., https://example.com)"
                    });
                    setPrompt('');
                  } else if (chip.label === "Build website") {
                    setSelectedFormat('website');
                    setActiveIntent({ 
                      label: "Website", 
                      icon: chip.icon,
                      placeholder: "Enter website name (e.g., Portfolio, SaaS Dashboard)"
                    });
                    setPrompt('');
                  } else if (chip.label === "Data analysis") {
                    setSelectedFormat('graph');
                    setSelectedChart('bar');
                    setActiveIntent({ 
                      label: "Data analysis", 
                      icon: chip.icon,
                      placeholder: "Describe the data you want to analyze or upload a file"
                    });
                    setPrompt('');
                  }
                }}
                className="px-4 py-2 border border-gray-200 dark:border-gray-800 rounded-full text-xs font-medium text-gray-600 dark:text-gray-400 hover:border-blue-600 dark:hover:border-blue-600 hover:text-blue-600 flex items-center gap-2 bg-white dark:bg-zinc-900 transition-all cursor-pointer"
              >
                <chip.icon size={14} />
                {chip.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-6">
          <div className="space-y-4">
            <h3 className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest px-1">Choose output format</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {OUTPUT_FORMATS.map((format) => (
                <button
                  key={format.id}
                  onClick={() => setSelectedFormat(format.id)}
                  className={`flex items-start gap-4 p-4 rounded-2xl border transition-all text-left group cursor-pointer ${
                    selectedFormat === format.id 
                      ? "bg-white dark:bg-zinc-900 border-blue-600 shadow-lg -translate-y-1" 
                      : "bg-white/50 dark:bg-zinc-900/50 border-gray-200 dark:border-gray-800 hover:bg-white dark:hover:bg-zinc-900 hover:-translate-y-0.5"
                  }`}
                >
                  <div className={`p-2.5 rounded-xl transition-colors ${
                    selectedFormat === format.id ? "bg-blue-600 text-white" : "bg-gray-100 dark:bg-zinc-800 text-gray-500"
                  }`}>
                    <format.icon size={20} />
                  </div>
                  <div>
                    <div className="font-bold text-sm text-gray-900 dark:text-gray-100">{format.label}</div>
                    <div className="text-xs text-gray-500 mt-0.5">{format.desc}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest px-1">Preferred charts gallery</h3>
            <div className="grid grid-cols-3 gap-3">
              {CHART_TYPES.map((chart) => (
                <button
                  key={chart.id}
                  onClick={() => setSelectedChart(chart.id)}
                  className={`flex flex-col items-center justify-center gap-2 p-4 rounded-2xl border bg-white dark:bg-zinc-900 transition-all group cursor-pointer ${
                    selectedChart === chart.id 
                      ? "border-blue-600 shadow-lg -translate-y-1" 
                      : "border-gray-200 dark:border-gray-800 hover:-translate-y-0.5"
                  }`}
                >
                  <div className={`p-2 rounded-lg transition-colors ${
                    selectedChart === chart.id ? "bg-blue-50 dark:bg-blue-950/40 text-blue-600" : "text-gray-400 group-hover:text-gray-700"
                  }`}>
                    <chart.icon size={22} />
                  </div>
                  <span className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{chart.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
export default Home;
