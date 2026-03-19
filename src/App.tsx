import { useEffect, useState, useCallback, useRef } from 'react';
import ResultPanel from './components/ResultPanel';
import SpeechInput from './components/SpeechInput';
import { buildCombinedPrompt } from './lib/prompt';
import { callOpenRouter } from './lib/openrouter';
import { parseEvaluation } from './lib/parser';
import { speakRealtime, stopSpeaking, getMuted, setMuted } from './lib/tts';
import type {
  ConversationSetup,
  EvaluationInput,
  ParseResult,
} from './types/evaluation';

type ChatMessage = { role: 'bot' | 'user'; text: string };
type SampleScenario = {
  id: string;
  name: string;
  context: string;
  character: string;
  openingBotLine: string;
};
type SampleTopic = { id: string; name: string; scenarios: SampleScenario[] };
type SampleLibrary = { topics: SampleTopic[] };

type NewScenarioForm = {
  topicId: string;
  topicName: string;
  scenarioId: string;
  scenarioName: string;
  context: string;
  character: string;
  openingBotLine: string;
};

function cleanBotLine(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, '')
    .replace(/^"|"$/g, '')
    .trim();
}

function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export default function App() {
  const envApiKey = (import.meta.env.VITE_OPENROUTER_API_KEY ?? '').trim();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [latestResult, setLatestResult] = useState<ParseResult | null>(null);
  const [setup, setSetup] = useState<ConversationSetup | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const messagesRef = useRef<ChatMessage[]>([]);
  messagesRef.current = messages;
  const [, setUserLine] = useState('');
  const [isEnded, setIsEnded] = useState(false);
  const [liveTranscript, setLiveTranscript] = useState('');
  const [sampleTopics, setSampleTopics] = useState<SampleTopic[]>([]);
  const [selectedScenarioId, setSelectedScenarioId] = useState('');
  const [selectedScenario, setSelectedScenario] = useState<{
    topicName: string;
    scenario: SampleScenario;
  } | null>(null);
  const [topicOpenState, setTopicOpenState] = useState<Record<string, boolean>>(
    {},
  );
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [ttsMuted, setTtsMuted] = useState(getMuted);
  const [speakingIdx, setSpeakingIdx] = useState<number | null>(null);
  const [highlightWordIdx, setHighlightWordIdx] = useState<number | null>(null);
  const speakingIdxRef = useRef<number | null>(null);
  const chatLogRef = useRef<HTMLDivElement>(null);
  const [newScenarioForm, setNewScenarioForm] = useState<NewScenarioForm>({
    topicId: '',
    topicName: '',
    scenarioId: '',
    scenarioName: '',
    context: '',
    character: '',
    openingBotLine: '',
  });

  useEffect(() => {
    async function loadSampleLibrary() {
      try {
        const response = await fetch('/sample/index.json', {
          cache: 'no-cache',
        });
        if (!response.ok) throw new Error('Failed to load sample scenarios.');
        const payload = (await response.json()) as SampleLibrary;
        setSampleTopics(payload.topics ?? []);
        setTopicOpenState(
          Object.fromEntries((payload.topics ?? []).map((t) => [t.id, true])),
        );
        const first = payload.topics?.[0]?.scenarios?.[0];
        if (first) setSelectedScenarioId(first.id);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Could not load samples.',
        );
      }
    }
    void loadSampleLibrary();
  }, []);

  useEffect(() => {
    const el = chatLogRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, liveTranscript]);

  function speakBot(text: string, messageIdx: number) {
    setSpeakingIdx(messageIdx);
    speakingIdxRef.current = messageIdx;
    setHighlightWordIdx(null);
    speakRealtime(text, {
      onStart: () => {
        if (speakingIdxRef.current === messageIdx) {
          setHighlightWordIdx(null);
        }
      },
      onHighlight: (wordIdx) => {
        if (speakingIdxRef.current === messageIdx) {
          setHighlightWordIdx(wordIdx);
        }
      },
      onEnd: () => {
        if (speakingIdxRef.current === messageIdx) {
          setHighlightWordIdx(null);
          setSpeakingIdx(null);
          speakingIdxRef.current = null;
        }
      },
    }).catch(() => {
      if (speakingIdxRef.current === messageIdx) {
        setHighlightWordIdx(null);
        setSpeakingIdx(null);
        speakingIdxRef.current = null;
      }
    });
  }

  function replayBot(text: string, messageIdx: number) {
    setSpeakingIdx(messageIdx);
    speakingIdxRef.current = messageIdx;
    setHighlightWordIdx(null);
    speakRealtime(text, {
      onHighlight: (wordIdx) => {
        if (speakingIdxRef.current === messageIdx) {
          setHighlightWordIdx(wordIdx);
        }
      },
      onEnd: () => {
        if (speakingIdxRef.current === messageIdx) {
          setHighlightWordIdx(null);
          setSpeakingIdx(null);
          speakingIdxRef.current = null;
        }
      },
    }).catch(() => {
      if (speakingIdxRef.current === messageIdx) {
        setHighlightWordIdx(null);
        setSpeakingIdx(null);
        speakingIdxRef.current = null;
      }
    });
  }

  function handleToggleMute() {
    const next = !ttsMuted;
    setTtsMuted(next);
    setMuted(next);
  }

  function handleRecordingStart() {
    stopSpeaking();
    setSpeakingIdx(null);
    setHighlightWordIdx(null);
    speakingIdxRef.current = null;
  }

  function getLastBotLine(list: ChatMessage[]): string | null {
    for (let i = list.length - 1; i >= 0; i -= 1) {
      if (list[i].role === 'bot') return list[i].text;
    }
    return null;
  }

  function handleStart(nextSetup: ConversationSetup) {
    if (!envApiKey) {
      setError(
        'Missing VITE_OPENROUTER_API_KEY. Please set it in your .env file.',
      );
      return;
    }
    setSetup(nextSetup);
    setMessages([{ role: 'bot', text: nextSetup.openingBotLine }]);
    setLatestResult(null);
    setError(null);
    setUserLine('');
    setIsEnded(false);
    speakBot(nextSetup.openingBotLine, 0);
  }

  function handleResetResult() {
    setError(null);
    setLatestResult(null);
  }

  function handleEndConversation() {
    setIsEnded(true);
    stopSpeaking();
    setSpeakingIdx(null);
    setHighlightWordIdx(null);
    speakingIdxRef.current = null;
  }

  const handleTranscriptDone = useCallback(
    (text: string) => {
      if (!setup || !envApiKey || isEnded || loading) return;
      setUserLine(text);
      // We set userLine then trigger evaluation in an effect-free way
      // by calling the evaluate logic directly with the text
      void evaluateWithText(text);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [setup, envApiKey, isEnded, loading, messages],
  );

  async function evaluateWithText(text: string) {
    if (!setup || !envApiKey || !text.trim() || isEnded || loading) return;

    const currentMessages = messagesRef.current;
    const prevBotLine = getLastBotLine(currentMessages);
    if (!prevBotLine) {
      setError('No previous bot line found.');
      return;
    }

    const input: EvaluationInput = {
      topic: setup.topic,
      context: setup.context,
      character: setup.character,
      prevBotLine,
      userResponse: text.trim(),
    };

    const nextMessages: ChatMessage[] = [
      ...currentMessages,
      { role: 'user', text: text.trim() },
    ];
    setMessages(nextMessages);
    setUserLine('');
    setLoading(true);
    setError(null);
    setLatestResult(null);

    try {
      // Single combined API call: evaluate + generate bot reply
      const raw = await callOpenRouter(
        envApiKey,
        buildCombinedPrompt({ ...input, chatHistory: nextMessages }),
      );
      const parsed = parseEvaluation(raw);
      setLatestResult(parsed);

      if (!parsed.ok) return;

      const botLine =
        cleanBotLine(parsed.data.next_bot_line ?? '') ||
        'Could you try one more response in this scenario?';
      setMessages((prev) => {
        const updated = [...prev, { role: 'bot' as const, text: botLine }];
        speakBot(botLine, updated.length - 1);
        return updated;
      });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'An unexpected error occurred.',
      );
    } finally {
      setLoading(false);
    }
  }

  function updateNewScenarioField(field: keyof NewScenarioForm, value: string) {
    setNewScenarioForm((prev) => ({ ...prev, [field]: value }));
  }

  function openCreateDialog() {
    setIsCreateDialogOpen(true);
    setNewScenarioForm({
      topicId: '',
      topicName: '',
      scenarioId: '',
      scenarioName: '',
      context: '',
      character: '',
      openingBotLine: '',
    });
  }

  function closeCreateDialog() {
    setIsCreateDialogOpen(false);
  }

  function toggleTopicOpen(topicId: string) {
    setTopicOpenState((prev) => ({
      ...prev,
      [topicId]: !(prev[topicId] ?? true),
    }));
  }

  function handleScenarioSelect(topicName: string, scenario: SampleScenario) {
    setSelectedScenarioId(scenario.id);
    setSelectedScenario({ topicName, scenario });
    // Reset all conversation state when switching scenarios
    stopSpeaking();
    setSpeakingIdx(null);
    setHighlightWordIdx(null);
    speakingIdxRef.current = null;
    setSetup(null);
    setMessages([]);
    setLatestResult(null);
    setError(null);
    setUserLine('');
    setIsEnded(false);
  }

  function handleStartConversation() {
    if (!selectedScenario) return;
    const { topicName, scenario } = selectedScenario;
    handleStart({
      topic: topicName,
      context: scenario.context,
      character: scenario.character,
      openingBotLine: scenario.openingBotLine,
    });
  }

  async function saveScenarioToSampleFolder(nextTopics: SampleTopic[]) {
    const picker = (
      window as Window & { showDirectoryPicker?: () => Promise<any> }
    ).showDirectoryPicker;
    if (!picker) {
      throw new Error(
        'This browser does not support folder writing API. Use Chromium browser to save files.',
      );
    }

    const selectedDir = await picker();
    let sampleDir = selectedDir;
    if (selectedDir.name !== 'sample') {
      sampleDir = await selectedDir.getDirectoryHandle('sample', {
        create: true,
      });
    }

    const indexHandle = await sampleDir.getFileHandle('index.json', {
      create: true,
    });
    const indexWriter = await indexHandle.createWritable();
    await indexWriter.write(JSON.stringify({ topics: nextTopics }, null, 2));
    await indexWriter.close();
  }

  async function createScenario() {
    const topicName = newScenarioForm.topicName.trim();
    const scenarioName = newScenarioForm.scenarioName.trim();
    const context = newScenarioForm.context.trim();
    const character = newScenarioForm.character.trim();
    const openingBotLine = newScenarioForm.openingBotLine.trim();

    if (
      !topicName ||
      !scenarioName ||
      !context ||
      !character ||
      !openingBotLine
    ) {
      setError('Please fill all fields in the create scenario form.');
      return;
    }

    const topicId = newScenarioForm.topicId.trim() || slugify(topicName);
    const scenarioId =
      newScenarioForm.scenarioId.trim() || slugify(scenarioName);

    const newScenario: SampleScenario = {
      id: scenarioId,
      name: scenarioName,
      context,
      character,
      openingBotLine,
    };

    const nextTopics = [...sampleTopics];
    const topicIndex = nextTopics.findIndex((t) => t.id === topicId);

    if (topicIndex >= 0) {
      if (nextTopics[topicIndex].scenarios.some((s) => s.id === scenarioId)) {
        setError('Scenario ID already exists in this topic.');
        return;
      }
      nextTopics[topicIndex] = {
        ...nextTopics[topicIndex],
        name: topicName,
        scenarios: [...nextTopics[topicIndex].scenarios, newScenario],
      };
    } else {
      nextTopics.push({
        id: topicId,
        name: topicName,
        scenarios: [newScenario],
      });
    }

    setSampleTopics(nextTopics);
    setSelectedScenarioId(scenarioId);

    try {
      await saveScenarioToSampleFolder(nextTopics);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Scenario created but save failed.',
      );
    }

    setIsCreateDialogOpen(false);
  }

  return (
    <div className='container'>
      <header>
        <h1>English Conversation Practice</h1>
        <p className='subtitle'>AI-powered evaluation via OpenRouter</p>
      </header>

      <main>
        <div className='dashboard-grid'>
          <section className='sample-library-panel'>
            <div className='sample-library-header'>
              <h2>List Scenario</h2>
              <button className='secondary' onClick={openCreateDialog}>
                Create Scenario
              </button>
            </div>

            <div className='sample-folder-tree'>
              {sampleTopics.map((topic) => (
                <div key={topic.id} className='topic-folder'>
                  <button
                    className='topic-name'
                    onClick={() => toggleTopicOpen(topic.id)}
                  >
                    <span className='folder-icon'>
                      {(topicOpenState[topic.id] ?? true) ? '[-]' : '[+]'}
                    </span>
                    {`Topic ${topic.name}`}
                  </button>
                  {(topicOpenState[topic.id] ?? true) &&
                    topic.scenarios.map((scenario) => (
                      <button
                        key={scenario.id}
                        className={`scenario-file ${selectedScenarioId === scenario.id ? 'active' : ''}`}
                        onClick={() =>
                          handleScenarioSelect(topic.name, scenario)
                        }
                      >
                        {scenario.name}
                      </button>
                    ))}
                </div>
              ))}
            </div>
          </section>

          <section className='overview-card'>
            <h2>Overview</h2>
            <div className='overview-block'>
              <h3>Topic</h3>
              <p>
                {setup?.topic ??
                  selectedScenario?.topicName ??
                  'Select a scenario to start.'}
              </p>
            </div>
            <div className='overview-block'>
              <h3>Context</h3>
              <p>
                {setup?.context ?? selectedScenario?.scenario.context ?? '-'}
              </p>
            </div>
            <div className='overview-block'>
              <h3>Character</h3>
              <p>
                {setup?.character ??
                  selectedScenario?.scenario.character ??
                  '-'}
              </p>
            </div>
            <div className='overview-block'>
              <h3>Conversation Details</h3>
              <p>
                Status: {setup ? (isEnded ? 'Ended' : 'Active') : 'Not started'}
              </p>
              <p>Total messages: {messages.length}</p>
              <p>
                User turns: {messages.filter((m) => m.role === 'user').length}
              </p>
            </div>
            {selectedScenario && !setup && (
              <button
                className='start-conversation-btn'
                onClick={handleStartConversation}
              >
                Start Conversation
              </button>
            )}
            {setup && !isEnded && (
              <button
                className='start-conversation-btn end'
                onClick={handleEndConversation}
              >
                End Conversation
              </button>
            )}
            {setup && isEnded && selectedScenario && (
              <button
                className='start-conversation-btn retry'
                onClick={handleStartConversation}
              >
                Re-try Conversation
              </button>
            )}
          </section>

          <section className='chat-shell'>
            <div className='chat-header'>
              <h2>Conversation</h2>
              <div className='actions'>
                <button
                  className={`secondary mute-toggle ${ttsMuted ? 'muted' : ''}`}
                  onClick={handleToggleMute}
                  title={ttsMuted ? 'Unmute TTS' : 'Mute TTS'}
                  type='button'
                >
                  {ttsMuted ? (
                    <svg
                      xmlns='http://www.w3.org/2000/svg'
                      width='16'
                      height='16'
                      viewBox='0 0 24 24'
                      fill='none'
                      stroke='currentColor'
                      strokeWidth='2'
                      strokeLinecap='round'
                      strokeLinejoin='round'
                    >
                      <polygon points='11 5 6 9 2 9 2 15 6 15 11 19 11 5' />
                      <line x1='23' y1='9' x2='17' y2='15' />
                      <line x1='17' y1='9' x2='23' y2='15' />
                    </svg>
                  ) : (
                    <svg
                      xmlns='http://www.w3.org/2000/svg'
                      width='16'
                      height='16'
                      viewBox='0 0 24 24'
                      fill='none'
                      stroke='currentColor'
                      strokeWidth='2'
                      strokeLinecap='round'
                      strokeLinejoin='round'
                    >
                      <polygon points='11 5 6 9 2 9 2 15 6 15 11 19 11 5' />
                      <path d='M19.07 4.93a10 10 0 0 1 0 14.14' />
                      <path d='M15.54 8.46a5 5 0 0 1 0 7.07' />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            <div
              className='chat-log'
              role='log'
              aria-live='polite'
              ref={chatLogRef}
            >
              {messages.length === 0 && !liveTranscript ? (
                <p className='chat-empty'>
                  Choose a scenario to start the conversation.
                </p>
              ) : (
                <>
                  {messages.map((message, idx) => (
                    <div
                      key={`${message.role}-${idx}`}
                      className={`chat-bubble ${message.role}${speakingIdx === idx ? ' speaking' : ''}`}
                    >
                      <div className='chat-role'>
                        {message.role === 'bot' ? 'Bot' : 'You'}
                        {message.role === 'bot' && (
                          <button
                            className='replay-btn'
                            onClick={() => replayBot(message.text, idx)}
                            title='Play this message'
                            type='button'
                          >
                            <svg
                              xmlns='http://www.w3.org/2000/svg'
                              width='14'
                              height='14'
                              viewBox='0 0 24 24'
                              fill='none'
                              stroke='currentColor'
                              strokeWidth='2'
                              strokeLinecap='round'
                              strokeLinejoin='round'
                            >
                              <polygon points='11 5 6 9 2 9 2 15 6 15 11 19 11 5' />
                              <path d='M15.54 8.46a5 5 0 0 1 0 7.07' />
                            </svg>
                          </button>
                        )}
                      </div>
                      <p>
                        {speakingIdx === idx && highlightWordIdx !== null
                          ? message.text
                              .split(/(\s+)/)
                              .reduce<{
                                wordCount: number;
                                nodes: React.ReactNode[];
                              }>(
                                (acc, token, i) => {
                                  if (/\s+/.test(token)) {
                                    acc.nodes.push(
                                      <span key={i}>{token}</span>,
                                    );
                                  } else {
                                    const isActive =
                                      acc.wordCount === highlightWordIdx;
                                    const isPast =
                                      acc.wordCount < highlightWordIdx;
                                    acc.nodes.push(
                                      <span
                                        key={i}
                                        className={
                                          isActive
                                            ? 'tts-word active'
                                            : isPast
                                              ? 'tts-word past'
                                              : 'tts-word'
                                        }
                                      >
                                        {token}
                                      </span>,
                                    );
                                    acc.wordCount++;
                                  }
                                  return acc;
                                },
                                { wordCount: 0, nodes: [] },
                              ).nodes
                          : message.text}
                      </p>
                    </div>
                  ))}
                  {liveTranscript && (
                    <div className='chat-bubble user live-transcript'>
                      <div className='chat-role'>You (speaking…)</div>
                      <p>{liveTranscript}</p>
                    </div>
                  )}
                  {loading && (
                    <div className='chat-bubble bot thinking'>
                      <div className='chat-role'>Bot</div>
                      <div className='thinking-dots'>
                        <span />
                        <span />
                        <span />
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            <div className='chat-input-row'>
              <SpeechInput
                disabled={!setup || isEnded || loading}
                placeholder={
                  !setup
                    ? 'Select a scenario first.'
                    : isEnded
                      ? 'Conversation ended. Select a scenario to restart.'
                      : 'Click to speak your line.'
                }
                onTranscriptDone={handleTranscriptDone}
                onRecordingStart={handleRecordingStart}
                liveTranscript={liveTranscript}
                setLiveTranscript={setLiveTranscript}
              />
            </div>
          </section>

          <section className='scores-column'>
            <h2>Scores</h2>
            {latestResult ? (
              <ResultPanel result={latestResult} />
            ) : (
              <div className='empty-score-panel'>
                <p>No score yet.</p>
                <p>Submit a line to evaluate.</p>
              </div>
            )}
            {latestResult && (
              <button
                className='secondary reset-btn'
                onClick={handleResetResult}
              >
                Reset Result
              </button>
            )}
          </section>
        </div>

        {isCreateDialogOpen && (
          <div className='dialog-overlay' role='dialog' aria-modal='true'>
            <div className='dialog-card'>
              <h3>Create New Scenario</h3>
              <p>
                Add topic/scenario/character/opening line and save into sample
                folder.
              </p>

              <div className='field'>
                <label htmlFor='topicName'>Topic Name</label>
                <input
                  id='topicName'
                  value={newScenarioForm.topicName}
                  onChange={(e) =>
                    updateNewScenarioField('topicName', e.target.value)
                  }
                />
              </div>
              <div className='field'>
                <label htmlFor='topicId'>Topic ID (optional)</label>
                <input
                  id='topicId'
                  value={newScenarioForm.topicId}
                  onChange={(e) =>
                    updateNewScenarioField('topicId', e.target.value)
                  }
                />
              </div>
              <div className='field'>
                <label htmlFor='scenarioName'>Scenario Name</label>
                <input
                  id='scenarioName'
                  value={newScenarioForm.scenarioName}
                  onChange={(e) =>
                    updateNewScenarioField('scenarioName', e.target.value)
                  }
                />
              </div>
              <div className='field'>
                <label htmlFor='scenarioId'>Scenario ID (optional)</label>
                <input
                  id='scenarioId'
                  value={newScenarioForm.scenarioId}
                  onChange={(e) =>
                    updateNewScenarioField('scenarioId', e.target.value)
                  }
                />
              </div>
              <div className='field'>
                <label htmlFor='newContext'>Scenario / Context</label>
                <textarea
                  id='newContext'
                  rows={3}
                  value={newScenarioForm.context}
                  onChange={(e) =>
                    updateNewScenarioField('context', e.target.value)
                  }
                />
              </div>
              <div className='field'>
                <label htmlFor='newCharacter'>Character Description</label>
                <textarea
                  id='newCharacter'
                  rows={2}
                  value={newScenarioForm.character}
                  onChange={(e) =>
                    updateNewScenarioField('character', e.target.value)
                  }
                />
              </div>
              <div className='field'>
                <label htmlFor='newOpeningBotLine'>Opening Bot Line</label>
                <textarea
                  id='newOpeningBotLine'
                  rows={2}
                  value={newScenarioForm.openingBotLine}
                  onChange={(e) =>
                    updateNewScenarioField('openingBotLine', e.target.value)
                  }
                />
              </div>

              <div className='actions'>
                <button onClick={() => void createScenario()}>
                  Save Scenario
                </button>
                <button className='secondary' onClick={closeCreateDialog}>
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className='result-panel error-panel'>
            <h3>Error</h3>
            <p>{error}</p>
            <button className='secondary' onClick={handleResetResult}>
              Dismiss
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
