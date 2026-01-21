
import React, { useEffect, useState, useRef, useCallback } from 'react';

declare const pdfjsLib: any;

interface ClauseModalProps {
  isOpen: boolean;
  onClose: () => void;
  standardName: string;
  clauseNumber: string;
  pdfData: Uint8Array;
  initialPage: number;
}

export const ClauseModal: React.FC<ClauseModalProps> = ({ 
  isOpen, 
  onClose, 
  standardName, 
  clauseNumber, 
  pdfData,
  initialPage
}) => {
  // Ensure initialPage is valid (PDF.js is 1-indexed)
  const [currentPage, setCurrentPage] = useState(Math.max(1, initialPage));
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [scale, setScale] = useState(1.0);
  
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [size, setSize] = useState({ width: 900, height: 800 });
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const sizeStart = useRef({ w: 0, h: 0 });

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pdfDocRef = useRef<any>(null);
  const renderTaskRef = useRef<any>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      const w = Math.min(window.innerWidth * 0.9, 1000);
      const h = Math.min(window.innerHeight * 0.9, 850);
      setSize({ width: w, height: h });
      setPos({
        x: (window.innerWidth - w) / 2,
        y: (window.innerHeight - h) / 2
      });
    }
  }, [isOpen]);

  const renderPage = useCallback(async (num: number, currentScale: number) => {
    if (!pdfDocRef.current || !canvasRef.current) return;
    
    // Safety check: Don't request pages out of bounds
    const pageNum = Math.max(1, Math.min(num, pdfDocRef.current.numPages));
    
    try {
      if (renderTaskRef.current) {
        renderTaskRef.current.cancel();
      }

      const page = await pdfDocRef.current.getPage(pageNum);
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');
      if (!context) return;
      
      const viewport = page.getViewport({ scale: currentScale });
      const pixelRatio = window.devicePixelRatio || 1;
      
      canvas.height = viewport.height * pixelRatio;
      canvas.width = viewport.width * pixelRatio;
      canvas.style.height = `${viewport.height}px`;
      canvas.style.width = `${viewport.width}px`;
      
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);

      const renderTask = page.render({
        canvasContext: context,
        viewport: viewport
      });
      renderTaskRef.current = renderTask;

      await renderTask.promise;
      setLoading(false);
    } catch (err: any) {
      if (err.name === 'RenderingCancelledException') return;
      console.error("Page render error:", err);
      setError(`Failed to render page ${pageNum}.`);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    
    const loadPdf = async () => {
      setLoading(true);
      setError(null);
      try {
        const loadingTask = pdfjsLib.getDocument({ 
          data: pdfData.slice(0),
          disableAutoFetch: true,
          disableStream: true
        });
        
        const pdf = await loadingTask.promise;
        pdfDocRef.current = pdf;
        setTotalPages(pdf.numPages);
        
        // Clamp initial page to available pages
        const startPage = Math.max(1, Math.min(initialPage, pdf.numPages));
        setCurrentPage(startPage);
        renderPage(startPage, scale);
      } catch (err: any) {
        console.error("PDF load error:", err);
        setError(`Could not load PDF document: ${err.message}`);
        setLoading(false);
      }
    };

    loadPdf();

    return () => {
      if (renderTaskRef.current) {
        renderTaskRef.current.cancel();
      }
      if (pdfDocRef.current) {
        pdfDocRef.current.destroy();
        pdfDocRef.current = null;
      }
    };
  }, [isOpen, pdfData, initialPage, scale, renderPage]);

  useEffect(() => {
    if (pdfDocRef.current && !loading) {
      renderPage(currentPage, scale);
    }
  }, [currentPage, scale, renderPage, loading]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('.drag-handle')) {
      setIsDragging(true);
      dragStart.current = { x: e.clientX - pos.x, y: e.clientY - pos.y };
    }
  };

  const handleResizeStart = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsResizing(true);
    dragStart.current = { x: e.clientX, y: e.clientY };
    sizeStart.current = { w: size.width, h: size.height };
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        setPos({
          x: e.clientX - dragStart.current.x,
          y: e.clientY - dragStart.current.y
        });
      }
      if (isResizing) {
        const deltaX = e.clientX - dragStart.current.x;
        const deltaY = e.clientY - dragStart.current.y;
        setSize({
          width: Math.max(400, sizeStart.current.w + deltaX),
          height: Math.max(300, sizeStart.current.h + deltaY)
        });
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      setIsResizing(false);
    };

    if (isDragging || isResizing) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, isResizing]);

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm pointer-events-none"
      aria-hidden="true"
    >
      <div 
        ref={modalRef}
        style={{ 
          left: `${pos.x}px`, 
          top: `${pos.y}px`, 
          width: `${size.width}px`, 
          height: `${size.height}px`,
          position: 'absolute'
        }}
        className={`bg-white rounded-xl shadow-2xl flex flex-col overflow-hidden animate-scale-up pointer-events-auto border border-slate-200 select-none ${isDragging ? 'opacity-90' : ''}`}
        onMouseDown={handleMouseDown}
      >
        <div className="drag-handle px-6 py-3 border-b border-slate-100 flex items-center justify-between bg-slate-50 cursor-move">
          <div className="flex items-center space-x-3 pointer-events-none">
            <div className="flex-shrink-0 w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div className="overflow-hidden">
              <div className="flex items-center space-x-2">
                <h3 className="font-bold text-slate-800 truncate max-w-[200px] md:max-w-xs">{standardName}</h3>
                <span className="bg-blue-100 text-blue-700 text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider">Clause {clauseNumber}</span>
              </div>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            <div className="flex items-center bg-white border border-slate-200 rounded-lg mr-4 overflow-hidden">
               <button 
                onClick={() => setScale(prev => Math.max(0.5, prev - 0.25))}
                title="Zoom Out"
                className="p-1.5 hover:bg-slate-50 text-slate-500 border-r border-slate-100"
               >
                 <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                 </svg>
               </button>
               <span className="px-2 text-[10px] font-bold text-slate-600 min-w-[3rem] text-center">
                 {Math.round(scale * 100)}%
               </span>
               <button 
                onClick={() => setScale(prev => Math.min(4, prev + 0.25))}
                title="Zoom In"
                className="p-1.5 hover:bg-slate-50 text-slate-500 border-l border-slate-100"
               >
                 <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                 </svg>
               </button>
            </div>

            <button 
              onClick={onClose}
              className="p-1.5 hover:bg-red-50 rounded-lg text-slate-400 hover:text-red-500 transition-all active:scale-90"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="bg-slate-800 px-6 py-2 flex items-center justify-between text-white shadow-inner">
          <div className="flex items-center space-x-4">
            <button 
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage <= 1 || loading}
              className="p-1 hover:bg-slate-700 disabled:opacity-30 rounded transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            </button>
            <div className="text-xs font-mono tracking-widest uppercase flex items-center space-x-2">
              <span>Page</span>
              <span className="text-blue-400 font-bold min-w-[1rem] text-center">{currentPage}</span>
              <span className="text-slate-500">/</span>
              <span>{totalPages}</span>
            </div>
            <button 
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage >= totalPages || loading}
              className="p-1 hover:bg-slate-700 disabled:opacity-30 rounded transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
          
          <div className="flex items-center space-x-2">
            <button 
              onClick={() => setScale(1.0)}
              className="text-[10px] bg-slate-700 hover:bg-slate-600 px-2 py-1 rounded font-bold uppercase tracking-tighter"
            >
              Reset Zoom
            </button>
          </div>
        </div>

        <div className="flex-1 bg-slate-200 relative overflow-auto custom-scrollbar flex justify-center p-4 md:p-8 select-auto">
          {loading && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-slate-50/80 backdrop-blur-sm">
               <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-600 border-t-transparent mb-4" />
               <p className="text-slate-600 font-bold">Rendering Standard...</p>
            </div>
          )}
          {error && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center text-red-500 bg-white p-6">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <p className="font-semibold text-center text-sm">{error}</p>
            </div>
          )}
          <div className="bg-white shadow-2xl p-0 h-fit rounded-sm border border-slate-300 transition-transform duration-200 ease-out origin-top">
            <canvas ref={canvasRef} />
          </div>
        </div>

        <div 
          onMouseDown={handleResizeStart}
          className="absolute bottom-0 right-0 w-6 h-6 cursor-nwse-resize z-50 flex items-center justify-center group"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-slate-300 group-hover:text-blue-500 transition-colors" fill="currentColor" viewBox="0 0 24 24">
            <path d="M22 22h-2v-2h2v2zM22 18h-2v-2h2v2zM18 22h-2v-2h2v2zM18 18h-2v-2h2v2zM14 22h-2v-2h2v2z" />
          </svg>
        </div>

        <div className="px-6 py-2 bg-slate-50 border-t border-slate-100 flex justify-between items-center text-[9px] text-slate-400 font-medium">
          <span>Drag header to move • Use bottom right corner to resize</span>
          <span className="text-slate-300 uppercase">RailStandard Engine v2.1</span>
        </div>
      </div>
    </div>
  );
};
