import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { db, initializeSchema } from "@/lib/db";
import { auth } from "@/lib/auth";
import { z } from "zod";

const deleteAccountSchema = z.object({
  password: z.string().min(1, "Password is required to confirm deletion"),
});

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await initializeSchema();
    const body = await request.json();
    const result = deleteAccountSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: "Password is required to confirm deletion" },
        { status: 400 }
      );
    }

    const { password } = result.data;

    // Get current user
    const userResult = await db.execute({
      sql: "SELECT password_hash FROM users WHERE id = ?",
      args: [session.user.id],
    });

    if (userResult.rows.length === 0) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const user = userResult.rows[0] as unknown as { password_hash: string };

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) {
      return NextResponse.json(
        { error: "Password is incorrect" },
        { status: 400 }
      );
    }

    // Delete all user's data (cascading through projects -> pages -> sections -> screenshots -> votes)
    // First get all project IDs
    const projectsResult = await db.execute({
      sql: "SELECT id FROM projects WHERE user_id = ?",
      args: [session.user.id],
    });

    // Delete votes for user's screenshots
    for (const project of projectsResult.rows) {
      const projectId = (project as unknown as { id: string }).id;
      await db.execute({
        sql: `DELETE FROM votes WHERE screenshot_id IN (
          SELECT s.id FROM screenshots s
          JOIN sections sec ON s.section_id = sec.id
          JOIN pages p ON sec.page_id = p.id
          WHERE p.project_id = ?
        )`,
        args: [projectId],
      });
    }

    // Delete screenshots
    for (const project of projectsResult.rows) {
      const projectId = (project as unknown as { id: string }).id;
      await db.execute({
        sql: `DELETE FROM screenshots WHERE section_id IN (
          SELECT sec.id FROM sections sec
          JOIN pages p ON sec.page_id = p.id
          WHERE p.project_id = ?
        )`,
        args: [projectId],
      });
    }

    // Delete sections
    for (const project of projectsResult.rows) {
      const projectId = (project as unknown as { id: string }).id;
      await db.execute({
        sql: `DELETE FROM sections WHERE page_id IN (
          SELECT id FROM pages WHERE project_id = ?
        )`,
        args: [projectId],
      });
    }

    // Delete pages
    await db.execute({
      sql: "DELETE FROM pages WHERE project_id IN (SELECT id FROM projects WHERE user_id = ?)",
      args: [session.user.id],
    });

    // Delete projects
    await db.execute({
      sql: "DELETE FROM projects WHERE user_id = ?",
      args: [session.user.id],
    });

    // Delete user
    await db.execute({
      sql: "DELETE FROM users WHERE id = ?",
      args: [session.user.id],
    });

    return NextResponse.json({ message: "Account deleted successfully" });
  } catch (err) {
    console.error("Delete account error:", err);
    return NextResponse.json(
      { error: "Failed to delete account" },
      { status: 500 }
    );
  }
}
