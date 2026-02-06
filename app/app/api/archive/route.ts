import { NextRequest, NextResponse } from 'next/server';
import { getEventsInRange, deleteEvent } from '@/lib/google';
import fs from 'fs';
import path from 'path';

// Define Calendars (Sync with calendar/route.ts)
const CALENDARS: Record<string, string> = {
    isabel: process.env.CALENDAR_ISABEL || '',
    yolanda: process.env.CALENDAR_YOLANDA || '',
    almudena: process.env.CALENDAR_ALMUDENA || '',
    stylist4: process.env.CALENDARIO_4 || '',
    stylist5: process.env.CALENDARIO_5 || '',
};

export async function POST(request: NextRequest) {
    try {
        const today = new Date();
        // Determine current year/month in Madrid time (approximation or explicit)
        // We use UTC components as a baseline and subtract buffer to be safe.
        // Target: 1st of Current Month
        const year = today.getFullYear();
        const month = today.getMonth(); // 0-indexed

        // Create UTC date for 1st of month 00:00:00 UTC
        const threshold = new Date(Date.UTC(year, month, 1, 0, 0, 0));

        // Subtract 2 hours to account for Madrid being up to UTC+2.
        // This ensures we don't accidentally delete an event on Feb 1st 00:30 Madrid (which is Jan 31 22:30 UTC or similar).
        // Feb 1 00:00 Madrid is at earliest Jan 31 22:00 UTC.
        // So setting threshold to Jan 31 22:00 UTC (Feb 1 00:00 UTC - 2h) is safe.
        threshold.setHours(threshold.getHours() - 2);

        // Define search start (far past)
        const pastStart = new Date('2024-01-01T00:00:00.000Z');

        console.log(`[Archiver] Starting clean up for events before ${threshold.toISOString()}`);

        const archiveDir = path.join(process.cwd(), 'backups');
        if (!fs.existsSync(archiveDir)) {
            fs.mkdirSync(archiveDir, { recursive: true });
        }
        const archiveFile = path.join(archiveDir, 'appointments_archive.csv');

        // Ensure CSV header exists
        if (!fs.existsSync(archiveFile)) {
            fs.writeFileSync(archiveFile, 'ID,Date,Time,Stylist,ClientName,Service,Phone,CreatedAt\n');
        }

        let totalArchived = 0;

        // Iterate over each calendar
        for (const [stylistKey, calendarId] of Object.entries(CALENDARS)) {
            if (!calendarId) continue;

            // Fetch events
            const events = await getEventsInRange(calendarId, pastStart, threshold);

            if (events.length === 0) continue;

            console.log(`[Archiver] Found ${events.length} past events for ${stylistKey}`);

            for (const event of events) {
                // Parse Description
                let service = '';
                let phone = '';
                try {
                    if (event.description) {
                        const descObj = JSON.parse(event.description);
                        service = descObj.s || descObj.service || event.description;
                        phone = descObj.p || descObj.phone || '';
                    }
                } catch (e) {
                    service = event.description || '';
                }

                const start = event.start?.dateTime || event.start?.date || '';
                const time = start ? new Date(start).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }) : '';
                const date = start ? new Date(start).toLocaleDateString('es-ES', { year: 'numeric', month: '2-digit', day: '2-digit' }) : '';

                // CSV Row
                // Escape quotes in strings
                const safeClient = (event.summary || '').replace(/"/g, '""');
                const safeService = service.replace(/"/g, '""');

                const csvRow = `"${event.id}","${date}","${time}","${stylistKey}","${safeClient}","${safeService}","${phone}","${new Date().toISOString()}"\n`;

                // Append to File
                fs.appendFileSync(archiveFile, csvRow);

                // Delete from Calendar
                try {
                    await deleteEvent(calendarId, event.id!);
                    totalArchived++;
                } catch (delErr) {
                    console.error(`[Archiver] Failed to delete event ${event.id} from ${stylistKey}`, delErr);
                }
            }
        }

        return NextResponse.json({
            success: true,
            message: `Archived and deleted ${totalArchived} events.`,
            archivedCount: totalArchived
        });

    } catch (error: any) {
        console.error('[Archiver] Error:', error);
        return NextResponse.json(
            { error: 'Internal Server Error', details: error.message },
            { status: 500 }
        );
    }
}
