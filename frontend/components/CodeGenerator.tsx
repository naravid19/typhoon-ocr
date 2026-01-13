"use client";

import { useState, useMemo } from "react";
import { Check, Copy, ChevronDown } from "lucide-react";
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { generateCode } from "@/lib/api";
import { OcrOptions } from "@/types/ocr";

interface CodeGeneratorProps {
  options: OcrOptions;
  file: File | null;
}

export function CodeGenerator({ options, file }: CodeGeneratorProps) {
  const [language, setLanguage] = useState("python");
  const [copied, setCopied] = useState(false);

  const code = useMemo(() => generateCode(language, file, options), [language, file, options]);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="border-t border-white/10 bg-[#0c0c0e]">
      <div className="flex items-center justify-between px-4 py-2 border-b border-white/5">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Generated Code</span>
          <div className="relative group">
            <button className="flex items-center gap-1.5 text-xs font-medium text-violet-400 hover:text-violet-300 transition-colors px-2 py-1 rounded hover:bg-white/5">
              {language === "python" && "Python"}
              {language === "curl" && "cURL"}
              {language === "javascript" && "JavaScript"}
              <ChevronDown size={12} />
            </button>
            
            {/* Dropdown */}
            <div className="absolute top-full left-0 mt-1 w-32 bg-[#18181b] border border-white/10 rounded-lg shadow-xl overflow-hidden hidden group-hover:block z-20">
              <button 
                onClick={() => setLanguage("python")} 
                className="w-full text-left px-3 py-2 text-xs text-zinc-300 hover:bg-violet-500/10 hover:text-violet-300 transition-colors"
              >
                Python
              </button>
              <button 
                onClick={() => setLanguage("curl")} 
                className="w-full text-left px-3 py-2 text-xs text-zinc-300 hover:bg-violet-500/10 hover:text-violet-300 transition-colors"
              >
                cURL
              </button>
              <button 
                onClick={() => setLanguage("javascript")} 
                className="w-full text-left px-3 py-2 text-xs text-zinc-300 hover:bg-violet-500/10 hover:text-violet-300 transition-colors"
              >
                JavaScript
              </button>
            </div>
          </div>
        </div>
        
        <button 
          onClick={handleCopy}
          className="p-1.5 text-zinc-500 hover:text-white transition-colors rounded hover:bg-white/5"
          title="Copy code"
        >
          {copied ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
        </button>
      </div>
      
      <div className="relative">
        <SyntaxHighlighter
          language={language}
          style={vscDarkPlus}
          customStyle={{
            margin: 0,
            padding: '1rem',
            background: 'transparent',
            fontSize: '0.8rem',
            maxHeight: '200px',
            overflowY: 'auto'
          }}
          wrapLongLines={true}
        >
          {code}
        </SyntaxHighlighter>
      </div>
    </div>
  );
}
