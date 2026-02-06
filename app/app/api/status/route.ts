import { NextResponse } from 'next/server';
import { getSessionStatus, restartSession, getSessionQR } from '@/lib/whatsapp';

export async function GET() {
    // Avoid caching status checks
    const status = await getSessionStatus();
    return NextResponse.json(status, {
        headers: {
            'Cache-Control': 'no-store, no-cache, must-revalidate',
        },
    });
}

export async function POST(req: Request) {
    try {
        const body = await req.json();
        if (body.action === 'restart') {
            const result = await restartSession();
            return NextResponse.json(result);
        }
        if (body.action === 'get_qr') {
            const result = await getSessionQR();
            return NextResponse.json(result);
        }
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
