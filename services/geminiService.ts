import { GoogleGenAI, Type } from "@google/genai";
import { RailDocument, GeminiResponse } from "../types";

export async function queryStandards(
  question: string,
  documents: RailDocument[]
): Promise<GeminiResponse> {
  // Use the API key provided by the build process (defined in vite.config.ts)
  const apiKey = process.env.API_KEY;
  
  if (!apiKey || apiKey === "undefined" || apiKey === "") {
    throw new Error("Missing API Key. Please verify that you have added the API_KEY secret to your GitHub repository settings and successfully redeployed via GitHub Actions.");
  }

  const ai = new GoogleGenAI({ apiKey });
  
  const context = documents
    .map(doc => `--- FILENAME: ${doc.name} ---\n${doc.content}`)
    .join('\n\n');

  const systemInstruction = `
    You are an expert in Network Rail standards and engineering specifications. 
    Your task is to answer user questions accurately based ONLY on the provided document text.
    
    The text provided includes page markers like "[Page X]". 
    
    CRITICAL RULES:
    1. For every answer, you MUST provide citations.
    2. The "standard" field in the citation MUST be the EXACT "FILENAME" provided in the context.
    3. The "clause" field is the specific clause number found (e.g. 3.2.1).
    4. The "page" field MUST be the integer page number found in the text (e.g. if info follows [Page 5], page is 5).
    5. If the answer isn't in the provided text, state that the information is not found.
    6. Format your response as a valid JSON object.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Context:\n${context}\n\nQuestion: ${question}`,
      config: {
        systemInstruction,
        thinkingConfig: { thinkingBudget: 0 },
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            answer: { type: Type.STRING },
            citations: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  standard: { type: Type.STRING },
                  clause: { type: Type.STRING },
                  page: { type: Type.INTEGER }
                },
                required: ["standard", "clause", "page"]
              }
            }
          },
          required: ["answer", "citations"]
        }
      }
    });

    const resultText = response.text;
    if (!resultText) {
      throw new Error("Empty response received from the AI.");
    }

    return JSON.parse(resultText.trim()) as GeminiResponse;
  } catch (error) {
    console.error("Gemini API Error:", error);
    throw new Error(error instanceof Error ? error.message : "Unable to reach the AI assistant. Please check your connection and configuration.");
  }
}
