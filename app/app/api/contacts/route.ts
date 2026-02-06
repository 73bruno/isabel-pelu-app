import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { google } from 'googleapis';
import Fuse from 'fuse.js';

// Helper: Get OAuth client from session
function getOAuthClient(accessToken: string) {
    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({ access_token: accessToken });
    return oauth2Client;
}

// GET: Search contacts
export async function GET(request: NextRequest) {
    try {
        const session = await auth();

        if (!session?.accessToken) {
            return NextResponse.json(
                { error: 'No autenticado. Inicia sesión para buscar contactos.', contacts: [] },
                { status: 401 }
            );
        }

        const searchParams = request.nextUrl.searchParams;
        const query = searchParams.get('q');

        if (!query || query.length < 2) {
            return NextResponse.json({ contacts: [] });
        }

        // Use User Session Client
        const oauth2Client = getOAuthClient(session.accessToken);
        const people = google.people({ version: 'v1', auth: oauth2Client });

        // Search
        const searchResponse = await people.people.searchContacts({
            query,
            readMask: 'names,phoneNumbers,userDefined',
            pageSize: 30,
        });

        let contacts = (searchResponse.data.results || []).map((result: any) => {
            const person = result.person;
            const name = person?.names?.[0]?.displayName || 'Sin nombre';
            const phone = person?.phoneNumbers?.[0]?.value || '';
            const resourceName = person?.resourceName || '';

            // Extract Reminders Preference
            const userDefined = person?.userDefined || [];
            const remindersSetting = userDefined.find((u: any) => u.key === 'whatsapp_reminders');
            const remindersEnabled = remindersSetting?.value !== 'disabled'; // Default true if missing

            return {
                id: resourceName,
                name,
                phone,
                resourceName,
                remindersEnabled
            };
        });

        // 1. FALLBACK: Fuse.js Fuzzy Search if few results
        if (contacts.length < 5) {
            try {
                const allContactsResponse = await people.people.connections.list({
                    resourceName: 'people/me',
                    personFields: 'names,phoneNumbers,userDefined',
                    pageSize: 500, // Reasonable limit
                });

                const allContacts = (allContactsResponse.data.connections || []).map((person: any) => {
                    const name = person?.names?.[0]?.displayName || '';
                    const phone = person?.phoneNumbers?.[0]?.value || '';

                    const userDefined = person?.userDefined || [];
                    const remindersSetting = userDefined.find((u: any) => u.key === 'whatsapp_reminders');
                    const remindersEnabled = remindersSetting?.value !== 'disabled';

                    return {
                        id: person?.resourceName || '',
                        name,
                        phone,
                        resourceName: person?.resourceName || '',
                        remindersEnabled
                    };
                }).filter((c: any) => c.name);

                // Fuzzy search
                const fuse = new Fuse(allContacts, {
                    keys: ['name'],
                    threshold: 0.4,
                    distance: 100,
                    includeScore: true,
                    ignoreLocation: true,
                    minMatchCharLength: 2,
                });

                const fuzzyResults = fuse.search(query);

                // Merge
                const existingIds = new Set(contacts.map((c: any) => c.id));
                for (const result of fuzzyResults) {
                    if (!existingIds.has(result.item.id)) {
                        contacts.push(result.item);
                    }
                }
            } catch (err) {
                console.error('Error in fuzzy search fallback:', err);
                // Fail silently and return what we have
            }
        }

        // Limit to 10 results
        contacts = contacts.slice(0, 10);

        return NextResponse.json({ contacts });
    } catch (error: any) {
        console.error('Contacts search error:', error);

        if (error.code === 401 || error.message?.includes('invalid_grant')) {
            return NextResponse.json(
                { error: 'Sesión expirada. Por favor, vuelve a iniciar sesión.', contacts: [] },
                { status: 401 }
            );
        }

        return NextResponse.json(
            { error: 'Error al buscar contactos', contacts: [] },
            { status: 500 }
        );
    }
}

// POST: Create new contact
export async function POST(request: NextRequest) {
    try {
        const session = await auth();

        if (!session?.accessToken) {
            return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
        }

        const body = await request.json();
        const { name, phone, remindersEnabled = true } = body;

        if (!name) {
            return NextResponse.json({ error: 'Nombre requerido' }, { status: 400 });
        }

        // Use User Session Client
        const oauth2Client = getOAuthClient(session.accessToken);
        const people = google.people({ version: 'v1', auth: oauth2Client });

        // Build contact data
        const contactData: any = {
            names: [{ givenName: name }],
            userDefined: [
                { key: 'whatsapp_reminders', value: remindersEnabled ? 'enabled' : 'disabled' }
            ]
        };

        if (phone) {
            contactData.phoneNumbers = [{ value: phone, type: 'mobile' }];
        }

        const response = await people.people.createContact({
            requestBody: contactData,
            personFields: 'names,phoneNumbers,userDefined',
        });

        const newContact = response.data;

        return NextResponse.json({
            success: true,
            contact: {
                id: newContact.resourceName,
                name: newContact.names?.[0]?.displayName || name,
                phone: newContact.phoneNumbers?.[0]?.value || '',
                resourceName: newContact.resourceName,
                remindersEnabled,
            }
        });
    } catch (error: any) {
        console.error('Create contact error:', error);
        return NextResponse.json({ error: 'Error al crear contacto' }, { status: 500 });
    }
}

// PATCH: Update contact
export async function PATCH(request: NextRequest) {
    try {
        const session = await auth();

        if (!session?.accessToken) {
            return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
        }

        const body = await request.json();
        const { resourceName, phone, remindersEnabled } = body;

        if (!resourceName) {
            return NextResponse.json({ error: 'resourceName requerido' }, { status: 400 });
        }

        // Use User Session Client
        const oauth2Client = getOAuthClient(session.accessToken);
        const people = google.people({ version: 'v1', auth: oauth2Client });

        // First get current contact to get ETag and existing data
        const currentContact = await people.people.get({
            resourceName,
            personFields: 'names,phoneNumbers,userDefined,metadata',
        });

        const etag = currentContact.data.etag;
        const existingUserDefined = currentContact.data.userDefined || [];

        // Build update mask and data
        const updatePersonFields: string[] = [];
        const updateData: any = {};

        // Update phone if provided
        if (phone !== undefined) {
            updatePersonFields.push('phoneNumbers');
            updateData.phoneNumbers = [{ value: phone, type: 'mobile' }];
        }

        // Update reminders preference if provided
        // We must preserve existing userDefined fields if any, but replace ours
        if (remindersEnabled !== undefined) {
            updatePersonFields.push('userDefined');

            // Filter out our key from existing
            const otherUserDefined = existingUserDefined.filter((u: any) => u.key !== 'whatsapp_reminders');

            updateData.userDefined = [
                ...otherUserDefined,
                { key: 'whatsapp_reminders', value: remindersEnabled ? 'enabled' : 'disabled' }
            ];
        }

        if (updatePersonFields.length === 0) {
            return NextResponse.json({ error: 'Nada que actualizar' }, { status: 400 });
        }

        const response = await people.people.updateContact({
            resourceName,
            updatePersonFields: updatePersonFields.join(','),
            requestBody: {
                etag,
                ...updateData,
            },
            personFields: 'names,phoneNumbers,userDefined',
        });

        const updatedContact = response.data;
        const userDefined = updatedContact.userDefined || [];
        const remindersSetting = userDefined.find((u: any) => u.key === 'whatsapp_reminders');

        return NextResponse.json({
            success: true,
            contact: {
                id: updatedContact.resourceName,
                name: updatedContact.names?.[0]?.displayName || '',
                phone: updatedContact.phoneNumbers?.[0]?.value || '',
                resourceName: updatedContact.resourceName,
                remindersEnabled: remindersSetting?.value !== 'disabled',
            }
        });
    } catch (error: any) {
        console.error('Update contact error:', error);
        return NextResponse.json({ error: 'Error al actualizar contacto' }, { status: 500 });
    }
}
