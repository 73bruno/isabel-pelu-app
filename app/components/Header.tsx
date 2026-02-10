"use client";

import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useEffect, useState } from 'react';
import AuthStatus from './AuthStatus';
import ServerStatus from './ServerStatus';

interface HeaderProps {
  selectedDate: Date;
  onDateChange: (date: Date) => void;
  onNewAppointment: () => void;
  viewMode: 'day' | 'week';
  onViewChange: (mode: 'day' | 'week') => void;
  currentStylist: string;
  onStylistChange: (stylist: string) => void;
  onOpenSettings: (tab?: 'general' | 'stylists' | 'schedule') => void;
  stylists?: string[];
  silentMode?: boolean;
  onSilentModeChange?: (silent: boolean) => void;
}

export default function Header({
  selectedDate,
  onDateChange,
  onNewAppointment,
  viewMode,
  onViewChange,
  currentStylist,
  onStylistChange,
  onOpenSettings,
  stylists,
  silentMode,
  onSilentModeChange
}: HeaderProps) {
  const [isMobile, setIsMobile] = useState(false);

  // Detect mobile on mount and resize
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Force single stylist on mobile - auto-select first if "all" is selected
  useEffect(() => {
    if (isMobile && currentStylist === 'all' && stylists && stylists.length > 0) {
      onStylistChange(stylists[0]);
    }
  }, [isMobile, currentStylist, stylists, onStylistChange]);

  return (
    <header className="sticky top-0 z-50 w-full glass-metal px-4 sm:px-6 py-3 sm:py-4 flex flex-col gap-3 sm:gap-4 sm:flex-row sm:items-center sm:justify-between shadow-sm transition-all duration-300 backdrop-blur-md">
      <div className="flex items-center gap-3 sm:gap-4 justify-between sm:justify-start">
        {/* Logo Container - Improved for both modes */}
        <div className="flex items-center gap-3">
          <div className="relative h-10 w-10 sm:h-12 sm:w-12 overflow-hidden rounded-full border-2 border-gold/70 dark:border-gold shadow-lg shrink-0 bg-gradient-to-br from-white to-gray-100 dark:from-gray-800 dark:to-gray-900">
            <img
              src="/logo.avif"
              alt="Isabel Peluquería"
              className="object-cover w-full h-full logo-adaptive"
            />
            {/* Subtle ring overlay for depth */}
            <div className="absolute inset-0 rounded-full ring-1 ring-inset ring-black/5 dark:ring-white/10"></div>
          </div>
          <div>
            <h1 className="text-base sm:text-xl font-bold tracking-tight text-gray-900 dark:text-white leading-tight font-serif">
              Almodóvar <span className="text-gold-dark dark:text-gold italic">Peluqueras</span>
            </h1>
            <p className="text-[9px] sm:text-xs text-gray-500 dark:text-gray-400 uppercase tracking-widest font-medium">
              Gestión de Citas
            </p>
          </div>
        </div>

        {/* Desktop Controls */}
        <div className="hidden md:flex items-center gap-4 bg-gray-100/50 dark:bg-gray-800/50 p-1 rounded-xl border border-gray-200 dark:border-gray-700">
          {/* View Selector */}
          <div className="flex bg-white dark:bg-gray-900 rounded-lg shadow-sm p-1">
            <button
              onClick={() => onViewChange('day')}
              className={`px-3 py-1.5 text-sm rounded-md transition-all font-medium ${viewMode === 'day' ? 'bg-gray-900 dark:bg-gold dark:text-gray-900 text-white shadow-md' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'}`}
            >
              Día
            </button>
            <button
              onClick={() => onViewChange('week')}
              className={`px-3 py-1.5 text-sm rounded-md transition-all font-medium ${viewMode === 'week' ? 'bg-gray-900 dark:bg-gold dark:text-gray-900 text-white shadow-md' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'}`}
            >
              Semana
            </button>
          </div>

          <div className="w-px h-8 bg-gray-300 dark:bg-gray-700"></div>

          {/* Stylist Selector */}
          <select
            value={currentStylist}
            onChange={(e) => onStylistChange(e.target.value)}
            className="bg-transparent text-sm font-medium text-gray-700 dark:text-gray-200 outline-none cursor-pointer hover:text-gray-900 dark:hover:text-white [&>option]:text-gray-900 [&>option]:bg-white"
          >
            <option value="all">Todas las Peluqueras</option>
            {stylists?.map(s => (
              <option key={s} value={s}>{s}</option>
            )) || (
                <>
                  <option value="Isabel">Solo Isabel</option>
                  <option value="Almudena">Solo Almudena</option>
                  <option value="Yolanda">Solo Yolanda</option>
                </>
              )}
          </select>
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-3 justify-between sm:justify-end w-full sm:w-auto overflow-x-auto scrollbar-hide">

        {/* Mobile Stylist Pills - Force single selection */}
        <div className="md:hidden flex gap-1.5 overflow-x-auto scrollbar-hide flex-1">
          {stylists?.map(s => (
            <button
              key={s}
              onClick={() => onStylistChange(s)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${currentStylist === s
                ? 'bg-gold text-gray-900 shadow-md'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                }`}
            >
              {s}
            </button>
          ))}
        </div>

        {/* Server Status Indicator */}
        <ServerStatus mode="mini" onClick={() => onOpenSettings('general')} />

        {/* Auth Status - Google Login for Contacts */}
        <AuthStatus />

        {/* Silent Mode Toggle */}
        <button
          onClick={() => onSilentModeChange?.(!silentMode)}
          className={`p-2 rounded-lg transition-colors ${silentMode
              ? 'text-amber-600 bg-amber-100 dark:bg-amber-900/50 dark:text-amber-400'
              : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800'
            }`}
          title={silentMode ? 'Modo Silencioso ACTIVO — click para desactivar' : 'Activar Modo Silencioso (sin WhatsApp)'}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            {silentMode ? (
              <>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
              </>
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
            )}
          </svg>
        </button>

        {/* Settings Button */}
        <button
          onClick={() => onOpenSettings()}
          className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          title="Ajustes Avanzados"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </button>

        {/* Date Navigator */}
        <div className="flex items-center bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm p-0.5 sm:p-1">
          <button
            disabled={(() => {
              const today = new Date();
              const startOfCurrentMonth = new Date(today.getFullYear(), today.getMonth(), 1);

              // Predict target date
              const targetDate = new Date(selectedDate);
              const diff = viewMode === 'week' ? 7 : 1;
              targetDate.setDate(targetDate.getDate() - diff);

              return targetDate < startOfCurrentMonth;
            })()}
            onClick={() => {
              const newDate = new Date(selectedDate);
              const diff = viewMode === 'week' ? 7 : 1;
              newDate.setDate(newDate.getDate() - diff);

              const today = new Date();
              const startOfCurrentMonth = new Date(today.getFullYear(), today.getMonth(), 1);
              startOfCurrentMonth.setHours(0, 0, 0, 0); // normalize

              if (newDate < startOfCurrentMonth) return; // Prevention

              onDateChange(newDate);
            }}
            className="p-1.5 sm:p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md text-gray-500 dark:text-gray-400 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="px-2 sm:px-4 font-medium text-xs sm:text-sm text-gray-700 dark:text-gray-200 min-w-[100px] sm:min-w-[140px] text-center capitalize">
            {viewMode === 'week' ? (
              (() => {
                const d = new Date(selectedDate);
                const day = d.getDay();
                const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday
                const monday = new Date(d.setDate(diff));
                const sunday = new Date(monday);
                sunday.setDate(monday.getDate() + 6);

                return (
                  <span className="text-[11px] sm:text-sm">
                    {format(monday, "d MMM", { locale: es })} - {format(sunday, "d MMM", { locale: es })}
                  </span>
                );
              })()
            ) : (
              <span className="hidden sm:inline">{format(selectedDate, "EEEE, d MMMM", { locale: es })}</span>
            )}
            {viewMode === 'day' && (
              <span className="sm:hidden">{format(selectedDate, "EEE d MMM", { locale: es })}</span>
            )}
          </div>
          <button
            onClick={() => {
              const newDate = new Date(selectedDate);
              const diff = viewMode === 'week' ? 7 : 1;
              newDate.setDate(newDate.getDate() + diff);
              onDateChange(newDate);
            }}
            className="p-1.5 sm:p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md text-gray-500 dark:text-gray-400 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>
    </header>
  );
}
