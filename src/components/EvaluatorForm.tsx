import { useEffect, useState } from "react";
import type { ConversationSetup } from "../types/evaluation";

const SAMPLE_DATA: ConversationSetup = {
  topic: "Restaurant Conversations",
  context: "You are at a casual Vietnamese restaurant and the waiter asks what you want to order.",
  character: "Friendly waiter speaking simple English to help a learner.",
  openingBotLine: "Welcome. What would you like to have today?",
};

interface Props {
  onStart: (setup: ConversationSetup) => void;
  loading: boolean;
  presetSetup?: ConversationSetup | null;
}

export default function EvaluatorForm({ onStart, loading, presetSetup }: Props) {
  const [setup, setSetup] = useState<ConversationSetup>({
    topic: "",
    context: "",
    character: "",
    openingBotLine: "",
  });

  useEffect(() => {
    if (presetSetup) {
      setSetup(presetSetup);
    }
  }, [presetSetup]);

  const allFilled =
    setup.topic.trim() &&
    setup.context.trim() &&
    setup.character.trim() &&
    setup.openingBotLine.trim();

  function update(field: keyof ConversationSetup, value: string) {
    setSetup((prev) => ({ ...prev, [field]: value }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!allFilled || loading) return;
    onStart(setup);
  }

  return (
    <form className="form" onSubmit={handleSubmit}>
      <div className="field">
        <label htmlFor="topic">Topic</label>
        <input id="topic" value={setup.topic} onChange={(e) => update("topic", e.target.value)} />
      </div>

      <div className="field">
        <label htmlFor="context">Context / Scenario</label>
        <textarea id="context" rows={3} value={setup.context} onChange={(e) => update("context", e.target.value)} />
      </div>

      <div className="field">
        <label htmlFor="character">Character Description</label>
        <textarea id="character" rows={2} value={setup.character} onChange={(e) => update("character", e.target.value)} />
      </div>

      <div className="field">
        <label htmlFor="openingBotLine">Opening Bot Line</label>
        <textarea id="openingBotLine" rows={2} value={setup.openingBotLine} onChange={(e) => update("openingBotLine", e.target.value)} />
      </div>

      <div className="actions">
        <button type="submit" disabled={!allFilled || loading}>{loading ? "Starting..." : "Start Conversation"}</button>
        <button type="button" className="secondary" onClick={() => setSetup(SAMPLE_DATA)}>Try Sample Data</button>
      </div>
    </form>
  );
}
