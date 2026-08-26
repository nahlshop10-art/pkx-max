import React, { useState, useEffect } from 'react';
import { cn } from '../lib/utils';

export default function AdminLoadingScreen() {
  const [isVisible, setIsVisible] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const timeoutRef = React.useRef<any>(null);

  useEffect(() => {
    const handleLoading = (e: any) => {
      const { message, isSuccess, isError } = e.detail;
      
      if (timeoutRef.current) {
         clearTimeout(timeoutRef.current);
         timeoutRef.current = null;
      }

      if (isSuccess || isError) {
         setIsVisible(false);
         timeoutRef.current = setTimeout(() => {
           setProgress(null);
         }, 300);
         return;
      }

      if (message) {
         setIsVisible(true);
         const progressMatch = message.match(/(\d+)%/);
         if (progressMatch) {
             setProgress(parseInt(progressMatch[1], 10));
         } else {
             setProgress(null);
         }
      }
    };

    window.addEventListener('admin-loading', handleLoading);
    return () => window.removeEventListener('admin-loading', handleLoading);
  }, []);

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center pointer-events-auto">
      {/* Semi-transparent dark overlay */}
      <div className="absolute inset-0 bg-[var(--dash-bg)]/60 backdrop-blur-sm"></div>
      
      {/* Minimal Loading container */}
      <div className="relative flex items-center justify-center scale-100 animate-in fade-in zoom-in duration-200">
        {progress !== null ? (
           <div className="w-24 h-24 relative flex items-center justify-center">
             <div className="absolute inset-0 bg-[var(--dash-bg)] rounded-full shadow-2xl"></div>
             <svg className="w-24 h-24 transform -rotate-90 absolute inset-0 z-10 drop-shadow-lg">
               <circle cx="48" cy="48" r="44" stroke="currentColor" strokeWidth="6" fill="transparent" className="text-[var(--dash-border)]" />
               <circle 
                 cx="48" cy="48" r="44" 
                 stroke="currentColor" 
                 strokeWidth="6" 
                 fill="transparent" 
                 strokeDasharray={44 * 2 * Math.PI} 
                 strokeDashoffset={(44 * 2 * Math.PI) - ((progress / 100) * (44 * 2 * Math.PI))} 
                 strokeLinecap="round"
                 className="text-[#fafafa] transition-all duration-300" 
               />
             </svg>
             <span className="text-xl font-bold text-[#fafafa] z-20">{progress}%</span>
           </div>
        ) : (
           <div className="w-20 h-20 bg-[var(--dash-bg)] rounded-full flex items-center justify-center shadow-2xl relative">
             <div className="w-14 h-14 border-[4px] border-[var(--dash-border)] border-t-[#fafafa] border-r-[#fafafa] rounded-full animate-spin"></div>
           </div>
        )}
      </div>
    </div>
  );
}
