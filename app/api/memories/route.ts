import { NextRequest, NextResponse } from "next/server";
import { getDb, Memory } from "@/lib/db";
import { authorizeApiRequest, handleApiError, readJsonRequest } from "@/lib/apiSecurity";

export async function GET(request: NextRequest) {
  const blocked = await authorizeApiRequest(request);
  if (blocked) return blocked;

  try {
    const db = getDb();
    const rows = db.prepare("SELECT * FROM memories ORDER BY created_at DESC").all() as unknown as Memory[];
    return NextResponse.json({ memories: rows });
  } catch (err: unknown) {
    return handleApiError("memory-list", err);
  }
}

export async function POST(req: NextRequest) {
  const blocked = await authorizeApiRequest(req, "write");
  if (blocked) return blocked;

  try {
    const body = await readJsonRequest(req, 8 * 1024);
    const fact = body.fact;
    const category = body.category;

    if (typeof fact !== "string" || !fact.trim() || fact.trim().length > 2_000) {
      return NextResponse.json({ error: "A valid memory fact is required." }, { status: 400 });
    }
    if (category !== undefined && (typeof category !== "string" || category.trim().length > 60)) {
      return NextResponse.json({ error: "Memory category is invalid." }, { status: 400 });
    }

    const db = getDb();
    const id = `mem_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const now = Date.now();
    const cat = (typeof category === "string" ? category.trim() : "") || "general";

    const insert = db.prepare("INSERT INTO memories (id, fact, category, created_at) VALUES (?, ?, ?, ?)");
    insert.run(id, fact.trim(), cat, now);

    return NextResponse.json({ memory: { id, fact: fact.trim(), category: cat, created_at: now } });
  } catch (err: unknown) {
    return handleApiError("memory-create", err);
  }
}

export async function DELETE(req: NextRequest) {
  const blocked = await authorizeApiRequest(req, "write");
  if (blocked) return blocked;

  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    const all = searchParams.get("all");

    const db = getDb();
    if (all === "true") {
      db.exec("DELETE FROM memories");
      return NextResponse.json({ success: true, message: "All memories wiped" });
    }

    if (!id) {
      return NextResponse.json({ error: "id or all=true required" }, { status: 400 });
    }

    db.prepare("DELETE FROM memories WHERE id = ?").run(id);
    return NextResponse.json({ success: true, id });
  } catch (err: unknown) {
    return handleApiError("memory-delete", err);
  }
}
