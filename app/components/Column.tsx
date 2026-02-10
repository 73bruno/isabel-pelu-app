"use client";

import { isBusinessHour, getBusinessHoursForDay, Schedule } from '../utils/schedule';
import { useState, useRef } from 'react';

interface Appointment {
    id: string;
    time: string;
    duration: number; // in minutes
    clientName: string;
    service: string;
    color?: string; // Optional custom color per service
    stylist: string; // Required for drag-drop
    phone?: string;
    remindersEnabled?: boolean;
}

interface ColumnProps {
    name: string;
    appointments: Appointment[];
    onAddClick: (params?: { time: string, duration: number }) => void;
    onEditClick?: (appointment: Appointment) => void;
    onMoveAppointment?: (appointment: Appointment, newTime: string) => void; // NEW: For drag-drop
    date: Date;
    schedule?: Schedule;
    compact?: boolean; // For week view - smaller display
}

// Helper to calculate pixel height based on duration
const PPM_NORMAL = 2.5;
const PPM_COMPACT = 1.5;

export default function Column({ name, appointments, onAddClick, onEditClick, onMoveAppointment, date, schedule, compact = false }: ColumnProps) {
    const pixelsPerMinute = compact ? PPM_COMPACT : PPM_NORMAL;

    // Dynamic Time Range Calculation
    const businessIntervals = getBusinessHoursForDay(date, schedule);
    const isClosed = !businessIntervals || businessIntervals.length === 0;

    let startHour = 9;
    let endHour = 20;

    if (!isClosed) {
        startHour = Math.min(...businessIntervals.map(i => i[0]));
        endHour = Math.max(...businessIntervals.map(i => i[1]));
    }

    // Generate time slots - NOW EVERY 15 MINUTES for better granularity
    const timeSlots: { hour: number, minute: number }[] = [];
    if (!isClosed) {
        for (let h = startHour; h < endHour; h++) {
            for (let m = 0; m < 60; m += 15) {
                timeSlots.push({ hour: h, minute: m });
            }
        }
    }

    // Total height calculation
    const totalHours = endHour - startHour;
    const totalHeight = totalHours * 60 * pixelsPerMinute;

    // Sort appointments by time
    const sortedAppointments = [...appointments].sort((a, b) => {
        return parseInt(a.time.replace(':', '')) - parseInt(b.time.replace(':', ''));
    });

    // Drag State for CREATE
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState<{ y: number, time: string } | null>(null);
    const [dragCurrent, setDragCurrent] = useState<{ y: number, duration: number } | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    // Drag State for MOVE - with threshold
    const [movingAppointment, setMovingAppointment] = useState<Appointment | null>(null);
    const [movePreviewTime, setMovePreviewTime] = useState<string | null>(null);
    const [showMoveConfirm, setShowMoveConfirm] = useState(false);
    const [pendingMove, setPendingMove] = useState<{ appointment: Appointment, newTime: string } | null>(null);

    // Move threshold state - prevents accidental moves
    const MOVE_THRESHOLD = 20; // pixels of movement required before activating move
    const [moveCandidate, setMoveCandidate] = useState<{ appt: Appointment, startY: number } | null>(null);
    const [isMoveActive, setIsMoveActive] = useState(false);

    const getTimeFromY = (y: number) => {
        const minutesFromStart = y / pixelsPerMinute;
        const totalMinutes = (startHour * 60) + minutesFromStart;

        const hours = Math.floor(totalMinutes / 60);
        const minutes = Math.floor(totalMinutes % 60);

        const roundedMinutes = Math.round(minutes / 15) * 15;
        let finalHours = hours;
        let finalMinutes = roundedMinutes;

        if (roundedMinutes === 60) {
            finalHours += 1;
            finalMinutes = 0;
        }

        return `${finalHours.toString().padStart(2, '0')}:${finalMinutes.toString().padStart(2, '0')}`;
    };

    // Handle mousedown on appointment card — just records candidate, no move yet
    const handleAppointmentMouseDown = (e: React.MouseEvent, appt: Appointment) => {
        e.preventDefault();
        e.stopPropagation();
        setMoveCandidate({ appt, startY: e.clientY });
        setIsMoveActive(false);
    };

    // Handle mouse down on empty area (for creating)
    const handleMouseDown = (e: React.MouseEvent) => {
        if (!containerRef.current || isClosed) return;
        if ((e.target as HTMLElement).closest('.appointment-card')) return;

        const rect = containerRef.current.getBoundingClientRect();
        const scrollTop = containerRef.current.scrollTop;
        const clientY = e.clientY - rect.top + scrollTop;

        const startTime = getTimeFromY(clientY);

        // Extract hour from time string to check business hours
        const hour = parseInt(startTime.split(':')[0]);

        // Block creation if starting outside business hours
        if (!isBusinessHour(date, hour, schedule)) {
            return;
        }

        setIsDragging(true);
        setDragStart({ y: clientY, time: startTime });
        setDragCurrent({ y: clientY, duration: 15 });
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!containerRef.current) return;

        const rect = containerRef.current.getBoundingClientRect();
        const scrollTop = containerRef.current.scrollTop;
        const clientY = e.clientY - rect.top + scrollTop;

        // Handle move candidate — check threshold before activating
        if (moveCandidate && !isMoveActive) {
            const deltaY = Math.abs(e.clientY - moveCandidate.startY);
            if (deltaY > MOVE_THRESHOLD) {
                // Threshold exceeded — activate move mode
                setIsMoveActive(true);
                setMovingAppointment(moveCandidate.appt);
                setMovePreviewTime(moveCandidate.appt.time);
            }
            return;
        }

        // Handle active move
        if (isMoveActive && movingAppointment) {
            const newTime = getTimeFromY(clientY);
            setMovePreviewTime(newTime);
            return;
        }

        // Handle creating new appointment
        if (!isDragging || !dragStart) return;

        const diffY = clientY - dragStart.y;
        const diffMinutes = Math.max(15, Math.round((diffY / pixelsPerMinute) / 15) * 15);

        setDragCurrent({
            y: clientY,
            duration: diffMinutes
        });
    };

    const handleMouseUp = () => {
        // If we had a move candidate but never exceeded threshold — it's a click (edit)
        if (moveCandidate && !isMoveActive) {
            if (onEditClick) onEditClick(moveCandidate.appt);
            setMoveCandidate(null);
            return;
        }

        // Handle completed move
        if (isMoveActive && movingAppointment && movePreviewTime && movePreviewTime !== movingAppointment.time) {
            setPendingMove({ appointment: movingAppointment, newTime: movePreviewTime });
            setShowMoveConfirm(true);
        }

        // Handle create completion
        if (isDragging && dragStart && dragCurrent) {
            onAddClick({ time: dragStart.time, duration: dragCurrent.duration });
        }

        // Reset all states
        setIsDragging(false);
        setDragStart(null);
        setDragCurrent(null);
        setMovingAppointment(null);
        setMovePreviewTime(null);
        setMoveCandidate(null);
        setIsMoveActive(false);
    };

    const confirmMove = () => {
        if (pendingMove && onMoveAppointment) {
            onMoveAppointment(pendingMove.appointment, pendingMove.newTime);
        }
        setShowMoveConfirm(false);
        setPendingMove(null);
    };

    const cancelMove = () => {
        setShowMoveConfirm(false);
        setPendingMove(null);
    };

    return (
        <>
            {/* Move Confirmation Modal */}
            {showMoveConfirm && pendingMove && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl p-6 max-w-sm w-full">
                        <h3 className="font-bold text-lg text-gray-900 dark:text-white mb-2">
                            ¿Mover cita?
                        </h3>
                        <p className="text-gray-600 dark:text-gray-400 mb-4">
                            <span className="font-semibold">{pendingMove.appointment.clientName}</span>
                            <br />
                            <span className="text-sm">
                                {pendingMove.appointment.time} → <span className="text-gold-dark font-bold">{pendingMove.newTime}</span>
                            </span>
                        </p>
                        <div className="flex gap-3">
                            <button
                                onClick={cancelMove}
                                className="flex-1 py-2 px-4 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors font-medium"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={confirmMove}
                                className="flex-1 py-2 px-4 bg-gold text-gray-900 rounded-lg hover:bg-gold-dark transition-colors font-bold shadow-md"
                            >
                                Confirmar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div
                className="flex-1 min-w-0 h-full flex flex-col rounded-2xl border shadow-sm overflow-hidden transition-colors duration-300"
                style={{ backgroundColor: 'var(--card-bg)', borderColor: 'var(--border-color)', boxShadow: 'var(--card-shadow)' }}
            >
                {/* Column Header */}
                <div
                    className={`p-4 border-b flex items-center justify-between sticky top-0 z-20 transition-colors duration-300 backdrop-blur-sm`}
                    style={{
                        backgroundColor: isClosed ? 'var(--background)' : 'var(--card-bg)',
                        borderColor: 'var(--border-color)'
                    }}
                >
                    <h2 className={`font-bold text-sm sm:text-base tracking-wide truncate ${isClosed ? 'opacity-50' : ''}`} style={{ color: 'var(--text-main)' }}>{name}</h2>
                    {!isClosed && (
                        <span className="hidden sm:inline-block px-2 py-0.5 bg-gold-light/20 dark:bg-gold/20 text-gold-dark dark:text-gold text-[10px] rounded-full font-bold">
                            {appointments.length}
                        </span>
                    )}
                </div>

                {/* Timeline Container */}
                <div
                    ref={containerRef}
                    className={`flex-1 overflow-y-auto overflow-x-hidden relative scrollbar-hide select-none transition-colors duration-300 ${isClosed ? 'flex items-center justify-center' : ''}`}
                    style={{
                        backgroundColor: isClosed ? 'var(--background)' : 'var(--card-bg)'
                    }}
                    onMouseDown={handleMouseDown}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    onMouseLeave={handleMouseUp}
                >
                    {isClosed ? (
                        <div className="text-gray-400 dark:text-gray-500 font-medium text-sm italic">Cerrado</div>
                    ) : (
                        <>
                            {/* Background Grid - Now with 15-min slots */}
                            <div className="absolute top-0 left-0 w-full pointer-events-none" style={{ height: `${totalHeight}px` }}>
                                {/* Hour slots */}
                                {Array.from({ length: totalHours }, (_, i) => startHour + i).map((hour) => {
                                    const isOpen = isBusinessHour(date, hour, schedule);

                                    return (
                                        <div
                                            key={hour}
                                            className={`relative border-b ${!isOpen ? 'bg-repeating-linear-stripes-gray' : ''}`}
                                            style={{
                                                height: `${60 * pixelsPerMinute}px`,
                                                borderColor: 'var(--border-color)'
                                            }}
                                        >
                                            {/* Hour Label */}
                                            <span className={`absolute -top-3 left-1 w-8 sm:w-10 text-xs font-bold font-mono z-10 opacity-70`} style={{ color: isOpen ? 'var(--text-main)' : 'var(--text-secondary)' }}>
                                                {hour}:00
                                            </span>

                                            {/* Professional Timeline Markers - Visual Hierarchy */}
                                            {/* 15 min mark - very subtle dotted */}
                                            <div
                                                className="absolute top-[25%] left-12 right-2 border-t"
                                                style={{ borderColor: 'var(--timeline-15min)', borderStyle: 'dotted' }}
                                            ></div>

                                            {/* 30 min mark - medium solid */}
                                            <div
                                                className="absolute top-[50%] left-10 right-0 border-t"
                                                style={{ borderColor: 'var(--timeline-30min)' }}
                                            >
                                                {/* 30 min label - only on non-compact */}
                                                {!compact && (
                                                    <span className="absolute -top-2 left-0 text-[9px] font-mono text-gray-400 dark:text-gray-600">
                                                        :30
                                                    </span>
                                                )}
                                            </div>

                                            {/* 45 min mark - very subtle dotted */}
                                            <div
                                                className="absolute top-[75%] left-12 right-2 border-t"
                                                style={{ borderColor: 'var(--timeline-15min)', borderStyle: 'dotted' }}
                                            ></div>

                                            {/* Vertical Line - stronger for hour structure */}
                                            <div
                                                className="absolute top-0 bottom-0 left-10 border-r"
                                                style={{ borderColor: 'var(--timeline-hour)' }}
                                            ></div>
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Drag Selection Visualizer (Create) */}
                            {isDragging && dragStart && dragCurrent && (
                                <div
                                    className="absolute left-[3rem] right-[4px] bg-gold/30 border border-gold border-dashed rounded-md z-50 pointer-events-none flex items-center justify-center text-gold-dark font-bold text-xs"
                                    style={{
                                        top: `${dragStart.y}px`,
                                        height: `${Math.max(10, dragCurrent.duration * pixelsPerMinute)}px`
                                    }}
                                >
                                    {dragCurrent.duration} min
                                </div>
                            )}

                            {/* Move Preview Ghost */}
                            {movingAppointment && movePreviewTime && (
                                <div
                                    className="absolute left-[3rem] right-[4px] bg-blue-500/30 border-2 border-blue-500 border-dashed rounded-lg z-50 pointer-events-none flex items-center justify-center"
                                    style={{
                                        top: `${((parseInt(movePreviewTime.split(':')[0]) - startHour) * 60 + parseInt(movePreviewTime.split(':')[1])) * pixelsPerMinute}px`,
                                        height: `${movingAppointment.duration * pixelsPerMinute}px`
                                    }}
                                >
                                    <span className="bg-blue-500 text-white text-xs font-bold px-2 py-1 rounded">
                                        {movePreviewTime}
                                    </span>
                                </div>
                            )}

                            {/* Appointment Blocks */}
                            <div className="relative w-full pointer-events-none" style={{ height: `${totalHeight}px` }}>
                                {sortedAppointments.map((appt, index) => {
                                    const [hours, minutes] = appt.time.split(':').map(Number);
                                    const startMinutesFromBase = (hours - startHour) * 60 + minutes;

                                    const isOverlapping = index > 0 && startMinutesFromBase < ((parseInt(sortedAppointments[index - 1].time.split(':')[0]) - startHour) * 60 + parseInt(sortedAppointments[index - 1].time.split(':')[1]) + sortedAppointments[index - 1].duration);

                                    const leftBase = '3rem';
                                    const overlapIndent = isOverlapping ? '1.5rem' : '0px';

                                    const isBeingMoved = movingAppointment?.id === appt.id;

                                    return (
                                        <div
                                            key={appt.id}
                                            onMouseDown={(e) => handleAppointmentMouseDown(e, appt)}
                                            className={`appointment-card absolute rounded-lg border-l-4 hover:z-30 transition-all overflow-hidden flex flex-col justify-start shadow-sm hover:shadow-xl hover:scale-[1.02] group pointer-events-auto ${isBeingMoved ? 'opacity-50 cursor-grabbing' : 'cursor-pointer'}`}
                                            style={{
                                                top: `${startMinutesFromBase * pixelsPerMinute}px`,
                                                height: `${appt.duration * pixelsPerMinute}px`,
                                                backgroundColor: appt.color || '#FEFCE8',
                                                borderColor: 'rgba(0,0,0,0.1)',
                                                left: `calc(${leftBase} + ${overlapIndent})`,
                                                right: '4px',
                                                zIndex: isOverlapping ? 10 : 1
                                            }}
                                        >
                                            {/* Inner Gradient Overlay for depth */}
                                            <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-transparent pointer-events-none"></div>

                                            <div className="relative p-2 flex flex-col h-full">
                                                <div className="flex justify-between items-start gap-1 min-w-0">
                                                    <span className="font-bold text-gray-800 text-xs sm:text-sm leading-tight truncate block w-full drop-shadow-sm">
                                                        {appt.clientName}
                                                    </span>
                                                </div>

                                                {appt.duration > 20 && (
                                                    <div className="text-[11px] text-gray-600/90 font-medium truncate leading-none mt-1 group-hover:text-gray-800 transition-colors">
                                                        {appt.service}
                                                    </div>
                                                )}

                                                {/* Time label for longer appointments */}
                                                {appt.duration > 45 && (
                                                    <div className="mt-auto text-[10px] text-gray-400 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                                        {appt.time}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </>
                    )}
                </div>
            </div>
        </>
    );
}
