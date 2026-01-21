
import React from 'react';
import { RailDocument } from '../types';

interface DocumentListProps {
  documents: RailDocument[];
  onDelete: (id: string) => void;
}

export const DocumentList: React.FC<DocumentListProps> = ({ documents, onDelete }) => {
  return (
    <div className="space-y-3">
      <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider px-2">Uploaded Standards ({documents.length})</h3>
      <div className="space-y-1">
        {documents.map((doc) => (
          <div 
            key={doc.id} 
            className="group flex items-center justify-between p-3 bg-white border border-slate-200 rounded-lg hover:border-blue-300 transition-colors"
          >
            <div className="flex items-center space-x-3 overflow-hidden">
              <div className="flex-shrink-0 w-8 h-8 bg-slate-100 rounded flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-slate-500" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A1 1 0 0111 2.293l4.707 4.707a1 1 0 01.293.707V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="truncate">
                <p className="text-sm font-medium text-slate-700 truncate">{doc.name}</p>
                <p className="text-[10px] text-slate-400">{(doc.size / 1024 / 1024).toFixed(2)} MB</p>
              </div>
            </div>
            <button 
              onClick={() => onDelete(doc.id)}
              className="p-1 text-slate-400 hover:text-red-500 rounded opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};
