import { useCallback, useEffect, useRef, useState } from 'react';
import type { RealtimeSessionResponse } from '@shared/types';
import { api } from '@/lib/api';

/**
 * Sprachmodus über die OpenAI Realtime API (WebRTC).
 *
 * Ablauf: kurzlebiges Token vom eigenen Server holen → Mikrofon öffnen →
 * PeerConnection zu OpenAI aufbauen → Antwort-Audio direkt abspielen.
 * Der API-Key liegt ausschließlich auf dem Server.
 */

export type VoiceStatus = 'idle' | 'connecting' | 'live' | 'error';

export interface VoiceTranscript {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  /** Solange true, wächst der Text noch. */
  partial: boolean;
}

/** Ergebnis eines Werkzeugaufrufs, das an das Modell zurückgeht. */
export type ToolResult = Record<string, unknown>;

/** Führt einen vom Assistenten angeforderten Werkzeugaufruf aus. */
export type ToolExecutor = (name: string, args: Record<string, unknown>) => Promise<ToolResult>;

export interface RealtimeVoice {
  status: VoiceStatus;
  error: string | null;
  /** Der Nutzer spricht gerade. */
  listening: boolean;
  /** Das Modell spricht gerade. */
  speaking: boolean;
  transcripts: VoiceTranscript[];
  start: () => Promise<void>;
  stop: () => void;
  /** Laufende Antwort abbrechen, ohne die Verbindung zu trennen. */
  interrupt: () => void;
}

let transcriptCounter = 0;
const nextTranscriptId = () => `voice-${(transcriptCounter += 1)}`;

/** Session-Konfiguration in der Form, die die jeweilige API-Variante erwartet. */
function sessionUpdatePayload(session: RealtimeSessionResponse): Record<string, unknown> {
  if (session.variant === 'ga') {
    return {
      type: 'session.update',
      session: {
        type: 'realtime',
        instructions: session.instructions,
        audio: {
          input: {
            transcription: { model: session.transcriptionModel },
            turn_detection: { type: 'server_vad', silence_duration_ms: 700 },
          },
          output: { voice: session.voice },
        },
        tools: session.tools,
        tool_choice: 'auto',
      },
    };
  }

  return {
    type: 'session.update',
    session: {
      instructions: session.instructions,
      voice: session.voice,
      input_audio_transcription: { model: session.transcriptionModel },
      turn_detection: { type: 'server_vad', silence_duration_ms: 700 },
      tools: session.tools,
      tool_choice: 'auto',
    },
  };
}

/**
 * SDP-Austausch. Schlägt der konfigurierte Endpunkt mit 404 fehl, wird die
 * ältere Beta-Adresse versucht — dieselbe Absicherung wie serverseitig beim
 * Ausstellen des Tokens.
 */
async function exchangeSdp(
  session: RealtimeSessionResponse,
  offerSdp: string,
): Promise<string> {
  const candidates = [
    session.callUrl,
    session.callUrl.replace(/\/calls$/, ''),
  ].filter((url, index, all) => all.indexOf(url) === index);

  let lastError = 'Unbekannter Fehler';

  for (const base of candidates) {
    const response = await fetch(`${base}?model=${encodeURIComponent(session.model)}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${session.clientSecret}`,
        'Content-Type': 'application/sdp',
        ...(session.variant === 'beta' ? { 'OpenAI-Beta': 'realtime=v1' } : {}),
      },
      body: offerSdp,
    });

    if (response.ok) return response.text();

    lastError = `HTTP ${response.status} — ${(await response.text()).slice(0, 200)}`;
    if (response.status !== 404) break;
  }

  throw new Error(lastError);
}

export function useRealtimeVoice(executeTool?: ToolExecutor): RealtimeVoice {
  const [status, setStatus] = useState<VoiceStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [transcripts, setTranscripts] = useState<VoiceTranscript[]>([]);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const channelRef = useRef<RTCDataChannel | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  // Laufende Assistenten-Antwort, an die Deltas angehängt werden.
  const activeReplyRef = useRef<string | null>(null);

  const teardown = useCallback(() => {
    channelRef.current?.close();
    channelRef.current = null;

    pcRef.current?.getSenders().forEach((sender) => sender.track?.stop());
    pcRef.current?.close();
    pcRef.current = null;

    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;

    if (audioRef.current) {
      audioRef.current.srcObject = null;
      audioRef.current.remove();
      audioRef.current = null;
    }

    activeReplyRef.current = null;
    setListening(false);
    setSpeaking(false);
  }, []);

  const stop = useCallback(() => {
    teardown();
    setStatus('idle');
  }, [teardown]);

  const appendDelta = useCallback((delta: string) => {
    setTranscripts((prev) => {
      const id = activeReplyRef.current;
      const existing = id ? prev.find((entry) => entry.id === id) : undefined;

      if (!existing) {
        const created = nextTranscriptId();
        activeReplyRef.current = created;
        return [...prev, { id: created, role: 'assistant', text: delta, partial: true }];
      }

      return prev.map((entry) =>
        entry.id === id ? { ...entry, text: entry.text + delta } : entry,
      );
    });
  }, []);

  const executorRef = useRef<ToolExecutor | undefined>(executeTool);
  executorRef.current = executeTool;

  /**
   * Werkzeugaufruf ausführen und das Ergebnis zurückgeben.
   *
   * Nach dem Ergebnis muss ausdrücklich eine neue Antwort angefordert werden —
   * sonst bleibt das Modell stumm und der Nutzer denkt, es sei abgestürzt.
   */
  const runTool = useCallback(async (callId: string, name: string, rawArgs: string) => {
    const channel = channelRef.current;
    if (!channel || channel.readyState !== 'open') return;

    let output: ToolResult;
    try {
      const args = rawArgs ? (JSON.parse(rawArgs) as Record<string, unknown>) : {};
      output = executorRef.current
        ? await executorRef.current(name, args)
        : { fehler: `Unbekanntes Werkzeug: ${name}` };
    } catch (cause) {
      output = { fehler: cause instanceof Error ? cause.message : String(cause) };
    }

    channel.send(
      JSON.stringify({
        type: 'conversation.item.create',
        item: { type: 'function_call_output', call_id: callId, output: JSON.stringify(output) },
      }),
    );
    channel.send(JSON.stringify({ type: 'response.create' }));
  }, []);

  const handleEvent = useCallback(
    (raw: MessageEvent<string>) => {
      let event: { type?: string; [key: string]: unknown };
      try {
        event = JSON.parse(raw.data) as typeof event;
      } catch {
        return;
      }

      const type = event.type ?? '';

      // Sprechpausen-Erkennung des Servers.
      if (type === 'input_audio_buffer.speech_started') setListening(true);
      if (type === 'input_audio_buffer.speech_stopped') setListening(false);

      // Audioausgabe läuft (WebRTC-spezifische Ereignisse).
      if (type === 'output_audio_buffer.started') setSpeaking(true);
      if (type === 'output_audio_buffer.stopped' || type === 'output_audio_buffer.cleared') {
        setSpeaking(false);
      }

      // Transkript der eigenen Sprache.
      if (type.endsWith('input_audio_transcription.completed')) {
        const text = String(event.transcript ?? '').trim();
        if (text) {
          setTranscripts((prev) => [
            ...prev,
            { id: nextTranscriptId(), role: 'user', text, partial: false },
          ]);
        }
      }

      // Transkript der Antwort. GA und Beta benennen das Ereignis leicht
      // unterschiedlich, deshalb auf die Endung prüfen.
      if (type.endsWith('audio_transcript.delta')) {
        const delta = String(event.delta ?? '');
        if (delta) appendDelta(delta);
      }

      if (type.endsWith('audio_transcript.done')) {
        const finished = activeReplyRef.current;
        const text = String(event.transcript ?? '').trim();
        setTranscripts((prev) =>
          prev.map((entry) =>
            entry.id === finished
              ? { ...entry, text: text || entry.text, partial: false }
              : entry,
          ),
        );
        activeReplyRef.current = null;
      }

      if (type === 'response.done') {
        activeReplyRef.current = null;
        setSpeaking(false);
      }

      // Werkzeugaufruf: das Modell hat die Argumente fertig übertragen.
      if (type === 'response.function_call_arguments.done') {
        void runTool(
          String(event.call_id ?? ''),
          String(event.name ?? ''),
          String(event.arguments ?? '{}'),
        );
      }

      if (type === 'error') {
        const detail = event.error as { message?: string } | undefined;
        setError(detail?.message ?? 'Fehler in der Sprachsitzung');
      }
    },
    [appendDelta, runTool],
  );

  const start = useCallback(async () => {
    if (status === 'connecting' || status === 'live') return;

    setError(null);
    setStatus('connecting');

    try {
      // getUserMedia gibt es nur im sicheren Kontext. localhost zählt als
      // sicher — ein Aufruf über die LAN-IP ohne HTTPS jedoch nicht.
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error(
          'Kein Mikrofonzugriff möglich. Die Seite muss über localhost oder ' +
            'HTTPS geöffnet werden.',
        );
      }

      const session = await api.realtimeSession();

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      streamRef.current = stream;

      const pc = new RTCPeerConnection();
      pcRef.current = pc;

      // Antwort-Audio abspielen.
      const audio = document.createElement('audio');
      audio.autoplay = true;
      audio.style.display = 'none';
      document.body.appendChild(audio);
      audioRef.current = audio;
      pc.ontrack = (event) => {
        audio.srcObject = event.streams[0] ?? null;
      };

      const track = stream.getAudioTracks()[0];
      if (track) pc.addTrack(track, stream);

      const channel = pc.createDataChannel('oai-events');
      channelRef.current = channel;
      channel.onmessage = handleEvent;
      channel.onopen = () => {
        channel.send(JSON.stringify(sessionUpdatePayload(session)));
        setStatus('live');
      };

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
          setError('Verbindung zu OpenAI verloren');
          teardown();
          setStatus('error');
        }
      };

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      const answer = await exchangeSdp(session, offer.sdp ?? '');
      await pc.setRemoteDescription({ type: 'answer', sdp: answer });
    } catch (cause) {
      const message =
        cause instanceof DOMException && cause.name === 'NotAllowedError'
          ? 'Mikrofonzugriff wurde abgelehnt.'
          : cause instanceof DOMException && cause.name === 'NotFoundError'
            ? 'Kein Mikrofon gefunden.'
            : cause instanceof Error
              ? cause.message
              : String(cause);

      teardown();
      setError(message);
      setStatus('error');
    }
  }, [status, handleEvent, teardown]);

  /** Antwort abbrechen — z.B. wenn man dem Assistenten ins Wort fällt. */
  const interrupt = useCallback(() => {
    channelRef.current?.send(JSON.stringify({ type: 'response.cancel' }));
    setSpeaking(false);
  }, []);

  // Beim Verlassen der Seite Mikrofon und Verbindung sicher freigeben.
  useEffect(() => teardown, [teardown]);

  return { status, error, listening, speaking, transcripts, start, stop, interrupt };
}
