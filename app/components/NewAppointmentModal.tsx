"use client";

import { useState, useRef, useEffect } from 'react';
import VoiceButton from './VoiceButton';
import { getDay } from 'date-fns';

// Reusable Input Component with Voice & Clear
// Extracted here for simplicity, typically would be in its own file
interface VoiceInputProps extends React.InputHTMLAttributes<HTMLInputElement | HTMLTextAreaElement> {
    isTextArea?: boolean;
    rows?: number;
    onVoiceChange: (text: string) => void;
    onClear: () => void;
}

// NOTE: This logic for voice recording is a Simplified inline version of VoiceButton,
// tailored for small icon triggers.
//Ideally we should extract the "Logic" of VoiceRecog into a hook.
const useVoiceRecognition = (onResult: (text: string) => void) => {
    const [isListening, setIsListening] = useState(false);
    const recognitionRef = useRef<any>(null);

    useEffect(() => {
        if (typeof window !== 'undefined') {
            const { webkitSpeechRecognition, SpeechRecognition } = window as any;
            if (!webkitSpeechRecognition && !SpeechRecognition) return;

            const recognition = new (webkitSpeechRecognition || SpeechRecognition)();
            recognition.continuous = false;
            recognition.lang = 'es-ES';
            recognition.interimResults = false; // We want final result

            recognition.onresult = (event: any) => {
                const text = event.results[0][0].transcript;
                onResult(text);
                setIsListening(false);
            };

            recognition.onend = () => setIsListening(false);
            recognition.onerror = () => setIsListening(false);

            recognitionRef.current = recognition;
        }
    }, [onResult]);

    const start = () => {
        if (recognitionRef.current) {
            recognitionRef.current.start();
            setIsListening(true);
        }
    };

    return { isListening, start };
};


const VoiceInput = ({ isTextArea, onVoiceChange, onClear, className, ...props }: VoiceInputProps) => {
    const { isListening, start } = useVoiceRecognition(onVoiceChange);

    const Wrapper = isTextArea ? 'div' : 'div'; // Just a wrapper
    const InputComp = isTextArea ? 'textarea' : 'input';

    return (
        <div className="relative group w-full">
            {/* Left Action: Clear (visible when value exists) */}
            {props.value && (
                <button
                    onClick={onClear}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-red-500 z-10 p-1"
                    title="Borrar texto"
                >
                    ✕
                </button>
            )}

            {/* The Input */}
            {/* We add padding-left to avoid overlap with Clear button if visible, else normal padding */}
            {/* And padding-right for Mic */}
            <InputComp
                {...(props as any)}
                className={`
                    w-full border rounded-lg focus:ring-2 focus:ring-gold outline-none transition-all font-medium
                    pl-10 pr-10 ${className || ''} ${isTextArea ? 'resize-none py-3' : 'py-3'}
                    bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-500
                `}
            />

            {/* Right Action: Voice Microphone */}
            <button
                onClick={start}
                className={`absolute right-3 top-1/2 -translate-y-1/2 transition-all p-2 rounded-full hover:bg-gray-200 ${isListening ? 'text-red-500 animate-pulse bg-red-50' : 'text-gray-400 hover:text-gold-dark'}`}
                title="Dictar texto"
            >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                </svg>
            </button>
        </div>
    );
};


interface NewAppointment {
    client: string;
    stylist: string;
    time: string;
    duration: number;
    service: string;
    phone?: string;
    remindersEnabled?: boolean;
}

interface Contact {
    id: string;
    name: string;
    phone: string;
    resourceName?: string;
    remindersEnabled?: boolean;
}

interface NewAppointmentModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (appointment: NewAppointment) => void;
    onDelete?: () => void;
    initialText?: string;
    initialTime?: string;
    initialDuration?: number;
    initialStylist?: string;
    stylists?: string[];
    editingAppointment?: any;
    date?: Date; // For business hours validation
    schedule?: { [key: number]: number[][] }; // Business hours config
}

export default function NewAppointmentModal({
    isOpen,
    onClose,
    onSave,
    onDelete,
    initialText,
    initialTime,
    initialDuration,
    initialStylist,
    stylists = ['Isabel', 'Yolanda', 'Almudena'],
    editingAppointment,
    date,
    schedule
}: NewAppointmentModalProps) {
    const [client, setClient] = useState('');
    const [clientPhone, setClientPhone] = useState('');
    const [stylist, setStylist] = useState(initialStylist || stylists[0]);
    const [service, setService] = useState('');
    const [time, setTime] = useState('');
    const [duration, setDuration] = useState('30');

    // Validation State
    const [timeError, setTimeError] = useState<string | null>(null);

    // Contact Management State
    const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
    const [remindersEnabled, setRemindersEnabled] = useState(true);
    const [isNewContact, setIsNewContact] = useState(false);
    const [isSavingContact, setIsSavingContact] = useState(false);
    const [phoneChanged, setPhoneChanged] = useState(false); // Controls if Phone UI is in "Edit Mode" AND if Phone data changed
    const [reminderChanged, setReminderChanged] = useState(false); // New state to track reminder preference change
    const [contactSaved, setContactSaved] = useState(false);

    // Contact Autocomplete State
    const [suggestions, setSuggestions] = useState<Contact[]>([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [isSearching, setIsSearching] = useState(false);
    const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // Reset and Initialize
    useEffect(() => {
        if (isOpen) {
            // Reset contact management state
            setSuggestions([]);
            setShowSuggestions(false);
            setContactSaved(false);
            setIsSavingContact(false);

            if (editingAppointment) {
                // Editing Mode - load existing appointment data
                setClient(editingAppointment.clientName || '');
                setClientPhone(editingAppointment.phone || '');
                setStylist(editingAppointment.stylist || stylists[0]);
                setService(editingAppointment.service || '');
                setTime(editingAppointment.time || '');
                setDuration(String(editingAppointment.duration || 30));
                setRemindersEnabled(editingAppointment.remindersEnabled !== false);

                // Mark as existing contact (not new)
                setSelectedContact({
                    id: editingAppointment.id,
                    name: editingAppointment.clientName,
                    phone: editingAppointment.phone || ''
                });
                setIsNewContact(false);
                setPhoneChanged(false);
                setReminderChanged(false);

                // If editing, use the appointment's reminder setting, default to true
                setRemindersEnabled(editingAppointment.remindersEnabled !== false);
            } else {
                // Creation Mode - reset to defaults
                setClient('');
                setClientPhone('');
                setService('');
                setSelectedContact(null);
                setIsNewContact(false);
                setPhoneChanged(false);
                setReminderChanged(false);
                setRemindersEnabled(true);

                if (initialStylist) setStylist(initialStylist);
                if (initialTime) setTime(initialTime);
                if (initialDuration) setDuration(initialDuration.toString());

                // If initialText exists (from voice input), try to extract time
                if (initialText) {
                    const lowerText = initialText.toLowerCase();
                    const timeMatch = lowerText.match(/(\d{1,2})(:| )(\d{2})/) || lowerText.match(/(\d{1,2}) (de la mañana|de la tarde|horas)/);
                    if (timeMatch && !initialTime) {
                        setTime(timeMatch[1] + ":00");
                    }
                } else {
                    if (!initialTime) setTime('');
                }
            }
        }
    }, [isOpen, initialText, initialTime, initialDuration, initialStylist, stylists, editingAppointment]);

    // Search contacts as user types (with debounce)
    useEffect(() => {
        // Don't search if contact is already selected
        if (selectedContact) {
            setSuggestions([]);
            setShowSuggestions(false);
            return;
        }

        if (client.length < 2) {
            setSuggestions([]);
            setShowSuggestions(false);
            return;
        }

        // Clear previous timeout
        if (searchTimeoutRef.current) {
            clearTimeout(searchTimeoutRef.current);
        }

        // Debounce: wait 300ms after user stops typing
        searchTimeoutRef.current = setTimeout(async () => {
            setIsSearching(true);
            try {
                const response = await fetch(`/api/contacts?q=${encodeURIComponent(client)}`);
                if (response.ok) {
                    const data = await response.json();
                    setSuggestions(data.contacts || []);
                    setShowSuggestions(data.contacts?.length > 0);
                }
            } catch (err) {
                console.error('Error searching contacts:', err);
            } finally {
                setIsSearching(false);
            }
        }, 300);

        return () => {
            if (searchTimeoutRef.current) {
                clearTimeout(searchTimeoutRef.current);
            }
        };
    }, [client, selectedContact]);

    // Handle selecting a contact from suggestions
    const handleSelectContact = (contact: Contact) => {
        setClient(contact.name);
        setClientPhone(contact.phone || '');
        setSelectedContact(contact);
        setIsNewContact(false);
        setPhoneChanged(false);
        setReminderChanged(false);
        setContactSaved(false);
        setShowSuggestions(false);
        setSuggestions([]);

        // Use contact preference if available, else default true
        if (contact.remindersEnabled !== undefined) {
            setRemindersEnabled(contact.remindersEnabled);
        } else {
            setRemindersEnabled(true);
        }
    };

    // Handle phone change
    const handlePhoneChange = (newPhone: string) => {
        setClientPhone(newPhone);
        if (selectedContact && newPhone !== selectedContact.phone) {
            setPhoneChanged(true);
            setContactSaved(false);
        }
    };

    // Mark as new contact (not from suggestions)
    const handleClientChange = (newClient: string) => {
        setClient(newClient);
        if (selectedContact && newClient !== selectedContact.name) {
            setSelectedContact(null);
            setIsNewContact(true);
        } else if (!selectedContact && newClient.length > 0) {
            setIsNewContact(true);
        }
        setContactSaved(false);
    };

    // Save new contact to Google Contacts
    const handleSaveNewContact = async () => {
        if (!client.trim()) return;

        setIsSavingContact(true);
        try {
            const response = await fetch('/api/contacts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: client.trim(),
                    phone: clientPhone.trim() || undefined,
                    remindersEnabled,
                }),
            });

            if (response.ok) {
                const data = await response.json();
                setSelectedContact(data.contact);
                setIsNewContact(false);
                setContactSaved(true);
            } else {
                console.error('Error creating contact');
            }
        } catch (err) {
            console.error('Error creating contact:', err);
        } finally {
            setIsSavingContact(false);
        }
    };

    // Update existing contact (phone or reminders)
    const handleUpdateContact = async () => {
        if (!selectedContact?.resourceName) return;

        setIsSavingContact(true);
        try {
            const response = await fetch('/api/contacts', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    resourceName: selectedContact.resourceName,
                    phone: clientPhone.trim() || undefined,
                    remindersEnabled,
                }),
            });

            if (response.ok) {
                const data = await response.json();
                setSelectedContact(data.contact);
                setPhoneChanged(false);
                setReminderChanged(false);
                setContactSaved(true);
            } else {
                console.error('Error updating contact');
            }
        } catch (err) {
            console.error('Error updating contact:', err);
        } finally {
            setIsSavingContact(false);
        }
    };

    // Helper to check if time is within business hours
    const isTimeInBusinessHours = (timeStr: string): boolean => {
        if (!date || !schedule) return true; // If no schedule provided, allow all

        const dayOfWeek = getDay(date);
        const intervals = schedule[dayOfWeek];

        if (!intervals || intervals.length === 0) return false; // Day is closed

        const hour = parseInt(timeStr.split(':')[0]);

        for (const [start, end] of intervals) {
            if (hour >= start && hour < end) {
                return true;
            }
        }
        return false;
    };

    const handleSave = () => {
        setTimeError(null); // Clear previous error

        if (!client || !time) return;

        // Validate business hours (only for new appointments or if time changed)
        if (!isTimeInBusinessHours(time)) {
            setTimeError('Esta hora está fuera del horario de apertura');
            return;
        }

        // Silent Background Update: If contact exists and info changed, update it.
        if (selectedContact) {
            const phoneChanged = clientPhone.trim() !== (selectedContact.phone || '').trim();
            const remindersChanged = selectedContact.remindersEnabled !== undefined && remindersEnabled !== selectedContact.remindersEnabled;

            if (phoneChanged || remindersChanged) {
                // Fire and forget (or we could await if critical, but user requested "de fondo")
                // We reuse handleUpdateContact logic but without UI loading states if possible, 
                // or just call the API directly here to be cleaner.
                const updatePayload = {
                    resourceName: selectedContact.resourceName,
                    phone: clientPhone.trim() || undefined,
                    remindersEnabled,
                };

                // Execute silently
                fetch('/api/contacts', {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(updatePayload),
                }).catch(err => console.error("Background contact update failed:", err));
            }
        }

        onSave({
            client,
            stylist,
            time,
            duration: parseInt(duration),
            service,
            phone: clientPhone || undefined,
            remindersEnabled,
            // Pass back ID if editing so parent knows to update
            ...(editingAppointment ? { id: editingAppointment.id } : {})
        } as any);
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
            <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden transform transition-all scale-100">
                <div className="bg-gradient-to-r from-gray-900 to-gray-800 p-4 text-white flex justify-between items-center">
                    <h3 className="font-bold text-lg dark:text-white">{editingAppointment ? 'Editar Cita' : 'Nueva Cita'}</h3>
                    <div className="flex items-center gap-2">
                        {editingAppointment && onDelete && (
                            <button
                                onClick={onDelete}
                                className="text-red-400 hover:text-red-300 mr-2 p-1"
                                title="Eliminar Cita"
                            >
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                            </button>
                        )}
                        <button onClick={onClose} className="text-gray-400 hover:text-white">✕</button>
                    </div>
                </div>

                <div className="p-6 space-y-5 bg-white dark:bg-gray-900">

                    {/* Client Input with Voice + Autocomplete */}
                    <div className="relative">
                        <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Cliente</label>
                        <VoiceInput
                            value={client}
                            onChange={(e: any) => handleClientChange(e.target.value)}
                            onVoiceChange={(text) => handleClientChange(text)}
                            onClear={() => {
                                setClient('');
                                setClientPhone('');
                                setSelectedContact(null);
                                setIsNewContact(false);
                                setPhoneChanged(false);
                                setContactSaved(false);
                                setSuggestions([]);
                            }}
                            onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
                            onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                            placeholder="Nombre del cliente"
                            className="dark:bg-gray-800 dark:border-gray-700 dark:text-white dark:placeholder-gray-500"
                            autoComplete="off"
                        />

                        {/* Loading indicator */}
                        {isSearching && (
                            <div className="absolute right-12 top-[42px] text-gray-400">
                                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                            </div>
                        )}

                        {/* Suggestions Dropdown */}
                        {showSuggestions && suggestions.length > 0 && (
                            <div className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                                {suggestions.map((contact) => (
                                    <button
                                        key={contact.id}
                                        type="button"
                                        onClick={() => handleSelectContact(contact)}
                                        className="w-full px-4 py-3 text-left hover:bg-gold/10 dark:hover:bg-gold/20 transition-colors flex items-center justify-between border-b border-gray-100 dark:border-gray-700 last:border-0"
                                    >
                                        <span className="font-medium text-gray-800 dark:text-gray-200">{contact.name}</span>
                                        {contact.phone ? (
                                            <span className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
                                                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                                                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.224-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
                                                </svg>
                                                {contact.phone}
                                            </span>
                                        ) : (
                                            <span className="text-xs text-orange-500">Sin teléfono</span>
                                        )}
                                    </button>
                                ))}
                            </div>
                        )}

                        {/* Phone & Contact Management Section */}
                        {client.length > 0 && (
                            <div className="mt-3 p-4 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 space-y-3">

                                {/* If Contact Selected and Has Phone, Show Summary with Edit Option */}
                                {selectedContact && !phoneChanged && selectedContact.phone ? (
                                    <div className="flex items-center justify-between">
                                        <div className="flex flex-col">
                                            <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Móvil Vinculado</span>
                                            <span className="text-sm font-medium text-gray-800 dark:text-white flex items-center gap-2">
                                                <svg className="w-4 h-4 text-green-600" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.224-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" /></svg>
                                                {selectedContact.phone}
                                            </span>
                                        </div>
                                        <button
                                            onClick={() => setPhoneChanged(true)}
                                            className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                                        >
                                            Cambiar
                                        </button>
                                    </div>
                                ) : (
                                    /* Phone Input (Visible if New Contact OR Editing) */
                                    <div>
                                        <div className="flex items-center gap-2 mb-2">
                                            <svg className="w-4 h-4 text-green-600" fill="currentColor" viewBox="0 0 24 24">
                                                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.224-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
                                            </svg>
                                            <span className="text-xs font-semibold text-gray-700 dark:text-gray-200">
                                                {selectedContact ? 'Modificar Teléfono' : 'Teléfono WhatsApp'}
                                            </span>
                                            {phoneChanged && selectedContact && (
                                                <button onClick={() => {
                                                    setClientPhone(selectedContact.phone);
                                                    setPhoneChanged(false);
                                                }} className="ml-auto text-xs text-gray-400 hover:text-gray-600">Cancelar</button>
                                            )}
                                        </div>
                                        <input
                                            type="tel"
                                            value={clientPhone}
                                            onChange={(e) => handlePhoneChange(e.target.value)}
                                            placeholder="Ej: 612 345 678"
                                            className="w-full p-2 text-sm border rounded-lg focus:ring-2 focus:ring-green-500 outline-none bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white placeholder-gray-400"
                                        />
                                    </div>
                                )}

                                {/* Reminders Toggle */}
                                <div className="flex items-center justify-between py-2 border-t border-gray-200 dark:border-gray-600">
                                    <span className="text-xs text-gray-600 dark:text-gray-400">
                                        🔔 Enviar recordatorios
                                    </span>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setRemindersEnabled(!remindersEnabled);
                                            // If we toggle this for an existing contact, mark as changed to suggest update
                                            if (selectedContact) {
                                                setReminderChanged(true);
                                                setContactSaved(false);
                                            }
                                        }}
                                        className={`relative w-10 h-5 rounded-full transition-colors ${remindersEnabled ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'
                                            }`}
                                    >
                                        <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform shadow ${remindersEnabled ? 'translate-x-5' : 'translate-x-0'
                                            }`} />
                                    </button>
                                </div>

                                {/* Status Messages & Action Buttons */}
                                <div className="pt-2 border-t border-gray-200 dark:border-gray-600">
                                    {/* Contact saved indicator */}
                                    {contactSaved && (
                                        <p className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1 mb-2">
                                            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                            </svg>
                                            Contacto actualizado
                                        </p>
                                    )}

                                    {/* New contact - offer to save */}
                                    {isNewContact && !contactSaved && client.length > 2 && (
                                        <button
                                            type="button"
                                            onClick={handleSaveNewContact}
                                            disabled={isSavingContact}
                                            className="w-full py-2 px-3 text-xs font-medium rounded-lg bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                                        >
                                            {isSavingContact ? (
                                                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                                </svg>
                                            ) : (
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                                                </svg>
                                            )}
                                            Guardar como nuevo contacto
                                        </button>
                                    )}

                                    {/* Existing contact with changed info - AUTO UPDATES ON SAVE, NO BUTTON NEEDED */}
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Hora</label>
                            <input
                                type="time"
                                value={time}
                                onChange={(e) => { setTime(e.target.value); setTimeError(null); }}
                                className={`w-full p-3 border rounded-lg focus:ring-2 focus:ring-gold outline-none bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white ${timeError ? 'border-red-500 ring-1 ring-red-500' : 'border-gray-200 dark:border-gray-700'}`}
                            />
                            {timeError && (
                                <p className="text-xs text-red-500 mt-1">{timeError}</p>
                            )}
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Duración</label>
                            <select
                                value={duration}
                                onChange={(e) => setDuration(e.target.value)}
                                className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-gold outline-none bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white"
                            >
                                <option value="15">15 min</option>
                                <option value="30">30 min</option>
                                <option value="45">45 min</option>
                                <option value="60">1h</option>
                                <option value="90">1h 30m</option>
                                <option value="120">2h</option>
                            </select>
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Peluquera</label>
                        <div className="grid grid-cols-3 gap-2">
                            {stylists.map((s) => (
                                <button
                                    key={s}
                                    onClick={() => setStylist(s)}
                                    className={`p-2 border rounded-lg text-sm transition-all font-medium ${stylist === s ? 'border-gold bg-gold/10 dark:bg-gold/20 text-gold-dark dark:text-gold ring-1 ring-gold/50' : 'border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:border-gold hover:bg-gold/5 dark:hover:bg-gold/10'}`}
                                >
                                    {s}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Tratamiento Rápido</label>
                        <div className="flex flex-wrap gap-2 mb-3">
                            {['Corte', 'Secado', 'Tinte', 'Mechas'].map((s) => {
                                const isSelected = service.toLowerCase().includes(s.toLowerCase());
                                return (
                                    <button
                                        key={s}
                                        onClick={() => {
                                            const current = service;
                                            if (isSelected) {
                                                const newText = current.replace(new RegExp(`${s}(, )?`, 'i'), '').replace(new RegExp(`, ${s}`, 'i'), '').trim();
                                                const cleanText = newText.replace(/,$/, '');
                                                setService(cleanText);
                                            } else {
                                                setService(current ? `${current}, ${s}` : s);
                                            }
                                        }}
                                        className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-all ${isSelected
                                            ? 'bg-gray-800 dark:bg-gold text-white dark:text-gray-900 border-gray-800 dark:border-gold shadow-md'
                                            : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-500'
                                            }`}
                                    >
                                        {isSelected ? '✓ ' : '+ '}{s}
                                    </button>
                                );
                            })}
                        </div>

                        {/* Service Input with Voice */}
                        <div className="relative">
                            <VoiceInput
                                isTextArea
                                rows={2}
                                value={service}
                                onChange={(e: any) => setService(e.target.value)}
                                onVoiceChange={(text) => setService(prev => prev ? `${prev} ${text}` : text)}
                                onClear={() => setService('')}
                                placeholder="Detalles o descripción adicional..."
                                className="dark:bg-gray-800 dark:border-gray-700 dark:text-white dark:placeholder-gray-500"
                            />
                        </div>
                    </div>

                    <div className="pt-2 flex gap-3">
                        <button onClick={onClose} className="flex-1 py-3 px-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 font-medium rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                            Cancelar
                        </button>
                        <button
                            onClick={handleSave}
                            className="flex-[2] py-3 px-4 bg-gray-900 text-white font-bold rounded-xl shadow-lg hover:bg-gray-800 transform active:scale-95 transition-all flex justify-center items-center gap-2"
                        >
                            <span>{editingAppointment ? 'Guardar Cambios' : 'Crear Cita'}</span>
                            <span>{editingAppointment ? '✓' : '→'}</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
