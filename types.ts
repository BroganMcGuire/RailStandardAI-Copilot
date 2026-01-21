
export interface RailDocument {
  id: string;
  name: string;
  content: string;
  size: number;
  uploadDate: Date;
  pdfData: Uint8Array; // Original PDF bytes for viewing
}

export interface Citation {
  standard: string;
  clause: string;
  page?: number; // The page number found by AI
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  citations?: Citation[];
  timestamp: Date;
}

export interface GeminiResponse {
  answer: string;
  citations: Citation[];
}
