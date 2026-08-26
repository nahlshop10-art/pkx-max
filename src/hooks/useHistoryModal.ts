import { useEffect, useRef } from 'react';

export function useHistoryModal(isOpen: boolean, closeFn: () => void, modalPath: string) {
  const wasOpenRef = useRef(false);
  const closeFnRef = useRef(closeFn);
  closeFnRef.current = closeFn;

  useEffect(() => {
    if (isOpen && !wasOpenRef.current) {
      window.history.pushState({ ui_id: modalPath }, '');
      wasOpenRef.current = true;
    } else if (!isOpen && wasOpenRef.current) {
      // It was closed programmatically (not via popstate which already changed history)
      if (window.history.state?.ui_id === modalPath) {
         window.history.back(); // clean up history
      }
      wasOpenRef.current = false;
    }
  }, [isOpen, modalPath]);

  useEffect(() => {
    if (!isOpen) return;
    const handlePop = (_e: PopStateEvent) => {
       closeFnRef.current(); 
    };
    window.addEventListener('popstate', handlePop);
    return () => window.removeEventListener('popstate', handlePop);
  }, [isOpen]);
}
