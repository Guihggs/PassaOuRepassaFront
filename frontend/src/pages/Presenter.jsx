import { useEffect, useMemo, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { socket, BACKEND_HTTP_URL } from "../socket.js";

const LETTERS = ["A", "B", "C", "D"];
const EMPTY_QUESTION = {
  title: "",
  alt_a: "",
  alt_b: "",
  alt_c: "",
  alt_d: "",
  correct: "A",
  category: "",
  difficulty: "fácil",
  explanation: "",
};

export default function Presenter() {
  const [state, setState] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [tab, setTab] = useState("controle"); // controle | perguntas | equipes
  const [editing, setEditing] = useState(null); // pergunta sendo editada (ou EMPTY_QUESTION)

  useEffect(() => {
    function onState(s) {
      setState(s);
    }
    function onQuestions(qs) {
      setQuestions(qs);
    }
    socket.on("state:update", onState);
    socket.on("presenter:questions", onQuestions);
    return () => {
      socket.off("state:update", onState);
      socket.off("presenter:questions", onQuestions);
    };
  }, []);

  const teamLinks = useMemo(() => {
    const origin = window.location.origin;
    return [1, 2, 3].map((id) => `${origin}/team/${id}`);
  }, []);

  const answeringTeam = useMemo(() => {
    // Importante: só considerar que "há uma equipe respondendo agora" quando
    // o status realmente for "answering". Sem essa checagem, depois que o
    // apresentador clica em Certo/Errado o status muda para "revealed" mas
    // esta variável continuava "true" (pressOrder/answeringPos não são
    // resetados), fazendo os botões continuarem na tela como se nada
    // tivesse acontecido — dando a falsa impressão de que o clique não
    // registrou nada.
    if (!state || state.status !== "answering" || state.answeringPos < 0) return null;
    const entry = state.pressOrder[state.answeringPos];
    if (!entry) return null;
    return state.teams.find((t) => t.id === entry.teamId);
  }, [state]);

  async function saveQuestion(q) {
    const method = q.id ? "PUT" : "POST";
    const url = q.id ? `${BACKEND_HTTP_URL}/api/questions/${q.id}` : `${BACKEND_HTTP_URL}/api/questions`;
    await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(q),
    });
    setEditing(null);
  }

  async function deleteQuestion(id) {
    if (!confirm("Excluir esta pergunta?")) return;
    await fetch(`${BACKEND_HTTP_URL}/api/questions/${id}`, { method: "DELETE" });
  }

  if (!state) {
    return <div className="min-h-screen flex items-center justify-center font-display text-2xl animate-pulse">Conectando…</div>;
  }

  return (
    <div className="min-h-screen p-6 md:p-8 max-w-6xl mx-auto space-y-6">
      <header className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-semibold">🎛️ Painel do Apresentador</h1>
        <nav className="flex gap-2">
          {[
            ["controle", "Controle da Partida"],
            ["perguntas", "Perguntas"],
            ["equipes", "Equipes / QR Codes"],
          ].map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition ${
                tab === key ? "bg-volt text-night" : "bg-panel text-white/70 hover:text-white"
              }`}
            >
              {label}
            </button>
          ))}
        </nav>
      </header>

      {tab === "controle" && (
        <ControleTab
          state={state}
          questions={questions}
          answeringTeam={answeringTeam}
        />
      )}

      {tab === "perguntas" && (
        <PerguntasTab
          questions={questions}
          editing={editing}
          setEditing={setEditing}
          saveQuestion={saveQuestion}
          deleteQuestion={deleteQuestion}
        />
      )}

      {tab === "equipes" && <EquipesTab teams={state.teams} teamLinks={teamLinks} />}
    </div>
  );
}

// ---------------------------------------------------------------------------
function ControleTab({ state, questions, answeringTeam }) {
  const currentIndex = state.currentQuestionIndex;
  const currentQ = questions[currentIndex] || null;

  return (
    <div className="grid md:grid-cols-3 gap-6">
      <div className="md:col-span-2 space-y-4">
        <div className="rounded-2xl bg-panel border border-white/10 p-5">
          <p className="text-white/50 text-xs uppercase tracking-widest mb-1">Status da rodada</p>
          <p className="font-display text-xl">{statusLabel(state.status)}</p>

          {currentQ ? (
            <div className="mt-4 space-y-2">
              <p className="text-white/50 text-xs">
                Pergunta {currentIndex + 1} de {questions.length}
              </p>
              <p className="text-lg font-semibold">{currentQ.title}</p>
              <div className="grid grid-cols-2 gap-2 text-sm">
                {LETTERS.map((l) => (
                  <p key={l} className={l === currentQ.correct ? "text-volt" : "text-white/70"}>
                    {l}) {currentQ[`alt_${l.toLowerCase()}`]} {l === currentQ.correct && "✓"}
                  </p>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-white/40 mt-4">Nenhuma pergunta selecionada. Escolha uma abaixo.</p>
          )}
        </div>

        {answeringTeam && (
          <div className="rounded-2xl bg-panel border border-volt p-5 flex items-center justify-between">
            <div>
              <p className="text-white/50 text-xs uppercase tracking-widest">Respondendo agora</p>
              <p className="font-display text-2xl" style={{ color: answeringTeam.color }}>
                {answeringTeam.name}
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => socket.emit("presenter:markAnswer", { correct: true })}
                className="px-5 py-3 rounded-xl bg-green-500 font-semibold hover:brightness-110"
              >
                ✓ Resposta Correta
              </button>
              <button
                onClick={() => socket.emit("presenter:markAnswer", { correct: false })}
                className="px-5 py-3 rounded-xl bg-red-500 font-semibold hover:brightness-110"
              >
                ✗ Resposta Errada
              </button>
            </div>
          </div>
        )}

        {/* Confirmação visual do resultado da rodada — some assim que o
            apresentador escolhe a próxima pergunta ou reinicia o botão. */}
        {state.status === "revealed" && state.roundLog?.length > 0 && (
          <div className="rounded-2xl bg-panel border border-white/10 p-5 space-y-2">
            <p className="text-white/50 text-xs uppercase tracking-widest">Resultado registrado ✅</p>
            {state.roundLog.map((entry, i) => {
              const team = state.teams.find((t) => t.id === entry.teamId);
              return (
                <div
                  key={`${entry.teamId}-${i}`}
                  className={`rounded-xl px-4 py-2 flex items-center justify-between border ${
                    entry.correct ? "border-green-500/50 bg-green-500/10" : "border-red-500/50 bg-red-500/10"
                  }`}
                >
                  <span className="font-semibold" style={{ color: team?.color }}>
                    {entry.correct ? "✓" : "✗"} {team?.name || `Equipe ${entry.teamId}`}
                  </span>
                  <span className="text-sm text-white/60">
                    {entry.correct ? `+${entry.pointValue} pt gravado(s)` : "sem pontos"}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        <div className="rounded-2xl bg-panel border border-white/10 p-5 flex flex-wrap gap-3">
          <ActionButton onClick={() => socket.emit("presenter:startRound")} disabled={!currentQ || state.status === "live" || state.status === "answering" || state.status === "countdown"}>
            ▶️ Iniciar rodada
          </ActionButton>
          <ActionButton onClick={() => socket.emit("presenter:showAnswer")}>👁️ Mostrar resposta</ActionButton>
          <ActionButton onClick={() => socket.emit("presenter:resetButton")}>🔄 Resetar botão</ActionButton>
          <ActionButton onClick={() => socket.emit("presenter:endRound")}>⏹️ Encerrar rodada</ActionButton>
          <ActionButton onClick={() => socket.emit("presenter:nextQuestion")}>⏭️ Próxima pergunta</ActionButton>
          <ActionButton
            danger
            onClick={() => {
              if (confirm("Zerar placar e reiniciar o jogo?")) socket.emit("presenter:resetGame");
            }}
          >
            🗑️ Reiniciar jogo
          </ActionButton>
        </div>

        <div className="rounded-2xl bg-panel border border-white/10 p-5">
          <p className="text-white/50 text-xs uppercase tracking-widest mb-3">Escolher pergunta</p>
          <div className="flex flex-wrap gap-2">
            {questions.map((q, i) => (
              <button
                key={q.id}
                onClick={() => socket.emit("presenter:selectQuestion", { index: i })}
                className={`px-3 py-2 rounded-lg text-sm border ${
                  i === currentIndex ? "border-volt text-volt" : "border-white/10 text-white/60 hover:text-white"
                }`}
              >
                {i + 1}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <p className="text-white/50 text-xs uppercase tracking-widest">Ordem de quem apertou</p>
        {state.pressOrder.length === 0 && <p className="text-white/30 text-sm">Ninguém apertou ainda.</p>}
        <div className="space-y-2">
          {state.pressOrder.map((p, i) => {
            const team = state.teams.find((t) => t.id === p.teamId);
            const result = state.roundLog?.find((r) => r.teamId === p.teamId);
            return (
              <div key={p.teamId} className="rounded-xl bg-panel border border-white/10 px-4 py-3 flex items-center justify-between">
                <span className="font-display">
                  {["🥇", "🥈", "🥉"][i] || `${i + 1}º`} {team?.name || `Equipe ${p.teamId}`}
                  {result && (result.correct ? " ✓" : " ✗")}
                </span>
                <span className={`text-sm ${result ? (result.correct ? "text-green-400" : "text-red-400") : "text-white/40"}`}>
                  {result ? (result.correct ? `+${result.pointValue} pt` : "0 pt") : `${state.pointValues[i]} pt`}
                </span>
              </div>
            );
          })}
        </div>

        <p className="text-white/50 text-xs uppercase tracking-widest pt-2">Placar</p>
        <div className="space-y-2">
          {[...state.teams].sort((a, b) => b.score - a.score).map((t) => (
            <div key={t.id} className="rounded-xl bg-panel border border-white/10 px-4 py-3 flex items-center justify-between">
              <span style={{ color: t.color || "#fff" }} className="font-semibold">{t.name || `Equipe ${t.id}`}</span>
              <span>{t.score} pts</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function statusLabel(status) {
  return (
    {
      idle: "Aguardando início",
      countdown: "Contagem regressiva…",
      live: "Botões liberados — aguardando toques",
      answering: "Aguardando confirmação do apresentador",
      revealed: "Resposta revelada",
      ended: "Jogo encerrado",
    }[status] || status
  );
}

function ActionButton({ children, onClick, disabled, danger }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`px-4 py-3 rounded-xl font-semibold text-sm transition disabled:opacity-30 ${
        danger ? "bg-red-500/20 text-red-300 hover:bg-red-500/30" : "bg-white/10 hover:bg-white/20"
      }`}
    >
      {children}
    </button>
  );
}

// ---------------------------------------------------------------------------
function PerguntasTab({ questions, editing, setEditing, saveQuestion, deleteQuestion }) {
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-white/50 text-sm">{questions.length} pergunta(s) cadastradas</p>
        <button
          onClick={() => setEditing({ ...EMPTY_QUESTION })}
          className="px-4 py-2 rounded-lg bg-volt text-night font-semibold text-sm"
        >
          + Nova pergunta
        </button>
      </div>

      {editing && (
        <QuestionForm
          question={editing}
          onCancel={() => setEditing(null)}
          onSave={saveQuestion}
        />
      )}

      <div className="space-y-2">
        {questions.map((q) => (
          <div key={q.id} className="rounded-xl bg-panel border border-white/10 px-4 py-3 flex items-center justify-between gap-4">
            <div>
              <p className="font-semibold">{q.title}</p>
              <p className="text-white/40 text-xs">{q.category} · {q.difficulty} · resposta: {q.correct}</p>
            </div>
            <div className="flex gap-2 shrink-0">
              <button onClick={() => setEditing(q)} className="px-3 py-1.5 rounded-lg bg-white/10 text-sm">Editar</button>
              <button onClick={() => deleteQuestion(q.id)} className="px-3 py-1.5 rounded-lg bg-red-500/20 text-red-300 text-sm">Excluir</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function QuestionForm({ question, onCancel, onSave }) {
  const [form, setForm] = useState(question);

  useEffect(() => setForm(question), [question]);

  function set(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  return (
    <div className="rounded-2xl bg-panel border border-volt/50 p-5 space-y-3">
      <input
        placeholder="Enunciado da pergunta"
        value={form.title}
        onChange={(e) => set("title", e.target.value)}
        className="w-full rounded-lg bg-night border border-white/10 px-3 py-2"
      />
      <div className="grid grid-cols-2 gap-3">
        {LETTERS.map((l) => (
          <div key={l} className="flex items-center gap-2">
            <input
              type="radio"
              name="correct"
              checked={form.correct === l}
              onChange={() => set("correct", l)}
            />
            <input
              placeholder={`Alternativa ${l}`}
              value={form[`alt_${l.toLowerCase()}`]}
              onChange={(e) => set(`alt_${l.toLowerCase()}`, e.target.value)}
              className="flex-1 rounded-lg bg-night border border-white/10 px-3 py-2"
            />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <input
          placeholder="Categoria"
          value={form.category || ""}
          onChange={(e) => set("category", e.target.value)}
          className="rounded-lg bg-night border border-white/10 px-3 py-2"
        />
        <select
          value={form.difficulty || "fácil"}
          onChange={(e) => set("difficulty", e.target.value)}
          className="rounded-lg bg-night border border-white/10 px-3 py-2"
        >
          <option value="fácil">fácil</option>
          <option value="médio">médio</option>
          <option value="difícil">difícil</option>
        </select>
      </div>
      <textarea
        placeholder="Explicação da resposta (opcional)"
        value={form.explanation || ""}
        onChange={(e) => set("explanation", e.target.value)}
        className="w-full rounded-lg bg-night border border-white/10 px-3 py-2"
        rows={2}
      />
      <div className="flex gap-3 justify-end">
        <button onClick={onCancel} className="px-4 py-2 rounded-lg bg-white/10 text-sm">Cancelar</button>
        <button onClick={() => onSave(form)} className="px-4 py-2 rounded-lg bg-volt text-night font-semibold text-sm">Salvar</button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
const TEAM_COLOR_OPTIONS = [
  "#3B82F6", "#EF4444", "#10B981", "#F4E409", "#8B5CF6", "#FF2E8C",
];

function EquipesTab({ teams, teamLinks }) {
  const [editingId, setEditingId] = useState(null);

  return (
    <div className="grid md:grid-cols-3 gap-6">
      {teams.map((t, i) => (
        <div key={t.id} className="rounded-2xl bg-panel border border-white/10 p-5 flex flex-col items-center gap-4 text-center">
          <p className="font-display text-lg">Equipe {t.id}</p>
          <div className="bg-white p-3 rounded-xl">
            <QRCodeSVG value={teamLinks[i]} size={160} />
          </div>
          <p className="text-white/40 text-xs break-all">{teamLinks[i]}</p>

          {editingId === t.id ? (
            <EditTeamNameForm
              team={t}
              onCancel={() => setEditingId(null)}
              onSaved={() => setEditingId(null)}
            />
          ) : t.registered ? (
            <div className="flex flex-col items-center gap-2">
              <div className="flex items-center gap-2">
                {t.photo && <img src={t.photo} className="w-8 h-8 rounded-full object-cover" alt="" />}
                <span style={{ color: t.color }} className="font-semibold">{t.name}</span>
              </div>
              <button
                onClick={() => setEditingId(t.id)}
                className="px-3 py-1.5 rounded-lg bg-white/10 text-xs hover:bg-white/20"
              >
                ✏️ Editar nome da equipe
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <p className="text-white/30 text-sm">Aguardando cadastro…</p>
              <button
                onClick={() => setEditingId(t.id)}
                className="px-3 py-1.5 rounded-lg bg-white/10 text-xs hover:bg-white/20"
              >
                ✏️ Cadastrar/editar manualmente
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// Formulário de edição do nome (e cor) da equipe, usado pelo apresentador.
// Reaproveita o mesmo evento "team:register" do celular da equipe — o
// backend simplesmente sobrescreve nome/cor/foto da equipe já existente,
// então isso funciona tanto para cadastro inicial quanto para renomear
// depois de já ter sido criada.
function EditTeamNameForm({ team, onCancel, onSaved }) {
  const [name, setName] = useState(team.name || "");
  const [color, setColor] = useState(team.color || TEAM_COLOR_OPTIONS[0]);
  const [saving, setSaving] = useState(false);

  function handleSave() {
    if (!name.trim()) return;
    setSaving(true);
    socket.emit(
      "team:register",
      { teamId: team.id, name: name.trim(), color, photo: team.photo || null },
      () => {
        setSaving(false);
        onSaved();
      }
    );
  }

  return (
    <div className="w-full space-y-3 text-left">
      <input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Nome da equipe"
        className="w-full rounded-lg bg-night border border-white/10 px-3 py-2 text-center"
      />
      <div className="flex justify-center gap-2">
        {TEAM_COLOR_OPTIONS.map((c) => (
          <button
            key={c}
            onClick={() => setColor(c)}
            className={`w-7 h-7 rounded-full border-2 ${color === c ? "border-white scale-110" : "border-transparent"}`}
            style={{ backgroundColor: c }}
            aria-label={c}
          />
        ))}
      </div>
      <div className="flex gap-2 justify-center">
        <button onClick={onCancel} className="px-3 py-1.5 rounded-lg bg-white/10 text-xs">Cancelar</button>
        <button
          onClick={handleSave}
          disabled={!name.trim() || saving}
          className="px-3 py-1.5 rounded-lg bg-volt text-night font-semibold text-xs disabled:opacity-30"
        >
          {saving ? "Salvando…" : "Salvar"}
        </button>
      </div>
    </div>
  );
}
