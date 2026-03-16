import { useState, useRef, useEffect, useCallback } from 'react';
import { Scissors, Play, Pause, X, Check } from 'lucide-react';

interface VideoTrimmerProps {
    file: File;
    onSave: (trimmedFile: File) => void;
    onCancel: () => void;
}

function formatTime(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 10);
    return `${m}:${s.toString().padStart(2, '0')}.${ms}`;
}

const THUMBNAIL_COUNT = 20;

const VideoTrimmer = ({ file, onSave, onCancel }: VideoTrimmerProps) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const timelineRef = useRef<HTMLDivElement>(null);
    const [duration, setDuration] = useState(0);
    const [startTime, setStartTime] = useState(0);
    const [endTime, setEndTime] = useState(0);
    const [currentTime, setCurrentTime] = useState(0);
    const [isPlaying, setIsPlaying] = useState(false);
    const [isPreviewing, setIsPreviewing] = useState(false);
    const [thumbnails, setThumbnails] = useState<string[]>([]);
    const [dragging, setDragging] = useState<'start' | 'end' | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const videoUrl = useRef<string>('');
    const previewRafRef = useRef<number>(0);

    // Load video and extract thumbnails
    useEffect(() => {
        videoUrl.current = URL.createObjectURL(file);
        const video = videoRef.current;
        if (!video) return;
        video.src = videoUrl.current;

        return () => {
            URL.revokeObjectURL(videoUrl.current);
            cancelAnimationFrame(previewRafRef.current);
        };
    }, [file]);

    const handleLoadedMetadata = useCallback(() => {
        const video = videoRef.current;
        if (!video || !isFinite(video.duration)) return;
        setDuration(video.duration);
        setEndTime(video.duration);
        extractThumbnails(video);
    }, []);

    const extractThumbnails = async (video: HTMLVideoElement) => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const thumbW = 80;
        const thumbH = 45;
        canvas.width = thumbW;
        canvas.height = thumbH;

        const thumbs: string[] = [];
        const interval = video.duration / THUMBNAIL_COUNT;

        for (let i = 0; i < THUMBNAIL_COUNT; i++) {
            const time = i * interval;
            try {
                await new Promise<void>((resolve) => {
                    video.onseeked = () => {
                        ctx.drawImage(video, 0, 0, thumbW, thumbH);
                        thumbs.push(canvas.toDataURL('image/jpeg', 0.5));
                        resolve();
                    };
                    video.currentTime = time;
                });
            } catch {
                thumbs.push('');
            }
        }

        // Reset video to start
        video.currentTime = 0;
        setThumbnails(thumbs);
    };

    const handleTimeUpdate = useCallback(() => {
        const video = videoRef.current;
        if (!video) return;
        setCurrentTime(video.currentTime);

        if (isPreviewing && video.currentTime >= endTime) {
            video.pause();
            setIsPlaying(false);
            setIsPreviewing(false);
        }
    }, [isPreviewing, endTime]);

    const handlePreview = useCallback(() => {
        const video = videoRef.current;
        if (!video) return;

        if (isPlaying) {
            video.pause();
            setIsPlaying(false);
            setIsPreviewing(false);
            return;
        }

        video.currentTime = startTime;
        video.play();
        setIsPlaying(true);
        setIsPreviewing(true);
    }, [isPlaying, startTime]);

    const handleTimelineMouseDown = useCallback((e: React.MouseEvent, handle: 'start' | 'end') => {
        e.preventDefault();
        e.stopPropagation();
        setDragging(handle);
    }, []);

    useEffect(() => {
        if (!dragging) return;

        const handleMouseMove = (e: MouseEvent) => {
            const timeline = timelineRef.current;
            if (!timeline) return;
            const rect = timeline.getBoundingClientRect();
            const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
            const time = ratio * duration;

            if (dragging === 'start') {
                setStartTime(Math.min(time, endTime - 0.5));
            } else {
                setEndTime(Math.max(time, startTime + 0.5));
            }
        };

        const handleMouseUp = () => setDragging(null);

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [dragging, duration, startTime, endTime]);

    const handleTrim = useCallback(async () => {
        const video = videoRef.current;
        if (!video) return;
        setIsProcessing(true);

        try {
            // Use MediaRecorder + canvas to re-encode the trimmed section
            const canvas = document.createElement('canvas');
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            const ctx = canvas.getContext('2d')!;

            const stream = canvas.captureStream(30);

            // Attempt to capture audio too
            try {
                const audioCtx = new AudioContext();
                const source = audioCtx.createMediaElementSource(video);
                const dest = audioCtx.createMediaStreamDestination();
                source.connect(dest);
                source.connect(audioCtx.destination);
                dest.stream.getAudioTracks().forEach(t => stream.addTrack(t));
            } catch {
                // No audio track or not supported — continue without audio
            }

            const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
                ? 'video/webm;codecs=vp9'
                : 'video/webm';

            const recorder = new MediaRecorder(stream, { mimeType });
            const chunks: BlobPart[] = [];

            recorder.ondataavailable = (e) => {
                if (e.data.size > 0) chunks.push(e.data);
            };

            const done = new Promise<Blob>((resolve) => {
                recorder.onstop = () => {
                    resolve(new Blob(chunks, { type: mimeType }));
                };
            });

            video.currentTime = startTime;
            await new Promise<void>(r => { video.onseeked = () => r(); });

            recorder.start();
            video.play();

            // Draw frames to canvas until endTime
            const drawFrame = () => {
                if (video.currentTime >= endTime || video.paused) {
                    video.pause();
                    recorder.stop();
                    return;
                }
                ctx.drawImage(video, 0, 0);
                requestAnimationFrame(drawFrame);
            };
            requestAnimationFrame(drawFrame);

            const blob = await done;
            const ext = file.name.split('.').pop() || 'webm';
            const trimmedFile = new File([blob], `trimmed-${file.name.replace(`.${ext}`, '')}.webm`, { type: mimeType });
            onSave(trimmedFile);
        } catch {
            // Fallback: just return original file
            onSave(file);
        } finally {
            setIsProcessing(false);
        }
    }, [file, startTime, endTime, onSave]);

    const startPct = duration > 0 ? (startTime / duration) * 100 : 0;
    const endPct = duration > 0 ? (endTime / duration) * 100 : 100;
    const currentPct = duration > 0 ? (currentTime / duration) * 100 : 0;
    const selectedDuration = endTime - startTime;

    return (
        <div style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            background: 'rgba(0,0,0,0.85)', display: 'flex',
            flexDirection: 'column', alignItems: 'center',
        }}>
            {/* Header */}
            <div style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                padding: '12px 24px', background: 'var(--bg-elevated)',
                borderBottom: '1px solid var(--stroke)', width: '100%',
                justifyContent: 'center',
            }}>
                <Scissors size={18} color="var(--accent-primary)" />
                <span style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)' }}>Trim Video</span>
            </div>

            {/* Video preview */}
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', overflow: 'hidden' }}>
                <video
                    ref={videoRef}
                    onLoadedMetadata={handleLoadedMetadata}
                    onTimeUpdate={handleTimeUpdate}
                    style={{
                        maxWidth: '100%', maxHeight: 'calc(100vh - 280px)',
                        borderRadius: '8px', boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
                    }}
                />
            </div>

            {/* Timeline controls */}
            <div style={{
                width: '100%', maxWidth: '800px', padding: '0 24px 12px',
            }}>
                {/* Duration display */}
                <div style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    marginBottom: '8px', fontSize: '12px', color: 'var(--text-muted)',
                }}>
                    <span>Start: {formatTime(startTime)}</span>
                    <span style={{ color: 'var(--accent-primary)', fontWeight: 600 }}>
                        Selected: {formatTime(selectedDuration)}
                    </span>
                    <span>End: {formatTime(endTime)}</span>
                </div>

                {/* Thumbnail strip + handles */}
                <div
                    ref={timelineRef}
                    style={{
                        position: 'relative', height: '60px', borderRadius: '8px',
                        overflow: 'hidden', background: 'var(--bg-tertiary)',
                        border: '1px solid var(--stroke)',
                    }}
                >
                    {/* Thumbnails */}
                    <div style={{ display: 'flex', height: '100%', gap: 0 }}>
                        {thumbnails.length > 0
                            ? thumbnails.map((thumb, i) => (
                                <div key={i} style={{ flex: 1, height: '100%', overflow: 'hidden' }}>
                                    {thumb && <img src={thumb} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />}
                                </div>
                            ))
                            : <div style={{ flex: 1, background: 'var(--bg-secondary)' }} />
                        }
                    </div>

                    {/* Dimmed regions */}
                    <div style={{ position: 'absolute', top: 0, left: 0, width: `${startPct}%`, height: '100%', background: 'rgba(0,0,0,0.6)' }} />
                    <div style={{ position: 'absolute', top: 0, right: 0, width: `${100 - endPct}%`, height: '100%', background: 'rgba(0,0,0,0.6)' }} />

                    {/* Selected region border */}
                    <div style={{
                        position: 'absolute', top: 0, left: `${startPct}%`, width: `${endPct - startPct}%`,
                        height: '100%', border: '2px solid var(--accent-primary)',
                        boxSizing: 'border-box', pointerEvents: 'none',
                    }} />

                    {/* Current time indicator */}
                    <div style={{
                        position: 'absolute', top: 0, left: `${currentPct}%`,
                        width: '2px', height: '100%', background: '#fff',
                        transform: 'translateX(-1px)', pointerEvents: 'none',
                    }} />

                    {/* Start handle */}
                    <div
                        onMouseDown={e => handleTimelineMouseDown(e, 'start')}
                        style={{
                            position: 'absolute', top: 0, left: `${startPct}%`,
                            width: '14px', height: '100%', cursor: 'ew-resize',
                            transform: 'translateX(-7px)', display: 'flex',
                            alignItems: 'center', justifyContent: 'center', zIndex: 2,
                        }}
                    >
                        <div style={{
                            width: '4px', height: '32px', borderRadius: '2px',
                            background: 'var(--accent-primary)',
                            boxShadow: '0 0 4px rgba(0,0,0,0.5)',
                        }} />
                    </div>

                    {/* End handle */}
                    <div
                        onMouseDown={e => handleTimelineMouseDown(e, 'end')}
                        style={{
                            position: 'absolute', top: 0, left: `${endPct}%`,
                            width: '14px', height: '100%', cursor: 'ew-resize',
                            transform: 'translateX(-7px)', display: 'flex',
                            alignItems: 'center', justifyContent: 'center', zIndex: 2,
                        }}
                    >
                        <div style={{
                            width: '4px', height: '32px', borderRadius: '2px',
                            background: 'var(--accent-primary)',
                            boxShadow: '0 0 4px rgba(0,0,0,0.5)',
                        }} />
                    </div>
                </div>
            </div>

            {/* Bottom bar */}
            <div style={{
                display: 'flex', justifyContent: 'center', gap: '12px',
                padding: '16px', background: 'var(--bg-elevated)',
                borderTop: '1px solid var(--stroke)', width: '100%',
            }}>
                <button
                    onClick={onCancel}
                    style={{
                        display: 'flex', alignItems: 'center', gap: '6px',
                        padding: '10px 24px', borderRadius: '8px',
                        border: '1px solid var(--stroke)', background: 'none',
                        color: 'var(--text-secondary)', cursor: 'pointer',
                        fontSize: '14px', fontWeight: 600,
                    }}
                >
                    <X size={16} />
                    Cancel
                </button>
                <button
                    onClick={handlePreview}
                    style={{
                        display: 'flex', alignItems: 'center', gap: '6px',
                        padding: '10px 24px', borderRadius: '8px',
                        border: '1px solid var(--stroke)', background: 'none',
                        color: 'var(--text-secondary)', cursor: 'pointer',
                        fontSize: '14px', fontWeight: 600,
                    }}
                >
                    {isPlaying ? <Pause size={16} /> : <Play size={16} />}
                    Preview
                </button>
                <button
                    onClick={handleTrim}
                    disabled={isProcessing}
                    style={{
                        display: 'flex', alignItems: 'center', gap: '6px',
                        padding: '10px 24px', borderRadius: '8px',
                        border: 'none', background: 'var(--accent-primary)',
                        color: '#000', cursor: isProcessing ? 'wait' : 'pointer',
                        fontSize: '14px', fontWeight: 700,
                        opacity: isProcessing ? 0.6 : 1,
                    }}
                >
                    <Check size={16} />
                    {isProcessing ? 'Processing...' : 'Trim'}
                </button>
            </div>
        </div>
    );
};

export default VideoTrimmer;
