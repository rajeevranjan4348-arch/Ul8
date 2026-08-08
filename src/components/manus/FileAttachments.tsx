import React from 'react';
import { FileText, FileJson, File, Download } from 'lucide-react';

export interface AttachmentFile {
  name: string;
  type: 'pdf' | 'markdown' | 'json' | 'csv' | 'other';
  size: string;
  url?: string;
}

function FileCodeIcon({ size, className }: { size?: number, className?: string }) {
  return (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      width={size} 
      height={size} 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      className={className}
    >
      <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/>
      <polyline points="14 2 14 8 20 8"/>
      <path d="M9 13h6"/>
      <path d="M9 17h6"/>
      <path d="M12 13v4"/>
    </svg>
  );
}

interface FileCardProps {
  file: AttachmentFile;
}

export function FileCard({ file }: FileCardProps) {
  const getIcon = () => {
    switch (file.type) {
      case 'pdf':
        return <div className="p-2 bg-red-100 rounded-lg text-red-600"><FileText size={20} /></div>;
      case 'markdown':
        return <div className="p-2 bg-blue-100 rounded-lg text-blue-600"><FileCodeIcon size={20} /></div>;
      case 'json':
      case 'csv':
        return <div className="p-2 bg-green-100 rounded-lg text-green-600"><FileJson size={20} /></div>;
      default:
        return <div className="p-2 bg-gray-100 rounded-lg text-gray-600"><File size={20} /></div>;
    }
  };

  const handleDownload = () => {
    // Generate a simple dummy file to download
    const content = `Mock output file content for: ${file.name}`;
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div 
      onClick={handleDownload}
      className="flex items-center gap-3 p-3 bg-white border border-gray-200 dark:border-gray-800 rounded-xl hover:shadow-sm transition-all cursor-pointer min-w-[240px] group dark:bg-zinc-900"
    >
      {getIcon()}
      <div className="flex-1 min-w-0">
        <div className="font-medium text-sm truncate text-gray-900 dark:text-gray-100 group-hover:text-blue-600 transition-colors">
          {file.name}
        </div>
        <div className="text-xs text-gray-500 flex items-center gap-1">
          <span className="uppercase">{file.type}</span>
          <span>•</span>
          <span>{file.size}</span>
        </div>
      </div>
      <Download size={14} className="text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
    </div>
  );
}

interface FileAttachmentsProps {
  files: AttachmentFile[];
}

export function FileAttachments({ files }: FileAttachmentsProps) {
  if (!files || files.length === 0) return null;

  return (
    <div className="mt-6">
      <div className="flex flex-wrap gap-3 mb-4">
        {files.map((file, i) => (
          <FileCard key={i} file={file} />
        ))}
      </div>
      
      <div className="w-full text-center py-2 text-xs text-gray-400 font-medium">
        ✨ Click any file card to download/simulate download
      </div>
    </div>
  );
}
