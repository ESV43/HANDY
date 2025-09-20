import React from 'react';
import { UploadedFile } from '../types';
import { PdfIcon, CheckCircleIcon, XCircleIcon, TrashIcon, DownloadIcon, SpinnerIcon } from './icons';

interface FileListProps {
  files: UploadedFile[];
  onRemove: (id: string) => void;
  onDownload: (id: string) => void;
}

const FileItem: React.FC<{ file: UploadedFile; onRemove: (id: string) => void; onDownload: (id: string) => void; }> = ({ file, onRemove, onDownload }) => {
    const renderStatus = () => {
        switch (file.status) {
            case 'pending':
                return <span className="text-xs text-slate-400">Ready to convert</span>;
            case 'processing':
                return <div className="flex items-center gap-2 text-xs text-yellow-400"><SpinnerIcon /> Processing...</div>;
            case 'completed':
                return <div className="flex items-center gap-2 text-xs text-green-400"><CheckCircleIcon /> Completed</div>;
            case 'error':
                return <div className="flex items-center gap-2 text-xs text-red-400"><XCircleIcon /> Error</div>;
            default:
                return null;
        }
    };
    
    return (
        <li className="flex items-center justify-between bg-slate-800 p-3 rounded-lg">
            <div className="flex items-center gap-3">
                <PdfIcon />
                <div className="flex flex-col">
                    <span className="text-sm font-medium text-slate-200">{file.file.name}</span>
                    {renderStatus()}
                </div>
            </div>
            <div className="flex items-center gap-2">
                {file.status === 'completed' && (
                    <button onClick={() => onDownload(file.id)} className="p-2 text-slate-400 hover:text-indigo-400 transition-colors">
                        <DownloadIcon />
                    </button>
                )}
                <button onClick={() => onRemove(file.id)} className="p-2 text-slate-400 hover:text-red-400 transition-colors">
                    <TrashIcon />
                </button>
            </div>
        </li>
    );
};


const FileList: React.FC<FileListProps> = ({ files, onRemove, onDownload }) => {
  return (
    <ul className="space-y-3">
      {files.map(file => (
        <FileItem key={file.id} file={file} onRemove={onRemove} onDownload={onDownload} />
      ))}
    </ul>
  );
};

export default FileList;
