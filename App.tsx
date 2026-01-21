
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { RailDocument, ChatMessage, Citation } from './types';
import { extractTextFromPdf } from './services/pdfService';
import { queryStandards } from './services/geminiService';
import { 
  getAllDocuments, 
  saveDocument, 
  deleteDocument, 
  getChatHistory, 
  saveChatMessage, 
  clearChatHistory 
} from './services/storageService';
import { DocumentList } from './components/DocumentList';
import { EmptyState } from './components/EmptyState';
import { ClauseModal } from './components/ClauseModal';

type AppView = 'chat';

interface ActiveClause {
  standardName: string;
  clauseNumber: string;
  pdfData: Uint8Array;
  page: number;
}

const App: React.FC = () => {
  const [view, setView] = useState<AppView>('chat');
  const [documents, setDocuments] = useState<RailDocument[]>([]);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isProcessingFile, setIsProcessingFile] = useState(false);
  const [isLoadingLibrary, setIsLoadingLibrary] = useState(true);
  const [isAsking, setIsAsking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  
  const [activeClause, setActiveClause] = useState<ActiveClause | null>(null);
  
  const chatEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragCounter = useRef(0);

  // Initialize Library and Chat History
  useEffect(() => {
    const loadAppData = async () => {
      try {
        const [storedDocs, storedChat] = await Promise.all([
          getAllDocuments(),
          getChatHistory()
        ]);
        setDocuments(storedDocs);
        setChatHistory(storedChat);
      } catch (err) {
        console.error("Failed to load local data:", err);
      } finally {
        setIsLoadingLibrary(false);
      }
    };
    loadAppData();
  }, []);

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (view === 'chat') {
      scrollToBottom();
    }
  }, [chatHistory, isAsking, view]);

  const cleanFileName = (name: string): string => {
    return name.replace(/\s\(\d+\)(?=\.pdf|$)/gi, '');
  };

  const processFile = async (file: File): Promise<RailDocument | null> => {
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      return null;
    }

    const arrayBuffer = await file.arrayBuffer();
    if (file.size > 50 * 1024 * 1024) {
      throw new Error(`File "${file.name}" is too large (max 50MB).`);
    }

    const text = await extractTextFromPdf(file);
    const cleanedName = cleanFileName(file.name);
    
    const doc: RailDocument = {
      id: crypto.randomUUID(),
      name: cleanedName,
      content: text,
      size: file.size,
      uploadDate: new Date(),
      pdfData: new Uint8Array(arrayBuffer)
    };
    
    await saveDocument(doc);
    return doc;
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsProcessingFile(true);
    setError(null);

    try {
      const newDocs: RailDocument[] = [];
      for (let i = 0; i < files.length; i++) {
        const doc = await processFile(files[i]);
        if (doc) newDocs.push(doc);
      }
      setDocuments(prev => [...prev, ...newDocs]);
    } catch (err: any) {
      setError(err.message || 'Error processing PDF');
    } finally {
      setIsProcessingFile(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current++;
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current--;
    if (dragCounter.current === 0) {
      setIsDragging(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    dragCounter.current = 0;

    const items = e.dataTransfer.items;
    if (!items) return;

    setIsProcessingFile(true);
    setError(null);

    try {
      const filesToProcess: File[] = [];
      for (let i = 0; i < items.length; i++) {
        const item = items[i].webkitGetAsEntry();
        if (item) {
          const scanned = await scanFiles(item);
          filesToProcess.push(...scanned);
        }
      }

      const newDocs: RailDocument[] = [];
      for (const file of filesToProcess) {
        const doc = await processFile(file);
        if (doc) newDocs.push(doc);
      }
      
      if (newDocs.length > 0) {
        setDocuments(prev => [...prev, ...newDocs]);
      } else if (filesToProcess.length === 0) {
        setError("No PDF files found.");
      }
    } catch (err: any) {
      setError(err.message || "Failed to process items.");
    } finally {
      setIsProcessingFile(false);
    }
  };

  const scanFiles = async (item: FileSystemEntry): Promise<File[]> => {
    const files: File[] = [];
    if (item.isFile) {
      const file = await new Promise<File>((resolve) => (item as FileSystemFileEntry).file(resolve));
      if (file.name.toLowerCase().endsWith('.pdf')) {
        files.push(file);
      }
    } else if (item.isDirectory) {
      const directoryReader = (item as FileSystemDirectoryEntry).createReader();
      const entries = await new Promise<FileSystemEntry[]>((resolve) => {
        directoryReader.readEntries(resolve);
      });
      for (const entry of entries) {
        const entryFiles = await scanFiles(entry);
        files.push(...entryFiles);
      }
    }
    return files;
  };

  const handleAsk = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || isAsking || documents.length === 0) return;

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      text: inputText,
      timestamp: new Date()
    };

    setChatHistory(prev => [...prev, userMsg]);
    await saveChatMessage(userMsg);
    
    const currentQuery = inputText;
    setInputText('');
    setIsAsking(true);
    setError(null);

    try {
      const result = await queryStandards(currentQuery, documents);
      const assistantMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        text: result.answer,
        citations: result.citations,
        timestamp: new Date()
      };
      setChatHistory(prev => [...prev, assistantMsg]);
      await saveChatMessage(assistantMsg);
    } catch (err: any) {
      setError(err.message || 'Failed to get an answer.');
    } finally {
      setIsAsking(false);
    }
  };

  const handleClearChat = async () => {
    await clearChatHistory();
    setChatHistory([]);
  };

  const removeDocument = async (id: string) => {
    try {
      await deleteDocument(id);
      setDocuments(prev => prev.filter(d => d.id !== id));
    } catch (err) {
      console.error("Failed to delete document:", err);
    }
  };

  const handleCitationClick = (citation: Citation) => {
    setError(null);
    const target = citation.standard.toLowerCase().trim();
    const targetNoExt = target.replace(/\.pdf$/i, '');
    
    let doc = documents.find(d => {
      const docName = d.name.toLowerCase();
      const docNameNoExt = docName.replace(/\.pdf$/i, '');
      return docName === target || docNameNoExt === targetNoExt;
    });

    if (!doc) {
      const candidates = documents.filter(d => {
        const docNameNoExt = d.name.toLowerCase().replace(/\.pdf$/i, '');
        return docNameNoExt.includes(targetNoExt) || targetNoExt.includes(docNameNoExt);
      });
      if (candidates.length > 0) {
        candidates.sort((a, b) => Math.abs(a.name.length - citation.standard.length) - Math.abs(b.name.length - citation.standard.length));
        doc = candidates[0];
      }
    }

    if (!doc) {
      setError(`Standard "${citation.standard}" not found in your local library.`);
      return;
    }

    setActiveClause({
      standardName: doc.name,
      clauseNumber: citation.clause,
      pdfData: doc.pdfData,
      page: Math.max(1, citation.page || 1)
    });
  };

  const handleOpenSearch = () => {
    const searchUrl = `http://networkrailstandards/NewSearch.aspx?q=${encodeURIComponent(inputText.trim())}`;
    window.open(searchUrl, '_blank', 'noopener,noreferrer');
  };

  return (
    <div 
      className="flex h-screen bg-slate-50 relative"
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {isDragging && (
        <div className="absolute inset-0 z-[100] bg-blue-600/10 backdrop-blur-sm border-4 border-dashed border-blue-500 flex flex-col items-center justify-center animate-fade-in pointer-events-none">
          <div className="bg-white p-8 rounded-3xl shadow-2xl flex flex-col items-center space-y-4 scale-110">
            <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center text-blue-600">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 animate-bounce" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
            </div>
            <div className="text-center">
              <h2 className="text-2xl font-bold text-slate-800">Drop PDFs or Folders</h2>
              <p className="text-slate-500 font-medium">Add standards to your library instantly</p>
            </div>
          </div>
        </div>
      )}

      <aside className="w-80 flex-shrink-0 bg-slate-900 flex flex-col border-r border-slate-800">
        <div className="p-6">
          <div className="flex items-center space-x-3 mb-8">
            <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center text-white shadow-lg shadow-blue-500/20">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <h1 className="text-xl font-bold text-white tracking-tight">RailStandard<span className="text-blue-500">AI</span></h1>
          </div>

          <div className="space-y-3">
            <input 
              type="file" 
              ref={fileInputRef}
              onChange={handleFileUpload}
              className="hidden"
              multiple
              accept=".pdf"
            />
            
            <button 
              onClick={() => fileInputRef.current?.click()}
              disabled={isProcessingFile || isLoadingLibrary}
              className="w-full flex items-center justify-center space-x-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-700 text-white font-medium py-3 px-4 rounded-xl transition-all shadow-lg shadow-blue-600/20 active:scale-95"
            >
              {isProcessingFile ? (
                <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent" />
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              )}
              <span>{isProcessingFile ? 'Parsing...' : 'Upload Standards'}</span>
            </button>

            <button 
              onClick={handleOpenSearch}
              className="w-full flex items-center justify-center space-x-2 border border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white transition-all py-3 px-4 rounded-xl text-sm font-medium active:scale-95"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
              <span>Search Online</span>
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar px-4 pb-6">
          {isLoadingLibrary ? (
            <div className="flex flex-col items-center justify-center py-10 space-y-3">
              <div className="animate-spin rounded-full h-6 w-6 border-2 border-blue-500 border-t-transparent" />
              <p className="text-xs text-slate-500">Syncing library...</p>
            </div>
          ) : (
            <DocumentList documents={documents} onDelete={removeDocument} />
          )}
        </div>

        <div className="p-4 bg-slate-950/50 border-t border-slate-800">
           <div className="flex items-center justify-between text-[10px] text-slate-500 mb-2">
             <span className="flex items-center space-x-1">
               <span className="w-1.5 h-1.5 bg-green-500 rounded-full"></span>
               <span>Local Storage Active</span>
             </span>
             <span className="font-mono">{documents.length} Files</span>
           </div>
           <p className="text-[9px] text-slate-600 italic">Your standards are saved locally in this browser. No cloud storage is used.</p>
        </div>
      </aside>

      <main className="flex-1 flex flex-col overflow-hidden relative">
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8 z-10 shadow-sm">
          <div className="flex items-center space-x-4">
             <h2 className="font-semibold text-slate-700">Standards Q&A</h2>
             {documents.length > 0 && (
               <span className="bg-blue-50 text-blue-700 text-xs px-2 py-1 rounded-full border border-blue-100 font-medium">
                 {documents.length} standards indexed
               </span>
             )}
          </div>
          <button onClick={handleClearChat} className="text-xs text-slate-400 hover:text-red-500 font-medium transition-colors">Clear History</button>
        </header>

        <div className="flex-1 overflow-y-auto custom-scrollbar bg-slate-50 px-4 md:px-8 py-8 space-y-8">
          {chatHistory.length === 0 ? (
            <EmptyState />
          ) : (
            chatHistory.map((msg) => (
              <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] md:max-w-[70%] rounded-2xl p-6 shadow-sm border ${
                  msg.role === 'user' 
                    ? 'bg-blue-600 border-blue-500 text-white rounded-tr-none' 
                    : 'bg-white border-slate-200 text-slate-800 rounded-tl-none'
                }`}>
                  <div className="flex items-center space-x-2 mb-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider opacity-60">{msg.role === 'user' ? 'You' : 'Assistant'}</span>
                    <span className="text-[10px] opacity-40">
                      {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <div className="prose prose-slate prose-sm max-w-none">
                    <p className="whitespace-pre-wrap leading-relaxed">{msg.text}</p>
                  </div>
                  {msg.citations && msg.citations.length > 0 && (
                    <div className="mt-6 pt-4 border-t border-slate-100">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">References (Stored Locally)</p>
                      <div className="flex flex-wrap gap-2">
                        {msg.citations.map((cite, i) => (
                          <button 
                            key={i} 
                            onClick={() => handleCitationClick(cite)}
                            className="flex items-center space-x-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 shadow-sm hover:border-blue-400 hover:bg-blue-50 transition-all active:scale-95 group/cite"
                          >
                             <div className="w-1.5 h-1.5 bg-blue-500 rounded-full group-hover/cite:animate-ping"></div>
                             <span className="text-xs font-semibold text-slate-700">{cite.standard}</span>
                             <span className="text-xs text-slate-400">|</span>
                             <span className="text-xs text-blue-600 font-medium">Clause {cite.clause}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
          {isAsking && (
            <div className="flex justify-start">
              <div className="bg-white border border-slate-200 rounded-2xl rounded-tl-none p-6 shadow-sm max-w-[70%]">
                <div className="flex space-x-2">
                  <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                  <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                  <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                </div>
              </div>
            </div>
          )}
          {error && (
            <div className="flex justify-center">
              <div className="bg-red-50 border border-red-100 text-red-600 px-4 py-3 rounded-lg text-sm flex items-center space-x-2 animate-fade-in">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                <span>{error}</span>
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        <div className="p-6 bg-white border-t border-slate-200 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
          <form onSubmit={handleAsk} className="max-w-4xl mx-auto relative group">
            <input 
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder={documents.length > 0 ? "Ask a question about your standards..." : "Upload standards to start..."}
              disabled={documents.length === 0 || isAsking}
              className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-4 pl-6 pr-32 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-slate-700 placeholder-slate-400 shadow-inner"
            />
            <div className="absolute right-2 top-2 bottom-2 flex space-x-1">
               <button 
                type="submit"
                disabled={!inputText.trim() || isAsking || documents.length === 0}
                className="bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white px-6 rounded-xl font-semibold text-sm transition-all flex items-center space-x-2"
              >
                <span>Ask AI</span>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clip-rule="evenodd" />
                </svg>
               </button>
            </div>
          </form>
        </div>
      </main>

      {activeClause && (
        <ClauseModal 
          isOpen={!!activeClause}
          onClose={() => setActiveClause(null)}
          standardName={activeClause.standardName}
          clauseNumber={activeClause.clauseNumber}
          pdfData={activeClause.pdfData}
          initialPage={activeClause.page}
        />
      )}
    </div>
  );
};

export default App;
