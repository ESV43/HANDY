import React, { useState, useCallback } from 'react';
import { UploadedFile, OutputFileFormat, FileStatus, PdfContent } from './types';
import FileUpload from './components/FileUpload';
import FileList from './components/FileList';
import FormatSelector from './components/FormatSelector';
import { processHandwrittenNotes } from './services/geminiService';
import { LogoIcon } from './components/icons';

// Make jspdf available globally from the script tag
declare const jspdf: any;
// Make pdfjsLib available globally
declare const pdfjsLib: any;

pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js`;

const App: React.FC = () => {
    const [files, setFiles] = useState<UploadedFile[]>([]);
    const [outputFormat, setOutputFormat] = useState<OutputFileFormat>('pdf');
    const [isProcessing, setIsProcessing] = useState<boolean>(false);

    const handleFilesSelected = (selectedFiles: File[]) => {
        const newFiles: UploadedFile[] = selectedFiles
            .filter(file => file.type === 'application/pdf')
            .map(file => ({
                id: `${file.name}-${file.lastModified}`,
                file,
                status: 'pending',
                output: null,
            }));
        setFiles(prevFiles => [...prevFiles, ...newFiles]);
    };

    const removeFile = (id: string) => {
        setFiles(prevFiles => prevFiles.filter(f => f.id !== id));
    };

    const convertPdfToImages = async (file: File): Promise<string[]> => {
        const images: string[] = [];
        const fileBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: fileBuffer }).promise;
        const numPages = pdf.numPages;

        for (let i = 1; i <= numPages; i++) {
            const page = await pdf.getPage(i);
            const viewport = page.getViewport({ scale: 1.5 });
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            if (!context) continue;
            
            canvas.height = viewport.height;
            canvas.width = viewport.width;

            await page.render({ canvasContext: context, viewport: viewport }).promise;
            images.push(canvas.toDataURL('image/jpeg').split(',')[1]);
        }
        return images;
    };
    
    const generatePdf = (data: PdfContent, filename: string) => {
      const { jsPDF } = jspdf;
      const doc = new jsPDF();
      let yPos = 20;

      doc.setFontSize(22);
      doc.text(data.title, 105, yPos, { align: 'center' });
      yPos += 20;

      data.content.forEach(item => {
          if (yPos > 280) {
              doc.addPage();
              yPos = 20;
          }
          switch (item.type) {
              case 'heading1':
                  doc.setFontSize(18);
                  doc.setFont(undefined, 'bold');
                  doc.text(item.text, 14, yPos);
                  yPos += 10;
                  break;
              case 'heading2':
                  doc.setFontSize(14);
                  doc.setFont(undefined, 'bold');
                  doc.text(item.text, 14, yPos);
                  yPos += 8;
                  break;
              case 'paragraph':
                  doc.setFontSize(12);
                  doc.setFont(undefined, 'normal');
                  const splitText = doc.splitTextToSize(item.text, 180);
                  doc.text(splitText, 14, yPos);
                  yPos += (splitText.length * 5) + 5;
                  break;
              case 'bullet_list':
                  doc.setFontSize(12);
                  doc.setFont(undefined, 'normal');
                  item.items.forEach(listItem => {
                      const splitListItem = doc.splitTextToSize(`• ${listItem}`, 170);
                      if (yPos > 280) {
                          doc.addPage();
                          yPos = 20;
                      }
                      doc.text(splitListItem, 20, yPos);
                      yPos += (splitListItem.length * 5) + 2;
                  });
                  yPos += 5;
                  break;
          }
      });
      doc.save(`${filename.replace('.pdf', '')}_converted.pdf`);
    };

    const downloadTexFile = (content: string, filename: string) => {
        const blob = new Blob([content], { type: 'text/x-tex' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${filename.replace('.pdf', '')}.tex`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const handleDownload = (fileId: string) => {
        const file = files.find(f => f.id === fileId);
        if (!file || !file.output) return;

        if (outputFormat === 'pdf' && typeof file.output === 'object') {
            generatePdf(file.output as PdfContent, file.file.name);
        } else if (outputFormat === 'tex' && typeof file.output === 'string') {
            downloadTexFile(file.output, file.file.name);
        }
    };
    
    const handleConvert = useCallback(async () => {
        setIsProcessing(true);

        const processingPromises = files
            .filter(f => f.status === 'pending')
            .map(async (fileToProcess) => {
                setFiles(prev => prev.map(f => f.id === fileToProcess.id ? { ...f, status: 'processing' } : f));
                try {
                    const images = await convertPdfToImages(fileToProcess.file);
                    if (images.length === 0) throw new Error("Could not extract images from PDF.");

                    const result = await processHandwrittenNotes(images, outputFormat);
                    setFiles(prev => prev.map(f => f.id === fileToProcess.id ? { ...f, status: 'completed', output: result } : f));
                } catch (error) {
                    console.error('Error processing file:', fileToProcess.file.name, error);
                    setFiles(prev => prev.map(f => f.id === fileToProcess.id ? { ...f, status: 'error' } : f));
                }
            });

        await Promise.all(processingPromises);
        setIsProcessing(false);
    }, [files, outputFormat]);

    return (
        <div className="min-h-screen bg-slate-900 text-slate-100 font-sans flex flex-col items-center p-4 sm:p-8">
            <div className="w-full max-w-4xl mx-auto">
                <header className="text-center mb-8">
                    <div className="flex items-center justify-center gap-4 mb-4">
                        <LogoIcon />
                        <h1 className="text-4xl sm:text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-indigo-600">
                            DigiNotes AI
                        </h1>
                    </div>
                    <p className="text-slate-400 text-lg">
                        Transform your handwritten notes into polished digital documents.
                    </p>
                </header>

                <main className="space-y-8">
                    <div className="bg-slate-800/50 rounded-xl p-6 shadow-lg border border-slate-700">
                        <h2 className="text-xl font-semibold mb-4 text-slate-200">1. Upload Your Notes</h2>
                        <FileUpload onFilesSelected={handleFilesSelected} />
                    </div>

                    {files.length > 0 && (
                        <>
                            <div className="bg-slate-800/50 rounded-xl p-6 shadow-lg border border-slate-700">
                                <h2 className="text-xl font-semibold mb-4 text-slate-200">2. Review Files</h2>
                                <FileList files={files} onRemove={removeFile} onDownload={handleDownload} />
                            </div>

                            <div className="bg-slate-800/50 rounded-xl p-6 shadow-lg border border-slate-700">
                                <h2 className="text-xl font-semibold mb-4 text-slate-200">3. Choose Output Format</h2>
                                <FormatSelector selectedFormat={outputFormat} onFormatChange={setOutputFormat} />
                            </div>

                            <div className="flex justify-center">
                                <button
                                    onClick={handleConvert}
                                    disabled={isProcessing || files.every(f => f.status !== 'pending')}
                                    className="w-full max-w-sm bg-indigo-600 text-white font-bold py-3 px-6 rounded-lg hover:bg-indigo-500 disabled:bg-slate-600 disabled:cursor-not-allowed transition-all duration-300 ease-in-out transform hover:scale-105 shadow-indigo-500/50"
                                >
                                    {isProcessing ? 'Processing...' : 'Convert Notes'}
                                </button>
                            </div>
                        </>
                    )}
                </main>
            </div>
        </div>
    );
};

export default App;
