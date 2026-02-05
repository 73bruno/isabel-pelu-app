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
}

interface ColumnProps {
    name: string;
    appointments: Appointment[];
    onAddClick: (params?: { time: string, duration: number }) => void;
    onEditClick?: (appointment: Appointment) => void;
    date: Date;
    schedule?: Schedule;
    compact?: boolean; // For week view - smaller display
}

// Helper to calculate pixel height based on duration
const PPM_NORMAL = 2.5;
const PPM_COMPACT = 1.5;

export default function Column({ name, appointments, onAddClick, onEditClick, date, schedule, compact = false }: ColumnProps) {
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

    // Generate time slots
    const timeSlots = [];
    if (!isClosed) {
        for (let i = startHour; i < endHour; i++) {
            timeSlots.push(i);
        }
    }

    // Total height calculation
    const totalHours = endHour - startHour;
    const totalHeight = totalHours * 60 * pixelsPerMinute;

    // Sort appointments by time
    const sortedAppointments = [...appointments].sort((a, b) => {
        return parseInt(a.time.replace(':', '')) - parseInt(b.time.replace(':', ''));
    });

    // Drag State
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState<{ y: number, time: string } | null>(null);
    const [dragCurrent, setDragCurrent] = useState<{ y: number, duration: number } | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);

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
            return; // Silently ignore - the visual indication (gray stripes) is enough
        }

        setIsDragging(true);
        setDragStart({ y: clientY, time: startTime });
        setDragCurrent({ y: clientY, duration: 15 });
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!isDragging || !dragStart || !containerRef.current) return;

        const rect = containerRef.current.getBoundingClientRect();
        const scrollTop = containerRef.current.scrollTop;
        const clientY = e.clientY - rect.top + scrollTop;

        const diffY = clientY - dragStart.y;
        const diffMinutes = Math.max(15, Math.round((diffY / pixelsPerMinute) / 15) * 15);

        setDragCurrent({
            y: clientY,
            duration: diffMinutes
        });
    };

    const handleMouseUp = () => {
        if (isDragging && dragStart && dragCurrent) {
            onAddClick({ time: dragStart.time, duration: dragCurrent.duration });
        }
        setIsDragging(false);
        setDragStart(null);
        setDragCurrent(null);
    };

    return (
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
                        {/* Background Grid */}
                        <div className="absolute top-0 left-0 w-full pointer-events-none" style={{ height: `${totalHeight}px` }}>
                            {timeSlots.map((hour) => {
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

                                        {/* 15 Minute Markers */}
                                        <div className="absolute top-[25%] left-12 right-0 border-t border-dashed" style={{ borderColor: 'var(--timeline-dashed)' }}></div>
                                        <div className="absolute top-[50%] left-10 right-0 border-t" style={{ borderColor: 'var(--timeline-line)' }}></div> {/* 30 min stronger line */}
                                        <div className="absolute top-[75%] left-12 right-0 border-t border-dashed" style={{ borderColor: 'var(--timeline-dashed)' }}></div>

                                        {/* Vertical Line */}
                                        <div className="absolute top-0 bottom-0 left-10 border-r" style={{ borderColor: 'var(--timeline-line)' }}></div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Drag Selection Visualizer */}
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

                        {/* Appointment Blocks */}
                        <div className="relative w-full pointer-events-none" style={{ height: `${totalHeight}px` }}>
                            {sortedAppointments.map((appt, index) => {
                                const [hours, minutes] = appt.time.split(':').map(Number);
                                const startMinutesFromBase = (hours - startHour) * 60 + minutes;

                                const isOverlapping = index > 0 && startMinutesFromBase < ((parseInt(sortedAppointments[index - 1].time.split(':')[0]) - startHour) * 60 + parseInt(sortedAppointments[index - 1].time.split(':')[1]) + sortedAppointments[index - 1].duration);

                                const leftBase = '3rem';
                                const overlapIndent = isOverlapping ? '1.5rem' : '0px';

                                return (
                                    <div
                                        key={appt.id}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            if (onEditClick) onEditClick(appt);
                                        }}
                                        className="appointment-card absolute rounded-lg border-l-4 hover:z-30 transition-all cursor-pointer overflow-hidden flex flex-col justify-start shadow-sm hover:shadow-xl hover:scale-[1.02] group pointer-events-auto"
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
    );
}
