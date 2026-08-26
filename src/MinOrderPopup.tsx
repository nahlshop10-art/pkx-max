import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AlertCircle, X } from 'lucide-react';
import { useScrollLock } from './hooks/useScrollLock';

interface MinOrderPopupProps {
  message: string;
  autoCloseTime: number;
  onClose: () => void;
  isOpen: boolean;
}

export default function MinOrderPopup({ message, autoCloseTime, onClose, isOpen }: MinOrderPopupProps) {
  useScrollLock(isOpen);
  
  useEffect(() => {
    if (isOpen && autoCloseTime > 0) {
      const timer = setTimeout(() => {
        onClose();
      }, autoCloseTime);
      return () => clearTimeout(timer);
    }
  }, [isOpen, autoCloseTime, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-[var(--dash-bg)]/60 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            className="relative bg-white rounded-2xl p-6 shadow-2xl max-w-sm w-full text-center overflow-hidden"
          >
            <button 
              onClick={onClose}
              className="absolute top-3 right-3 text-gray-400 hover:text-gray-600 transition-colors bg-gray-50 hover:bg-gray-100 rounded-full p-1 auto-close-btn"
            >
              <X size={20} />
            </button>

            <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
              <AlertCircle size={32} className="text-red-500" />
            </div>
            
            <h3 className="text-xl font-bold text-gray-900 mb-2">Attention Required</h3>
            <p className="text-gray-600 font-medium">
              {message}
            </p>
            
            <button 
              onClick={onClose}
              className="mt-6 w-full py-3 bg-[var(--dash-bg)] hover:bg-[var(--dash-bg)] text-white rounded-xl font-bold transition-colors"
            >
              Close
            </button>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
