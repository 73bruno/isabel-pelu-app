
import { setTimeout } from 'timers/promises';

const WAHA_URL = process.env.WAHA_URL || 'http://localhost:3000';
const SESSION = process.env.WAHA_SESSION || 'default';
const API_KEY = process.env.WAHA_API_KEY; // Optional if configured in WAHA
const DEBUG_MODE = process.env.WHATSAPP_DEBUG_MODE === 'true';
const WHITELIST = (process.env.WHATSAPP_WHITELIST || '').split(',').map(n => n.trim());

// Tipos básicos para respuestas de WAHA
interface WahaResponse {
    id?: string;
    success?: boolean;
    error?: string;
}

/**
 * Normaliza un número de teléfono para WAHA (formato internacional sin +)
 * @example "+34 600 000 000" -> "34600000000"
 * @example "600 000 000" -> "34600000000" (Añade prefijo España por defecto)
 */
export function normalizePhone(phone: string): string {
    let clean = phone.replace(/\D/g, '');
    // Auto-fix Spanish numbers without prefix
    if (clean.length === 9 && (clean.startsWith('6') || clean.startsWith('7'))) {
        clean = '34' + clean;
    }
    return clean;
}

/**
 * Formatea el Chat ID requerido por WAHA
 * @example "34600000000" -> "34600000000@c.us"
 */
function getChatId(phone: string): string {
    const cleanPhone = normalizePhone(phone);
    return `${cleanPhone}@c.us`;
}

/**
 * Comprueba si es seguro enviar mensaje a este número
 */
export function isAllowedNumber(phone: string): boolean {
    if (!DEBUG_MODE) return true; // En producción, todos permitidos (con cuidado)

    const cleanPhone = normalizePhone(phone);
    const isAllowed = WHITELIST.some(w => normalizePhone(w) === cleanPhone);

    if (!isAllowed) {
        console.warn(`[WAHA BLOCKED] Intento de envío a ${cleanPhone} bloqueado por DEBUG MODE. Whitelist: ${WHITELIST.join(', ')}`);
    }
    return isAllowed;
}

/**
 * Helper para peticiones HTTP a WAHA
 */
export async function wahaRequest(endpoint: string, method: string, body?: any) {
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'accept': 'application/json',
    };

    if (API_KEY) {
        headers['X-Api-Key'] = API_KEY;
    }

    try {
        const response = await fetch(`${WAHA_URL}/api/${endpoint}`, {
            method,
            headers,
            body: body ? JSON.stringify(body) : undefined,
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`WAHA Error (${response.status}): ${errorText}`);
        }

        return await response.json();
    } catch (error) {
        console.error(`[WAHA ERROR] Failed to ${method} ${endpoint}:`, error);
        throw error;
    }
}

/**
 * Envía un mensaje simulando comportamiento humano para evitar bloqueos.
 * 
 * Flujo:
 * 1. Verifica Whitelist (si Debug)
 * 2. Send Seen (Marcar como visto)
 * 3. Start Typing (Escribiendo...)
 * 4. Espera aleatoria (Human delay)
 * 5. Envía mensaje
 * 6. Stop Typing
 */
export async function sendWhatsAppMessage(phone: string, text: string) {
    if (!isAllowedNumber(phone)) {
        return { success: false, error: 'Number not in whitelist (Debug Mode)' };
    }

    const chatId = getChatId(phone);
    const session = SESSION;

    try {
        // 1. Mark as seen (si hubiera mensajes previos)
        await wahaRequest('sendSeen', 'POST', { session, chatId });

        // 2. Start typing
        await wahaRequest('startTyping', 'POST', { session, chatId });

        // 3. Human Delay (calculado según longitud del mensaje, mínimo 2s, max 6s)
        // Simulamos que escribe a 5 caracteres por 100ms aprox
        const typingTimeBase = Math.min(Math.max(text.length * 50, 2000), 6000);
        const randomJitter = Math.random() * 1000; // +0-1s aleatorio
        await setTimeout(typingTimeBase + randomJitter);

        // 4. Send Message
        const result = await wahaRequest('sendText', 'POST', {
            session,
            chatId,
            text,
        });

        // 5. Stop typing (aunque sendText suele cortarlo, es buena práctica asegurar)
        await wahaRequest('stopTyping', 'POST', { session, chatId });

        console.log(`[WAHA SENT] Mensaje enviado a ${normalizePhone(phone)}`);
        return { success: true, data: result };

    } catch (error: any) {
        // Intentar parar typing si falló algo
        try { await wahaRequest('stopTyping', 'POST', { session, chatId }); } catch (e) { }

        return { success: false, error: error.message };
    }
}

/**
 * Verifica si la sesión de WAHA está conectada y lista
 */
/**
 * Verifica si la sesión de WAHA está conectada y lista
 */
export async function checkWahaSessionStatus() {
    try {
        const response: any = await wahaRequest(`sessions/${SESSION}/me`, 'GET');

        // WAHA Core devuelve el objeto Me directamente: { id: "...", pushName: "..." }
        // Otras versiones podrían devolver { me: { ... } }
        const me = response?.me || response;

        const isConnected = !!(me && me.id);

        return {
            isConnected,
            phone: me?.id?.split('@')[0],
            pushName: me?.pushName
        };
    } catch (error) {
        console.error('[WAHA CHECK] Failed:', error);
        return { isConnected: false, error };
    }
}


/**
 * Obtiene el estado técnico de la sesión (STOPPED, STARTING, WORKING, FAILED)
 */
export async function getSessionStatus() {
    try {
        const response: any = await wahaRequest(`sessions/${SESSION}`, 'GET');
        return {
            status: response.status, // WORKING, SCANNING, STOPPED, FAILED, STARTING
            me: response.me
        };
    } catch (error) {
        console.error('[WAHA STATUS] Failed:', error);
        return { status: 'UNKNOWN', error };
    }
}

/**
 * Reinicia la sesión de WAHA (Stop -> Start)
 */
export async function restartSession() {
    console.log('[WAHA RESTART] Initiating session restart...');
    try {
        // 1. Stop
        try {
            await wahaRequest('sessions/stop', 'POST', { name: SESSION });
        } catch (e) {
            console.warn('[WAHA RESTART] Stop failed (maybe already stopped):', e);
        }

        // 2. Wait
        await setTimeout(2000);

        // 3. Start
        await wahaRequest('sessions/start', 'POST', { name: SESSION });

        return { success: true };
    } catch (error: any) {
        console.error('[WAHA RESTART] Failed:', error);
        return { success: false, error: error.message };
    }
}


/**
 * Obtiene el QR (Screenshot) de la sesión en tiempo real
 */
export async function getSessionQR() {
    try {
        const url = `${WAHA_URL}/api/screenshot?session=${SESSION}`;
        const headers: Record<string, string> = API_KEY ? { 'X-Api-Key': API_KEY } : {};

        const response = await fetch(url, { headers });

        if (!response.ok) {
            throw new Error('No se pudo obtener la captura');
        }

        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const base64 = buffer.toString('base64');

        // WAHA returns a PNG screenshot typically
        return { success: true, image: `data:image/png;base64,${base64}` };
    } catch (error: any) {
        console.error('[WAHA QR] Failed:', error);
        return { success: false, error: error.message };
    }
}
