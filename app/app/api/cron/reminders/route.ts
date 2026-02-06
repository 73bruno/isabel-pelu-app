
import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import { JWT } from 'google-auth-library';
import { sendWhatsAppMessage, normalizePhone } from '@/lib/whatsapp';

// Reusing calendar logic (simplified for cron)
const SCOPES = ['https://www.googleapis.com/auth/calendar'];

async function getAuthClient() {
    return new JWT({
        email: process.env.GOOGLE_CLIENT_EMAIL,
        key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        scopes: SCOPES,
    });
}

// Map calendar IDs to names
const CALENDAR_MAP: Record<string, string> = {
    [process.env.CALENDAR_ISABEL || '']: 'Isabel',
    [process.env.CALENDAR_YOLANDA || '']: 'Yolanda',
    [process.env.CALENDAR_ALMUDENA || '']: 'Almudena',
    [process.env.CALENDARIO_4 || '']: 'Estilista 4',
    [process.env.CALENDARIO_5 || '']: 'Estilista 5',
};

// Helper to parse description (duplicated logic from calendar API to avoid circular deps)
function parseDescription(desc: string | undefined | null) {
    if (!desc) return { service: '', phone: undefined, reminders: false };
    try {
        const data = JSON.parse(desc);
        if (typeof data === 'object' && data !== null) {
            return {
                service: data.s || data.service || '',
                phone: data.p || data.phone,
                reminders: !!(data.r || data.reminders)
            };
        }
        return { service: desc, phone: undefined, reminders: false };
    } catch (e) {
        return { service: desc, phone: undefined, reminders: false };
    }
}

// Main Cron Handler
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);

        // Simple security check (use Cron Secret usually provided by Vercel or custom param)
        // For VPS curl setup: ?key=mysecretkey
        const secret = searchParams.get('key');
        if (process.env.CRON_SECRET && secret !== process.env.CRON_SECRET) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        console.log('[CRON] Starting daily reminders check...');

        const auth = await getAuthClient();
        const calendar = google.calendar({ version: 'v3', auth });

        // Calculate "Tomorrow" (Next Day)
        const now = new Date();
        const tomorrow = new Date(now);
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(0, 0, 0, 0);

        const tomorrowEnd = new Date(tomorrow);
        tomorrowEnd.setHours(23, 59, 59, 999);

        const dateStr = tomorrow.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });

        // Fetch appointments from ALL calendars
        const calendarIds = [
            process.env.CALENDAR_ISABEL,
            process.env.CALENDAR_YOLANDA,
            process.env.CALENDAR_ALMUDENA,
            process.env.CALENDARIO_4,
            process.env.CALENDARIO_5
        ].filter(Boolean) as string[];

        let sentCount = 0;
        let errorCount = 0;
        let skippedCount = 0;
        const results: any[] = [];

        for (const calendarId of calendarIds) {
            try {
                const response = await calendar.events.list({
                    calendarId,
                    timeMin: tomorrow.toISOString(),
                    timeMax: tomorrowEnd.toISOString(),
                    singleEvents: true,
                    orderBy: 'startTime',
                });

                const events = response.data.items || [];
                const stylistName = CALENDAR_MAP[calendarId] || 'Estilista';

                for (const event of events) {
                    const { service, phone, reminders } = parseDescription(event.description);
                    const clientName = event.summary || 'Cliente';

                    if (reminders && phone) {
                        const startTime = event.start?.dateTime
                            ? new Date(event.start.dateTime).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
                            : '00:00';

                        // Format Client Name (First word, Capitalized)
                        // Format Client Name (First word, Capitalized)
                        const firstName = clientName.trim().split(/\s+/)[0];
                        const formattedName = firstName.charAt(0).toUpperCase() + firstName.slice(1).toLowerCase();

                        // Anti-Blocking: Random variations for Greeting and Closing (Professional Tone)
                        const greetings = ['Hola', 'Buenas', 'Saludos'];
                        const closings = ['Te esperamos!', 'Nos vemos mañana.', 'Un saludo!', 'Gracias!'];

                        const greeting = greetings[Math.floor(Math.random() * greetings.length)];
                        const closing = closings[Math.floor(Math.random() * closings.length)];

                        // Construct message (Professional & Minimalist)
                        const message = `${greeting} ${formattedName}, te recordamos tu cita para mañana:\n\n📅 ${dateStr}\n⏰ ${startTime}\n💇 Con ${stylistName}\n\n${closing}`;

                        // Enviar
                        console.log(`[CRON] Sending reminder to ${clientName} (${phone})...`);
                        const result = await sendWhatsAppMessage(phone, message);

                        if (result.success) {
                            sentCount++;
                            results.push({ client: clientName, status: 'sent' });
                        } else {
                            errorCount++;
                            console.error(`[CRON] Failed to send to ${clientName}:`, result.error);
                            results.push({ client: clientName, status: 'error', error: result.error });
                        }
                    } else {
                        skippedCount++;
                    }
                }
            } catch (err) {
                console.error(`[CRON] Error processing calendar ${calendarId}:`, err);
            }
        }

        console.log(`[CRON] Finished. Sent: ${sentCount}, Errors: ${errorCount}, Skipped: ${skippedCount}`);

        return NextResponse.json({
            success: true,
            date: dateStr,
            stats: { sent: sentCount, errors: errorCount, skipped: skippedCount },
            results
        });

    } catch (error: any) {
        console.error('Cron Fatal Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
