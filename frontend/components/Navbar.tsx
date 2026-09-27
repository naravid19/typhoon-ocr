import Link from "next/link";
import { FileText, ExternalLink } from "lucide-react";
import { UpdateBadge } from "./UpdateBadge";

export function Navbar() {
  return (
    <header suppressHydrationWarning className="fixed top-0 left-0 right-0 h-13 border-b border-white/[0.08] bg-[#09090b]/90 backdrop-blur-md z-50 flex items-center justify-between px-5">
      <div className="flex items-center gap-3">
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="w-7 h-7 rounded-md bg-violet-600 flex items-center justify-center text-white font-semibold shadow-xs">
            <FileText size={15} />
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="font-semibold text-sm tracking-tight text-zinc-100 group-hover:text-white transition-colors">
              TYPHOON OCR
            </span>
            <span className="text-[10px] text-violet-400/90 font-mono uppercase tracking-wider px-1.5 py-0.5 rounded bg-violet-500/10 border border-violet-500/20">
              Studio
            </span>
          </div>
        </Link>
      </div>
      
      <div className="flex items-center gap-4">
        <UpdateBadge />
        <a 
          href="https://docs.opentyphoon.ai" 
          target="_blank" 
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-200 transition-colors font-medium px-2.5 py-1 rounded-md hover:bg-zinc-800/50"
        >
          <span>Docs</span>
          <ExternalLink size={12} className="text-zinc-500" />
        </a>
      </div>
    </header>
  );
}
