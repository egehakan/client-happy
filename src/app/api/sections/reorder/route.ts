import { NextResponse } from "next/server";
import { z } from "zod";
import { db, initializeSchema } from "@/lib/db";
import { requireAuth, userOwnsAllSections } from "@/lib/auth/api-auth";

const reorderSectionsSchema = z.object({
  sectionOrders: z.array(
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
    const result = reorderSectionsSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: "Validation failed", details: result.error.flatten() },
        { status: 400 }
      );
    }

    const { sectionOrders } = result.data;

    // Verify ownership for all sections (single batch query)
    const sectionIds = sectionOrders.map((s) => s.id);
    if (!(await userOwnsAllSections(session.user.id, sectionIds))) {
      return NextResponse.json(
        { error: "One or more sections not found or not owned" },
        { status: 404 }
      );
    }

    // Update all sections
    for (const s of sectionOrders) {
      await db.execute({
        sql: "UPDATE sections SET sort_order = ?, updated_at = datetime('now') WHERE id = ?",
        args: [s.sortOrder, s.id],
      });
    }

    return NextResponse.json({ success: true, updatedCount: sectionOrders.length });
  } catch (err) {
    console.error("Failed to reorder sections:", err);
    return NextResponse.json({ error: "Failed to reorder sections" }, { status: 500 });
  }
}
