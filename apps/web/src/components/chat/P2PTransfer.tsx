import { useState, useRef, useCallback, useEffect } from 'react';
import { Send, Download, X, Check, AlertTriangle, Upload, Loader, FileIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { getSocket } from '../../lib/socket';

interface P2PTransferProps {
  targetUserId?: string;
  onComplete: (file: File) => void;
}

type TransferState = 'idle' | 'connecting' | 'transferring' | 'complete' | 'failed';
type Role = 'sender' | 'receiver';

interface TransferInfo {
  fileName: string;
  fileSize: number;
  speed: number;
  progress: number;
  eta: number;
}

const MAX_FILE_SIZE = 2 * 1024 * 1024 * 1024; // 2GB
const CHUNK_SIZE = 64 * 1024; // 64KB

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function formatSpeed(bytesPerSec: number): string {
  return `${formatBytes(bytesPerSec)}/s`;
}

function formatEta(seconds: number): string {
  if (seconds < 60) return `${Math.ceil(seconds)}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${Math.ceil(seconds % 60)}s`;
  return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
}

export function P2PTransfer({ targetUserId, onComplete }: P2PTransferProps) {
  const [state, setState] = useState<TransferState>('idle');
  const [role, setRole] = useState<Role>('sender');
  const [info, setInfo] = useState<TransferInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [incomingOffer, setIncomingOffer] = useState<{ fromUserId: string; fileName: string; fileSize: number } | null>(null);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dcRef = useRef<RTCDataChannel | null>(null);
  const fileRef = useRef<File | null>(null);
  const chunksRef = useRef<ArrayBuffer[]>([]);
  const receivedRef = useRef(0);
  const startTimeRef = useRef(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const cleanup = useCallback(() => {
    if (dcRef.current) { dcRef.current.close(); dcRef.current = null; }
    if (pcRef.current) { pcRef.current.close(); pcRef.current = null; }
    chunksRef.current = [];
    receivedRef.current = 0;
  }, []);

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const handleSignal = (data: any) => {
      if (data.type === 'offer') {
        setIncomingOffer({ fromUserId: data.fromUserId, fileName: data.fileName, fileSize: data.fileSize });
      } else if (data.type === 'answer' && pcRef.current) {
        pcRef.current.setRemoteDescription(new RTCSessionDescription(data.sdp));
      } else if (data.type === 'ice-candidate' && pcRef.current) {
        pcRef.current.addIceCandidate(new RTCIceCandidate(data.candidate));
      }
    };

    socket.on('P2P_SIGNAL', handleSignal);
    return () => {
      socket.off('P2P_SIGNAL', handleSignal);
      cleanup();
    };
  }, [cleanup]);

  const createPeerConnection = useCallback(() => {
    const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
    const socket = getSocket();

    pc.onicecandidate = (e) => {
      if (e.candidate && socket) {
        socket.emit('P2P_SIGNAL', { type: 'ice-candidate', candidate: e.candidate, targetUserId });
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed') {
        setState('failed');
        setError('Connection failed');
        cleanup();
      }
    };

    pcRef.current = pc;
    return pc;
  }, [targetUserId, cleanup]);

  const sendFile = useCallback(async (file: File) => {
    const socket = getSocket();
    if (!socket || !targetUserId) return;

    setRole('sender');
    setState('connecting');
    setError(null);
    fileRef.current = file;
    setInfo({ fileName: file.name, fileSize: file.size, speed: 0, progress: 0, eta: 0 });

    const pc = createPeerConnection();
    const dc = pc.createDataChannel('file-transfer');
    dcRef.current = dc;

    dc.binaryType = 'arraybuffer';
    dc.bufferedAmountLowThreshold = CHUNK_SIZE * 8;

    dc.onopen = () => {
      setState('transferring');
      startTimeRef.current = Date.now();
      let offset = 0;

      const sendChunk = () => {
        if (!fileRef.current) return;
        while (offset < fileRef.current.size && dc.bufferedAmount < CHUNK_SIZE * 16) {
          const end = Math.min(offset + CHUNK_SIZE, fileRef.current.size);
          const slice = fileRef.current.slice(offset, end);
          slice.arrayBuffer().then((buf) => dc.send(buf));
          offset = end;

          const elapsed = (Date.now() - startTimeRef.current) / 1000;
          const speed = elapsed > 0 ? offset / elapsed : 0;
          const remaining = fileRef.current!.size - offset;
          const eta = speed > 0 ? remaining / speed : 0;
          setInfo((prev) => prev ? { ...prev, progress: offset / fileRef.current!.size, speed, eta } : prev);
        }
        if (offset < fileRef.current.size) {
          dc.onbufferedamountlow = sendChunk;
        } else {
          dc.send(new ArrayBuffer(0)); // Signal end
          setState('complete');
          setInfo((prev) => prev ? { ...prev, progress: 1, eta: 0 } : prev);
        }
      };
      sendChunk();
    };

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    socket.emit('P2P_SIGNAL', { type: 'offer', sdp: offer, targetUserId, fileName: file.name, fileSize: file.size });
  }, [targetUserId, createPeerConnection]);

  const acceptTransfer = useCallback(async () => {
    if (!incomingOffer) return;
    const socket = getSocket();
    if (!socket) return;

    setRole('receiver');
    setState('connecting');
    setError(null);
    setInfo({ fileName: incomingOffer.fileName, fileSize: incomingOffer.fileSize, speed: 0, progress: 0, eta: 0 });
    setIncomingOffer(null);

    const pc = createPeerConnection();

    pc.ondatachannel = (event) => {
      const dc = event.channel;
      dcRef.current = dc;
      dc.binaryType = 'arraybuffer';
      startTimeRef.current = Date.now();
      setState('transferring');

      dc.onmessage = (e) => {
        const buf = e.data as ArrayBuffer;
        if (buf.byteLength === 0) {
          // Transfer complete
          const blob = new Blob(chunksRef.current);
          const file = new File([blob], incomingOffer!.fileName);
          onComplete(file);
          setState('complete');
          setInfo((prev) => prev ? { ...prev, progress: 1, eta: 0 } : prev);
          cleanup();
          return;
        }
        chunksRef.current.push(buf);
        receivedRef.current += buf.byteLength;

        const elapsed = (Date.now() - startTimeRef.current) / 1000;
        const speed = elapsed > 0 ? receivedRef.current / elapsed : 0;
        const remaining = incomingOffer!.fileSize - receivedRef.current;
        const eta = speed > 0 ? remaining / speed : 0;
        setInfo((prev) => prev ? { ...prev, progress: receivedRef.current / incomingOffer!.fileSize, speed, eta } : prev);
      };
    };

    // In a real flow, we'd receive the offer SDP from the signal; simplified here
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    socket.emit('P2P_SIGNAL', { type: 'answer', sdp: answer, targetUserId: incomingOffer.fromUserId });
  }, [incomingOffer, createPeerConnection, onComplete, cleanup]);

  const rejectTransfer = useCallback(() => {
    setIncomingOffer(null);
  }, []);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_FILE_SIZE) {
      setError('File exceeds 2GB limit');
      return;
    }
    sendFile(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, [sendFile]);

  const handleFallback = useCallback(() => {
    if (fileRef.current) onComplete(fileRef.current);
    setState('idle');
    setInfo(null);
    cleanup();
  }, [onComplete, cleanup]);

  const handleReset = useCallback(() => {
    setState('idle');
    setInfo(null);
    setError(null);
    cleanup();
  }, [cleanup]);

  const progressPct = info ? Math.round(info.progress * 100) : 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {/* Incoming offer notification */}
      <AnimatePresence>
        {incomingOffer && state === 'idle' && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            style={{
              background: 'var(--bg-elevated)',
              border: '1px solid var(--accent-primary)',
              borderRadius: '10px',
              padding: '12px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <Download size={16} style={{ color: 'var(--accent-primary)' }} />
              <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>Incoming File Transfer</span>
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '10px' }}>
              <strong>{incomingOffer.fileName}</strong> ({formatBytes(incomingOffer.fileSize)})
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={acceptTransfer}
                style={{
                  flex: 1,
                  padding: '6px',
                  borderRadius: '6px',
                  border: 'none',
                  background: 'var(--accent-primary)',
                  color: '#fff',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Accept
              </button>
              <button
                onClick={rejectTransfer}
                style={{
                  flex: 1,
                  padding: '6px',
                  borderRadius: '6px',
                  border: '1px solid var(--stroke)',
                  background: 'none',
                  color: 'var(--text-secondary)',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Reject
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main UI */}
      {state === 'idle' && !incomingOffer && (
        <div style={{ display: 'flex', gap: '6px' }}>
          <button
            onClick={() => fileInputRef.current?.click()}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 12px',
              borderRadius: '8px',
              border: '1px solid var(--stroke)',
              background: 'var(--bg-secondary)',
              color: 'var(--text-primary)',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            <Send size={14} />
            Send File P2P
          </button>
          <input ref={fileInputRef} type="file" style={{ display: 'none' }} onChange={handleFileSelect} />
        </div>
      )}

      {/* Transfer progress */}
      <AnimatePresence>
        {(state === 'connecting' || state === 'transferring' || state === 'complete' || state === 'failed') && info && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            style={{
              background: 'var(--bg-elevated)',
              border: '1px solid var(--stroke)',
              borderRadius: '10px',
              padding: '12px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <FileIcon size={16} style={{ color: 'var(--accent-primary)' }} />
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {info.fileName}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{formatBytes(info.fileSize)}</div>
                </div>
              </div>
              {state !== 'transferring' && state !== 'connecting' && (
                <button onClick={handleReset} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px', color: 'var(--text-muted)' }}>
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Progress bar */}
            <div style={{ height: '6px', background: 'var(--bg-secondary)', borderRadius: '3px', overflow: 'hidden', marginBottom: '8px' }}>
              <motion.div
                style={{
                  height: '100%',
                  borderRadius: '3px',
                  background: state === 'failed' ? '#ef4444' : state === 'complete' ? '#66bb6a' : 'var(--accent-primary)',
                }}
                animate={{ width: `${progressPct}%` }}
                transition={{ ease: 'linear', duration: 0.3 }}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-muted)' }}>
              <span>
                {state === 'connecting' && (
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Loader size={10} style={{ animation: 'spin 1s linear infinite' }} />
                    Connecting...
                  </span>
                )}
                {state === 'transferring' && `${progressPct}% - ${formatSpeed(info.speed)}`}
                {state === 'complete' && (
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#66bb6a' }}>
                    <Check size={10} /> Transfer complete
                  </span>
                )}
                {state === 'failed' && (
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#ef4444' }}>
                    <AlertTriangle size={10} /> {error || 'Transfer failed'}
                  </span>
                )}
              </span>
              {state === 'transferring' && info.eta > 0 && (
                <span>ETA: {formatEta(info.eta)}</span>
              )}
            </div>

            {/* Fallback */}
            {(state === 'failed' || state === 'connecting') && role === 'sender' && (
              <button
                onClick={handleFallback}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  marginTop: '8px',
                  padding: '6px 10px',
                  borderRadius: '6px',
                  border: '1px solid var(--stroke)',
                  background: 'none',
                  color: 'var(--text-secondary)',
                  fontSize: '11px',
                  cursor: 'pointer',
                  width: '100%',
                  justifyContent: 'center',
                }}
              >
                <Upload size={12} />
                Upload to server instead
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Standalone error */}
      {error && state === 'idle' && (
        <div style={{ fontSize: '11px', color: '#ef4444', padding: '0 4px' }}>{error}</div>
      )}
    </div>
  );
}
