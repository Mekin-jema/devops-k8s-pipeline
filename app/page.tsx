"use client";

import { useEffect, useMemo, useState } from "react";

type Todo = {
  id: string;
  title: string;
  completed: boolean;
  createdAt: string;
};

const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

export default function Home() {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [title, setTitle] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const completedCount = useMemo(() => todos.filter((todo) => todo.completed).length, [todos]);

  async function loadTodos() {
    try {
      setError(null);
      const response = await fetch(`${apiBaseUrl}/api/todos`);
      if (!response.ok) {
        throw new Error("Unable to load todos.");
      }
      const data = (await response.json()) as Todo[];
      setTodos(data);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unexpected error.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadTodos();
  }, []);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmedTitle = title.trim();
    if (!trimmedTitle) return;

    setSaving(true);
    setError(null);

    try {
      const response = await fetch(`${apiBaseUrl}/api/todos${editingId ? `/${editingId}` : ""}`, {
        method: editingId ? "PUT" : "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ title: trimmedTitle }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { message?: string } | null;
        throw new Error(payload?.message || "Failed to save todo.");
      }

      await loadTodos();
      setTitle("");
      setEditingId(null);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unexpected error.");
    } finally {
      setSaving(false);
    }
  }

  async function handleToggle(todo: Todo) {
    await fetch(`${apiBaseUrl}/api/todos/${todo.id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ completed: !todo.completed }),
    });
    await loadTodos();
  }

  async function handleDelete(id: string) {
    await fetch(`${apiBaseUrl}/api/todos/${id}`, {
      method: "DELETE",
    });
    await loadTodos();
  }

  function startEdit(todo: Todo) {
    setTitle(todo.title);
    setEditingId(todo.id);
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 px-4 py-10 text-slate-100">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-8 rounded-3xl border border-white/10 bg-white/5 p-6 shadow-2xl backdrop-blur md:p-10">
        <section className="space-y-3">
          <p className="text-sm font-medium uppercase tracking-[0.35em] text-cyan-300">Fullstack Todo</p>
          <h1 className="text-3xl font-semibold tracking-tight md:text-5xl">Manage tasks with Next.js + Express</h1>
          <p className="max-w-2xl text-sm leading-6 text-slate-300 md:text-base">
            Add, update, complete, and remove todos from the frontend while the Express API handles the data.
          </p>
        </section>

        <section className="grid gap-4 rounded-2xl border border-white/10 bg-slate-950/40 p-4 md:grid-cols-[1fr_auto] md:p-5">
          <form className="flex flex-col gap-3 md:flex-row" onSubmit={handleSubmit}>
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Write a new todo..."
              className="h-12 flex-1 rounded-xl border border-white/10 bg-slate-900 px-4 text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-cyan-400"
            />
            <button
              type="submit"
              disabled={saving}
              className="h-12 rounded-xl bg-cyan-400 px-5 font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {editingId ? "Update Todo" : "Add Todo"}
            </button>
          </form>
          <div className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-300 md:min-w-64">
            <span>Total: {todos.length}</span>
            <span>Completed: {completedCount}</span>
          </div>
        </section>

        {error ? (
          <p className="rounded-xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{error}</p>
        ) : null}

        <section className="space-y-3">
          {loading ? (
            <div className="rounded-2xl border border-white/10 bg-white/5 px-6 py-10 text-center text-slate-300">
              Loading todos...
            </div>
          ) : todos.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/15 bg-white/5 px-6 py-10 text-center text-slate-300">
              No todos yet. Add your first one above.
            </div>
          ) : (
            <ul className="grid gap-3">
              {todos.map((todo) => (
                <li
                  key={todo.id}
                  className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-slate-950/50 p-4 md:flex-row md:items-center md:justify-between"
                >
                  <div className="flex items-start gap-3">
                    <button
                      type="button"
                      onClick={() => void handleToggle(todo)}
                      className={`mt-1 flex h-5 w-5 items-center justify-center rounded-full border ${todo.completed ? "border-cyan-400 bg-cyan-400" : "border-slate-500"}`}
                      aria-label={todo.completed ? "Mark todo as incomplete" : "Mark todo as complete"}
                    >
                      {todo.completed ? <span className="h-2 w-2 rounded-full bg-slate-950" /> : null}
                    </button>
                    <div>
                      <p className={`text-base font-medium ${todo.completed ? "text-slate-400 line-through" : "text-slate-100"}`}>
                        {todo.title}
                      </p>
                      <p className="text-xs text-slate-500">Created {new Date(todo.createdAt).toLocaleString()}</p>
                    </div>
                  </div>

                  <div className="flex gap-2 self-end md:self-auto">
                    <button
                      type="button"
                      onClick={() => startEdit(todo)}
                      className="rounded-lg border border-white/10 px-4 py-2 text-sm text-slate-200 transition hover:bg-white/10"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleDelete(todo.id)}
                      className="rounded-lg border border-rose-400/30 px-4 py-2 text-sm text-rose-200 transition hover:bg-rose-500/10"
                    >
                      Delete
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}
