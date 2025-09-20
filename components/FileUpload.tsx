import React, { useState, useCallback } from 'react';
import { UploadIcon } from './icons';

interface FileUploadProps {
  onFilesSelected: (files: File[]) => void;
}

const FileUpload: React.FC<FileUploadProps> = ({ onFilesSelected }) => {
  const [isDragging, setIsDragging] = useState(false);

  const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files);
    if (files && files.length > 0) {
      onFilesSelected(files);
    }
  }, [onFilesSelected]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
     if (files && files.length > 0) {
      onFilesSelected(files);
    }
  };

  return (
    <div
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors duration-300 ${isDragging ? 'border-indigo-500 bg-slate-700/50' : 'border-slate-600 bg-slate-800'}`}
    >
      <input
        type="file"
        id="file-upload"
        multiple
        accept=".pdf"
        onChange={handleFileChange}
        className="hidden"
      />
      <label htmlFor="file-upload" className="cursor-pointer flex flex-col items-center">
        <UploadIcon />
        <p className="mt-4 text-slate-300">
          <span className="font-semibold text-indigo-400">Click to upload</span> or drag and drop
        </p>
        <p className="text-xs text-slate-500 mt-1">PDF files only</p>
      </label>
    </div>
  );
};

export default FileUpload;
