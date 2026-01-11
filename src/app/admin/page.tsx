import Link from "next/link";
import { redirect } from "next/navigation";
import { unstable_noStore as noStore } from "next/cache";
import { db, initializeSchema } from "@/lib/db";
import { auth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FolderOpen, Image, ThumbsUp, Plus } from "lucide-react";

interface Stats {
  projectCount: number;
  screenshotCount: number;
  voteCount: number;
}

async function getStats(userId: string): Promise<Stats> {
  noStore();
  await initializeSchema();

  const projectResult = await db.execute({
    sql: "SELECT COUNT(*) as count FROM projects WHERE user_id = ?",
    args: [userId],
  });

  const screenshotResult = await db.execute({
    sql: `SELECT COUNT(*) as count FROM screenshots s
          JOIN sections sec ON s.section_id = sec.id
          JOIN pages p ON sec.page_id = p.id
          JOIN projects pr ON p.project_id = pr.id
          WHERE pr.user_id = ?`,
    args: [userId],
  });

  const voteResult = await db.execute({
    sql: `SELECT COUNT(*) as count FROM votes v
          JOIN screenshots s ON v.screenshot_id = s.id
          JOIN sections sec ON s.section_id = sec.id
          JOIN pages p ON sec.page_id = p.id
          JOIN projects pr ON p.project_id = pr.id
          WHERE pr.user_id = ?`,
    args: [userId],
  });

  return {
    projectCount: (projectResult.rows[0] as unknown as { count: number }).count,
    screenshotCount: (screenshotResult.rows[0] as unknown as { count: number }).count,
    voteCount: (voteResult.rows[0] as unknown as { count: number }).count,
  };
}

export default async function AdminDashboard() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const stats = await getStats(session.user.id);

  return (
    <div>
      <div className="mb-4 flex flex-col gap-3 sm:mb-8 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold sm:text-3xl">Dashboard</h1>
          <p className="text-sm text-muted-foreground sm:text-base">
            Overview of your style finder projects
          </p>
        </div>
        <Link href="/admin/projects/new" className="w-full sm:w-auto">
          <Button className="w-full sm:w-auto">
            <Plus className="mr-2 h-4 w-4" />
            New Project
          </Button>
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">
              Total Projects
            </CardTitle>
            <FolderOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.projectCount}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">
              Total Screenshots
            </CardTitle>
            <Image className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.screenshotCount}</div>
          </CardContent>
        </Card>

        <Card className="sm:col-span-2 md:col-span-1">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Votes</CardTitle>
            <ThumbsUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.voteCount}</div>
          </CardContent>
        </Card>
      </div>

      <div className="mt-6 sm:mt-8">
        <h2 className="mb-4 text-lg font-semibold sm:text-xl">Quick Actions</h2>
        <div className="flex flex-col gap-3 sm:flex-row sm:gap-4">
          <Link href="/admin/projects" className="w-full sm:w-auto">
            <Button variant="outline" className="w-full sm:w-auto">View All Projects</Button>
          </Link>
          <Link href="/admin/votes" className="w-full sm:w-auto">
            <Button variant="outline" className="w-full sm:w-auto">View Vote Analytics</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
