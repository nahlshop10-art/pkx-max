import React, { useState, useRef, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, ChevronDown, Check } from 'lucide-react';
import { cn } from '../lib/utils';

interface DatePickerProps {
  label: string;
  value: Date | null;
  onChange: (date: Date) => void;
}

export function DatePicker({ label, value, onChange }: DatePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(value ? value.getMonth() : new Date().getMonth());
  const [currentYear, setCurrentYear] = useState(value ? value.getFullYear() : new Date().getFullYear());
  const [showMonthDropdown, setShowMonthDropdown] = useState(false);
  const [showYearDropdown, setShowYearDropdown] = useState(false);
  const [maxYear, setMaxYear] = useState(Math.max(new Date().getFullYear() + 10, 2036));
  
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setShowMonthDropdown(false);
        setShowYearDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (value) {
      setCurrentMonth(value.getMonth());
      setCurrentYear(value.getFullYear());
    }
  }, [value]);

  const handlePrevMonth = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear(prev => prev - 1);
    } else {
      setCurrentMonth(prev => prev - 1);
    }
  };

  const handleNextMonth = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear(prev => prev + 1);
    } else {
      setCurrentMonth(prev => prev + 1);
    }
  };

  const handleYearScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    if (scrollHeight - scrollTop <= clientHeight + 10) {
      setMaxYear(prev => {
        const expectedMax = currentYear + 10;
        if (prev > expectedMax && prev - expectedMax > 50) return prev;
        return prev + 10;
      });
    }
  };

  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const firstDayOfMonth = new Date(currentYear, currentMonth, 1).getDay();
  const daysInPrevMonth = new Date(currentYear, currentMonth, 0).getDate();
  
  const prevMonthDays = Array.from({ length: firstDayOfMonth }, (_, i) => daysInPrevMonth - firstDayOfMonth + i + 1);
  const currentMonthDays = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const nextMonthDays = Array.from({ length: 42 - (prevMonthDays.length + currentMonthDays.length) }, (_, i) => i + 1);

  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const calendarMonthName = monthNames[currentMonth].substring(0, 3);

  const formattedValue = value 
    ? `${monthNames[value.getMonth()].substring(0, 3)} ${value.getDate()}, ${value.getFullYear()}`
    : 'Select date';

  return (
    <div className="relative" ref={containerRef}>
      <label className="block text-xs font-medium text-gray-400 mb-1.5 ml-1">{label}</label>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "w-full flex items-center justify-between px-4 py-3 bg-[#27272a] border rounded-xl transition-all duration-200",
          isOpen ? "border-[#fafafa] shadow-[0_0_0_2px_rgba(250, 250, 250,0.1)]" : "border-[#2a4339] hover:border-[#3a5349]",
          !value && "text-gray-400"
        )}
      >
        <span className="text-sm font-medium text-white">{formattedValue}</span>
        <CalendarIcon size={16} className={isOpen ? "text-[#fafafa]" : "text-gray-400"} />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-[#18181b] border border-[#2a4339] rounded-2xl shadow-2xl z-50 p-4 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-center justify-between mb-4">
            <button onClick={handlePrevMonth} className="p-1.5 hover:bg-[#27272a] rounded-lg text-gray-400 transition-colors"><ChevronLeft size={18} /></button>
            <div className="flex gap-1.5">
              <div className="relative">
                <button onClick={() => { setShowMonthDropdown(!showMonthDropdown); setShowYearDropdown(false); }} className="flex items-center gap-1 px-2.5 py-1.5 hover:bg-[#27272a] rounded-lg text-sm font-medium text-white transition-colors">
                  {calendarMonthName} <ChevronDown size={14} className="text-gray-400" />
                </button>
                {showMonthDropdown && (
                  <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1 w-32 bg-[#27272a] border border-[#2a4339] rounded-xl shadow-xl z-50 py-1.5 max-h-48 overflow-y-auto">
                    {monthNames.map((m, i) => (
                      <button key={m} onClick={() => { setCurrentMonth(i); setShowMonthDropdown(false); }} className="w-full text-left px-3 py-2 text-sm hover:bg-[#2a4339] text-gray-200 flex justify-between items-center">
                        {m.substring(0, 3)} {currentMonth === i && <Check size={14} className="text-[#fafafa]" />}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="relative">
                <button onClick={() => { setShowYearDropdown(!showYearDropdown); setShowMonthDropdown(false); }} className="flex items-center gap-1 px-2.5 py-1.5 hover:bg-[#27272a] rounded-lg text-sm font-medium text-white transition-colors">
                  {currentYear} <ChevronDown size={14} className="text-gray-400" />
                </button>
                {showYearDropdown && (
                  <div 
                    className="absolute top-full left-1/2 -translate-x-1/2 mt-1 w-24 bg-[#27272a] border border-[#2a4339] rounded-xl shadow-xl z-50 py-1.5 max-h-48 overflow-y-auto"
                    onScroll={handleYearScroll}
                  >
                    {Array.from({ length: maxYear - 2020 + 1 }, (_, i) => 2020 + i).map(y => (
                      <button key={y} onClick={() => { setCurrentYear(y); setShowYearDropdown(false); }} className="w-full text-left px-3 py-2 text-sm hover:bg-[#2a4339] text-gray-200 flex justify-between items-center">
                        {y} {currentYear === y && <Check size={14} className="text-[#fafafa]" />}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <button onClick={handleNextMonth} className="p-1.5 hover:bg-[#27272a] rounded-lg text-gray-400 transition-colors"><ChevronRight size={18} /></button>
          </div>
          
          <div className="grid grid-cols-7 gap-1 text-center mb-2">
            {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((d, i) => (
              <div key={i} className="text-[11px] font-semibold text-gray-500 py-1 uppercase tracking-wider">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1 text-center">
            {prevMonthDays.map(d => <div key={`prev-${d}`} className="py-1.5 text-sm text-gray-600/50">{d}</div>)}
            {currentMonthDays.map(d => {
              const isSelected = value?.getDate() === d && value?.getMonth() === currentMonth && value?.getFullYear() === currentYear;
              const isToday = new Date().getDate() === d && new Date().getMonth() === currentMonth && new Date().getFullYear() === currentYear;
              
              return (
                <button
                  key={`curr-${d}`}
                  onClick={() => {
                    onChange(new Date(currentYear, currentMonth, d));
                    setIsOpen(false);
                  }}
                  className={cn(
                    "mx-auto w-8 h-8 flex items-center justify-center text-sm rounded-full transition-all duration-200",
                    isSelected 
                      ? "bg-[#fafafa] text-black font-bold shadow-md shadow-[#fafafa]/20" 
                      : isToday
                        ? "bg-[#27272a] text-[#fafafa] font-semibold hover:bg-[#2a4339]"
                        : "text-gray-300 hover:bg-[#27272a] hover:text-white"
                  )}
                >
                  {d}
                </button>
              );
            })}
            {nextMonthDays.map(d => <div key={`next-${d}`} className="py-1.5 text-sm text-gray-600/50">{d}</div>)}
          </div>
        </div>
      )}
    </div>
  );
}
