import React, { useRef } from 'react';
import { ShoppingBag, ShoppingCart, Check, ArrowRight, Plus } from 'lucide-react';
import { ButtonDesign, FloatingButtonDesign } from '../types';
import { motion, PanInfo } from 'motion/react';

interface ActionBtnProps {
  config: ButtonDesign | FloatingButtonDesign;
  onClick: () => void;
  label: string;
  badge?: number;
  rightText?: string;
  className?: string; // Additional classes
  style?: React.CSSProperties; // Add custom style if needed, e.g. from framer-motion or inline
  onUpdatePosition?: (updates: Partial<FloatingButtonDesign>) => void; // For live drag update
}

export default function ActionBtn({ config, onClick, label, badge, rightText, className = '', style = {}, onUpdatePosition }: ActionBtnProps) {
  const isFloating = 'position' in config;
  const floatingConfig = config as FloatingButtonDesign;
  const buttonRef = useRef<HTMLButtonElement>(null);
  
  // Compute floating styles if applicable
  const floatingStyles: React.CSSProperties = isFloating ? {
    position: 'fixed' as any,
    zIndex: 40,
    marginBottom: floatingConfig.marginBottom,
    marginLeft: floatingConfig.marginLeft,
    marginRight: floatingConfig.marginRight,
  } : {};

  if (isFloating) {
    if (floatingConfig.position === 'bottom-center') {
      floatingStyles.bottom = floatingConfig.marginBottom;
      floatingStyles.left = '50%';
      floatingStyles.transform = 'translateX(-50%)';
    } else if (floatingConfig.position === 'bottom-left') {
      floatingStyles.bottom = floatingConfig.marginBottom;
      floatingStyles.left = floatingConfig.marginLeft || '16px';
    } else if (floatingConfig.position === 'bottom-right') {
      floatingStyles.bottom = floatingConfig.marginBottom;
      floatingStyles.right = floatingConfig.marginRight || '16px';
    } else if (floatingConfig.position === 'top-left') {
      floatingStyles.top = floatingConfig.marginBottom || '16px'; // Actually should use marginTop but lets map to marginBottom for simplicity
      floatingStyles.left = floatingConfig.marginLeft || '16px';
    } else if (floatingConfig.position === 'top-right') {
      floatingStyles.top = floatingConfig.marginBottom || '16px';
      floatingStyles.right = floatingConfig.marginRight || '16px';
    }
  }

  const handleDragEnd = (e: any, info: PanInfo) => {
    if (!onUpdatePosition || !isFloating || !buttonRef.current) return;
    
    // We update position to be closest quadrant
    const rect = buttonRef.current.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;

    const w = window.innerWidth;
    const h = window.innerHeight;

    const isTop = y < h / 2;
    const isLeft = x < w / 3;
    const isRight = x > (w * 2) / 3;
    const isCenter = !isLeft && !isRight;

    let newPosition: FloatingButtonDesign['position'] = 'bottom-center';
    
    if (isTop) {
      newPosition = isRight ? 'top-right' : 'top-left';
    } else {
      if (isLeft) newPosition = 'bottom-left';
      else if (isRight) newPosition = 'bottom-right';
      else newPosition = 'bottom-center';
    }

    // Calculate margins based on where it landed
    const marginY = isTop ? rect.top : (h - rect.bottom);
    const marginX = isRight ? (w - rect.right) : rect.left;

    onUpdatePosition({
      position: newPosition,
      marginBottom: `${Math.max(0, marginY)}px`,
      ...(isCenter ? {} : {
        marginLeft: isLeft ? `${Math.max(0, marginX)}px` : '0px',
        marginRight: isRight ? `${Math.max(0, marginX)}px` : '0px',
      }),
    });
  };

  // Map legacy defaults to dynamic variables
  const bgColor = (!config.backgroundColor || config.backgroundColor === '#ff4f72') ? 'var(--theme-primary)' : config.backgroundColor;
  const txtColor = (!config.textColor || config.textColor === '#ffffff') ? 'var(--theme-white)' : config.textColor;

  const bgGradient = `linear-gradient(90deg, color-mix(in srgb, ${bgColor} 76%, white 24%) 0%, ${bgColor} 45%, ${bgColor} 100%)`;
  const dynamicShadow = config.elevation !== undefined && config.elevation > 0
    ? `0px ${config.elevation * 3}px ${config.elevation * 6}px color-mix(in srgb, ${bgColor} 35%, transparent)`
    : `0 4px 14px color-mix(in srgb, ${bgColor} 25%, transparent)`;

  const btnStyle: React.CSSProperties = {
    ...floatingStyles,
    width: config.width === 'auto' ? 'auto' : config.width,
    height: config.height,
    background: bgGradient,
    color: txtColor,
    fontSize: config.fontSize,
    fontWeight: config.fontWeight,
    borderRadius: config.borderRadius,
    boxShadow: dynamicShadow,
    padding: `${config.paddingY} ${config.paddingX}`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: rightText ? 'space-between' : 'center',
    gap: '12px',
    cursor: 'pointer',
    border: 'none',
    outline: 'none',
    transition: 'all 0.2s ease',
    ...style
  };

  const IconComponent = () => {
    const s = 20;
    if (config.icon === 'bag') return <ShoppingBag size={s} />;
    if (config.icon === 'cart') return <ShoppingCart size={s} />;
    if (config.icon === 'check') return <Check size={s} />;
    if (config.icon === 'arrow') return <ArrowRight size={s} />;
    if (config.icon === 'plus') return <Plus size={s} />;
    return null;
  };

  return (
    <motion.button 
      ref={buttonRef}
      onClick={!onUpdatePosition ? onClick : undefined} // Avoid click triggering when dragging
      onPointerUp={onUpdatePosition ? onClick : undefined}
      style={btnStyle as any} 
      className={className}
      drag={!!onUpdatePosition}
      dragMomentum={false}
      onDragEnd={handleDragEnd}
    >
      {config.iconPosition === 'left' && config.icon !== 'none' && (
        <div className="relative flex items-center justify-center">
          <IconComponent />
          {badge !== undefined && badge > 0 && (
            <span 
              className="absolute -top-2 -right-2 text-[10px] w-4 h-4 flex items-center justify-center rounded-full font-bold"
              style={{ backgroundColor: config.textColor, color: config.backgroundColor }}
            >
              {badge > 99 ? '99+' : badge}
            </span>
          )}
        </div>
      )}
      
      <span className="truncate">{label}</span>
      
      {config.iconPosition === 'right' && rightText === undefined && config.icon !== 'none' && (
         <IconComponent />
      )}

      {rightText !== undefined && (
        <span className="font-bold flex items-center gap-2">
          {rightText}
          {config.iconPosition === 'right' && config.icon !== 'none' && (
            <IconComponent />
          )}
        </span>
      )}
    </motion.button>
  );
}
