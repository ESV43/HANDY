import React from 'react';
import { OutputFileFormat } from '../types';

interface FormatSelectorProps {
  selectedFormat: OutputFileFormat;
  onFormatChange: (format: OutputFileFormat) => void;
}

const FormatSelector: React.FC<FormatSelectorProps> = ({ selectedFormat, onFormatChange }) => {
  return (
    <div className="flex justify-center gap-4">
      <div
        onClick={() => onFormatChange('pdf')}
        className={`cursor-pointer flex-1 text-center p-4 rounded-lg border-2 transition-all duration-300 ${selectedFormat === 'pdf' ? 'border-indigo-500 bg-indigo-500/20' : 'border-slate-600 bg-slate-800 hover:bg-slate-700'}`}
      >
        <h3 className="font-semibold text-lg">PDF</h3>
        <p className="text-sm text-slate-400">Polished, readable document.</p>
      </div>
      <div
        onClick={() => onFormatChange('tex')}
        className={`cursor-pointer flex-1 text-center p-4 rounded-lg border-2 transition-all duration-300 ${selectedFormat === 'tex' ? 'border-indigo-500 bg-indigo-500/20' : 'border-slate-600 bg-slate-800 hover:bg-slate-700'}`}
      >
        <h3 className="font-semibold text-lg">LaTeX</h3>
        <p className="text-sm text-slate-400">Editable, typeset code.</p>
      </div>
    </div>
  );
};

export default FormatSelector;
