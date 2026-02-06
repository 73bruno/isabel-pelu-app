"use client";
import { useState, useEffect } from 'react';

interface ServerStatusProps {
    mode?: 'mini' | 'full';
    onClick?: () => void;
}

export default function ServerStatus({ mode = 'mini', onClick }: ServerStatusProps) {
    const [status, setStatus] = useState<string>('LOADING');
    const [loading, setLoading] = useState(false);
    const [qrImage, setQrImage] = useState<string | null>(null);

    const fetchQR = async () => {
        try {
            const res = await fetch('/api/status', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'get_qr' })
            });
            const data = await res.json();
            if (data.success && data.image) {
                setQrImage(data.image);
            }
        } catch (e) {
            console.error('Error fetching QR:', e);
        }
    };

    const checkStatus = async () => {
        try {
            const res = await fetch('/api/status');
            const data = await res.json();
            const newStatus = data.status || 'UNKNOWN';
            setStatus(newStatus);

            // If scanning, auto-fetch QR
            if (newStatus === 'SCANNING') {
                fetchQR();
            } else {
                setQrImage(null);
            }
        } catch (e) {
            setStatus('ERROR');
        }
    };

    const handleRestart = async () => {
        if (!confirm('¿Estás segura de que quieres reiniciar el sistema de recordatorios? Esto puede tardar unos segundos.')) return;

        setLoading(true);
        setStatus('RESTARTING');
        try {
            const res = await fetch('/api/status', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'restart' })
            });
            const data = await res.json();
            if (data.success) {
                // Wait a bit then check status
                setTimeout(checkStatus, 5000);
            } else {
                alert('Error al reiniciar: ' + data.error);
                checkStatus();
            }
        } catch (e) {
            alert('Error de conexión');
            checkStatus();
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        checkStatus();
        const interval = setInterval(checkStatus, 30000); // Check every 30s
        return () => clearInterval(interval);
    }, []);

    const getStatusColor = () => {
        switch (status) {
            case 'WORKING': return 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.4)]';
            case 'SCANNING': return 'bg-yellow-500 animate-pulse'; // QR scan needed
            case 'STARTING': return 'bg-blue-500 animate-bounce';
            case 'STOPPED': return 'bg-red-500';
            case 'ERROR': return 'bg-red-500';
            default: return 'bg-gray-400';
        }
    };

    const getStatusText = () => {
        switch (status) {
            case 'WORKING': return 'Sistema Online';
            case 'SCANNING': return 'Escanea QR';
            case 'STARTING': return 'Iniciando...';
            case 'STOPPED': return 'Detenido';
            case 'RESTARTING': return 'Reiniciando...';
            case 'ERROR': return 'Error Conexión';
            default: return 'Desconectado';
        }
    };

    if (mode === 'mini') {
        const isError = status === 'STOPPED' || status === 'ERROR' || status === 'SCANNING';
        return (
            <button
                onClick={onClick}
                className={`
                    flex items-center gap-2 px-3 py-1.5 rounded-full border transition-all duration-300
                    ${isError
                        ? 'bg-red-50 border-red-200 text-red-700 dark:bg-red-900/20 dark:border-red-800'
                        : 'bg-green-50 border-green-200 text-green-700 dark:bg-green-900/20 dark:border-green-800'
                    }
                `}
                title={`Estado: ${getStatusText()} - Click para ver detalles`}
            >
                <div className={`w-2 h-2 rounded-full ${getStatusColor()}`} />
                <span className="text-xs font-semibold hidden sm:inline">
                    {status === 'WORKING' ? 'RECORDATORIOS' : 'REVISAR'}
                </span>
            </button>
        );
    }

    return (
        <div className="p-5 bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm">
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <div className="relative">
                        <div className={`w-4 h-4 rounded-full ${getStatusColor()}`} />
                        {status === 'WORKING' && <div className="absolute inset-0 rounded-full bg-green-500 animate-ping opacity-20" />}
                    </div>
                    <div>
                        <p className="font-semibold text-gray-900 dark:text-white leading-tight">{getStatusText()}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Servidor de WhatsApp (WAHA)</p>
                    </div>
                </div>
                <button
                    onClick={checkStatus}
                    className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors bg-gray-50 dark:bg-gray-700 rounded-lg hover:bg-gray-100"
                    title="Actualizar estado ahora"
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                </button>
            </div>

            <div className="space-y-3">
                <p className="text-sm text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-gray-900/50 p-3 rounded-lg border border-gray-100 dark:border-gray-800">
                    {status === 'WORKING' && '✅ El sistema está enviando recordatorios correctamente.'}
                    {status === 'STOPPED' && '⚠️ El sistema está detenido. Pulsa reiniciar para arrancar.'}
                    {status === 'SCANNING' && '⚠️ Vaya, se ha desconectado WhatsApp. Escanea el QR para volver a conectar.'}
                    {status === 'ERROR' && '❌ Error de conexión con el servidor.'}
                </p>

                {/* QR Display Area */}
                {status === 'SCANNING' && (
                    <div className="flex flex-col items-center gap-4 bg-gray-100 dark:bg-gray-900/50 p-4 rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-600">
                        {qrImage ? (
                            <div className="relative">
                                <img src={qrImage} alt="WhatsApp QR" className="w-64 h-64 rounded-lg shadow-lg" />
                                <div className="absolute -bottom-2 -right-2 bg-green-500 text-white text-xs px-2 py-1 rounded-full animate-bounce">
                                    Escanea ahora
                                </div>
                            </div>
                        ) : (
                            <div className="w-64 h-64 flex items-center justify-center bg-gray-200 rounded-lg animate-pulse">
                                <span className="text-gray-500 text-sm">Cargando QR...</span>
                            </div>
                        )}
                        <p className="text-xs text-center text-gray-500 max-w-[200px]">
                            Abre WhatsApp en tu móvil {'>'} Ajustes {'>'} Dispositivos vinculados {'>'} Vincular dispositivo
                        </p>
                        <button
                            onClick={fetchQR}
                            className="text-xs text-blue-500 underline"
                        >
                            Actualizar QR
                        </button>
                    </div>
                )}

                <button
                    onClick={handleRestart}
                    disabled={loading || status === 'RESTARTING'}
                    className={`
                        w-full py-2.5 px-4 rounded-lg text-sm font-semibold transition-all flex items-center justify-center gap-2
                        ${loading
                            ? 'bg-gray-100 text-gray-400 cursor-not-allowed dark:bg-gray-800'
                            : 'bg-gray-900 hover:bg-gray-800 text-white dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100 shadow-md hover:shadow-lg translate-y-0 hover:-translate-y-0.5'
                        }
                    `}
                >
                    {loading ? (
                        <>
                            <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                            <span>Reiniciando...</span>
                        </>
                    ) : (
                        <>
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                            <span>Reiniciar Servidor Manualmente</span>
                        </>
                    )}
                </button>
            </div>
        </div>
    );
}
