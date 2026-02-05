import { getDay } from 'date-fns';

export type Schedule = {
    [key: number]: number[][]; // 0: [[9,14]], 1: ...
};

export const DEFAULT_OPENING_HOURS: Schedule = {
    0: [], // Domingo: Cerrado
    1: [], // Lunes: Cerrado
    2: [[9, 18]], // Martes: 9-18
    3: [[9, 18]], // Miércoles: 9-18
    4: [[9, 13], [16, 20]], // Jueves: 9-13, 16-20
    5: [[9, 13], [15, 20]], // Viernes: 9-13, 15-20
    6: [[9, 15]], // Sábado: 9-15
};

export const isBusinessHour = (date: Date, hour: number, schedule: Schedule = DEFAULT_OPENING_HOURS) => {
    const day = getDay(date);
    const intervals = schedule[day];

    if (!intervals || intervals.length === 0) return false;

    // Check if the hour falls into any open interval
    for (const [start, end] of intervals) {
        if (hour >= start && hour < end) {
            return true;
        }
    }
    return false;
};

export const getBusinessHoursForDay = (date: Date, schedule: Schedule = DEFAULT_OPENING_HOURS) => {
    const day = getDay(date);
    return schedule[day] || [];
};
