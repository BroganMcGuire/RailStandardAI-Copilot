
import React from 'react';

export const EmptyState: React.FC = () => {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center px-4">
      <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mb-6">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      </div>
      <h3 className="text-xl font-semibold text-slate-800 mb-2">No Standards Uploaded</h3>
      <p className="text-slate-500 max-w-sm">
        Upload your Network Rail standards in PDF format to start asking questions and getting referenced answers.
      </p>
    </div>
  );
};
