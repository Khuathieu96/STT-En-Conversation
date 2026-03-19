import { useState } from 'react';
import type { ParseResult } from '../types/evaluation';

interface Props {
  result: ParseResult;
}

function ScoreBar({ label, value }: { label: string; value: number }) {
  const pct = Math.round(value * 100);
  return (
    <div className='score-row'>
      <span className='score-label'>{label}</span>
      <div className='score-bar-bg'>
        <div className='score-bar-fill' style={{ width: `${pct}%` }} />
      </div>
      <span className='score-value'>{pct}%</span>
    </div>
  );
}

export default function ResultPanel({ result }: Props) {
  const [showRaw, setShowRaw] = useState(false);

  if (!result.ok) {
    return (
      <div className='result-panel error-panel'>
        <h3>Parse Warning</h3>
        <p>{result.error}</p>
        <button className='secondary' onClick={() => setShowRaw((v) => !v)}>
          {showRaw ? 'Hide' : 'Show'} Raw Response
        </button>
        {showRaw && <pre className='raw-response'>{result.raw}</pre>}
      </div>
    );
  }

  const d = result.data;

  return (
    <div className='result-panel'>
      <div className='badge-row'>
        <span className={`badge ${d.is_match ? 'pass' : 'fail'}`}>
          {d.is_match ? 'Pass' : 'Redirect'}
        </span>
        <span className={`badge action-${d.next_action}`}>{d.next_action}</span>
      </div>

      <h3>Scores</h3>
      <ScoreBar label='Topic' value={d.score_topic} />
      <ScoreBar label='Context' value={d.score_context} />
      <ScoreBar label='Character' value={d.score_character} />
      <ScoreBar label='Reply Relevance' value={d.score_prev_reply_relevance} />

      <h3>Feedback (Vietnamese)</h3>
      <p className='feedback'>{d.feedback_short_vi}</p>

      <h3>Suggested User Reply (English)</h3>
      <p className='bot-reply'>{d.suggested_user_reply_en}</p>
    </div>
  );
}
