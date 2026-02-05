
import { NextRequest, NextResponse } from 'next/server';
import { sendWhatsAppMessage, checkWahaSessionStatus } from '@/lib/whatsapp';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { phone, message } = body;

        if (!phone || !message) {
            return NextResponse.json({ error: 'Faltan datos (phone, message)' }, { status: 400 });
        }

        // Seguridad extra: verificar estado antes de enviar
        const status = await checkWahaSessionStatus();
        if (!status.isConnected) {
            return NextResponse.json({
                error: 'WAHA Session Disconnected',
                details: status
            }, { status: 503 });
        }

        const result = await sendWhatsAppMessage(phone, message);

        if (!result.success) {
            return NextResponse.json({ error: result.error }, { status: 500 }); // O 403 si es whitelist
        }

        return NextResponse.json({ success: true, daa: result.data });

    } catch (error: any) {
        console.error('API WhatsApp Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
