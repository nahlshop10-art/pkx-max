import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { SocialLink, FloatingButtonDesign } from '../types';
import { MessageCircle, X } from 'lucide-react';
import { cn } from '../lib/utils';
import { DEFAULT_ACTION_BUTTONS } from '../types';

interface FloatingSocialButtonsProps {
  links: SocialLink[];
  mainIcon?: string;
  config?: FloatingButtonDesign;
  isCartVisible?: boolean;
}

export default function FloatingSocialButtons({ links, mainIcon, config = DEFAULT_ACTION_BUTTONS.viewCart, isCartVisible = false }: FloatingSocialButtonsProps) {
  const [isOpen, setIsOpen] = useState(false);

  // Force left position, using View Cart's horizontal spacing values for consistency
  const isRight = false; // Always left side as requested
  
  // Extract the raw value for fallback, but if we need to calculate offset, we'll try to keep the original unit if possible.
  // The simplest reliable way for CSS is calc() if we need to offset.
  const paddingBottomCss = (isCartVisible && config.position !== 'top-center' && (config.position.includes('left') || config.position.includes('center'))) 
    ? `calc(${config.marginBottom || '24px'} + 64px)` 
    : (config.marginBottom || '24px');

  const cartMarginX = (config.marginRight && config.marginRight !== '0px' && config.marginRight !== '0') 
    ? config.marginRight 
    : ((config.marginLeft && config.marginLeft !== '0px' && config.marginLeft !== '0') ? config.marginLeft : '16px');

  const stylePositioning: React.CSSProperties = {
    bottom: paddingBottomCss,
    left: cartMarginX,
    zIndex: 60,
    transition: 'bottom 0.3s ease-in-out'
  };

  // If there are no links, just pressing the button could still open chat? 
  // No, if no links and no mainIcon, maybe don't show. Wait, the prompt says show ONLY custom Message button default.
  // We'll show the button even if there are no links, so they can use it or at least see the icon.

  return (
    <div 
      className={cn(
        "fixed flex flex-col gap-3",
        isRight ? "items-end" : "items-center"
      )}
      style={stylePositioning}
    >
      <AnimatePresence>
        {isOpen && links && links.length > 0 && (
          <motion.div 
            initial={{ opacity: 0, y: 20, scale: 0.8 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.8 }}
            transition={{ duration: 0.2, staggerChildren: 0.05 }}
            className={cn("flex flex-col gap-3", isRight ? "items-end" : "items-center")}
          >
            {links.map((link, i) => (
              <motion.a
                key={link.id}
                href={link.link}
                target="_blank"
                rel="noopener noreferrer"
                initial={{ opacity: 0, y: 20, scale: 0.8 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 20, scale: 0.8 }}
                transition={{ duration: 0.2, delay: (links.length - 1 - i) * 0.05 }}
                className="w-12 h-12 rounded-full bg-white shadow-lg flex items-center justify-center hover:scale-110 active:scale-95 transition-transform overflow-hidden relative"
              >
                {link.icon ? (
                  <img src={link.icon} alt="Social icon" className="w-full h-full object-contain absolute inset-0" />
                ) : (
                  <div className="w-full h-full bg-gray-200" />
                )}
              </motion.a>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      <button
        onClick={() => {
          if (links && links.length > 0) {
            setIsOpen(!isOpen);
          }
        }}
        className={cn(
          "w-12 h-12 sm:w-14 sm:h-14 rounded-full shadow-xl flex items-center justify-center text-white transition-transform active:scale-95 bg-[#222222] overflow-hidden relative"
        )}
      >
        <AnimatePresence mode="wait">
          {isOpen ? (
            <motion.div
              key="close"
              initial={{ opacity: 0, rotate: -90 }}
              animate={{ opacity: 1, rotate: 0 }}
              exit={{ opacity: 0, rotate: 90 }}
              transition={{ duration: 0.15 }}
              className="absolute inset-0 flex items-center justify-center"
            >
              <X size={24} />
            </motion.div>
          ) : (
            <motion.div
              key="open"
              initial={{ opacity: 0, rotate: 90 }}
              animate={{ opacity: 1, rotate: 0 }}
              exit={{ opacity: 0, rotate: -90 }}
              transition={{ duration: 0.15 }}
              className="absolute inset-0 flex items-center justify-center"
            >
              {mainIcon ? (
                <img src={mainIcon} alt="Message" className="w-full h-full object-cover" />
              ) : (
                <MessageCircle size={24} className="fill-current text-white transform -scale-x-100" />
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </button>
    </div>
  );
}
