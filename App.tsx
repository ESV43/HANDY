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
    
    const generatePdf = async (data: PdfContent, filename: string) => {
      const { jsPDF } = jspdf;
      const doc = new jsPDF();
      let yPos = 20;
      const pageMargin = 14;
      const pageWidth = doc.internal.pageSize.getWidth();
      const textWidth = pageWidth - (pageMargin * 2);

      doc.setFontSize(22);
      doc.text(data.title, pageWidth / 2, yPos, { align: 'center' });
      yPos += 20;

      for (const item of data.content) {
          if (yPos > 270) {
              doc.addPage();
              yPos = 20;
          }
          switch (item.type) {
              case 'heading1':
                  doc.setFontSize(18);
                  doc.setFont(undefined, 'bold');
                  doc.text(item.text, pageMargin, yPos);
                  yPos += 10;
                  break;
              case 'heading2':
                  doc.setFontSize(14);
                  doc.setFont(undefined, 'bold');
                  doc.text(item.text, pageMargin, yPos);
                  yPos += 8;
                  break;
              case 'paragraph':
                  doc.setFontSize(12);
                  doc.setFont(undefined, 'normal');
                  const splitText = doc.splitTextToSize(item.text, textWidth);
                  doc.text(splitText, pageMargin, yPos);
                  yPos += (splitText.length * 5) + 5;
                  break;
              case 'equation': {
                  doc.setFontSize(12);
                  doc.setFont(undefined, 'normal');
                  
                  const splitEquation = doc.splitTextToSize(item.text, textWidth);
                  const equationHeight = (splitEquation.length * 5);

                  if (yPos + equationHeight + 6 > 280) { // 6 is for padding
                      doc.addPage();
                      yPos = 20;
                  }

                  yPos += 3; // Padding before
                  doc.text(splitEquation, pageWidth / 2, yPos, { align: 'center' });
                  yPos += equationHeight;
                  yPos += 3; // Padding after
                  break;
              }
              case 'bullet_list':
                  doc.setFontSize(12);
                  doc.setFont(undefined, 'normal');
                  item.items.forEach(listItem => {
                      const splitListItem = doc.splitTextToSize(`• ${listItem}`, textWidth - 6);
                      if (yPos > 280) {
                          doc.addPage();
                          yPos = 20;
                      }
                      doc.text(splitListItem, pageMargin + 6, yPos);
                      yPos += (splitListItem.length * 5) + 2;
                  });
                  yPos += 5;
                  break;
              case 'diagram': {
                    if (!item.svg) break;
                    
                    const originalFont = doc.getFont();
                    const originalFontSize = doc.getFontSize();
                    
                    doc.setFontSize(10);
                    doc.setFont(originalFont.fontName, 'italic');
                    const splitDescription = doc.splitTextToSize(`Diagram: ${item.text}`, textWidth);
                    const descriptionHeight = (splitDescription.length * 4) + 5;

                    const svgString = item.svg;
                    let svgHeight = 50;
                    const renderWidth = textWidth;
                    
                    const widthMatch = svgString.match(/width="([^"]+)"/);
                    const heightMatch = svgString.match(/height="([^"]+)"/);
                    const viewBoxMatch = svgString.match(/viewBox="([^"]+)"/);

                    let aspectRatio = 1; 
                    if (widthMatch && heightMatch) {
                        const w = parseFloat(widthMatch[1]);
                        const h = parseFloat(heightMatch[1]);
                        if (w > 0 && h > 0) aspectRatio = h / w;
                    } else if (viewBoxMatch) {
                        const parts = viewBoxMatch[1].split(/\s+/);
                        if (parts.length === 4) {
                            const vbWidth = parseFloat(parts[2]);
                            const vbHeight = parseFloat(parts[3]);
                            if (vbWidth > 0 && vbHeight > 0) aspectRatio = vbHeight / vbWidth;
                        }
                    }
                    svgHeight = renderWidth * aspectRatio;

                    if (yPos + descriptionHeight + svgHeight > 280) {
                        doc.addPage();
                        yPos = 20;
                    }

                    doc.text(splitDescription, pageMargin, yPos);
                    yPos += descriptionHeight;
                    
                    const svgBlob = new Blob([svgString], {type: 'image/svg+xml;charset=utf-8'});
                    const url = URL.createObjectURL(svgBlob);
                    const img = new Image();
                    
                    const promise = new Promise<void>((resolve, reject) => {
                        img.onload = () => {
                            const canvas = document.createElement('canvas');
                            const scale = 2; // Oversample for better quality
                            canvas.width = renderWidth * scale;
                            canvas.height = svgHeight * scale;
                            const ctx = canvas.getContext('2d');
                            if (ctx) {
                                ctx.scale(scale, scale);
                                ctx.drawImage(img, 0, 0, renderWidth, svgHeight);
                                const dataUrl = canvas.toDataURL('image/png');
                                doc.addImage(dataUrl, 'PNG', pageMargin, yPos, renderWidth, svgHeight);
                            }
                            URL.revokeObjectURL(url);
                            resolve();
                        };
                        img.onerror = (err) => {
                           URL.revokeObjectURL(url);
                           reject(err);
                        }
                        img.src = url;
                    });

                    try {
                        await promise;
                        yPos += svgHeight + 10;
                    } catch (error) {
                        console.error("Failed to render SVG:", error);
                        const errorText = "[Error rendering diagram]";
                        doc.setFontSize(10);
                        doc.setFont(undefined, 'normal');
                        doc.setTextColor(255, 0, 0);
                        doc.text(errorText, pageMargin, yPos);
                        doc.setTextColor(0, 0, 0);
                        yPos += 10;
                    }
                    
                    doc.setFont(originalFont.fontName, originalFont.fontStyle);
                    doc.setFontSize(originalFontSize);
                    break;
                }
          }
      }
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

    const handleDownload = async (fileId: string) => {
        const file = files.find(f => f.id === fileId);
        if (!file || !file.output) return;

        if (outputFormat === 'pdf' && typeof file.output === 'object') {
            await generatePdf(file.output as PdfContent, file.file.name);
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