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
  const pendingCount = todos.length - completedCount;
  const completionRate = todos.length ? Math.round((completedCount / todos.length) * 100) : 0;

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

  function cancelEdit() {
    setEditingId(null);
    setTitle("");
  }

  return (
    <main className="min-h-screen bg-white px-4 py-10 text-slate-900">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-8 rounded-3xl border border-slate-200 bg-slate-50 p-6 shadow-xl md:p-10">
        <section className="space-y-3">
          <p className="text-sm font-medium uppercase tracking-[0.35em] text-cyan-700">Fullstack Todo Dashboard</p>
          <h1 className="text-3xl font-semibold tracking-tight md:text-5xl">Manage tasks with clear action states</h1>
          <p className="max-w-2xl text-sm leading-6 text-slate-600 md:text-base">
            Track all tasks with standard CRUD action colors: Create (green), Update (blue), Complete (indigo), and Delete (red).
          </p>
        </section>

        <section className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3">
            <p className="text-xs uppercase tracking-wide text-emerald-700">Total tasks</p>
            <p className="mt-1 text-2xl font-semibold text-emerald-800">{todos.length}</p>
          </div>
          <div className="rounded-2xl border border-indigo-400/30 bg-indigo-500/10 px-4 py-3">
            <p className="text-xs uppercase tracking-wide text-indigo-700">Completed</p>
            <p className="mt-1 text-2xl font-semibold text-indigo-800">{completedCount}</p>
          </div>
          <div className="rounded-2xl border border-amber-400/30 bg-amber-500/10 px-4 py-3">
            <p className="text-xs uppercase tracking-wide text-amber-700">Pending</p>
            <p className="mt-1 text-2xl font-semibold text-amber-800">{pendingCount}</p>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="mb-2 flex items-center justify-between text-sm text-slate-600">
            <span>Completion progress</span>
            <span>{completionRate}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-slate-200">
            <div
              className="h-full rounded-full bg-indigo-400 transition-all"
              style={{ width: `${completionRate}%` }}
            />
          </div>
        </section>

        <section className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-4 md:grid-cols-[1fr_auto] md:p-5">
          <form className="flex flex-col gap-3 md:flex-row" onSubmit={handleSubmit}>
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder={editingId ? "Update selected todo..." : "Write a new todo..."}
              className="h-12 flex-1 rounded-xl border border-slate-300 bg-white px-4 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-cyan-500"
            />
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={saving}
                className={`h-12 rounded-xl px-5 font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-70 ${editingId ? "bg-blue-600 hover:bg-blue-500" : "bg-emerald-600 hover:bg-emerald-500"}`}
              >
                {editingId ? "Update" : "Create"}
              </button>
              {editingId ? (
                <button
                  type="button"
                  onClick={cancelEdit}
                  className="h-12 rounded-xl border border-slate-300 px-5 font-semibold text-slate-700 transition hover:bg-slate-100"
                >
                  Cancel
                </button>
              ) : null}
            </div>
          </form>
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600 md:min-w-64">
            <p className="font-semibold text-slate-800">Action legend</p>
            <p className="mt-1">Create: <span className="text-emerald-700">Green</span> • Update: <span className="text-blue-700">Blue</span></p>
            <p>Complete: <span className="text-indigo-700">Indigo</span> • Delete: <span className="text-rose-700">Red</span></p>
          </div>
        </section>

        {error ? (
          <p className="rounded-xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-700">{error}</p>
        ) : null}

        <section className="space-y-3">
          {loading ? (
            <div className="rounded-2xl border border-slate-200 bg-white px-6 py-10 text-center text-slate-600">
              Loading todos...
            </div>
          ) : todos.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-10 text-center text-slate-600">
              No todos yet. Add your first one above.
            </div>
          ) : (
            <ul className="grid gap-3">
              {todos.map((todo) => (
                <li
                  key={todo.id}
                  className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-4 md:flex-row md:items-center md:justify-between"
                >
                  <div className="flex items-start gap-3">
                    <button
                      type="button"
                      onClick={() => void handleToggle(todo)}
                      className={`mt-1 flex h-5 w-5 items-center justify-center rounded-full border transition ${todo.completed ? "border-indigo-400 bg-indigo-400" : "border-slate-400 hover:border-indigo-300"}`}
                      aria-label={todo.completed ? "Mark todo as incomplete" : "Mark todo as complete"}
                    >
                      {todo.completed ? <span className="h-2 w-2 rounded-full bg-slate-950" /> : null}
                    </button>
                    <div>
                      <p className={`text-base font-medium ${todo.completed ? "text-slate-400 line-through" : "text-slate-900"}`}>
                        {todo.title}
                      </p>
                      <p className="text-xs text-slate-500">Created {new Date(todo.createdAt).toLocaleString()}</p>
                      <p className={`mt-1 inline-flex rounded-md px-2 py-0.5 text-[11px] font-medium ${todo.completed ? "bg-indigo-500/20 text-indigo-700" : "bg-amber-500/20 text-amber-700"}`}>
                        {todo.completed ? "Completed" : "Pending"}
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-2 self-end md:self-auto">
                    <button
                      type="button"
                      onClick={() => startEdit(todo)}
                      className="rounded-lg border border-blue-400/30 bg-blue-500/10 px-4 py-2 text-sm text-blue-700 transition hover:bg-blue-500/20"
                    >
                      Update
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleDelete(todo.id)}
                      className="rounded-lg border border-rose-400/30 bg-rose-500/10 px-4 py-2 text-sm text-rose-700 transition hover:bg-rose-500/20"
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
