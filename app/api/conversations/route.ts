import { NextRequest, NextResponse } from "next/server";
import { getDb, Conversation } from "@/lib/db";
import { authorizeApiRequest, handleApiError, readJsonRequest } from "@/lib/apiSecurity";

export async function GET(request: NextRequest) {
  const blocked = await authorizeApiRequest(request);
  if (blocked) return blocked;

  try {
    const db = getDb();
    const query = db.prepare("SELECT * FROM conversations ORDER BY updated_at DESC");
    const rows = query.all() as unknown as Conversation[];
    return NextResponse.json({ conversations: rows });
  } catch (err: unknown) {
    return handleApiError("conversations-list", err);
  }
}

export async function POST(req: NextRequest) {
  const blocked = await authorizeApiRequest(req, "write");
  if (blocked) return blocked;

  try {
    const db = getDb();
    const body = await readJsonRequest(req, 8 * 1024);
    const suppliedId = body.id;
    const id = suppliedId === undefined
      ? `conv_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`
      : typeof suppliedId === "string" && /^[A-Za-z0-9_-]{1,100}$/.test(suppliedId)
        ? suppliedId
        : null;
    const rawTitle = body.title === undefined ? "New Directives" : body.title;
    const title = typeof rawTitle === "string" ? rawTitle.trim() : "";
    if (!id || !title || title.length > 120) {
      return NextResponse.json({ error: "Conversation ID or title is invalid." }, { status: 400 });
    }
    const now = Date.now();

    const insert = db.prepare(
      "INSERT INTO conversations (id, title, created_at, updated_at) VALUES (?, ?, ?, ?)"
    );
    insert.run(id, title, now, now);

    return NextResponse.json({ conversation: { id, title, created_at: now, updated_at: now } });
  } catch (err: unknown) {
    return handleApiError("conversation-create", err);
  }
}

export async function DELETE(request: NextRequest) {
  const blocked = await authorizeApiRequest(request, "write");
  if (blocked) return blocked;

  try {
    const db = getDb();
    db.exec("DELETE FROM messages; DELETE FROM conversations;");
    return NextResponse.json({ success: true, message: "All conversations cleared" });
  } catch (err: unknown) {
    return handleApiError("conversations-clear", err);
  }
}
