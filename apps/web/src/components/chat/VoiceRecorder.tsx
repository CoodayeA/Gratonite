import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Mic, Square, Send } from 'lucide-react';
import { motion } from 'framer-motion';

interface Props {
    onRecordComplete: (blob: Blob, duration: number) => void;
    maxDuration?: number;
}

const WAVEFORM_BARS = 20;

export function VoiceRecorder({ onRecordComplete, maxDuration = 60 }: Props) {
    const [state, setState] = useState<'idle' | 'recording' | 'processing'>('idle');
    const [elapsed, setElapsed] = useState(0);
    const [waveform, setWaveform] = useState<number[]>(Array(WAVEFORM_BARS).fill(4));
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const chunksRef = useRef<Blob[]>([]);
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const analyserRef = useRef<AnalyserNode | null>(null);
    const animFrameRef = useRef<number | null>(null);
    const streamRef = useRef<MediaStream | null>(null);

    const startRecording = useCallback(async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            streamRef.current = stream;
            const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' });
            mediaRecorderRef.current = mediaRecorder;
            chunksRef.current = [];

            // Setup analyser for waveform visualization
            const audioCtx = new AudioContext();
            const source = audioCtx.createMediaStreamSource(stream);
            const analyser = audioCtx.createAnalyser();
            analyser.fftSize = 64;
            source.connect(analyser);
            analyserRef.current = analyser;

            mediaRecorder.ondataavailable = (e) => {
                if (e.data.size > 0) chunksRef.current.push(e.data);
            };

            mediaRecorder.onstop = () => {
                setState('processing');
                const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
                stream.getTracks().forEach(t => t.stop());
                audioCtx.close();
                onRecordComplete(blob, elapsed);
                setState('idle');
                setElapsed(0);
                setWaveform(Array(WAVEFORM_BARS).fill(4));
            };

            mediaRecorder.start(100);
            setState('recording');
            setElapsed(0);

            timerRef.current = setInterval(() => {
                setElapsed(prev => {
                    if (prev + 1 >= maxDuration) {
                        mediaRecorder.stop();
                        if (timerRef.current) clearInterval(timerRef.current);
                        return prev + 1;
                    }
                    return prev + 1;
                });
            }, 1000);

            // Waveform animation loop
            const updateWaveform = () => {
                if (!analyserRef.current) return;
                const data = new Uint8Array(analyserRef.current.frequencyBinCount);
                analyserRef.current.getByteFrequencyData(data);
                const bars: number[] = [];
                const step = Math.floor(data.length / WAVEFORM_BARS);
                for (let i = 0; i < WAVEFORM_BARS; i++) {
                    const val = data[i * step] || 0;
                    bars.push(Math.max(4, (val / 255) * 24));
                }
                setWaveform(bars);
                animFrameRef.current = requestAnimationFrame(updateWaveform);
            };
            animFrameRef.current = requestAnimationFrame(updateWaveform);
        } catch {
            // Microphone permission denied
            setState('idle');
        }
    }, [maxDuration, onRecordComplete, elapsed]);

    const stopRecording = useCallback(() => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
            mediaRecorderRef.current.stop();
        }
        if (timerRef.current) clearInterval(timerRef.current);
        if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    }, []);

    const cancelRecording = useCallback(() => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
            mediaRecorderRef.current.ondataavailable = null;
            mediaRecorderRef.current.onstop = null;
            mediaRecorderRef.current.stop();
        }
        if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
        if (timerRef.current) clearInterval(timerRef.current);
        if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
        setState('idle');
        setElapsed(0);
        setWaveform(Array(WAVEFORM_BARS).fill(4));
    }, []);

    useEffect(() => {
        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
            if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
        };
    }, []);

    const formatTime = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;

    if (state === 'idle') {
        return (
            <button
                className="input-icon-btn"
                title="Record Voice Message"
                onClick={startRecording}
            >
                <Mic size={20} />
            </button>
        );
    }

    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
            <motion.div
                animate={{ opacity: [1, 0.4, 1] }}
                transition={{ repeat: Infinity, duration: 1.5 }}
                style={{
                    width: '10px', height: '10px', borderRadius: '50%',
                    background: 'var(--error)', flexShrink: 0,
                }}
            />
            <span style={{
                color: 'var(--error)', fontWeight: 600, fontFamily: 'var(--font-mono)',
                fontSize: '13px', flexShrink: 0, minWidth: '36px',
            }}>
                {formatTime(elapsed)}
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '2px', flex: 1, height: '24px' }}>
                {waveform.map((h, i) => (
                    <div
                        key={i}
                        style={{
                            width: '3px', height: `${h}px`,
                            background: 'var(--accent-primary)',
                            borderRadius: '2px', transition: 'height 0.1s',
                        }}
                    />
                ))}
            </div>
            <button
                className="input-icon-btn"
                title="Cancel"
                onClick={cancelRecording}
                style={{ color: 'var(--text-muted)' }}
            >
                <Square size={16} />
            </button>
            <button
                className="input-icon-btn primary"
                title="Send"
                onClick={stopRecording}
            >
                <Send size={16} />
            </button>
        </div>
    );
}
