import { NextRequest, NextResponse } from 'next/server';
import { getEventsForDate, createEvent, updateEvent, deleteEvent } from '@/lib/google';

// Calendar IDs for each stylist (up to 5)
const CALENDARS: Record<string, string> = {
    isabel: process.env.CALENDAR_ISABEL || '',
    yolanda: process.env.CALENDAR_YOLANDA || '',
    almudena: process.env.CALENDAR_ALMUDENA || '',
    stylist4: process.env.CALENDARIO_4 || '',
    stylist5: process.env.CALENDARIO_5 || '',
};

// Simple in-memory cache
// Key: "YYYY-MM-DD", Value: { data: Event[], timestamp: number }
const CACHE: Map<string, { data: any, timestamp: number }> = new Map();
const CACHE_TTL_MS = 60 * 1000; // 1 minute cache

// GET: Fetch events for a date
export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams;
        const dateStr = searchParams.get('date') || new Date().toISOString();
        const dateKey = dateStr.split('T')[0];

        // Check cache
        const cached = CACHE.get(dateKey);
        if (cached && (Date.now() - cached.timestamp < CACHE_TTL_MS)) {
            return NextResponse.json(cached.data);
        }

        const date = new Date(dateStr);

        // Fetch events from all calendars in parallel
        const [isabelEvents, yolandaEvents, almudenaEvents, stylist4Events, stylist5Events] = await Promise.all([
            CALENDARS.isabel ? getEventsForDate(CALENDARS.isabel, date) : [],
            CALENDARS.yolanda ? getEventsForDate(CALENDARS.yolanda, date) : [],
            CALENDARS.almudena ? getEventsForDate(CALENDARS.almudena, date) : [],
            CALENDARS.stylist4 ? getEventsForDate(CALENDARS.stylist4, date) : [],
            CALENDARS.stylist5 ? getEventsForDate(CALENDARS.stylist5, date) : [],
        ]);

        const responseData = {
            date: dateKey,
            calendars: {
                isabel: isabelEvents.map((e) => formatEvent(e, 'isabel')),
                yolanda: yolandaEvents.map((e) => formatEvent(e, 'yolanda')),
                almudena: almudenaEvents.map((e) => formatEvent(e, 'almudena')),
                stylist4: stylist4Events.map((e) => formatEvent(e, 'stylist4')),
                stylist5: stylist5Events.map((e) => formatEvent(e, 'stylist5')),
            },
        };

        // Update cache
        CACHE.set(dateKey, { data: responseData, timestamp: Date.now() });

        return NextResponse.json(responseData);
    } catch (error: any) {
        console.error('Calendar GET error:', error);

        // Simple error handling for quota exceeded
        if (error.message && error.message.includes('Quota exceeded')) {
            return NextResponse.json(
                { error: 'Límite de uso de Google Calendar excedido. Espere un minuto.' },
                { status: 429 }
            );
        }

        return NextResponse.json(
            { error: 'Failed to fetch calendar events' },
            { status: 500 }
        );
    }
}

// Helper to serialize description
function serializeDescription(service: string, phone?: string, reminders?: boolean) {
    if (!phone && !reminders) return service; // Backward compatibility
    return JSON.stringify({
        s: service, // service
        p: phone,   // phone
        r: reminders // reminders enabled
    });
}

// Helper to parse description
function parseDescription(desc: string | undefined | null) {
    if (!desc) return { service: '', phone: undefined, reminders: false };
    try {
        const data = JSON.parse(desc);
        if (typeof data === 'object' && data !== null) {
            // Check if it's our schema (s, p, r) or potentially legacy JSON?
            // Assuming new schema
            return {
                service: data.s || data.service || '',
                phone: data.p || data.phone,
                reminders: !!(data.r || data.reminders)
            };
        }
        return { service: desc, phone: undefined, reminders: false };
    } catch (e) {
        // Not JSON, treat as plain text service
        return { service: desc, phone: undefined, reminders: false };
    }
}

// POST: Create a new event
export async function POST(request: NextRequest) {
    // Invalidate cache on write
    CACHE.clear();

    try {
        const body = await request.json();
        const { stylist, clientName, service, startTime, duration = 60, phone, reminders } = body;

        const stylistKey = stylist.toLowerCase();
        const calendarId = CALENDARS[stylistKey];
        if (!calendarId) {
            return NextResponse.json(
                { error: `Invalid stylist: ${stylist}` },
                { status: 400 }
            );
        }

        const start = new Date(startTime);
        const end = new Date(start.getTime() + duration * 60 * 1000);

        const description = serializeDescription(service || '', phone, reminders);

        const event = await createEvent(
            calendarId,
            clientName,
            description,
            start,
            end
        );

        return NextResponse.json({ success: true, event: formatEvent(event, stylistKey) });
    } catch (error) {
        console.error('Calendar POST error:', error);
        return NextResponse.json(
            { error: 'Failed to create event' },
            { status: 500 }
        );
    }
}

// PUT: Update an existing event
export async function PUT(request: NextRequest) {
    // Invalidate cache on write
    CACHE.clear();

    try {
        const body = await request.json();
        const { eventId, stylist, clientName, service, startTime, duration = 60, phone, reminders } = body;

        if (!eventId) {
            return NextResponse.json(
                { error: 'eventId is required' },
                { status: 400 }
            );
        }

        const stylistKey = stylist.toLowerCase();
        const calendarId = CALENDARS[stylistKey];
        if (!calendarId) {
            return NextResponse.json(
                { error: `Invalid stylist: ${stylist}` },
                { status: 400 }
            );
        }

        const start = new Date(startTime);
        const end = new Date(start.getTime() + duration * 60 * 1000);

        const description = serializeDescription(service || '', phone, reminders);

        const event = await updateEvent(
            calendarId,
            eventId,
            clientName,
            description,
            start,
            end
        );

        return NextResponse.json({ success: true, event: formatEvent(event, stylistKey) });
    } catch (error) {
        console.error('Calendar PUT error:', error);
        return NextResponse.json(
            { error: 'Failed to update event' },
            { status: 500 }
        );
    }
}

// ... DELETE handler remains same ...

// Helper to format Google Calendar event to our format
function formatEvent(event: any, stylist: string) {
    const start = event.start?.dateTime || event.start?.date;
    const { service, phone, reminders } = parseDescription(event.description);

    return {
        id: event.id,
        time: start ? new Date(start).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Madrid' }) : '',
        clientName: event.summary || 'Sin nombre',
        service,
        phone,
        remindersEnabled: reminders,
        startDateTime: start,
        endDateTime: event.end?.dateTime || event.end?.date,
        stylist, // Include which stylist this belongs to
    };
}
