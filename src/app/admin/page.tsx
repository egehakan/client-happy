import Link from "next/link";
import { getDb } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FolderOpen, Image, ThumbsUp, Plus } from "lucide-react";

interface Stats {
  projectCount: number;
  screenshotCount: number;
  voteCount: number;
}

function getStats(): Stats {
  const db = getDb();

  const projectCount = db
    .prepare("SELECT COUNT(*) as count FROM projects")
    .get() as { count: number };

  const screenshotCount = db
    .prepare("SELECT COUNT(*) as count FROM screenshots")
    .get() as { count: number };

  const voteCount = db
    .prepare("SELECT COUNT(*) as count FROM votes")
    .get() as { count: number };

  return {
    projectCount: projectCount.count,
    screenshotCount: screenshotCount.count,
    voteCount: voteCount.count,
  };
}

export default function AdminDashboard() {
  const stats = getStats();

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">
            Overview of your style finder projects
          </p>
        </div>
        <Link href="/admin/projects/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            New Project
          </Button>
        </Link>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
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

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Votes</CardTitle>
            <ThumbsUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.voteCount}</div>
          </CardContent>
        </Card>
      </div>

      <div className="mt-8">
        <h2 className="mb-4 text-xl font-semibold">Quick Actions</h2>
        <div className="flex gap-4">
          <Link href="/admin/projects">
            <Button variant="outline">View All Projects</Button>
          </Link>
          <Link href="/admin/votes">
            <Button variant="outline">View Vote Analytics</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
