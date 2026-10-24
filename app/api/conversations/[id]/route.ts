import { NextRequest, NextResponse } from "next/server";
import { getDb, Conversation, DbMessage } from "@/lib/db";
import { authorizeApiRequest, handleApiError, readJsonRequest } from "@/lib/apiSecurity";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const blocked = await authorizeApiRequest(req);
  if (blocked) return blocked;

  try {
    const { id } = await context.params;
    if (!/^[A-Za-z0-9_-]{1,100}$/.test(id)) {
      return NextResponse.json({ error: "Conversation ID is invalid." }, { status: 400 });
    }
    const db = getDb();
    const convStmt = db.prepare("SELECT * FROM conversations WHERE id = ?");
    const conv = convStmt.get(id) as unknown as Conversation | undefined;

    if (!conv) {
      return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
    }

    const msgStmt = db.prepare(
      "SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC"
    );
    const messages = msgStmt.all(id) as unknown as DbMessage[];

    return NextResponse.json({ conversation: conv, messages });
  } catch (err: unknown) {
    return handleApiError("conversation-read", err);
  }
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const blocked = await authorizeApiRequest(req, "write");
  if (blocked) return blocked;

  try {
    const { id } = await context.params;
    if (!/^[A-Za-z0-9_-]{1,100}$/.test(id)) {
      return NextResponse.json({ error: "Conversation ID is invalid." }, { status: 400 });
    }
    const body = await readJsonRequest(req, 24 * 1024);
    const role = body.role;
    const content = body.content;

    if (
      !["user", "assistant", "system"].includes(String(role)) ||
      typeof content !== "string" ||
      !content.trim() ||
      content.length > 16_000
    ) {
      return NextResponse.json({ error: "A valid message role and text are required." }, { status: 400 });
    }
    const validatedRole = role as "user" | "assistant" | "system";

    const db = getDb();
    const msgId = `msg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const now = Date.now();

    const insertMsg = db.prepare(
      "INSERT INTO messages (id, conversation_id, role, content, created_at) VALUES (?, ?, ?, ?, ?)"
    );
    insertMsg.run(msgId, id, validatedRole, content, now);

    const updateConv = db.prepare("UPDATE conversations SET updated_at = ? WHERE id = ?");
    updateConv.run(now, id);

    return NextResponse.json({
      message: { id: msgId, conversation_id: id, role: validatedRole, content, created_at: now },
    });
  } catch (err: unknown) {
    return handleApiError("conversation-message-save", err);
  }
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const blocked = await authorizeApiRequest(req, "write");
  if (blocked) return blocked;

  try {
    const { id } = await context.params;
    if (!/^[A-Za-z0-9_-]{1,100}$/.test(id)) {
      return NextResponse.json({ error: "Conversation ID is invalid." }, { status: 400 });
    }
    const body = await readJsonRequest(req, 8 * 1024);
    const title = body.title;

    if (typeof title !== "string" || !title.trim() || title.trim().length > 120) {
      return NextResponse.json({ error: "A valid conversation title is required." }, { status: 400 });
    }

    const db = getDb();
    const update = db.prepare("UPDATE conversations SET title = ?, updated_at = ? WHERE id = ?");
    update.run(title.trim(), Date.now(), id);

    return NextResponse.json({ success: true, title: title.trim() });
  } catch (err: unknown) {
    return handleApiError("conversation-rename", err);
  }
}

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const blocked = await authorizeApiRequest(req, "write");
  if (blocked) return blocked;

  try {
    const { id } = await context.params;
    if (!/^[A-Za-z0-9_-]{1,100}$/.test(id)) {
      return NextResponse.json({ error: "Conversation ID is invalid." }, { status: 400 });
    }
    const db = getDb();
    db.prepare("DELETE FROM messages WHERE conversation_id = ?").run(id);
    db.prepare("DELETE FROM conversations WHERE id = ?").run(id);

    return NextResponse.json({ success: true, id });
  } catch (err: unknown) {
    return handleApiError("conversation-delete", err);
  }
}
