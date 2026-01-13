import Link from "next/link";
import { FileText } from "lucide-react";

export function Navbar() {
  return (
    <nav className="fixed top-0 left-0 right-0 h-16 border-b border-[rgba(255,255,255,0.08)] bg-[rgba(9,9,11,0.8)] backdrop-blur-md z-50 flex items-center justify-between px-6">
      <div className="flex items-center gap-4">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-linear-to-br from-violet-600 to-indigo-600 flex items-center justify-center text-white font-bold">
            <FileText size={18} />
          </div>
          <div className="flex flex-col">
            <span className="font-bold text-lg tracking-tight leading-tight">
              TYPHOON
            </span>
            <span className="text-[10px] text-violet-400 font-medium tracking-widest leading-tight">
              OCR
            </span>
          </div>
        </Link>
      </div>
      
      <div className="flex items-center gap-4">
        <a 
          href="https://docs.opentyphoon.ai" 
          target="_blank" 
          rel="noopener noreferrer"
          className="text-xs text-zinc-400 hover:text-white transition-colors"
        >
          Documentation
        </a>
        <div className="w-8 h-8 rounded-full bg-linear-to-tr from-violet-500 to-fuchsia-500 border border-white/10"></div>
      </div>
    </nav>
  );
}
