import { NextRequest, NextResponse } from "next/server";
import { getDb, Reminder } from "@/lib/db";
import { authorizeApiRequest, handleApiError, readJsonRequest } from "@/lib/apiSecurity";

export async function GET(request: NextRequest) {
  const blocked = await authorizeApiRequest(request);
  if (blocked) return blocked;

  try {
    const db = getDb();
    const rows = db.prepare("SELECT * FROM reminders ORDER BY created_at DESC").all() as unknown as Reminder[];
    return NextResponse.json({ reminders: rows });
  } catch (err: unknown) {
    return handleApiError("reminder-list", err);
  }
}

export async function POST(req: NextRequest) {
  const blocked = await authorizeApiRequest(req, "write");
  if (blocked) return blocked;

  try {
    const body = await readJsonRequest(req, 8 * 1024);
    const title = body.title;
    const dueTime = body.due_time;

    if (typeof title !== "string" || !title.trim() || title.trim().length > 160) {
      return NextResponse.json({ error: "A valid reminder title is required." }, { status: 400 });
    }
    if (dueTime !== undefined && (typeof dueTime !== "string" || dueTime.trim().length > 120)) {
      return NextResponse.json({ error: "Reminder due time is invalid." }, { status: 400 });
    }

    const db = getDb();
    const id = `rem_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const now = Date.now();
    const due = (typeof dueTime === "string" ? dueTime.trim() : "") || "Unscheduled";

    db.prepare("INSERT INTO reminders (id, title, due_time, completed, created_at) VALUES (?, ?, ?, 0, ?)").run(
      id,
      title.trim(),
      due,
      now
    );

    return NextResponse.json({ reminder: { id, title: title.trim(), due_time: due, completed: 0, created_at: now } });
  } catch (err: unknown) {
    return handleApiError("reminder-create", err);
  }
}

export async function PATCH(req: NextRequest) {
  const blocked = await authorizeApiRequest(req, "write");
  if (blocked) return blocked;

  try {
    const body = await readJsonRequest(req, 8 * 1024);
    const id = body.id;
    const completed = body.completed;

    if (typeof id !== "string" || !/^[A-Za-z0-9_-]{1,100}$/.test(id)) {
      return NextResponse.json({ error: "A valid reminder ID is required." }, { status: 400 });
    }
    if (typeof completed !== "boolean" && completed !== 0 && completed !== 1) {
      return NextResponse.json({ error: "Reminder completion state is invalid." }, { status: 400 });
    }

    const db = getDb();
    db.prepare("UPDATE reminders SET completed = ? WHERE id = ?").run(completed ? 1 : 0, id);
    return NextResponse.json({ success: true, id, completed: completed ? 1 : 0 });
  } catch (err: unknown) {
    return handleApiError("reminder-update", err);
  }
}

export async function DELETE(req: NextRequest) {
  const blocked = await authorizeApiRequest(req, "write");
  if (blocked) return blocked;

  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id || !/^[A-Za-z0-9_-]{1,100}$/.test(id)) {
      return NextResponse.json({ error: "A valid reminder ID is required." }, { status: 400 });
    }
    const db = getDb();
    db.prepare("DELETE FROM reminders WHERE id = ?").run(id);
    return NextResponse.json({ success: true, id });
  } catch (err: unknown) {
    return handleApiError("reminder-delete", err);
  }
}
