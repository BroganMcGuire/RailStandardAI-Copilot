
declare const pdfjsLib: any;

// Initialize PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

const MAX_PAGES_CONTEXT = 50; // Guard against massive memory spikes in the browser

export async function extractTextFromPdf(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  let pdf = null;
  
  try {
    pdf = await pdfjsLib.getDocument({ 
      data: new Uint8Array(arrayBuffer),
      disableAutoFetch: true,
      disableStream: true,
      stopAtErrors: false
    }).promise;
    
    let fullText = '';
    // Guard against PDFs with no pages
    if (!pdf || pdf.numPages === 0) {
      return "[Error: This PDF contains no readable pages.]";
    }

    const pagesToExtract = Math.min(pdf.numPages, MAX_PAGES_CONTEXT);

    for (let i = 1; i <= pagesToExtract; i++) {
      try {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items
          .map((item: any) => item.str)
          .join(' ');
        fullText += `[Page ${i}] ${pageText}\n\n`;
      } catch (pageErr) {
        console.warn(`Failed to extract text from page ${i}:`, pageErr);
        fullText += `[Page ${i}] [Text extraction failed for this page]\n\n`;
      }
    }

    if (pdf.numPages > MAX_PAGES_CONTEXT) {
      fullText += `\n\n[Note: Only the first ${MAX_PAGES_CONTEXT} pages were indexed to ensure browser stability. Please refer to the document viewer for later pages.]`;
    }

    return fullText;
  } catch (err) {
    console.error("PDF Extraction Error:", err);
    throw new Error("Failed to extract text from PDF. The file might be corrupted, protected, or too complex for browser-based parsing.");
  } finally {
    if (pdf) {
      try {
        await pdf.destroy(); // CRITICAL: Releases memory back to the browser immediately
      } catch (e) {
        console.error("Error destroying PDF instance:", e);
      }
    }
  }
}
