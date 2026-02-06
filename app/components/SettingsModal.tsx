"use client";

import { useState, useEffect } from 'react';
import { Schedule } from '../utils/schedule';
import ServerStatus from './ServerStatus';

// Stylist configuration type
export interface StylistConfig {
    id: string;
    name: string;
    calendarId: string;
    color: { bg: string; border: string; text: string };
    order: number;
    isActive: boolean;
}

// Color options - professional palette
const COLOR_OPTIONS = [
    { name: 'Dorado', color: { bg: '#FEF3C7', border: '#F59E0B', text: '#92400E' } },
    { name: 'Azul', color: { bg: '#DBEAFE', border: '#3B82F6', text: '#1E40AF' } },
    { name: 'Rosa', color: { bg: '#FCE7F3', border: '#EC4899', text: '#9D174D' } },
    { name: 'Verde', color: { bg: '#D1FAE5', border: '#10B981', text: '#065F46' } },
    { name: 'Morado', color: { bg: '#F3E8FF', border: '#8B5CF6', text: '#5B21B6' } },
];

// Calendar slots - maps to environment variables
const CALENDAR_SLOTS = [
    { id: 'isabel', envVar: 'CALENDAR_ISABEL', defaultName: 'Peluquera 1' },
    { id: 'yolanda', envVar: 'CALENDAR_YOLANDA', defaultName: 'Peluquera 2' },
    { id: 'almudena', envVar: 'CALENDAR_ALMUDENA', defaultName: 'Peluquera 3' },
    { id: 'stylist4', envVar: 'CALENDARIO_4', defaultName: 'Peluquera 4' },
    { id: 'stylist5', envVar: 'CALENDARIO_5', defaultName: 'Peluquera 5' },
];

const MAX_STYLISTS = 5;

interface SettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    stylistConfigs: StylistConfig[];
    onUpdateStylists: (configs: StylistConfig[]) => void;
    schedule: Schedule;
    onUpdateSchedule: (newSchedule: Schedule) => void;
    initialTab?: 'general' | 'stylists' | 'schedule';
}

// Helper functions
function generateId(): string {
    return `s_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export function loadStylistConfigs(): StylistConfig[] {
    if (typeof window === 'undefined') {
        return getDefaultConfigs();
    }

    const saved = localStorage.getItem('stylistConfigs');
    if (saved) {
        try {
            const parsed = JSON.parse(saved);
            // Migration: Ensure all configs have a calendarId
            const migrated = parsed.map((config: any, index: number) => {
                if (!config.calendarId) {
                    // Map legacy defaults or assign generic
                    if (config.id === 'isabel') return { ...config, calendarId: 'isabel' };
                    if (config.id === 'yolanda') return { ...config, calendarId: 'yolanda' };
                    if (config.id === 'almudena') return { ...config, calendarId: 'almudena' };
                    // For others, try to deduce from order or generate
                    // This is a best-effort migration
                    return { ...config, calendarId: `stylist${index + 1}` };
                }
                return config;
            });
            return migrated;
        } catch {
            return getDefaultConfigs();
        }
    }

    return getDefaultConfigs();
}

function getDefaultConfigs(): StylistConfig[] {
    return [
        { id: 'isabel', name: 'Isabel', calendarId: 'isabel', color: COLOR_OPTIONS[0].color, order: 0, isActive: true },
        { id: 'yolanda', name: 'Yolanda', calendarId: 'yolanda', color: COLOR_OPTIONS[1].color, order: 1, isActive: true },
        { id: 'almudena', name: 'Almudena', calendarId: 'almudena', color: COLOR_OPTIONS[2].color, order: 2, isActive: true },
    ];
}

export function saveStylistConfigs(configs: StylistConfig[]): void {
    if (typeof window !== 'undefined') {
        localStorage.setItem('stylistConfigs', JSON.stringify(configs));
    }
}

export default function SettingsModal({
    isOpen,
    onClose,
    stylistConfigs,
    onUpdateStylists,
    schedule,
    onUpdateSchedule,
    initialTab = 'general'
}: SettingsModalProps) {
    const [activeTab, setActiveTab] = useState<'general' | 'stylists' | 'schedule'>(initialTab);

    // Reset tab when modal opens
    useEffect(() => {
        if (isOpen) {
            setActiveTab(initialTab);
        }
    }, [isOpen, initialTab]);

    // Stylist editing
    const [editingStylist, setEditingStylist] = useState<string | null>(null);
    const [editName, setEditName] = useState('');
    const [editColorIndex, setEditColorIndex] = useState(0);

    // Schedule editing
    const [editingDay, setEditingDay] = useState<number | null>(null);
    const [tempStart, setTempStart] = useState(9);
    const [tempEnd, setTempEnd] = useState(18);

    // Dark Mode
    const [isDarkMode, setIsDarkMode] = useState(false);

    useEffect(() => {
        if (isOpen && typeof document !== 'undefined') {
            setIsDarkMode(document.documentElement.classList.contains('dark'));
        }
    }, [isOpen]);

    const toggleDarkMode = () => {
        if (typeof document !== 'undefined') {
            const isDark = document.documentElement.classList.toggle('dark');
            setIsDarkMode(isDark);
            localStorage.setItem('theme', isDark ? 'dark' : 'light');
        }
    };

    if (!isOpen) return null;

    const sortedStylists = [...stylistConfigs].sort((a, b) => a.order - b.order);

    // Add new stylist using next available slot
    const handleAddStylist = () => {
        if (stylistConfigs.length >= MAX_STYLISTS) return;

        const usedSlotIds = stylistConfigs.map(s => s.calendarId);
        const nextSlot = CALENDAR_SLOTS.find(slot => !usedSlotIds.includes(slot.id));

        if (!nextSlot) return;

        const usedColors = stylistConfigs.map(s => s.color.bg);
        const availableColor = COLOR_OPTIONS.find(c => !usedColors.includes(c.color.bg)) || COLOR_OPTIONS[stylistConfigs.length % COLOR_OPTIONS.length];

        const newStylist: StylistConfig = {
            id: generateId(),
            name: nextSlot.defaultName,
            calendarId: nextSlot.id,
            color: availableColor.color,
            order: stylistConfigs.length,
            isActive: true,
        };

        const updated = [...stylistConfigs, newStylist];
        onUpdateStylists(updated);
        saveStylistConfigs(updated);

        // Auto-open edit mode for the new stylist to set name
        setEditingStylist(newStylist.id);
        setEditName(newStylist.name);
        setEditColorIndex(COLOR_OPTIONS.findIndex(c => c.color.bg === newStylist.color.bg));
    };

    const handleStartEdit = (stylist: StylistConfig) => {
        setEditingStylist(stylist.id);
        setEditName(stylist.name);
        const colorIndex = COLOR_OPTIONS.findIndex(c => c.color.bg === stylist.color.bg);
        setEditColorIndex(colorIndex >= 0 ? colorIndex : 0);
    };

    const handleSaveEdit = () => {
        if (!editingStylist || !editName.trim()) return;

        const updated = stylistConfigs.map(s =>
            s.id === editingStylist
                ? { ...s, name: editName.trim(), color: COLOR_OPTIONS[editColorIndex].color }
                : s
        );
        onUpdateStylists(updated);
        saveStylistConfigs(updated);
        setEditingStylist(null);
    };

    const handleToggleActive = (id: string) => {
        const activeCount = stylistConfigs.filter(s => s.isActive).length;
        const target = stylistConfigs.find(s => s.id === id);

        if (target?.isActive && activeCount <= 1) {
            alert('Debe haber al menos una peluquera activa');
            return;
        }

        const updated = stylistConfigs.map(s =>
            s.id === id ? { ...s, isActive: !s.isActive } : s
        );
        onUpdateStylists(updated);
        saveStylistConfigs(updated);
    };

    const handleRemoveStylist = (id: string) => {
        const stylist = stylistConfigs.find(s => s.id === id);
        if (!stylist) return;

        if (stylistConfigs.length <= 1) {
            alert('Debe haber al menos una peluquera');
            return;
        }

        if (window.confirm(`¿Estás seguro de que quieres eliminar a ${stylist.name}?\n\nEsta acción no borrará sus citas del calendario, pero la quitará de la lista.`)) {
            const updated = stylistConfigs.filter(s => s.id !== id);
            // Re-normalize orders
            updated.forEach((s, i) => s.order = i);
            onUpdateStylists(updated);
            saveStylistConfigs(updated);

            // If we were editing this one, close edit
            if (editingStylist === id) {
                setEditingStylist(null);
            }
        }
    };

    const handleMoveUp = (index: number) => {
        if (index <= 0) return;
        const updated = [...sortedStylists];
        [updated[index - 1], updated[index]] = [updated[index], updated[index - 1]];
        updated.forEach((s, i) => s.order = i);
        onUpdateStylists(updated);
        saveStylistConfigs(updated);
    };

    const handleMoveDown = (index: number) => {
        if (index >= sortedStylists.length - 1) return;
        const updated = [...sortedStylists];
        [updated[index], updated[index + 1]] = [updated[index + 1], updated[index]];
        updated.forEach((s, i) => s.order = i);
        onUpdateStylists(updated);
        saveStylistConfigs(updated);
    };

    // Schedule Management
    const updateDaySchedule = (day: number, start: number, end: number, isClosed: boolean) => {
        const newSchedule = { ...schedule };
        newSchedule[day] = isClosed ? [] : [[start, end]];
        onUpdateSchedule(newSchedule);
        localStorage.setItem('schedule', JSON.stringify(newSchedule));
        setEditingDay(null);
    };

    return (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
            <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="p-4 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center bg-gray-50 dark:bg-gray-900">
                    <h2 className="text-xl font-bold text-gray-800 dark:text-white">Ajustes</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-xl w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition">×</button>
                </div>

                <div className="flex flex-1 overflow-hidden">
                    {/* Sidebar */}
                    <div className="w-40 bg-gray-50 dark:bg-gray-800 border-r border-gray-100 dark:border-gray-700 p-3 space-y-1">
                        {[
                            { key: 'general', label: 'General' },
                            { key: 'stylists', label: 'Peluqueras' },
                            { key: 'schedule', label: 'Horarios' },
                        ].map((tab) => (
                            <button
                                key={tab.key}
                                onClick={() => setActiveTab(tab.key as any)}
                                className={`w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${activeTab === tab.key
                                    ? 'bg-white dark:bg-gray-700 shadow-sm text-gray-900 dark:text-white'
                                    : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                                    }`}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>

                    {/* Content */}
                    <div className="flex-1 p-6 overflow-y-auto bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200">

                        {/* GENERAL TAB */}
                        {activeTab === 'general' && (
                            <div className="space-y-6">
                                <h3 className="text-lg font-semibold mb-4">Apariencia</h3>
                                <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-xl">
                                    <div>
                                        <p className="font-medium">Modo Oscuro</p>
                                        <p className="text-xs text-gray-500 dark:text-gray-400">Cambiar tema de la aplicación</p>
                                    </div>
                                    <button
                                        onClick={toggleDarkMode}
                                        className={`relative w-14 h-8 rounded-full transition-colors ${isDarkMode ? 'bg-gold' : 'bg-gray-300'}`}
                                    >
                                        <div className={`absolute top-1 left-1 w-6 h-6 bg-white rounded-full shadow-md transition-transform ${isDarkMode ? 'translate-x-6' : ''}`} />
                                    </button>
                                </div>

                                <div className="border-t border-gray-100 dark:border-gray-800 pt-6">
                                    <h3 className="text-lg font-semibold mb-4">Estado del Sistema</h3>
                                    <ServerStatus mode="full" />
                                </div>
                            </div>
                        )}

                        {/* STYLISTS TAB */}
                        {activeTab === 'stylists' && (
                            <div className="space-y-4">
                                <div className="flex items-center justify-between mb-2">
                                    <h3 className="text-lg font-semibold">Equipo</h3>
                                    {stylistConfigs.length < MAX_STYLISTS && (
                                        <button
                                            onClick={handleAddStylist}
                                            className="px-4 py-2 bg-gold text-gray-900 rounded-lg font-medium hover:bg-gold-dark transition text-sm"
                                        >
                                            + Añadir peluquera
                                        </button>
                                    )}
                                </div>

                                {/* Stylists list */}
                                <div className="space-y-2">
                                    {sortedStylists.map((stylist, index) => (
                                        <div
                                            key={stylist.id}
                                            className={`p-4 rounded-xl border transition-all ${stylist.isActive
                                                ? 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700'
                                                : 'bg-gray-100 dark:bg-gray-900 border-gray-200 dark:border-gray-800 opacity-60'
                                                }`}
                                        >
                                            {editingStylist === stylist.id ? (
                                                <div className="space-y-4">
                                                    <div>
                                                        <label className="text-xs text-gray-500 dark:text-gray-400 block mb-1">Nombre</label>
                                                        <input
                                                            type="text"
                                                            value={editName}
                                                            onChange={(e) => setEditName(e.target.value)}
                                                            className="w-full p-2.5 border rounded-lg bg-white dark:bg-gray-800 text-sm outline-none focus:ring-2 focus:ring-gold border-gray-200 dark:border-gray-700"
                                                            autoFocus
                                                        />
                                                    </div>

                                                    <div>
                                                        <label className="text-xs text-gray-500 dark:text-gray-400 block mb-2">Color de las citas</label>
                                                        <div className="flex gap-2">
                                                            {COLOR_OPTIONS.map((option, i) => (
                                                                <button
                                                                    key={i}
                                                                    onClick={() => setEditColorIndex(i)}
                                                                    className={`w-9 h-9 rounded-lg transition-transform ${editColorIndex === i ? 'ring-2 ring-offset-2 ring-gray-900 dark:ring-white scale-110' : 'hover:scale-105'}`}
                                                                    style={{
                                                                        backgroundColor: option.color.bg,
                                                                        border: `2px solid ${option.color.border}`
                                                                    }}
                                                                    title={option.name}
                                                                />
                                                            ))}
                                                        </div>
                                                    </div>

                                                    <div className="flex gap-2 justify-end pt-2 border-t border-gray-100 dark:border-gray-800">
                                                        <button
                                                            onClick={() => setEditingStylist(null)}
                                                            className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700 border border-gray-200 dark:border-gray-700 rounded-lg"
                                                        >
                                                            Cancelar
                                                        </button>
                                                        <button
                                                            onClick={handleSaveEdit}
                                                            className="px-4 py-2 text-sm bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-lg hover:opacity-90"
                                                        >
                                                            Guardar
                                                        </button>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-3">
                                                        <div
                                                            className="w-10 h-10 rounded-lg flex-shrink-0 shadow-sm"
                                                            style={{
                                                                backgroundColor: stylist.color.bg,
                                                                border: `2px solid ${stylist.color.border}`
                                                            }}
                                                        />
                                                        <div>
                                                            <span className="font-medium block">{stylist.name}</span>
                                                            <span className="text-xs text-gray-400">Calendario {index + 1}</span>
                                                        </div>
                                                    </div>

                                                    <div className="flex items-center gap-1">
                                                        {/* Reorder buttons */}
                                                        <div className="flex flex-col mr-2">
                                                            <button
                                                                onClick={() => handleMoveUp(index)}
                                                                disabled={index === 0}
                                                                className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30 text-xs"
                                                                title="Mover arriba"
                                                            >
                                                                ▲
                                                            </button>
                                                            <button
                                                                onClick={() => handleMoveDown(index)}
                                                                disabled={index === sortedStylists.length - 1}
                                                                className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30 text-xs"
                                                                title="Mover abajo"
                                                            >
                                                                ▼
                                                            </button>
                                                        </div>

                                                        {/* Toggle active */}
                                                        <button
                                                            onClick={() => handleToggleActive(stylist.id)}
                                                            className={`px-3 py-1.5 text-xs rounded-lg border transition ${stylist.isActive
                                                                ? 'bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800'
                                                                : 'bg-gray-100 dark:bg-gray-800 text-gray-500 border-gray-200 dark:border-gray-700'
                                                                }`}
                                                        >
                                                            {stylist.isActive ? 'Activa' : 'Inactiva'}
                                                        </button>

                                                        {/* Edit button */}
                                                        <button
                                                            onClick={() => handleStartEdit(stylist)}
                                                            className="px-3 py-1.5 text-xs text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition"
                                                        >
                                                            Editar
                                                        </button>

                                                        {/* Delete button (New) */}
                                                        <button
                                                            onClick={() => handleRemoveStylist(stylist.id)}
                                                            className="p-1.5 text-red-400 hover:text-red-600 dark:hover:text-red-300 rounded-lg transition"
                                                            title="Eliminar estilista"
                                                        >
                                                            🗑️
                                                        </button>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>

                                {stylistConfigs.length >= MAX_STYLISTS && (
                                    <p className="text-xs text-gray-500 text-center pt-2">
                                        Límite máximo de {MAX_STYLISTS} peluqueras alcanzado
                                    </p>
                                )}
                            </div>
                        )}

                        {/* SCHEDULE TAB */}
                        {activeTab === 'schedule' && (
                            <div className="space-y-3">
                                <h3 className="text-lg font-semibold mb-4">Horario del Salón</h3>

                                {Object.entries(schedule).map(([dayKey, intervals]) => {
                                    const dayNames = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
                                    const dayIndex = parseInt(dayKey);
                                    const dayName = dayNames[dayIndex];
                                    const isEditing = editingDay === dayIndex;
                                    const currentStart = intervals.length > 0 ? intervals[0][0] : 9;
                                    const currentEnd = intervals.length > 0 ? intervals[0][1] : 18;
                                    const isOpen = intervals.length > 0;

                                    return (
                                        <div key={dayKey} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                                            <div className="w-24 font-medium">{dayName}</div>

                                            <div className="flex-1 px-4">
                                                {!isEditing ? (
                                                    !isOpen ? (
                                                        <span className="text-red-400 text-sm italic">Cerrado</span>
                                                    ) : (
                                                        <span className="text-sm font-mono bg-white dark:bg-gray-700 px-2.5 py-1 rounded">
                                                            {String(intervals[0][0]).padStart(2, '0')}:00 - {String(intervals[0][1]).padStart(2, '0')}:00
                                                        </span>
                                                    )
                                                ) : (
                                                    <div className="flex items-center gap-2">
                                                        <select
                                                            className="bg-white dark:bg-gray-700 border rounded p-1.5 text-sm"
                                                            value={tempStart}
                                                            onChange={(e) => setTempStart(parseInt(e.target.value))}
                                                        >
                                                            {[...Array(24)].map((_, i) => <option key={i} value={i}>{String(i).padStart(2, '0')}:00</option>)}
                                                        </select>
                                                        <span className="text-gray-400">-</span>
                                                        <select
                                                            className="bg-white dark:bg-gray-700 border rounded p-1.5 text-sm"
                                                            value={tempEnd}
                                                            onChange={(e) => setTempEnd(parseInt(e.target.value))}
                                                        >
                                                            {[...Array(24)].map((_, i) => <option key={i} value={i}>{String(i).padStart(2, '0')}:00</option>)}
                                                        </select>
                                                    </div>
                                                )}
                                            </div>

                                            <div className="flex gap-2">
                                                {isEditing ? (
                                                    <>
                                                        <button
                                                            onClick={() => updateDaySchedule(dayIndex, 0, 0, true)}
                                                            className="text-xs text-red-500 hover:text-red-700 px-2 py-1"
                                                        >
                                                            Cerrar
                                                        </button>
                                                        <button
                                                            onClick={() => updateDaySchedule(dayIndex, tempStart, tempEnd, false)}
                                                            className="text-xs bg-gray-900 dark:bg-white text-white dark:text-gray-900 px-3 py-1 rounded hover:opacity-90"
                                                        >
                                                            Guardar
                                                        </button>
                                                        <button
                                                            onClick={() => setEditingDay(null)}
                                                            className="text-xs text-gray-500 px-2 py-1"
                                                        >
                                                            ×
                                                        </button>
                                                    </>
                                                ) : (
                                                    <button
                                                        onClick={() => {
                                                            setEditingDay(dayIndex);
                                                            setTempStart(currentStart);
                                                            setTempEnd(currentEnd);
                                                        }}
                                                        className="text-sm text-blue-500 hover:text-blue-700"
                                                    >
                                                        Editar
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}

                    </div>
                </div>
            </div>
        </div>
    );
}
