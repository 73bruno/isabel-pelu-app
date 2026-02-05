"use client";

import { useEffect, useRef, useState } from 'react';

// Simplified Web Speech API type definition
interface IWindow extends Window {
    webkitSpeechRecognition: any;
    SpeechRecognition: any;
}

interface VoiceButtonProps {
    onVoiceResult?: (text: string) => void;
}

export default function VoiceButton({ onVoiceResult }: VoiceButtonProps) {
    const [isListening, setIsListening] = useState(false);
    const [transcript, setTranscript] = useState("");
    const [showTranscript, setShowTranscript] = useState(false);

    const recognitionRef = useRef<any>(null);

    useEffect(() => {
        // Initialize Speech Recognition
        if (typeof window !== 'undefined') {
            const { webkitSpeechRecognition, SpeechRecognition } = window as unknown as IWindow;
            if (!webkitSpeechRecognition && !SpeechRecognition) {
                console.log("Speech recognition not supported");
                return;
            }

            const recognition = new (webkitSpeechRecognition || SpeechRecognition)();
            recognition.continuous = false; // Stop after one sentence for simplicity
            recognition.lang = 'es-ES';
            recognition.interimResults = true;

            recognition.onresult = (event: any) => {
                let currentTranscript = "";
                for (let i = event.resultIndex; i < event.results.length; ++i) {
                    currentTranscript += event.results[i][0].transcript;
                }
                setTranscript(currentTranscript);
                setShowTranscript(true);
            };

            recognition.onend = () => {
                setIsListening(false);
                if (transcript && onVoiceResult) {
                    onVoiceResult(transcript);
                }
                setTimeout(() => {
                    setShowTranscript(false);
                    setTranscript("");
                }, 3000);
            };

            recognitionRef.current = recognition;
        }
    }, [transcript, onVoiceResult]);

    const toggleListening = () => {
        if (isListening) {
            recognitionRef.current?.stop();
            setIsListening(false);
        } else {
            setTranscript("");
            recognitionRef.current?.start();
            setIsListening(true);
        }
    };

    return (
        <div className="fixed bottom-8 left-1/2 transform -translate-x-1/2 z-50 flex flex-col items-center">
            {/* Dynamic Status Text */}
            <div
                className={`
            mb-4 transition-all duration-300 transform 
            ${showTranscript || isListening ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0 pointer-events-none'}
        `}
            >
                <div className="bg-white/95 backdrop-blur-md px-6 py-3 rounded-2xl shadow-xl border border-gray-100 text-center max-w-[90vw] w-auto">
                    {isListening && !transcript && (
                        <p className="text-gray-500 font-medium text-sm animate-pulse">Escuchando...</p>
                    )}
                    {transcript && (
                        <p className="text-gray-800 font-medium text-lg leading-tight">"{transcript}"</p>
                    )}
                </div>
            </div>

            <button
                onClick={toggleListening}
                className={`
          relative flex items-center justify-center w-16 h-16 sm:w-20 sm:h-20 rounded-full 
          shadow-[0_8px_30px_rgb(0,0,0,0.12)] 
          transition-all duration-300 ease-out
          ${isListening
                        ? 'bg-red-500 scale-110 shadow-[0_0_40px_rgba(239,68,68,0.5)]'
                        : 'bg-gradient-to-br from-gray-900 to-gray-800 hover:scale-105 active:scale-95'}
        `}
            >
                {isListening && (
                    <>
                        <span className="absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75 animate-ping"></span>
                    </>
                )}

                <svg
                    className={`w-6 h-6 sm:w-8 sm:h-8 transition-colors ${isListening ? 'text-white' : 'text-gold-light'}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                </svg>
            </button>
        </div>
    );
}
