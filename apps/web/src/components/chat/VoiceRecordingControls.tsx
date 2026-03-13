import { useState, useRef, useCallback } from 'react';
import { Circle, Square, Download } from 'lucide-react';

interface VoiceRecordingControlsProps {
    isConnected: boolean;
    onRecordingStateChange?: (recording: boolean) => void;
}

export default function VoiceRecordingControls({ isConnected, onRecordingStateChange }: VoiceRecordingControlsProps) {
    const [isRecording, setIsRecording] = useState(false);
    const [duration, setDuration] = useState(0);
    const [lastRecordingUrl, setLastRecordingUrl] = useState<string | null>(null);
    const recorderRef = useRef<MediaRecorder | null>(null);
    const chunksRef = useRef<Blob[]>([]);
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const startRecording = useCallback(async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' });
            chunksRef.current = [];
            recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
            recorder.onstop = () => {
                const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
                const url = URL.createObjectURL(blob);
                setLastRecordingUrl(url);
                stream.getTracks().forEach(t => t.stop());
            };
            recorder.start(1000);
            recorderRef.current = recorder;
            setIsRecording(true);
            setDuration(0);
            timerRef.current = setInterval(() => setDuration(d => d + 1), 1000);
            onRecordingStateChange?.(true);
        } catch {
            // Permission denied or no mic
        }
    }, [onRecordingStateChange]);

    const stopRecording = useCallback(() => {
        if (recorderRef.current && recorderRef.current.state !== 'inactive') {
            recorderRef.current.stop();
        }
        recorderRef.current = null;
        setIsRecording(false);
        if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
        setDuration(0);
        onRecordingStateChange?.(false);
    }, [onRecordingStateChange]);

    const handleDownload = () => {
        if (!lastRecordingUrl) return;
        const a = document.createElement('a');
        a.href = lastRecordingUrl;
        a.download = `voice-recording-${new Date().toISOString().slice(0, 19)}.webm`;
        a.click();
    };

    if (!isConnected) return null;

    const formatTime = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;

    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {isRecording ? (
                <>
                    <button
                        onClick={stopRecording}
                        style={{
                            width: '32px', height: '32px', borderRadius: '50%',
                            background: 'var(--error)', border: 'none', color: 'white',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                        }}
                    >
                        <Square size={12} fill="white" />
                    </button>
                    <span style={{ fontSize: '12px', color: 'var(--error)', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                        {formatTime(duration)}
                    </span>
                </>
            ) : (
                <button
                    onClick={startRecording}
                    style={{
                        width: '32px', height: '32px', borderRadius: '50%',
                        background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)', color: 'var(--text-secondary)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                    }}
                    title="Record Voice Channel"
                >
                    <Circle size={12} fill="var(--error)" stroke="var(--error)" />
                </button>
            )}
            {lastRecordingUrl && !isRecording && (
                <button
                    onClick={handleDownload}
                    style={{
                        padding: '4px 8px', borderRadius: 'var(--radius-sm)',
                        background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)',
                        color: 'var(--text-secondary)', fontSize: '11px', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', gap: '4px',
                    }}
                >
                    <Download size={12} /> Save
                </button>
            )}
        </div>
    );
}
