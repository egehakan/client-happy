import { NextResponse } from "next/server";
import { z } from "zod";
import { db, initializeSchema } from "@/lib/db";
import { requireAuth, userOwnsAllPages } from "@/lib/auth/api-auth";

const reorderPagesSchema = z.object({
  pageOrders: z.array(
    z.object({
      id: z.string().min(1),
      sortOrder: z.number().int().min(0),
    })
  ).min(1),
});

export async function POST(request: Request) {
  const { session, error } = await requireAuth();
  if (error) return error;

  try {
    await initializeSchema();
    const body = await request.json();
    const result = reorderPagesSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: "Validation failed", details: result.error.flatten() },
        { status: 400 }
      );
    }

    const { pageOrders } = result.data;

    // Verify ownership for all pages (single batch query)
    const pageIds = pageOrders.map((p) => p.id);
    if (!(await userOwnsAllPages(session.user.id, pageIds))) {
      return NextResponse.json(
        { error: "One or more pages not found or not owned" },
        { status: 404 }
      );
    }

    // Update all pages
    for (const p of pageOrders) {
      await db.execute({
        sql: "UPDATE pages SET sort_order = ?, updated_at = datetime('now') WHERE id = ?",
        args: [p.sortOrder, p.id],
      });
    }

    return NextResponse.json({ success: true, updatedCount: pageOrders.length });
  } catch (err) {
    console.error("Failed to reorder pages:", err);
    return NextResponse.json({ error: "Failed to reorder pages" }, { status: 500 });
  }
}
