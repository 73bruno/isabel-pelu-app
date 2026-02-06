"use client";

import { useState, useEffect, useCallback, useMemo } from 'react';
import Header from "../components/Header";
import Column from "../components/Column";
import NewAppointmentModal from "../components/NewAppointmentModal";
import SettingsModal, { StylistConfig, loadStylistConfigs, saveStylistConfigs } from "../components/SettingsModal";
import { DEFAULT_OPENING_HOURS, Schedule, getBusinessHoursForDay } from "../utils/schedule";

// Types
interface Appointment {
  id: string;
  time: string;
  duration: number;
  clientName: string;
  service: string;
  color?: string;
  stylist: string;
  phone?: string;
}

// Helper: Format date as YYYY-MM-DD in LOCAL timezone (not UTC)
function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export default function Home() {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [activeTab, setActiveTab] = useState(0);

  // Stylist Config State (replaces old stylists array)
  const [stylistConfigs, setStylistConfigs] = useState<StylistConfig[]>(() => {
    // SSR-safe: return defaults, will be overwritten on client
    return [
      { id: 'isabel', name: 'Isabel', calendarId: 'isabel', color: { bg: '#FEF3C7', border: '#F59E0B', text: '#92400E' }, order: 0, isActive: true },
      { id: 'yolanda', name: 'Yolanda', calendarId: 'yolanda', color: { bg: '#DBEAFE', border: '#3B82F6', text: '#1E40AF' }, order: 1, isActive: true },
      { id: 'almudena', calendarId: 'almudena', name: 'Almudena', color: { bg: '#FCE7F3', border: '#EC4899', text: '#9D174D' }, order: 2, isActive: true },
    ];
  });
  const [schedule, setSchedule] = useState<Schedule>(DEFAULT_OPENING_HOURS);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<'general' | 'stylists' | 'schedule'>('general');

  // Derived: active stylists sorted by order (Memoized to prevent infinite loops)
  const activeStylists = useMemo(() =>
    stylistConfigs.filter(s => s.isActive).sort((a, b) => a.order - b.order),
    [stylistConfigs]
  );

  const stylistNames = useMemo(() =>
    activeStylists.map(s => s.name),
    [activeStylists]
  );

  // Build color map from configs (Memoized)
  const stylistColors = useMemo(() =>
    activeStylists.reduce((acc, stylist) => {
      acc[stylist.name] = stylist.color;
      return acc;
    }, {} as Record<string, { bg: string; border: string; text: string }>),
    [activeStylists]
  );

  // App State - Now fetched from Google Calendar
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [weekAppointments, setWeekAppointments] = useState<Record<string, Appointment[]>>({}); // Key: YYYY-MM-DD
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // View State
  const [viewMode, setViewMode] = useState<'day' | 'week'>('day');
  const [currentStylist, setCurrentStylist] = useState('all');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAppointment, setEditingAppointment] = useState<any>(null);
  const [voiceText, setVoiceText] = useState("");
  const [modalTime, setModalTime] = useState("");
  const [modalDuration, setModalDuration] = useState(30);
  const [modalStylist, setModalStylist] = useState("");

  // Initialize from LocalStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      // Load stylist configs
      const configs = loadStylistConfigs();
      setStylistConfigs(configs);

      const savedSchedule = localStorage.getItem('schedule');
      if (savedSchedule) {
        setSchedule(JSON.parse(savedSchedule));
      }

      const savedTheme = localStorage.getItem('theme');
      if (savedTheme === 'dark') {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    }
  }, []);

  // Fetch appointments from Google Calendar
  const fetchAppointments = useCallback(async (date: Date) => {
    setIsLoading(true);
    setError(null);

    try {
      const dateStr = formatLocalDate(date);
      const response = await fetch(`/api/calendar?date=${dateStr}`);

      if (!response.ok) {
        throw new Error('Error al cargar las citas');
      }

      const data = await response.json();

      // Transform API response to our format
      const allAppointments: Appointment[] = [];

      // Map calendar keys to stylist names AND colors using configuration
      const calendarToStylist: Record<string, string> = {};
      const localStylistColors: Record<string, { bg: string; border: string; text: string }> = {};

      // Default mapping for fallback
      calendarToStylist['isabel'] = 'Isabel';
      calendarToStylist['yolanda'] = 'Yolanda';
      calendarToStylist['almudena'] = 'Almudena';
      calendarToStylist['stylist4'] = 'Peluquera 4';
      calendarToStylist['stylist5'] = 'Peluquera 5';

      // Build mappings from config
      stylistConfigs.forEach(config => {
        if (config.calendarId) {
          calendarToStylist[config.calendarId.toLowerCase()] = config.name;
        }
        localStylistColors[config.name] = config.color;
      });

      console.log('Mapping Debug:', { calendarToStylist, availableCalendars: Object.keys(data.calendars) });

      Object.entries(data.calendars).forEach(([calendarKey, events]: [string, any]) => {
        // Try exact match matching or lowercase match
        const stylistName = calendarToStylist[calendarKey] || calendarToStylist[calendarKey.toLowerCase()] || calendarKey;

        events.forEach((event: any) => {
          // Calculate duration from start/end times
          let duration = 60; // default
          if (event.startDateTime && event.endDateTime) {
            const start = new Date(event.startDateTime);
            const end = new Date(event.endDateTime);
            duration = Math.round((end.getTime() - start.getTime()) / (1000 * 60));
          }

          allAppointments.push({
            id: event.id,
            time: event.time,
            duration,
            clientName: event.clientName,
            service: event.service || '',
            color: localStylistColors[stylistName]?.bg || '#E5E7EB',
            stylist: stylistName,
          });
        });
      });

      console.log('Processed Appointments:', allAppointments.map(a => ({ id: a.id, stylist: a.stylist, time: a.time })));

      setAppointments(allAppointments);
    } catch (err) {
      console.error('Error fetching appointments:', err);
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setIsLoading(false);
    }
  }, [stylistConfigs]); // Removed stylistColors dependency

  // Load appointments when date changes (day view)
  useEffect(() => {
    if (viewMode === 'day') {
      fetchAppointments(selectedDate);
    }
  }, [viewMode, selectedDate, fetchAppointments]);

  // Calculate days for Week View (Start MONDAY - End SATURDAY)
  const getWeekDays = (date: Date) => {
    const d = new Date(date);
    const day = d.getDay(); // 0 (Sun) - 6 (Sat)
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(d.setDate(diff));

    const weekDays = [];
    for (let i = 0; i < 6; i++) { // Mon-Sat
      const newDay = new Date(monday);
      newDay.setDate(monday.getDate() + i);
      weekDays.push(newDay);
    }
    return weekDays;
  };

  const weekDays = getWeekDays(new Date(selectedDate));

  // Fetch appointments for week view
  const fetchWeekAppointments = useCallback(async (days: Date[]) => {
    setIsLoading(true);
    setError(null);

    try {
      const results: Record<string, Appointment[]> = {};

      // Fetch all days in parallel
      await Promise.all(
        days.map(async (day) => {
          const dateStr = formatLocalDate(day);
          const response = await fetch(`/api/calendar?date=${dateStr}`);
          if (!response.ok) throw new Error(`Error fetching ${dateStr}`);

          const data = await response.json();
          const dayAppointments: Appointment[] = [];

          // Map calendar keys to stylist names AND colors using configuration
          const calendarToStylist: Record<string, string> = {};
          const localStylistColors: Record<string, { bg: string; border: string; text: string }> = {};

          // Default mapping for fallback
          calendarToStylist['isabel'] = 'Isabel';
          calendarToStylist['yolanda'] = 'Yolanda';
          calendarToStylist['almudena'] = 'Almudena';
          calendarToStylist['stylist4'] = 'Peluquera 4';
          calendarToStylist['stylist5'] = 'Peluquera 5';

          // Build mappings from config
          stylistConfigs.forEach(config => {
            if (config.calendarId) {
              calendarToStylist[config.calendarId] = config.name;
            }
            localStylistColors[config.name] = config.color;
          });

          Object.entries(data.calendars).forEach(([calendarKey, events]: [string, any]) => {
            const stylistName = calendarToStylist[calendarKey] || calendarKey;

            events.forEach((event: any) => {
              let duration = 60;
              if (event.startDateTime && event.endDateTime) {
                const start = new Date(event.startDateTime);
                const end = new Date(event.endDateTime);
                duration = Math.round((end.getTime() - start.getTime()) / (1000 * 60));
              }

              dayAppointments.push({
                id: event.id,
                time: event.time,
                duration,
                clientName: event.clientName,
                service: event.service || '',
                color: localStylistColors[stylistName]?.bg || '#E5E7EB',
                stylist: stylistName,
              });
            });
          });

          results[dateStr] = dayAppointments;
        })
      );

      setWeekAppointments(results);
    } catch (err) {
      console.error('Error fetching week appointments:', err);
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setIsLoading(false);
    }
  }, [stylistConfigs]); // Added stylistConfigs dependency

  // Load week appointments when in week view
  useEffect(() => {
    if (viewMode === 'week') {
      fetchWeekAppointments(weekDays);
    }
  }, [viewMode, selectedDate, fetchWeekAppointments]);

  // Handlers
  const handleOpenModal = (params?: { time: string, duration: number, stylist?: string }) => {
    if (params) {
      setModalTime(params.time);
      setModalDuration(params.duration);
      setModalStylist(params.stylist || stylistNames[0]);
    } else {
      setModalTime("");
      setModalDuration(30);
      setModalStylist(stylistNames[0]);
    }
    setVoiceText("");
    setEditingAppointment(null);
    setIsModalOpen(true);
  };

  const handleEditAppointment = (appt: any) => {
    setEditingAppointment(appt);
    setIsModalOpen(true);
  };

  const handleDeleteAppointment = async () => {
    if (!editingAppointment) return;

    try {
      // Map stylist name to calendar ID
      const stylistConfig = stylistConfigs.find(s => s.name === editingAppointment.stylist);

      console.log('Deleting Appointment - Debug Info:', {
        stylistName: editingAppointment.stylist,
        foundConfig: stylistConfig,
        allConfigs: stylistConfigs
      });

      let calendarId = stylistConfig ? stylistConfig.calendarId : editingAppointment.stylist.toLowerCase();

      // Fallback
      if (!stylistConfig && editingAppointment.stylist.startsWith('Peluquera ')) {
        const num = editingAppointment.stylist.replace('Peluquera ', '');
        if (['4', '5'].includes(num)) {
          calendarId = `stylist${num}`;
        }
      }

      const response = await fetch(
        `/api/calendar?eventId=${editingAppointment.id}&stylist=${calendarId}`,
        { method: 'DELETE' }
      );

      if (!response.ok) {
        throw new Error('Error al eliminar la cita');
      }

      // Refresh appointments from server
      if (viewMode === 'week') {
        const weekDays = getWeekDays(selectedDate);
        await fetchWeekAppointments(weekDays);
      } else {
        await fetchAppointments(selectedDate);
      }
    } catch (err) {
      console.error('Error deleting appointment:', err);
      alert('Error al eliminar la cita. Por favor, inténtalo de nuevo.');
    }

    setIsModalOpen(false);
    setEditingAppointment(null);
  };

  const handleSaveAppointment = async (newAppt: any) => {
    try {
      // Build start datetime
      const startDateTime = new Date(selectedDate);
      const [hours, minutes] = newAppt.time.split(':').map(Number);
      startDateTime.setHours(hours, minutes, 0, 0);

      // Map stylist name to calendar ID
      const stylistConfig = stylistConfigs.find(s => s.name === newAppt.stylist);

      // DEBUG LOGS
      console.log('Saving Appointment - Debug Info:', {
        stylistName: newAppt.stylist,
        foundConfig: stylistConfig,
        allConfigs: stylistConfigs
      });

      let calendarId = stylistConfig ? stylistConfig.calendarId : newAppt.stylist.toLowerCase();

      // Fallback: if name looks like "Peluquera X", try to map to stylistX
      if (!stylistConfig && newAppt.stylist.startsWith('Peluquera ')) {
        const num = newAppt.stylist.replace('Peluquera ', '');
        if (['4', '5'].includes(num)) {
          calendarId = `stylist${num}`;
        }
      }

      if (newAppt.id) {
        // UPDATE existing - send to Google Calendar via PUT
        const response = await fetch('/api/calendar', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            eventId: newAppt.id,
            stylist: calendarId, // Send ID, not name
            clientName: newAppt.client,
            service: newAppt.service || '',
            startTime: startDateTime.toISOString(),
            duration: newAppt.duration || 30,
            phone: newAppt.phone,
            reminders: newAppt.remindersEnabled,
          }),
        });

        if (!response.ok) {
          throw new Error('Error al actualizar la cita');
        }
      } else {
        // CREATE new - send to Google Calendar via POST
        const response = await fetch('/api/calendar', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            stylist: calendarId, // Send ID, not name
            clientName: newAppt.client,
            service: newAppt.service || '',
            startTime: startDateTime.toISOString(),
            duration: newAppt.duration || 30,
            phone: newAppt.phone,
            reminders: newAppt.remindersEnabled,
          }),
        });

        if (!response.ok) {
          throw new Error('Error al crear la cita');
        }

        // WhatsApp Confirmation (Fire & Forget)
        // Only if reminders are enabled and we have a phone number
        if (newAppt.remindersEnabled && newAppt.phone) {
          // Format Name: First word only, Capitalized
          const firstName = newAppt.client.trim().split(/\s+/)[0];
          const formattedName = firstName.charAt(0).toUpperCase() + firstName.slice(1).toLowerCase();

          const dateStr = startDateTime.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
          const timeStr = newAppt.time;

          // Calculate if subsequent reminder is needed (if > 24h from now)
          const now = new Date();
          const isToday = startDateTime.toDateString() === now.toDateString();
          const tomorrow = new Date(now);
          tomorrow.setDate(tomorrow.getDate() + 1);
          const isTomorrow = startDateTime.toDateString() === tomorrow.toDateString();

          let reminderText = "";
          if (!isToday && !isTomorrow) {
            reminderText = "\n\nTe enviaremos otro recordatorio el día previo a su cita.";
          }

          // Anti-Blocking Variations
          const greetings = ['Hola', 'Buenas', 'Estimado/a'];
          const closings = ['Gracias y hasta pronto!', 'Nos vemos pronto!', 'Gracias por confiar en nosotros.', 'Un saludo!'];

          const greeting = greetings[Math.floor(Math.random() * greetings.length)];
          const closing = closings[Math.floor(Math.random() * closings.length)];

          // ADDED EMOJIS HERE 📅 and ⏰
          const message = `${greeting} ${formattedName}, hemos creado tu cita:\n\n📅 ${dateStr} a las ⏰ ${timeStr} con ${newAppt.stylist}.${reminderText}\n\n${closing}`;

          // Send async (don't block UI)
          fetch('/api/whatsapp/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              phone: newAppt.phone,
              message
            })
          }).then(res => {
            if (!res.ok) console.warn('Failed to send WhatsApp confirmation');
          }).catch(err => console.error('WhatsApp Error:', err));
        }
      }

      // Refresh appointments from server
      if (viewMode === 'week') {
        const weekDays = getWeekDays(selectedDate);
        await fetchWeekAppointments(weekDays);
      } else {
        await fetchAppointments(selectedDate);
      }
    } catch (err) {
      console.error('Error saving appointment:', err);
      alert('Error al guardar la cita. Por favor, inténtalo de nuevo.');
    }

    setIsModalOpen(false);
    setEditingAppointment(null);
  };

  return (
    <main className="min-h-screen flex flex-col font-sans transition-colors duration-300">
      <Header
        selectedDate={selectedDate}
        onDateChange={(date) => setSelectedDate(new Date(date))}
        onNewAppointment={handleOpenModal}
        viewMode={viewMode}
        onViewChange={setViewMode}
        currentStylist={currentStylist}
        onStylistChange={setCurrentStylist}
        onOpenSettings={(tab) => {
          setSettingsTab(tab || 'general');
          setIsSettingsOpen(true);
        }}
        stylists={stylistNames}
      />

      <NewAppointmentModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingAppointment(null);
        }}
        onSave={handleSaveAppointment}
        onDelete={handleDeleteAppointment}
        initialText={voiceText}
        initialTime={modalTime}
        initialDuration={modalDuration}
        initialStylist={modalStylist}
        stylists={stylistNames}
        editingAppointment={editingAppointment}
        date={selectedDate}
        schedule={schedule}
      />

      <SettingsModal
        isOpen={isSettingsOpen}
        initialTab={settingsTab}
        onClose={() => setIsSettingsOpen(false)}
        stylistConfigs={stylistConfigs}
        onUpdateStylists={setStylistConfigs}
        schedule={schedule}
        onUpdateSchedule={setSchedule}
      />

      {/* Mobile Tabs (Only for Day View or Single Stylist) */}
      <div className="md:hidden px-4 py-2 border-b border-gray-200 bg-white sticky top-[80px] z-40 flex items-center justify-between gap-2 overflow-x-auto">
        {stylistNames.map((stylist: string, index: number) => (
          <button
            key={stylist}
            onClick={() => setActiveTab(index)}
            className={`
                    flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all whitespace-nowrap
                    ${activeTab === index
                ? 'bg-gold/10 text-gold-dark ring-1 ring-gold/50 shadow-sm'
                : 'text-gray-500 hover:bg-gray-50'}
                `}
          >
            {stylist}
          </button>
        ))}
      </div>

      {/* Main Board Area */}
      <div className="flex-1 p-4 md:p-6 overflow-hidden relative">
        {/* Loading State */}
        {isLoading && (
          <div className="absolute inset-0 bg-white/80 dark:bg-gray-900/80 z-30 flex items-center justify-center">
            <div className="flex flex-col items-center gap-3">
              <div className="w-10 h-10 border-4 border-gold border-t-transparent rounded-full animate-spin"></div>
              <p className="text-gray-600 dark:text-gray-400 font-medium">Cargando citas...</p>
            </div>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="absolute inset-0 bg-white/80 dark:bg-gray-900/80 z-30 flex items-center justify-center">
            <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-md text-center">
              <p className="text-red-700 font-medium mb-2">Error al cargar las citas</p>
              <p className="text-red-600 text-sm mb-4">{error}</p>
              <button
                onClick={() => fetchAppointments(selectedDate)}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                Reintentar
              </button>
            </div>
          </div>
        )}

        <div className="h-full max-w-7xl mx-auto">

          {/* LOGIC: DAY VIEW */}
          {viewMode === 'day' && (
            <div className={`flex flex-col md:flex-row gap-4 h-full`}>
              {stylistNames.map((stylist: string, index: number) => {
                // Filter based on "All" or match
                if (currentStylist !== 'all' && currentStylist !== stylist) return null;

                // Mobile: Only show active tab if All selected
                const isHiddenMobile = currentStylist === 'all' && activeTab !== index;

                return (
                  <div key={stylist} className={`${isHiddenMobile ? 'hidden md:flex' : 'flex'} flex-1`}>
                    <Column
                      name={stylist}
                      appointments={appointments.filter(a => a.stylist === stylist)}
                      onAddClick={(params) => handleOpenModal(params ? { ...params, stylist } : { time: '', duration: 30, stylist })}
                      onEditClick={handleEditAppointment}
                      date={selectedDate}
                      schedule={schedule}
                    />
                  </div>
                );
              })}
            </div>
          )}

          {/* LOGIC: WEEK VIEW */}
          {viewMode === 'week' && (
            <div className="flex flex-col gap-4 h-full">
              {/* Stylist Legend */}


              {/* Days Grid */}
              <div className="flex gap-2 h-full overflow-x-auto pb-4">
                {weekDays.map((date) => {
                  const dateKey = formatLocalDate(date);
                  const dayAppointments = weekAppointments[dateKey] || [];

                  // Filter by stylist if one is selected
                  const filteredAppts = currentStylist === 'all'
                    ? dayAppointments
                    : dayAppointments.filter(a => a.stylist === currentStylist);

                  const businessHours = getBusinessHoursForDay(date, schedule);
                  const isToday = formatLocalDate(date) === formatLocalDate(new Date());

                  if (!businessHours || businessHours.length === 0) return null;

                  return (
                    <div key={dateKey} className={`min-w-[200px] flex-1 ${isToday ? 'ring-2 ring-gold rounded-xl' : ''}`}>
                      <Column
                        name={`${date.toLocaleDateString('es-ES', { weekday: 'short' })} ${date.getDate()}`}
                        appointments={filteredAppts}
                        onAddClick={(params) => {
                          setSelectedDate(date);
                          handleOpenModal(params);
                        }}
                        onEditClick={(appt) => {
                          setSelectedDate(date);
                          handleEditAppointment(appt);
                        }}
                        date={date}
                        schedule={schedule}
                        compact={true}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>


    </main>
  );
}
