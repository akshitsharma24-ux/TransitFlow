import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Bot, ExternalLink, MessageCircle, RotateCcw, SendHorizontal, X } from 'lucide-react';
import { sendChat } from '../api';
import { getLineConfig } from '../utils/lineColors';
import { clock, minutesLabel } from '../utils/time';
import CrowdChip from './CrowdChip';

const STORAGE_KEY = 'transitflow_chat_v1';
const GREETING = {
  id: 0,
  role: 'bot',
  text: "Hi, I'm **TransitBot**. Ask me to plan a trip, check how crowded a station is, or find the best time to leave.",
  suggestions: ['Borivali to Churchgate tomorrow 8:45 am', 'How crowded is Dadar?', 'Any delays right now?', 'What can you do?'],
};

function load() {
  try {
    const saved = JSON.parse(sessionStorage.getItem(STORAGE_KEY));
    if (saved?.messages?.length) return saved;
  } catch { /* storage unavailable or corrupt */ }
  return { messages: [GREETING], context: null };
}

/** **bold** and "- bullet" lines, nothing else, so replies can never inject markup. */
function Rich({ text }) {
  return text.split('\n').map((line, i) => {
    const bullet = line.startsWith('- ');
    const parts = (bullet ? line.slice(2) : line).split(/(\*\*[^*]+\*\*)/g).map((part, j) => (
      part.startsWith('**') && part.endsWith('**') ? <strong key={j} className="text-[#F2F5F7]">{part.slice(2, -2)}</strong> : part
    ));
    return (
      <p key={i} className={bullet ? 'pl-4 relative' : undefined}>
        {bullet && <span className="absolute left-0 text-[#3FCFE0]" aria-hidden>{'\u2022'}</span>}
        {parts}
      </p>
    );
  });
}

function Card({ card }) {
  return (
    <div className="mt-2 rounded-xl border border-[#3FCFE0]/25 bg-[#0B1622]/80 p-3 space-y-2">
      <div className="flex items-center justify-between gap-2 font-mono">
        <span className="text-sm font-bold text-[#F2F5F7] tabular-nums">{clock(card.depart)} {'→'} {clock(card.arrive)}</span>
        <span className="text-xs text-slate-300">{minutesLabel(card.duration_minutes)} {'·'} <span className="text-[#3FCFE0]">{'₹'}{card.cost_rupees}</span></span>
      </div>
      <ul className="space-y-1">
        {card.steps.map((s, i) => {
          const conf = getLineConfig(s.line, s.mode);
          const dot = s.kind === 'ride' ? conf.color : '#64748b';
          return (
            <li key={i} className="flex items-center gap-2 text-[11px] text-slate-300">
              <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: dot }} />
              <span className="font-mono text-slate-500 tabular-nums">{clock(s.start)}</span>
              <span className="truncate">
                {s.kind === 'ride' ? `${s.line || s.mode}: ${s.from} → ${s.to}` : s.kind === 'wait' ? `Wait at ${s.from}` : `Walk (${s.minutes} min)`}
              </span>
              {s.crowd_level && <span className="ml-auto text-[10px] font-mono shrink-0" style={{ color: dot === '#64748b' ? undefined : conf.color }}>{s.crowd_level}</span>}
            </li>
          );
        })}
      </ul>
      <CrowdChip level={card.crowd_level} index={card.crowd_index} size="sm" />
    </div>
  );
}

export default function ChatAssistant({ onOpenPlanner, onNavigate }) {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState(load);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const listRef = useRef(null);
  const inputRef = useRef(null);
  const idRef = useRef(state.messages.reduce((m, x) => Math.max(m, x.id), 0) + 1);

  useEffect(() => {
    try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch { /* storage unavailable */ }
  }, [state]);

  useEffect(() => {
    if (!open) return undefined;
    const t = setTimeout(() => inputRef.current?.focus(), 150);
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => { clearTimeout(t); window.removeEventListener('keydown', onKey); };
  }, [open]);

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [state.messages, busy, open]);

  const push = (message) => setState((s) => ({ ...s, messages: [...s.messages, { id: idRef.current++, ...message }] }));

  const ask = useCallback(async (text) => {
    const message = text.trim();
    if (!message || busy) return;
    setInput('');
    push({ role: 'user', text: message });
    setBusy(true);
    try {
      const res = await sendChat(message, state.context);
      setState((s) => ({
        context: res.context,
        messages: [...s.messages, { id: idRef.current++, role: 'bot', text: res.reply, card: res.card, actions: res.actions, suggestions: res.suggestions }],
      }));
    } catch {
      push({ role: 'bot', text: "I couldn't reach the server just now. Please try again in a moment.", suggestions: [] });
    } finally {
      setBusy(false);
    }
  }, [busy, state.context]);

  const reset = () => { setState({ messages: [GREETING], context: null }); idRef.current = 1; };

  const runAction = (action) => {
    if (action.type === 'open_planner') { onOpenPlanner?.(action.params); setOpen(false); }
    if (action.type === 'navigate') { onNavigate?.(action.view); setOpen(false); }
  };

  const last = state.messages[state.messages.length - 1];

  return (
    <>
      <AnimatePresence>
        {!open && (
          <motion.button
            key="fab"
            type="button"
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.6, opacity: 0 }}
            whileHover={{ scale: 1.06 }}
            onClick={() => setOpen(true)}
            aria-label="Open TransitBot assistant"
            className="fixed bottom-5 right-5 z-[60] flex items-center gap-2 pl-4 pr-5 py-3 rounded-full bg-gradient-to-r from-[#3FCFE0] to-[#2BB5C6] text-[#0B1622] font-display font-bold text-sm shadow-[0_8px_30px_rgba(63,207,224,0.5)] cursor-pointer"
          >
            <MessageCircle className="w-5 h-5" />Ask TransitBot
          </motion.button>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {open && (
          <motion.section
            key="panel"
            role="dialog"
            aria-label="TransitBot assistant"
            initial={{ opacity: 0, y: 24, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.97 }}
            transition={{ duration: 0.2 }}
            className="fixed z-[70] inset-x-2 bottom-2 h-[80vh] sm:inset-x-auto sm:right-5 sm:bottom-5 sm:w-[390px] sm:h-[600px] max-h-[calc(100vh-1rem)] flex flex-col rounded-3xl border border-[#3FCFE0]/40 bg-[#0B1622]/98 backdrop-blur-2xl shadow-[0_24px_70px_rgba(0,0,0,0.7)] overflow-hidden"
          >
            <header className="flex items-center gap-3 px-4 py-3 border-b border-slate-800 bg-[#101B28]">
              <span className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#3FCFE0] to-[#E8A94D] text-[#0B1622] flex items-center justify-center"><Bot className="w-5 h-5" /></span>
              <div className="min-w-0">
                <div className="text-sm font-bold font-display text-[#F2F5F7]">TransitBot</div>
                <div className="text-[10px] font-mono text-slate-400">Rule-based assistant {'·'} no external AI</div>
              </div>
              <button type="button" onClick={reset} aria-label="Start a new conversation" title="New conversation" className="ml-auto p-2 rounded-lg text-slate-400 hover:text-[#3FCFE0] cursor-pointer"><RotateCcw className="w-4 h-4" /></button>
              <button type="button" onClick={() => setOpen(false)} aria-label="Close assistant" className="p-2 rounded-lg text-slate-400 hover:text-[#F2F5F7] cursor-pointer"><X className="w-4 h-4" /></button>
            </header>

            <div ref={listRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3" aria-live="polite">
              {state.messages.map((m) => (
                <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[88%] rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed space-y-1 ${
                    m.role === 'user'
                      ? 'bg-[#3FCFE0] text-[#0B1622] rounded-br-md font-medium'
                      : 'bg-[#101B28] border border-slate-800 text-slate-200 rounded-bl-md'}`}>
                    {m.role === 'user' ? m.text : <Rich text={m.text} />}
                    {m.card && <Card card={m.card} />}
                    {m.actions?.map((a) => (
                      <button key={a.label} type="button" onClick={() => runAction(a)}
                        className="mt-2 flex items-center gap-1.5 text-xs font-mono px-3 py-1.5 rounded-lg bg-[#3FCFE0]/15 border border-[#3FCFE0]/40 text-[#3FCFE0] hover:bg-[#3FCFE0]/25 cursor-pointer transition-colors">
                        <ExternalLink className="w-3 h-3" />{a.label}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
              {busy && (
                <div className="flex justify-start" aria-label="TransitBot is typing">
                  <div className="bg-[#101B28] border border-slate-800 rounded-2xl rounded-bl-md px-4 py-3 flex gap-1">
                    {[0, 1, 2].map((i) => <span key={i} className="w-1.5 h-1.5 rounded-full bg-[#3FCFE0] animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />)}
                  </div>
                </div>
              )}
            </div>

            {last?.role === 'bot' && last.suggestions?.length > 0 && !busy && (
              <div className="px-4 pb-2 flex gap-1.5 overflow-x-auto">
                {last.suggestions.map((s) => (
                  <button key={s} type="button" onClick={() => ask(s)}
                    className="shrink-0 text-[11px] font-mono px-3 py-1.5 rounded-full bg-[#101B28] border border-slate-700 text-slate-300 hover:border-[#3FCFE0]/60 hover:text-[#3FCFE0] cursor-pointer transition-colors">
                    {s}
                  </button>
                ))}
              </div>
            )}

            <form onSubmit={(e) => { e.preventDefault(); ask(input); }} className="flex items-center gap-2 p-3 border-t border-slate-800 bg-[#101B28]">
              <input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                maxLength={500}
                placeholder="e.g. Andheri to BKC at 9 am"
                aria-label="Message TransitBot"
                className="flex-1 px-3.5 py-2.5 bg-[#0B1622] border border-[#3FCFE0]/20 focus:border-[#3FCFE0] rounded-xl text-sm text-[#F2F5F7] placeholder-slate-500 outline-none"
              />
              <button type="submit" disabled={busy || !input.trim()} aria-label="Send"
                className="p-2.5 rounded-xl bg-[#3FCFE0] text-[#0B1622] disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"><SendHorizontal className="w-4 h-4" /></button>
            </form>
          </motion.section>
        )}
      </AnimatePresence>
    </>
  );
}
