import { useEffect, useRef, useState, useCallback } from 'react';
import { useRecording } from '@soniox/react';

interface SpeechInputProps {
  disabled: boolean;
  placeholder: string;
  onTranscriptDone: (text: string) => void;
  onRecordingStart?: () => void;
  /** Render the live transcript bubble inside the chat log */
  liveTranscript: string;
  setLiveTranscript: (text: string) => void;
}

type SpeechRecognitionResultLike = {
  isFinal: boolean;
  0: { transcript: string };
};

type SpeechRecognitionEventLike = {
  resultIndex: number;
  results: ArrayLike<SpeechRecognitionResultLike>;
};

type BrowserSpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

type BrowserSpeechRecognitionCtor = new () => BrowserSpeechRecognitionLike;

type WindowWithSpeechRecognition = Window & {
  SpeechRecognition?: BrowserSpeechRecognitionCtor;
  webkitSpeechRecognition?: BrowserSpeechRecognitionCtor;
};

function normalizeSpeechError(message: string): string {
  const normalized = message.toLowerCase();
  if (
    normalized.includes('balance exhausted') ||
    normalized.includes('add funds') ||
    normalized.includes('autopay')
  ) {
    return 'Soniox credits are exhausted. Please add funds or enable autopay in your Soniox organization settings.';
  }
  return message;
}

function getConfiguredSttProvider(): 'browser' | 'soniox' {
  const fromEnv = String(import.meta.env.VITE_STT_PROVIDER ?? '')
    .trim()
    .toLowerCase();
  if (fromEnv === 'browser' || fromEnv === 'soniox') {
    return fromEnv;
  }
  // Default to free browser STT in local development.
  return import.meta.env.DEV ? 'browser' : 'soniox';
}

function BrowserSpeechInput({
  disabled,
  placeholder,
  onTranscriptDone,
  onRecordingStart,
  setLiveTranscript,
}: SpeechInputProps) {
  const [wantsRecording, setWantsRecording] = useState(false);
  const [recordError, setRecordError] = useState<string | null>(null);
  const recognitionRef = useRef<BrowserSpeechRecognitionLike | null>(null);
  const stoppingRef = useRef(false);
  const finalTextRef = useRef('');
  const interimTextRef = useRef('');

  const speechCtor =
    typeof window !== 'undefined'
      ? (window as WindowWithSpeechRecognition).SpeechRecognition ||
        (window as WindowWithSpeechRecognition).webkitSpeechRecognition
      : undefined;

  const isSupported = Boolean(speechCtor);

  function buildRecognitionInstance(): BrowserSpeechRecognitionLike {
    const Ctor = speechCtor as BrowserSpeechRecognitionCtor;
    const rec = new Ctor();
    rec.lang = 'en-US';
    rec.continuous = true;
    rec.interimResults = true;

    rec.onresult = (event) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        const piece = result?.[0]?.transcript ?? '';
        if (result.isFinal) {
          finalTextRef.current += `${piece} `;
        } else {
          interim += piece;
        }
      }
      interimTextRef.current = interim;
      const merged = `${finalTextRef.current}${interimTextRef.current}`.trim();
      setLiveTranscript(merged);
    };

    rec.onerror = (event) => {
      setRecordError(
        normalizeSpeechError(event?.error ?? 'Speech recognition error'),
      );
      setWantsRecording(false);
      stoppingRef.current = false;
    };

    rec.onend = () => {
      const finalText =
        `${finalTextRef.current}${interimTextRef.current}`.trim();
      const shouldSubmit = stoppingRef.current;

      setWantsRecording(false);
      stoppingRef.current = false;

      if (shouldSubmit) {
        setLiveTranscript('');
        if (finalText) {
          onTranscriptDone(finalText);
        }
      }
    };

    return rec;
  }

  function startRecording() {
    if (!isSupported || disabled) return;
    setRecordError(null);
    setLiveTranscript('');
    finalTextRef.current = '';
    interimTextRef.current = '';
    stoppingRef.current = false;

    if (!recognitionRef.current) {
      recognitionRef.current = buildRecognitionInstance();
    }

    try {
      recognitionRef.current.start();
      setWantsRecording(true);
      onRecordingStart?.();
    } catch (err) {
      setWantsRecording(false);
      const msg =
        err instanceof Error
          ? err.message
          : 'Could not start browser speech recognition.';
      setRecordError(msg);
    }
  }

  function stopRecording() {
    if (!recognitionRef.current) return;
    stoppingRef.current = true;
    setWantsRecording(false);
    try {
      recognitionRef.current.stop();
    } catch {
      stoppingRef.current = false;
    }
  }

  function handleToggle() {
    if (disabled) return;
    if (wantsRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  }

  if (!isSupported) {
    return (
      <div className='speech-input-row'>
        <p className='speech-unsupported'>
          Browser speech recognition is not supported in this browser. Use
          Chrome or Edge, or set VITE_STT_PROVIDER=soniox.
        </p>
      </div>
    );
  }

  return (
    <div className='speech-input-row'>
      <button
        className={`mic-btn ${wantsRecording ? 'recording' : ''}`}
        onClick={handleToggle}
        disabled={disabled}
        title={wantsRecording ? 'Click to stop recording' : placeholder}
        type='button'
      >
        <svg
          xmlns='http://www.w3.org/2000/svg'
          width='24'
          height='24'
          viewBox='0 0 24 24'
          fill='none'
          stroke='currentColor'
          strokeWidth='2'
          strokeLinecap='round'
          strokeLinejoin='round'
        >
          <rect x='9' y='1' width='6' height='12' rx='3' />
          <path d='M5 10a7 7 0 0 0 14 0' />
          <line x1='12' y1='17' x2='12' y2='21' />
          <line x1='8' y1='21' x2='16' y2='21' />
        </svg>
        <span className='mic-label'>
          {wantsRecording
            ? 'Recording… Click to stop'
            : 'Click to speak (Browser STT)'}
        </span>
      </button>
      {wantsRecording && (
        <span className='recording-indicator'>
          <span className='pulse-dot' />
        </span>
      )}
      {recordError && <p className='speech-error'>Error: {recordError}</p>}
    </div>
  );
}

function SonioxSpeechInput({
  disabled,
  placeholder,
  onTranscriptDone,
  onRecordingStart,
  setLiveTranscript,
}: SpeechInputProps) {
  const [wantsRecording, setWantsRecording] = useState(false);
  const [recordError, setRecordError] = useState<string | null>(null);
  const stoppingRef = useRef(false);
  const wantsRef = useRef(false);

  // Keep refs for callbacks so the hook config stays stable
  const onTranscriptDoneRef = useRef(onTranscriptDone);
  onTranscriptDoneRef.current = onTranscriptDone;
  const setLiveTranscriptRef = useRef(setLiveTranscript);
  setLiveTranscriptRef.current = setLiveTranscript;

  const onError = useCallback((err: Error) => {
    console.error('Soniox recording error:', err);
    setRecordError(normalizeSpeechError(err.message));
    if (wantsRef.current) {
      wantsRef.current = false;
      setWantsRecording(false);
      stoppingRef.current = false;
    }
  }, []);

  const onStateChange = useCallback(
    ({ old_state, new_state }: { old_state: string; new_state: string }) => {
      console.log(`[Soniox] ${old_state} -> ${new_state}`);
    },
    [],
  );

  const onFinished = useCallback(() => {
    console.log('[Soniox] finished');
    stoppingRef.current = false;
  }, []);

  const recording = useRecording({
    model: 'stt-rt-preview',
    language_hints: ['en'],
    onError,
    onFinished,
    onStateChange,
  });

  const { text, isSupported, unsupportedReason, state } = recording;

  // Keep a ref to the latest text so we can read it after stop resolves
  const textRef = useRef(text);
  useEffect(() => {
    textRef.current = text;
  }, [text]);

  // Push live transcript to parent while recording
  useEffect(() => {
    if (wantsRef.current && text) {
      setLiveTranscriptRef.current(text);
    }
  }, [text]);

  useEffect(() => {
    console.log(
      '[SpeechInput] SDK state:',
      state,
      '| wantsRecording:',
      wantsRecording,
    );
  }, [state, wantsRecording]);

  async function handleToggle() {
    if (disabled || stoppingRef.current) return;
    setRecordError(null);

    if (wantsRecording) {
      stoppingRef.current = true;
      wantsRef.current = false;
      setWantsRecording(false);
      try {
        await recording.stop();
      } catch (e) {
        console.warn('stop() threw:', e);
      }
      const finalText = textRef.current.trim();
      setLiveTranscriptRef.current('');
      stoppingRef.current = false;
      if (finalText) {
        onTranscriptDoneRef.current(finalText);
      }
    } else {
      setLiveTranscriptRef.current('');
      wantsRef.current = true;
      setWantsRecording(true);
      onRecordingStart?.();
      recording.start();
    }
  }

  if (!isSupported) {
    return (
      <div className='speech-input-row'>
        <p className='speech-unsupported'>
          Microphone not supported: {unsupportedReason ?? 'unknown reason'}
        </p>
      </div>
    );
  }

  return (
    <div className='speech-input-row'>
      <button
        className={`mic-btn ${wantsRecording ? 'recording' : ''}`}
        onClick={() => void handleToggle()}
        disabled={disabled || stoppingRef.current}
        title={wantsRecording ? 'Click to stop recording' : placeholder}
        type='button'
      >
        <svg
          xmlns='http://www.w3.org/2000/svg'
          width='24'
          height='24'
          viewBox='0 0 24 24'
          fill='none'
          stroke='currentColor'
          strokeWidth='2'
          strokeLinecap='round'
          strokeLinejoin='round'
        >
          <rect x='9' y='1' width='6' height='12' rx='3' />
          <path d='M5 10a7 7 0 0 0 14 0' />
          <line x1='12' y1='17' x2='12' y2='21' />
          <line x1='8' y1='21' x2='16' y2='21' />
        </svg>
        <span className='mic-label'>
          {wantsRecording
            ? 'Recording… Click to stop'
            : 'Click to speak (Soniox STT)'}
        </span>
      </button>
      {wantsRecording && (
        <span className='recording-indicator'>
          <span className='pulse-dot' />
        </span>
      )}
      {recordError && <p className='speech-error'>Error: {recordError}</p>}
    </div>
  );
}

export default function SpeechInput(props: SpeechInputProps) {
  const provider = getConfiguredSttProvider();
  if (provider === 'browser') {
    return <BrowserSpeechInput {...props} />;
  }
  return <SonioxSpeechInput {...props} />;
}
