import { google } from 'googleapis';
import path from 'path';

// Load service account credentials
const SERVICE_ACCOUNT_PATH = path.join(process.cwd(), 'service-account.json');

// Create auth client
const auth = new google.auth.GoogleAuth({
    keyFile: SERVICE_ACCOUNT_PATH,
    scopes: [
        'https://www.googleapis.com/auth/calendar',
        'https://www.googleapis.com/auth/contacts.readonly',
    ],
});

// Calendar API client
export const calendar = google.calendar({ version: 'v3', auth });

// People API client (for contacts)
export const people = google.people({ version: 'v1', auth });

// Helper: Get events from a calendar for a specific date
export async function getEventsForDate(calendarId: string, date: Date) {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const response = await calendar.events.list({
        calendarId,
        timeMin: startOfDay.toISOString(),
        timeMax: endOfDay.toISOString(),
        singleEvents: true,
        orderBy: 'startTime',
    });

    return response.data.items || [];
}

// Helper: Create a new event
export async function createEvent(
    calendarId: string,
    summary: string,
    description: string,
    startTime: Date,
    endTime: Date
) {
    const response = await calendar.events.insert({
        calendarId,
        requestBody: {
            summary,
            description,
            start: {
                dateTime: startTime.toISOString(),
                timeZone: 'Europe/Madrid',
            },
            end: {
                dateTime: endTime.toISOString(),
                timeZone: 'Europe/Madrid',
            },
        },
    });

    return response.data;
}

// Helper: Update an existing event
export async function updateEvent(
    calendarId: string,
    eventId: string,
    summary: string,
    description: string,
    startTime: Date,
    endTime: Date
) {
    const response = await calendar.events.update({
        calendarId,
        eventId,
        requestBody: {
            summary,
            description,
            start: {
                dateTime: startTime.toISOString(),
                timeZone: 'Europe/Madrid',
            },
            end: {
                dateTime: endTime.toISOString(),
                timeZone: 'Europe/Madrid',
            },
        },
    });

    return response.data;
}

// Helper: Delete an event
export async function deleteEvent(calendarId: string, eventId: string) {
    await calendar.events.delete({
        calendarId,
        eventId,
    });

    return { success: true };
}

// Helper: Search contacts by name
export async function searchContacts(query: string) {
    const response = await people.people.searchContacts({
        query,
        readMask: 'names,phoneNumbers',
        pageSize: 10,
    });

    return response.data.results || [];
}

// Helper: Get all contacts (paginated)
export async function getAllContacts(pageToken?: string) {
    const response = await people.people.connections.list({
        resourceName: 'people/me',
        personFields: 'names,phoneNumbers',
        pageSize: 100,
        pageToken,
    });

    return {
        contacts: response.data.connections || [],
        nextPageToken: response.data.nextPageToken,
    };
}
