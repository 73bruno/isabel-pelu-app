import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import AuthStatus from './AuthStatus';

interface HeaderProps {
  selectedDate: Date;
  onDateChange: (date: Date) => void;
  onNewAppointment: () => void;
  viewMode: 'day' | 'week';
  onViewChange: (mode: 'day' | 'week') => void;
  currentStylist: string;
  onStylistChange: (stylist: string) => void;
  onOpenSettings: () => void;
  stylists?: string[]; // Optional for now to avoid breaking immediate parents, but we will pass it
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
  stylists
}: HeaderProps) {
  return (
    <header className="sticky top-0 z-50 w-full glass-metal dark:bg-gray-900/90 dark:border-gray-800 px-4 sm:px-6 py-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between shadow-sm transition-all duration-300 backdrop-blur-md">
      <div className="flex items-center gap-4 justify-between sm:justify-start">
        {/* Logo Container */}
        <div className="flex items-center gap-3">
          <div className="relative h-10 w-10 sm:h-12 sm:w-12 overflow-hidden rounded-full border-2 border-gold shadow-md shrink-0">
            <img
              src="/logo.avif"
              alt="Isabel Peluquería"
              className="object-cover w-full h-full"
            />
          </div>
          <div>
            <h1 className="text-lg sm:text-xl font-bold tracking-tight text-gray-800 dark:text-gray-100 leading-tight font-serif">
              Almodóvar <span className="text-gold-dark dark:text-gold italic">Peluqueras</span>
            </h1>
            <p className="text-[10px] sm:text-xs text-metal-dark dark:text-gray-400 uppercase tracking-widest letter-spacing-2">Gestión de Citas</p>
          </div>
        </div>

        {/* Desktop Controls */}
        <div className="hidden md:flex items-center gap-4 bg-gray-100/50 dark:bg-gray-800/50 p-1 rounded-xl border border-gray-200 dark:border-gray-700">
          {/* View Selector */}
          <div className="flex bg-white dark:bg-gray-900 rounded-lg shadow-sm p-1">
            <button
              onClick={() => onViewChange('day')}
              className={`px-3 py-1.5 text-sm rounded-md transition-all ${viewMode === 'day' ? 'bg-gray-900 dark:bg-gold dark:text-gray-900 text-white shadow-md' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'}`}
            >
              Día
            </button>
            <button
              onClick={() => onViewChange('week')}
              className={`px-3 py-1.5 text-sm rounded-md transition-all ${viewMode === 'week' ? 'bg-gray-900 dark:bg-gold dark:text-gray-900 text-white shadow-md' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'}`}
            >
              Semana
            </button>
          </div>

          <div className="w-px h-8 bg-gray-300 dark:bg-gray-700"></div>

          {/* Stylist Selector */}
          <select
            value={currentStylist}
            onChange={(e) => onStylistChange(e.target.value)}
            className="bg-transparent text-sm font-medium text-gray-700 dark:text-gray-200 outline-none cursor-pointer hover:text-gray-900 dark:hover:text-white [&>option]:text-gray-900"
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

      <div className="flex items-center gap-2 sm:gap-4 justify-between sm:justify-end w-full sm:w-auto overflow-x-auto scrollbar-hide">

        {/* Auth Status - Google Login for Contacts */}
        <AuthStatus />

        {/* Settings Button */}
        <button
          onClick={onOpenSettings}
          className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
          title="Ajustes Avanzados"
        >
          <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </button>

        {/* Date Navigator */}
        <div className="flex items-center bg-white rounded-lg border border-gray-200 shadow-sm p-1">
          <button
            onClick={() => {
              const newDate = new Date(selectedDate);
              newDate.setDate(newDate.getDate() - 1);
              onDateChange(newDate);
            }}
            className="p-2 hover:bg-gray-100 rounded-md text-gray-500"
          >
            ←
          </button>
          <div className="px-4 font-medium text-sm sm:text-base text-gray-700 min-w-[140px] text-center capitalize">
            {format(selectedDate, "EEEE, d MMMM", { locale: es })}
          </div>
          <button
            onClick={() => {
              const newDate = new Date(selectedDate);
              newDate.setDate(newDate.getDate() + 1);
              onDateChange(newDate);
            }}
            className="p-2 hover:bg-gray-100 rounded-md text-gray-500"
          >
            →
          </button>
        </div>

        <button
          onClick={onNewAppointment}
          className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-gray-900 text-white rounded-lg shadow-lg hover:bg-gray-800 transition-all font-medium text-xs sm:text-sm whitespace-nowrap"
        >
          <span>+</span>
          <span className="hidden sm:inline">Nueva Cita</span>
          <span className="sm:hidden">Cita</span>
        </button>
      </div>
    </header>
  );
}
