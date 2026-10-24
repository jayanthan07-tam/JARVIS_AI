"use client";

import { useState, useEffect } from "react";
import { type ActiveScreen } from "@/components/Navigation";
import { type Conversation, type Memory } from "@/lib/db";

interface HistoryScreenProps {
  onSelectConversation: (screen: ActiveScreen, convId: string) => void;
}

export default function HistoryScreen({ onSelectConversation }: HistoryScreenProps) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [memories, setMemories] = useState<Memory[]>([]);
  const [newMemoryFact, setNewMemoryFact] = useState("");
  const [editingConvId, setEditingConvId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  const loadData = () => {
    fetch("/api/conversations")
      .then((res) => res.json())
      .then((data) => setConversations(data.conversations || []))
      .catch(() => {});

    fetch("/api/memories")
      .then((res) => res.json())
      .then((data) => setMemories(data.memories || []))
      .catch(() => {});
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleDeleteConversation = async (id: string) => {
    try {
      await fetch(`/api/conversations/${id}`, { method: "DELETE" });
      loadData();
      setMessage("Directive session deleted.");
    } catch {
      // ignore
    }
  };

  const handleStartRename = (conv: Conversation) => {
    setEditingConvId(conv.id);
    setEditTitle(conv.title);
  };

  const handleSaveRename = async (id: string) => {
    if (!editTitle.trim()) return;
    try {
      await fetch(`/api/conversations/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: editTitle.trim() }),
      });
      setEditingConvId(null);
      loadData();
      setMessage("Session renamed.");
    } catch {
      // ignore
    }
  };

  const handleAddMemory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMemoryFact.trim()) return;
    try {
      await fetch("/api/memories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fact: newMemoryFact.trim(), category: "preference" }),
      });
      setNewMemoryFact("");
      loadData();
      setMessage("Permanent knowledge recorded in SQLite.");
    } catch {
      // ignore
    }
  };

  const handleDeleteMemory = async (id: string) => {
    try {
      await fetch(`/api/memories?id=${id}`, { method: "DELETE" });
      loadData();
      setMessage("Memory fact purged.");
    } catch {
      // ignore
    }
  };

  const handleClearAllHistory = async () => {
    if (!window.confirm("Confirm deletion of all saved conversations in SQLite database?")) return;
    try {
      await fetch("/api/conversations", { method: "DELETE" });
      loadData();
      setMessage("All directive logs purged.");
    } catch {
      // ignore
    }
  };

  return (
    <div className="screen-history-container">
      <div className="history-header-card">
        <div className="history-title-group">
          <span className="history-title">PERSISTENT DIRECTIVE VAULT // SQLITE</span>
          <span className="history-sub">LOCAL DATABASE RECORDS</span>
        </div>
        <button type="button" className="clear-all-btn" onClick={handleClearAllHistory}>
          PURGE ALL CHAT LOGS
        </button>
      </div>

      {message && <div className="history-notification">{message}</div>}

      <div className="history-two-col">
        {/* Left Column: Conversation Sessions */}
        <div className="history-col">
          <div className="history-panel">
            <span className="panel-heading">CONVERSATION SESSIONS ({conversations.length})</span>
            <div className="conversation-card-list">
              {conversations.length === 0 ? (
                <div className="empty-state">No saved conversations found. Start chatting to record logs.</div>
              ) : (
                conversations.map((c) => (
                  <div key={c.id} className="conv-card">
                    {editingConvId === c.id ? (
                      <div className="rename-box">
                        <input
                          type="text"
                          className="rename-input"
                          value={editTitle}
                          onChange={(e) => setEditTitle(e.target.value)}
                        />
                        <button
                          type="button"
                          className="rename-save-btn"
                          onClick={() => handleSaveRename(c.id)}
                        >
                          SAVE
                        </button>
                        <button
                          type="button"
                          className="rename-cancel-btn"
                          onClick={() => setEditingConvId(null)}
                        >
                          CANCEL
                        </button>
                      </div>
                    ) : (
                      <>
                        <div className="conv-card-top">
                          <span className="conv-name">{c.title}</span>
                          <span className="conv-date">
                            {new Date(c.updated_at).toLocaleDateString()} {new Date(c.updated_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </span>
                        </div>
                        <div className="conv-card-actions">
                          <button
                            type="button"
                            className="card-action-btn open"
                            onClick={() => onSelectConversation("chat", c.id)}
                          >
                            OPEN IN CHAT
                          </button>
                          <button
                            type="button"
                            className="card-action-btn rename"
                            onClick={() => handleStartRename(c)}
                          >
                            RENAME
                          </button>
                          <button
                            type="button"
                            className="card-action-btn delete"
                            onClick={() => handleDeleteConversation(c.id)}
                          >
                            DELETE
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Long-Term User Memories */}
        <div className="history-col">
          <div className="history-panel">
            <span className="panel-heading">PERMANENT USER KNOWLEDGE & MEMORIES</span>
            <span className="panel-sub">
              Facts stored here are automatically provided to J.A.R.V.I.S. as contextual memory.
            </span>

            <form className="memory-add-form" onSubmit={handleAddMemory}>
              <input
                type="text"
                className="memory-input"
                value={newMemoryFact}
                onChange={(e) => setNewMemoryFact(e.target.value)}
                placeholder="Add memory fact (e.g. 'User is designing an Iron Man suit')..."
              />
              <button type="submit" className="memory-submit-btn">
                + SAVE FACT
              </button>
            </form>

            <div className="memory-facts-list">
              {memories.length === 0 ? (
                <div className="empty-state">No long-term memories saved. Add facts above to inform J.A.R.V.I.S.</div>
              ) : (
                memories.map((m) => (
                  <div key={m.id} className="memory-fact-item">
                    <div className="fact-content">
                      <span className="fact-text">{m.fact}</span>
                      <span className="fact-category">[{m.category.toUpperCase()}]</span>
                    </div>
                    <button
                      type="button"
                      className="fact-delete-btn"
                      onClick={() => handleDeleteMemory(m.id)}
                    >
                      ×
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
