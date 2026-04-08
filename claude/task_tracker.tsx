import { useState, useRef, useEffect } from "react";

const PRIORITIES = ["High", "Medium", "Low"];
const STATUSES = ["To Do", "In Progress", "Done"];
const priorityOrder = { High: 0, Medium: 1, Low: 2 };
const statusOrder = { "To Do": 0, "In Progress": 1, Done: 2 };

const priorityStyle = {
  High:   { bg: "#FEE2E2", text: "#991B1B", border: "#FCA5A5" },
  Medium: { bg: "#FEF3C7", text: "#92400E", border: "#FCD34D" },
  Low:    { bg: "#D1FAE5", text: "#065F46", border: "#6EE7B7" },
};
const statusStyle = {
  "To Do":       { bg: "#F3F4F6", text: "#374151", border: "#D1D5DB" },
  "In Progress": { bg: "#DBEAFE", text: "#1E40AF", border: "#93C5FD" },
  Done:          { bg: "#D1FAE5", text: "#065F46", border: "#6EE7B7" },
};

function genId() { return Math.random().toString(36).slice(2); }
function formatDuration(ms) {
  if (!ms || ms < 0) return "0m";
  const m = Math.floor(ms / 60000);
  if (m < 60) return `${m}m`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}
function linkify(text) {
  if (!text) return null;
  return text.split(/(https?:\/\/[^\s]+)/g).map((p, i) =>
    p.match(/^https?:\/\//)
      ? <a key={i} href={p} target="_blank" rel="noopener noreferrer" style={{ color: "#1D4ED8", textDecoration: "underline", wordBreak: "break-all" }}>{p}</a>
      : p
  );
}

function Badge({ label, style }) {
  return (
    <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 9px", borderRadius: 20,
      background: style.bg, color: style.text, border: `1px solid ${style.border}`, whiteSpace: "nowrap" }}>
      {label}
    </span>
  );
}

function ConfirmDialog({ message, confirmLabel = "Confirm", confirmColor = "#DC2626", onConfirm, onCancel }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 400, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ background: "#fff", borderRadius: 14, width: "100%", maxWidth: 360, padding: 28, border: "1px solid #E5E7EB", boxShadow: "0 8px 32px rgba(0,0,0,0.18)" }}>
        <div style={{ fontSize: 22, marginBottom: 12 }}>⚠️</div>
        <div style={{ fontSize: 15, fontWeight: 600, color: "#111827", marginBottom: 8 }}>Are you sure?</div>
        <div style={{ fontSize: 13, color: "#6B7280", marginBottom: 24, lineHeight: 1.6 }}>{message}</div>
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button onClick={onCancel} style={{ padding: "8px 18px", fontSize: 13, background: "#F3F4F6", color: "#374151", border: "1.5px solid #D1D5DB", borderRadius: 8, cursor: "pointer", fontWeight: 500 }}>Cancel</button>
          <button onClick={onConfirm} style={{ padding: "8px 18px", fontSize: 13, background: confirmColor, color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 700 }}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}

function Modal({ title, onClose, children, maxWidth = 520, titleRight }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: "#fff", borderRadius: 14, width: "100%", maxWidth, maxHeight: "90vh", overflowY: "auto", boxShadow: "0 8px 32px rgba(0,0,0,0.18)", border: "1px solid #E5E7EB" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 20px", borderBottom: "1px solid #E5E7EB", gap: 10 }}>
          <span style={{ fontSize: 15, fontWeight: 600, color: "#111827", flex: 1 }}>{title}</span>
          {titleRight}
          <button onClick={onClose} style={{ background: "#F3F4F6", border: "1px solid #D1D5DB", borderRadius: 8, padding: "4px 12px", fontSize: 13, color: "#374151", cursor: "pointer" }}>Close</button>
        </div>
        <div style={{ padding: 20 }}>{children}</div>
      </div>
    </div>
  );
}

const inputStyle = { width: "100%", fontSize: 13, padding: "8px 10px", borderRadius: 8, border: "1.5px solid #D1D5DB", background: "#F9FAFB", color: "#111827", boxSizing: "border-box", outline: "none" };

function TimerWidget({ elapsed, running, onStart, onStop, onReset }) {
  const [display, setDisplay] = useState(elapsed);
  const startTs = useRef(null);
  useEffect(() => {
    let iv;
    if (running) {
      startTs.current = Date.now() - elapsed;
      iv = setInterval(() => setDisplay(Date.now() - startTs.current), 500);
    } else { setDisplay(elapsed); }
    return () => clearInterval(iv);
  }, [running, elapsed]);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <span style={{ fontSize: 18, fontWeight: 700, color: "#111827", minWidth: 52 }}>{formatDuration(display)}</span>
      {!running
        ? <button onClick={onStart} style={{ fontSize: 12, padding: "5px 14px", background: "#1D4ED8", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 600 }}>Start</button>
        : <button onClick={onStop} style={{ fontSize: 12, padding: "5px 14px", background: "#DC2626", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 600 }}>Stop</button>}
      <button onClick={onReset} style={{ fontSize: 12, padding: "5px 12px", background: "#F3F4F6", color: "#374151", border: "1px solid #D1D5DB", borderRadius: 8, cursor: "pointer" }}>Reset</button>
    </div>
  );
}

function ViewModal({ task, onEdit, onClose }) {
  const totalTime = (task.elapsed || 0) + task.subtasks.reduce((s, t) => s + (t.elapsed || 0), 0);
  const subDone = task.subtasks.filter(s => s.status === "Done").length;
  return (
    <Modal title={task.title || "Untitled"} onClose={onClose}
      titleRight={<button onClick={onEdit} style={{ fontSize: 12, fontWeight: 600, padding: "5px 14px", background: "#1D4ED8", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer" }}>Edit</button>}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
        <Badge label={task.priority} style={priorityStyle[task.priority]} />
        <Badge label={task.status} style={statusStyle[task.status]} />
        {task.dueDate && <span style={{ fontSize: 12, color: "#6B7280", background: "#F3F4F6", border: "1px solid #E5E7EB", borderRadius: 6, padding: "2px 10px" }}>Due: {task.dueDate}</span>}
        {totalTime > 0 && <span style={{ fontSize: 12, fontWeight: 600, color: "#1E40AF", background: "#EFF6FF", border: "1px solid #BFDBFE", borderRadius: 6, padding: "2px 10px" }}>{formatDuration(totalTime)} tracked</span>}
      </div>
      {task.notes ? (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Notes</div>
          <div style={{ fontSize: 13, color: "#374151", lineHeight: 1.7, whiteSpace: "pre-wrap", wordBreak: "break-word", background: "#F9FAFB", border: "1.5px solid #E5E7EB", borderRadius: 8, padding: "10px 12px" }}>
            {linkify(task.notes)}
          </div>
        </div>
      ) : (
        <div style={{ fontSize: 13, color: "#9CA3AF", marginBottom: 16, fontStyle: "italic" }}>No notes — click Edit to add some.</div>
      )}
      {task.subtasks.length > 0 && (
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Subtasks ({subDone}/{task.subtasks.length})</div>
          <div style={{ border: "1.5px solid #E5E7EB", borderRadius: 10, overflow: "hidden" }}>
            {task.subtasks.map((sub, i) => (
              <div key={sub.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 12px",
                borderBottom: i < task.subtasks.length - 1 ? "1px solid #F3F4F6" : "none",
                background: i % 2 === 0 ? "#FAFAFA" : "#fff" }}>
                <span style={{ fontSize: 13, color: sub.status === "Done" ? "#9CA3AF" : "#374151", flex: 1, textDecoration: sub.status === "Done" ? "line-through" : "none" }}>{sub.title}</span>
                <Badge label={sub.priority} style={priorityStyle[sub.priority]} />
                <Badge label={sub.status} style={statusStyle[sub.status]} />
              </div>
            ))}
          </div>
        </div>
      )}
    </Modal>
  );
}

function EditModal({ task, onSave, onClose }) {
  const titleRef = useRef(null);
  const notesRef = useRef(null);
  const priorityRef = useRef(null);
  const statusRef = useRef(null);
  const dueDateRef = useRef(null);
  const [elapsed, setElapsed] = useState(task.elapsed || 0);
  const [running, setRunning] = useState(false);
  const [startTs, setStartTs] = useState(null);
  const [subtasks, setSubtasks] = useState(task.subtasks || []);
  const [newSub, setNewSub] = useState("");

  useEffect(() => { titleRef.current?.focus(); }, []);

  const getForm = () => ({
    ...task,
    title: titleRef.current?.value || "",
    notes: notesRef.current?.value || "",
    priority: priorityRef.current?.value || "Medium",
    status: statusRef.current?.value || "To Do",
    dueDate: dueDateRef.current?.value || "",
    elapsed, running, startTs, subtasks,
  });

  const startTimer = () => { setRunning(true); setStartTs(Date.now() - elapsed); };
  const stopTimer = () => { setRunning(false); setElapsed(Date.now() - (startTs || Date.now())); setStartTs(null); };
  const resetTimer = () => { setRunning(false); setElapsed(0); setStartTs(null); };

  const addSub = () => {
    if (!newSub.trim()) return;
    setSubtasks(prev => [...prev, { id: genId(), title: newSub.trim(), priority: "Medium", status: "To Do", elapsed: 0, running: false }]);
    setNewSub("");
  };
  const updateSub = (i, patch) => setSubtasks(prev => prev.map((s, idx) => idx === i ? { ...s, ...patch } : s));
  const deleteSub = i => setSubtasks(prev => prev.filter((_, idx) => idx !== i));

  const totalTime = elapsed + subtasks.reduce((s, t) => s + (t.elapsed || 0), 0);

  const Field = ({ label, children }) => (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 5 }}>{label}</div>
      {children}
    </div>
  );

  return (
    <Modal title={task._isNew ? "New task" : `Edit — ${task.title || "Untitled"}`} onClose={() => { if (titleRef.current?.value.trim()) onSave(getForm()); onClose(); }}>
      <Field label="Title">
        <input ref={titleRef} defaultValue={task.title || ""} style={inputStyle} placeholder="Task title" />
      </Field>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 5 }}>Priority</div>
          <select ref={priorityRef} defaultValue={task.priority || "Medium"} style={{ ...inputStyle, cursor: "pointer" }}>
            {PRIORITIES.map(o => <option key={o}>{o}</option>)}
          </select>
        </div>
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 5 }}>Status</div>
          <select ref={statusRef} defaultValue={task.status || "To Do"} style={{ ...inputStyle, cursor: "pointer" }}>
            {STATUSES.map(o => <option key={o}>{o}</option>)}
          </select>
        </div>
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 5 }}>Due date</div>
          <input ref={dueDateRef} type="date" defaultValue={task.dueDate || ""} style={{ ...inputStyle, cursor: "pointer" }} />
        </div>
      </div>
      <Field label="Notes">
        <textarea ref={notesRef} defaultValue={task.notes || ""} style={{ ...inputStyle, resize: "vertical", minHeight: 80 }} placeholder="Add notes, links, or details..." />
      </Field>
      <Field label="Time tracked">
        <TimerWidget elapsed={elapsed} running={running} onStart={startTimer} onStop={stopTimer} onReset={resetTimer} />
        {totalTime > 0 && <div style={{ fontSize: 11, color: "#6B7280", marginTop: 4 }}>Total incl. subtasks: {formatDuration(totalTime)}</div>}
      </Field>
      <Field label="Subtasks">
        <div style={{ border: "1.5px solid #E5E7EB", borderRadius: 10, overflow: "hidden", marginBottom: 8 }}>
          {subtasks.length === 0 && <div style={{ padding: "12px 14px", fontSize: 13, color: "#9CA3AF" }}>No subtasks yet</div>}
          {subtasks.map((sub, i) => (
            <div key={sub.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 12px",
              borderBottom: i < subtasks.length - 1 ? "1px solid #F3F4F6" : "none",
              background: i % 2 === 0 ? "#FAFAFA" : "#fff" }}>
              <input type="checkbox" checked={sub.status === "Done"} onChange={e => updateSub(i, { status: e.target.checked ? "Done" : "To Do" })} style={{ width: 15, height: 15, cursor: "pointer" }} />
              <input defaultValue={sub.title} onBlur={e => updateSub(i, { title: e.target.value })}
                style={{ flex: 1, border: "none", background: "transparent", fontSize: 13, color: sub.status === "Done" ? "#9CA3AF" : "#111827", outline: "none", textDecoration: sub.status === "Done" ? "line-through" : "none" }} />
              <select defaultValue={sub.priority} onChange={e => updateSub(i, { priority: e.target.value })}
                style={{ fontSize: 11, padding: "2px 4px", border: "1px solid #E5E7EB", borderRadius: 6, background: "#fff", color: "#374151", cursor: "pointer" }}>
                {PRIORITIES.map(p => <option key={p}>{p}</option>)}
              </select>
              <Badge label={sub.priority} style={priorityStyle[sub.priority]} />
              <button onClick={() => deleteSub(i)} style={{ fontSize: 12, padding: "2px 8px", color: "#DC2626", background: "#FEE2E2", border: "1px solid #FCA5A5", borderRadius: 6, cursor: "pointer" }}>✕</button>
            </div>
          ))}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <input value={newSub} onChange={e => setNewSub(e.target.value)} onKeyDown={e => e.key === "Enter" && addSub()}
            placeholder="Add subtask and press Enter..." style={{ ...inputStyle, flex: 1 }} />
          <button onClick={addSub} style={{ padding: "8px 16px", fontSize: 13, fontWeight: 600, background: "#1D4ED8", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer" }}>Add</button>
        </div>
      </Field>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, paddingTop: 8, borderTop: "1px solid #F3F4F6" }}>
        <button onClick={onClose} style={{ padding: "8px 18px", fontSize: 13, background: "#F3F4F6", color: "#374151", border: "1px solid #D1D5DB", borderRadius: 8, cursor: "pointer" }}>Discard</button>
        <button onClick={() => { if (titleRef.current?.value.trim()) onSave(getForm()); onClose(); }} style={{ padding: "8px 20px", fontSize: 13, fontWeight: 600, background: "#1D4ED8", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer" }}>Save task</button>
      </div>
    </Modal>
  );
}

function ExportModal({ tasks, archived, onClose }) {
  const [copied, setCopied] = useState(false);
  const json = JSON.stringify({ tasks, archived }, null, 2);
  const copy = () => {
    navigator.clipboard.writeText(json).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  };
  return (
    <Modal title="Export JSON" onClose={onClose} maxWidth={600}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <span style={{ fontSize: 12, color: "#6B7280" }}>Copy and paste into a <code>.json</code> file for Google Drive backup.</span>
        <button onClick={copy} style={{ fontSize: 12, fontWeight: 700, padding: "6px 16px", background: copied ? "#D1FAE5" : "#1D4ED8", color: copied ? "#065F46" : "#fff", border: copied ? "1px solid #6EE7B7" : "none", borderRadius: 8, cursor: "pointer", whiteSpace: "nowrap", marginLeft: 12 }}>
          {copied ? "Copied!" : "Copy to clipboard"}
        </button>
      </div>
      <pre style={{ background: "#F9FAFB", border: "1.5px solid #E5E7EB", borderRadius: 10, padding: 14, fontSize: 12, color: "#374151", overflowX: "auto", overflowY: "auto", maxHeight: 400, margin: 0, fontFamily: "monospace", lineHeight: 1.6 }}>{json}</pre>
    </Modal>
  );
}

function AIAddModal({ onTasksReady, onClose }) {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState("");
  const textareaRef = useRef(null);
  useEffect(() => { textareaRef.current?.focus(); }, []);

  const parse = async () => {
    if (!input.trim()) return;
    setLoading(true); setError(""); setPreview(null);
    const today = new Date().toISOString().slice(0, 10);
    const prompt = `Today is ${today}. Extract one or more tasks from the text below and return ONLY a valid JSON array. No explanation, no markdown, no backticks — raw JSON only.

Each task object must have exactly these fields:
- id: a random 8-char alphanumeric string
- title: string
- priority: one of "High", "Medium", "Low"
- status: one of "To Do", "In Progress", "Done" — default "To Do"
- dueDate: "YYYY-MM-DD" if mentioned, else ""
- notes: any extra context beyond the title, else ""
- elapsed: 0
- running: false
- startTs: null
- subtasks: array, each with { id, title, priority, status, elapsed, running }

Text: """${input}"""`;

    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens: 1000, messages: [{ role: "user", content: prompt }] })
      });
      const data = await res.json();
      const text = data.content?.find(b => b.type === "text")?.text || "";
      const parsed = JSON.parse(text.replace(/```json|```/gi, "").trim());
      if (!Array.isArray(parsed) || !parsed.length) throw new Error();
      setPreview(parsed);
    } catch { setError("Couldn't parse tasks. Try rephrasing or being more specific."); }
    setLoading(false);
  };

  return (
    <Modal title="Add tasks with AI" onClose={onClose} maxWidth={560}>
      <div style={{ fontSize: 13, color: "#6B7280", marginBottom: 14, lineHeight: 1.6 }}>
        Paste text from any chat, list, or message — AI will extract and format tasks for you.
      </div>
      <textarea ref={textareaRef} value={input} onChange={e => { setInput(e.target.value); setPreview(null); setError(""); }}
        onKeyDown={e => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) parse(); }}
        placeholder={"E.g.\n\"Review the Istio circuit breaker fix — high priority, due Friday\nWrite unit tests for the Wasm extension, medium priority\""}
        rows={5} style={{ ...inputStyle, resize: "vertical", lineHeight: 1.6, marginBottom: 10 }} />
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <button onClick={parse} disabled={loading || !input.trim()}
          style={{ padding: "9px 20px", fontSize: 13, fontWeight: 700, background: loading ? "#93C5FD" : "#1D4ED8", color: "#fff", border: "none", borderRadius: 8, cursor: loading ? "not-allowed" : "pointer" }}>
          {loading ? "Parsing…" : "✦ Parse with AI"}
        </button>
        <span style={{ fontSize: 12, color: "#9CA3AF", alignSelf: "center" }}>or Cmd/Ctrl+Enter</span>
      </div>
      {error && <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8, padding: "10px 14px", fontSize: 13, color: "#DC2626", marginBottom: 12 }}>{error}</div>}
      {preview && (
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: "#065F46", background: "#D1FAE5", border: "1px solid #6EE7B7", borderRadius: 8, padding: "8px 14px", marginBottom: 12 }}>
            Found {preview.length} task{preview.length > 1 ? "s" : ""} — review before adding
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
            {preview.map((t, i) => (
              <div key={i} style={{ background: "#F9FAFB", border: "1.5px solid #E5E7EB", borderLeft: `4px solid ${priorityStyle[t.priority]?.border || "#D1D5DB"}`, borderRadius: 10, padding: "11px 14px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: t.notes ? 4 : 0 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "#111827", flex: 1 }}>{t.title}</span>
                  <Badge label={t.priority} style={priorityStyle[t.priority] || priorityStyle.Medium} />
                  <Badge label={t.status} style={statusStyle[t.status] || statusStyle["To Do"]} />
                  {t.dueDate && <span style={{ fontSize: 11, color: "#6B7280", background: "#F3F4F6", border: "1px solid #E5E7EB", borderRadius: 6, padding: "2px 8px" }}>{t.dueDate}</span>}
                </div>
                {t.notes && <div style={{ fontSize: 12, color: "#6B7280" }}>{t.notes}</div>}
                {t.subtasks?.length > 0 && t.subtasks.map((s, j) => (
                  <div key={j} style={{ fontSize: 12, color: "#374151", display: "flex", alignItems: "center", gap: 6, paddingTop: 3 }}>
                    <span style={{ color: "#9CA3AF" }}>↳</span> {s.title} <Badge label={s.priority} style={priorityStyle[s.priority] || priorityStyle.Medium} />
                  </div>
                ))}
              </div>
            ))}
          </div>
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button onClick={() => setPreview(null)} style={{ padding: "8px 18px", fontSize: 13, background: "#F3F4F6", color: "#374151", border: "1px solid #D1D5DB", borderRadius: 8, cursor: "pointer" }}>Re-parse</button>
            <button onClick={() => { onTasksReady(preview); onClose(); }}
              style={{ padding: "8px 22px", fontSize: 13, fontWeight: 700, background: "#1D4ED8", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer" }}>
              Add {preview.length} task{preview.length > 1 ? "s" : ""} →
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}

function ArchiveModal({ archived, onRestore, onDeleteForever, onClose }) {
  const [confirm, setConfirm] = useState(null);
  return (
    <Modal title={`Archive (${archived.length})`} onClose={onClose} maxWidth={600}>
      {confirm && <ConfirmDialog message={`"${confirm.title || "Untitled"}" will be permanently deleted and cannot be recovered.`} confirmLabel="Delete forever" onConfirm={() => { onDeleteForever(confirm.id); setConfirm(null); }} onCancel={() => setConfirm(null)} />}
      {archived.length === 0 && <div style={{ textAlign: "center", color: "#9CA3AF", padding: "2rem 0", fontSize: 14 }}>Archive is empty</div>}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {archived.map(task => (
          <div key={task.id} style={{ background: "#F9FAFB", border: "1.5px solid #E5E7EB", borderRadius: 10, padding: "12px 14px", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: "#6B7280", flex: 1, textDecoration: "line-through" }}>{task.title || "Untitled"}</span>
            <Badge label={task.priority} style={priorityStyle[task.priority]} />
            {task.dueDate && <span style={{ fontSize: 11, color: "#9CA3AF" }}>{task.dueDate}</span>}
            <span style={{ fontSize: 11, color: "#9CA3AF" }}>archived {task.archivedAt}</span>
            <button onClick={() => onRestore(task.id)} style={{ fontSize: 12, padding: "4px 12px", background: "#EFF6FF", color: "#1D4ED8", border: "1px solid #BFDBFE", borderRadius: 7, cursor: "pointer", fontWeight: 600 }}>Restore</button>
            <button onClick={() => setConfirm(task)} style={{ fontSize: 12, padding: "4px 12px", background: "#FEF2F2", color: "#DC2626", border: "1px solid #FECACA", borderRadius: 7, cursor: "pointer", fontWeight: 600 }}>Delete forever</button>
          </div>
        ))}
      </div>
    </Modal>
  );
}

function newTask() {
  return { id: genId(), title: "", priority: "Medium", status: "To Do", dueDate: "", notes: "", elapsed: 0, running: false, startTs: null, subtasks: [], _isNew: true };
}

export default function App() {
  const [tasks, setTasks] = useState([]);
  const [archived, setArchived] = useState([]);
  const [storageReady, setStorageReady] = useState(false);
  const [viewTask, setViewTask] = useState(null);
  const [editTask, setEditTask] = useState(null);
  const [showArchive, setShowArchive] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [showAI, setShowAI] = useState(false);
  const [confirmArchive, setConfirmArchive] = useState(null);
  const [sortBy, setSortBy] = useState("priority");
  const [filterPriority, setFilterPriority] = useState("All");
  const [filterStatus, setFilterStatus] = useState("All");
  const fileRef = useRef(null);

  useEffect(() => {
    (async () => {
      try {
        const t = await window.storage.get("tasks");
        const a = await window.storage.get("archived");
        if (t) setTasks(JSON.parse(t.value));
        if (a) setArchived(JSON.parse(a.value));
      } catch {}
      setStorageReady(true);
    })();
  }, []);

  useEffect(() => {
    if (!storageReady) return;
    window.storage.set("tasks", JSON.stringify(tasks)).catch(() => {});
  }, [tasks, storageReady]);

  useEffect(() => {
    if (!storageReady) return;
    window.storage.set("archived", JSON.stringify(archived)).catch(() => {});
  }, [archived, storageReady]);

  const saveTask = form => {
    const clean = { ...form }; delete clean._isNew;
    setTasks(prev => prev.find(t => t.id === clean.id) ? prev.map(t => t.id === clean.id ? clean : t) : [...prev, clean]);
    setViewTask(clean);
    setEditTask(null);
  };

  const addTasksBulk = newTasks => setTasks(prev => [...prev, ...newTasks]);

  const archiveTask = (e, id) => {
    e.stopPropagation();
    const task = tasks.find(t => t.id === id);
    if (!task) return;
    setConfirmArchive(task);
  };

  const confirmDoArchive = () => {
    const task = confirmArchive;
    setArchived(prev => [{ ...task, archivedAt: new Date().toISOString().slice(0, 10) }, ...prev]);
    setTasks(prev => prev.filter(t => t.id !== task.id));
    if (viewTask?.id === task.id) setViewTask(null);
    setConfirmArchive(null);
  };

  const restoreTask = id => {
    const task = archived.find(t => t.id === id);
    if (!task) return;
    const { archivedAt, ...clean } = task;
    setTasks(prev => [...prev, clean]);
    setArchived(prev => prev.filter(t => t.id !== id));
  };

  const toggleDone = (e, task) => {
    e.stopPropagation();
    const updated = { ...task, status: task.status === "Done" ? "To Do" : "Done" };
    setTasks(prev => prev.map(t => t.id === task.id ? updated : t));
    if (viewTask?.id === task.id) setViewTask(updated);
  };

  const importJSON = e => {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const data = JSON.parse(ev.target.result);
        if (Array.isArray(data)) setTasks(data);
        else { if (data.tasks) setTasks(data.tasks); if (data.archived) setArchived(data.archived); }
      } catch { alert("Invalid JSON file"); }
    };
    reader.readAsText(file); e.target.value = "";
  };

  const sorted = [...tasks]
    .filter(t => (filterPriority === "All" || t.priority === filterPriority) && (filterStatus === "All" || t.status === filterStatus))
    .sort((a, b) => {
      if (sortBy === "priority") return priorityOrder[a.priority] - priorityOrder[b.priority] || statusOrder[a.status] - statusOrder[b.status];
      if (sortBy === "status") return statusOrder[a.status] - statusOrder[b.status];
      if (sortBy === "dueDate") return (a.dueDate || "9999") < (b.dueDate || "9999") ? -1 : 1;
      if (sortBy === "time") return (b.elapsed || 0) - (a.elapsed || 0);
      return 0;
    });

  const totalTracked = tasks.reduce((s, t) => s + (t.elapsed || 0) + t.subtasks.reduce((ss, sub) => ss + (sub.elapsed || 0), 0), 0);
  const doneCount = tasks.filter(t => t.status === "Done").length;

  return (
    <div style={{ padding: "1.25rem", background: "#F9FAFB", minHeight: "100vh", fontFamily: "var(--font-sans)" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 20, fontWeight: 700, color: "#111827" }}>My tasks</span>
          <span style={{ fontSize: 11, color: storageReady ? "#065F46" : "#9CA3AF", background: storageReady ? "#D1FAE5" : "#F3F4F6", border: `1px solid ${storageReady ? "#6EE7B7" : "#E5E7EB"}`, borderRadius: 20, padding: "2px 9px", fontWeight: 600 }}>
            {storageReady ? "Auto-saved" : "Loading…"}
          </span>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button onClick={() => setShowArchive(true)} style={{ fontSize: 12, padding: "6px 14px", background: archived.length > 0 ? "#FEF3C7" : "#fff", color: archived.length > 0 ? "#92400E" : "#374151", border: `1.5px solid ${archived.length > 0 ? "#FCD34D" : "#D1D5DB"}`, borderRadius: 8, cursor: "pointer", fontWeight: 600 }}>
            Archive {archived.length > 0 ? `(${archived.length})` : ""}
          </button>
          <button onClick={() => fileRef.current.click()} style={{ fontSize: 12, padding: "6px 14px", background: "#fff", color: "#374151", border: "1.5px solid #D1D5DB", borderRadius: 8, cursor: "pointer", fontWeight: 500 }}>Import JSON</button>
          <button onClick={() => setShowExport(true)} style={{ fontSize: 12, padding: "6px 14px", background: "#fff", color: "#374151", border: "1.5px solid #D1D5DB", borderRadius: 8, cursor: "pointer", fontWeight: 500 }}>Export JSON</button>
          <input ref={fileRef} type="file" accept=".json" style={{ display: "none" }} onChange={importJSON} />
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 16 }}>
        {[["Total tasks", tasks.length, "#EFF6FF", "#1D4ED8"], ["Completed", doneCount, "#ECFDF5", "#065F46"], ["Time tracked", formatDuration(totalTracked), "#FEF3C7", "#92400E"]].map(([label, val, bg, color]) => (
          <div key={label} style={{ background: bg, borderRadius: 10, padding: "12px 16px", border: `1.5px solid ${color}33` }}>
            <div style={{ fontSize: 11, fontWeight: 600, color, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>{label}</div>
            <div style={{ fontSize: 22, fontWeight: 700, color }}>{val}</div>
          </div>
        ))}
      </div>

      {/* Controls */}
      <div style={{ background: "#fff", border: "1.5px solid #E5E7EB", borderRadius: 12, padding: "12px 16px", marginBottom: 12 }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center", marginBottom: 10 }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: "#6B7280", letterSpacing: "0.06em" }}>SORT</span>
          {["priority", "status", "dueDate", "time"].map(s => (
            <button key={s} onClick={() => setSortBy(s)} style={{ fontSize: 12, padding: "4px 11px", borderRadius: 20, cursor: "pointer", fontWeight: sortBy === s ? 700 : 400,
              background: sortBy === s ? "#1D4ED8" : "#F3F4F6", color: sortBy === s ? "#fff" : "#374151",
              border: sortBy === s ? "1.5px solid #1D4ED8" : "1.5px solid #D1D5DB" }}>
              {s === "dueDate" ? "due date" : s}
            </button>
          ))}
          <div style={{ width: 1, height: 24, background: "#E5E7EB" }} />
          <select value={filterPriority} onChange={e => setFilterPriority(e.target.value)} style={{ fontSize: 12, padding: "4px 8px", borderRadius: 8, border: "1.5px solid #D1D5DB", background: "#F9FAFB", color: "#111827", cursor: "pointer" }}>
            <option>All</option>{PRIORITIES.map(p => <option key={p}>{p}</option>)}
          </select>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: "#6B7280", letterSpacing: "0.06em" }}>STATUS</span>
          {["All", "To Do", "In Progress", "Done"].map(s => {
            const active = filterStatus === s;
            const count = s === "All" ? tasks.length : tasks.filter(t => t.status === s).length;
            const col = s === "To Do" ? ["#F3F4F6","#374151","#D1D5DB"] : s === "In Progress" ? ["#DBEAFE","#1E40AF","#93C5FD"] : s === "Done" ? ["#D1FAE5","#065F46","#6EE7B7"] : ["#F3F4F6","#374151","#D1D5DB"];
            return (
              <button key={s} onClick={() => setFilterStatus(s)} style={{ fontSize: 12, padding: "4px 12px", borderRadius: 20, cursor: "pointer", fontWeight: active ? 700 : 500,
                background: active ? col[0] : "#fff", color: active ? col[1] : "#6B7280", border: `1.5px solid ${active ? col[2] : "#E5E7EB"}` }}>
                {s === "To Do" ? "Open" : s} ({count})
              </button>
            );
          })}
          <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
            <button onClick={() => setShowAI(true)} style={{ fontSize: 13, fontWeight: 700, padding: "7px 18px", background: "#7C3AED", color: "#fff", border: "none", borderRadius: 9, cursor: "pointer" }}>✦ Add with AI</button>
            <button onClick={() => setEditTask(newTask())} style={{ fontSize: 13, fontWeight: 700, padding: "7px 18px", background: "#1D4ED8", color: "#fff", border: "none", borderRadius: 9, cursor: "pointer" }}>+ New task</button>
          </div>
        </div>
      </div>

      {/* Task list */}
      {sorted.length === 0 && (
        <div style={{ textAlign: "center", padding: "3rem 0", color: "#9CA3AF", fontSize: 14 }}>
          No tasks — click <strong>+ New task</strong> or <strong>✦ Add with AI</strong> to get started
        </div>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {sorted.map(task => {
          const subDone = task.subtasks.filter(s => s.status === "Done").length;
          const taskTime = (task.elapsed || 0) + task.subtasks.reduce((s, t) => s + (t.elapsed || 0), 0);
          const isDone = task.status === "Done";
          return (
            <div key={task.id} onClick={() => setViewTask(task)}
              style={{ background: isDone ? "#F9FAFB" : "#fff", border: `1.5px solid ${isDone ? "#D1D5DB" : "#E5E7EB"}`,
                borderLeft: `4px solid ${priorityStyle[task.priority].border}`, borderRadius: 11, padding: "12px 16px", cursor: "pointer", opacity: isDone ? 0.75 : 1 }}
              onMouseEnter={e => e.currentTarget.style.boxShadow = "0 2px 12px rgba(0,0,0,0.08)"}
              onMouseLeave={e => e.currentTarget.style.boxShadow = "none"}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <input type="checkbox" checked={isDone} onClick={e => toggleDone(e, task)} onChange={() => {}} style={{ width: 16, height: 16, cursor: "pointer", accentColor: "#1D4ED8" }} />
                <span style={{ fontSize: 14, fontWeight: 600, color: isDone ? "#9CA3AF" : "#111827", flex: 1, textDecoration: isDone ? "line-through" : "none" }}>{task.title || <span style={{ color: "#D1D5DB" }}>Untitled</span>}</span>
                <Badge label={task.priority} style={priorityStyle[task.priority]} />
                <Badge label={task.status} style={statusStyle[task.status]} />
                {task.dueDate && <span style={{ fontSize: 11, fontWeight: 500, color: "#6B7280", background: "#F3F4F6", border: "1px solid #E5E7EB", borderRadius: 6, padding: "2px 8px" }}>{task.dueDate}</span>}
                {taskTime > 0 && <span style={{ fontSize: 11, fontWeight: 600, color: "#1E40AF", background: "#EFF6FF", border: "1px solid #BFDBFE", borderRadius: 6, padding: "2px 8px" }}>{formatDuration(taskTime)}</span>}
                {task.subtasks.length > 0 && <span style={{ fontSize: 11, fontWeight: 600, color: "#374151", background: "#F3F4F6", border: "1px solid #E5E7EB", borderRadius: 6, padding: "2px 8px" }}>{subDone}/{task.subtasks.length} subtasks</span>}
                <button onClick={e => archiveTask(e, task.id)} title="Move to archive"
                  style={{ fontSize: 11, padding: "3px 10px", color: "#6B7280", background: "#F3F4F6", border: "1px solid #D1D5DB", borderRadius: 7, cursor: "pointer", fontWeight: 500, opacity: 0.7 }}>
                  Archive
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {viewTask && !editTask && <ViewModal task={viewTask} onEdit={() => setEditTask({ ...viewTask })} onClose={() => setViewTask(null)} />}
      {editTask && <EditModal task={editTask} onSave={saveTask} onClose={() => setEditTask(null)} />}
      {showAI && <AIAddModal onTasksReady={addTasksBulk} onClose={() => setShowAI(false)} />}
      {showExport && <ExportModal tasks={tasks} archived={archived} onClose={() => setShowExport(false)} />}
      {showArchive && <ArchiveModal archived={archived} onRestore={restoreTask} onDeleteForever={id => setArchived(prev => prev.filter(t => t.id !== id))} onClose={() => setShowArchive(false)} />}
      {confirmArchive && (
        <ConfirmDialog
          message={`"${confirmArchive.title || "Untitled"}" will be moved to the archive. You can restore it anytime.`}
          confirmLabel="Move to archive"
          confirmColor="#D97706"
          onConfirm={confirmDoArchive}
          onCancel={() => setConfirmArchive(null)}
        />
      )}
    </div>
  );
}
