import { useEffect, useState } from 'react';
import { AlertTriangle, BrainCircuit, CheckCircle2, ChevronRight, Compass, Sparkles } from 'lucide-react';

const api = async (path, options = {}) => {
  const response = await fetch(`/api${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || 'Unable to generate AI insight');
  return body;
};

export default function AIInsightPanel({ title, description, category, priority, onClose }) {
  const [insight, setInsight] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    const generate = async () => {
      try {
        const result = await api('/ai/insights', {
          method: 'POST',
          body: JSON.stringify({ title, description, category, priority }),
        });
        if (active) setInsight(result.insight);
      } catch (requestError) {
        if (active) setError(requestError.message);
      } finally {
        if (active) setLoading(false);
      }
    };
    generate();
    return () => { active = false; };
  }, [title, description, category, priority]);

  if (loading) return <aside className="ai-insight-panel loading"><BrainCircuit /><div><strong>Analyzing civic impact</strong><span>Reviewing risk, route, and response signals…</span></div></aside>;
  if (error) return <aside className="ai-insight-panel error"><AlertTriangle /><div><strong>AI insight unavailable</strong><span>{error}</span></div></aside>;
  if (!insight) return null;

  return (
    <aside className={`ai-insight-panel ${insight.riskLevel}`}>
      <div className="ai-panel-header">
        <span><Sparkles size={18} /></span>
        <div><small>AI impact intelligence</small><strong>{insight.label}</strong></div>
        <button onClick={onClose} aria-label="Close AI insight">×</button>
      </div>
      <div className="risk-score-row">
        <div className="risk-score"><strong>{insight.riskScore}</strong><span>/ 100</span></div>
        <div><small>Predicted impact</small><p>{insight.summary}</p></div>
      </div>
      <div className="ai-metric-grid">
        <div><Compass size={15} /><span>Response</span><strong>{insight.responseWindow}</strong></div>
        <div><CheckCircle2 size={15} /><span>Confidence</span><strong>{insight.confidence}%</strong></div>
      </div>
      <div className="ai-recommendations">
        <strong>Recommended actions</strong>
        {insight.recommendations.map((recommendation) => <p key={recommendation}><ChevronRight size={13} />{recommendation}</p>)}
      </div>
      {insight.signals.length > 0 && <div className="ai-signals"><strong>Detected signals</strong>{insight.signals.join(' • ')}</div>}
    </aside>
  );
}
