"use client";

import { useState } from "react";
import { Navbar } from "@/components/Navbar";
import { ConfigPanel } from "@/components/ConfigPanel";
import { ResponsePanel } from "@/components/ResponsePanel";
import { OcrOptions, OcrResult } from "@/types/ocr";
import { processOcr } from "@/lib/api";
import { AlertCircle } from "lucide-react";

export default function OcrPage() {
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<OcrResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [options, setOptions] = useState<OcrOptions>({
    model: "typhoon-ocr",
    task_type: "default",
    max_tokens: 16384,
    temperature: 0.1,
    top_p: 0.6,
    repetition_penalty: 1.2,
    pages: ""
  });

  const handleSubmit = async () => {
    if (!file) return;

    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      const data = await processOcr(file, options);
      if (data.success) {
        setResult(data);
      } else {
        setError(data.error || "Failed to process document");
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "An error occurred";
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#09090b] flex flex-col font-sans">
      <Navbar />
      
      <main className="flex-1 flex pt-16 h-[calc(100vh)]">
        <ConfigPanel 
          options={options} 
          setOptions={setOptions}
          file={file}
          setFile={setFile}
          onSubmit={handleSubmit}
          isLoading={isLoading}
        />
        
        <div className="flex-1 flex flex-col h-full relative">
          {error && (
            <div className="absolute top-4 left-4 right-4 z-50 bg-red-500/10 border border-red-500/20 text-red-200 px-4 py-3 rounded-lg flex items-center gap-2 backdrop-blur-md animate-in fade-in slide-in-from-top-2">
              <AlertCircle size={18} />
              <span className="text-sm font-medium">{error}</span>
              <button onClick={() => setError(null)} className="ml-auto hover:text-white">✕</button>
            </div>
          )}
          
          <ResponsePanel 
            result={result} 
            options={options}
            file={file}
            isLoading={isLoading}
          />
        </div>
      </main>
    </div>
  );
}
