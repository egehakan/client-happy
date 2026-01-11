import Link from "next/link";
import { redirect } from "next/navigation";
import { unstable_noStore as noStore } from "next/cache";
import { db, initializeSchema } from "@/lib/db";
import { auth } from "@/lib/auth";
import { type ProjectRow, projectFromRow } from "@/types";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { ProjectCard } from "@/components/admin/project-card";

async function getProjects(userId: string) {
  noStore();
  await initializeSchema();
  const result = await db.execute({
    sql: "SELECT * FROM projects WHERE user_id = ? ORDER BY created_at DESC",
    args: [userId],
  });
  return result.rows.map((row) => projectFromRow(row as unknown as ProjectRow));
}

export default async function ProjectsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const projects = await getProjects(session.user.id);

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold sm:text-3xl">Projects</h1>
          <p className="text-sm text-muted-foreground sm:text-base">
            Manage your client style understanding projects
          </p>
        </div>
        <Link href="/admin/projects/new" className="w-full sm:w-auto">
          <Button className="w-full sm:w-auto">
            <Plus className="mr-2 h-4 w-4" />
            New Project
          </Button>
        </Link>
      </div>

      {projects.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center sm:p-12">
          <h3 className="text-lg font-medium">No projects yet</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Create your first project to get started
          </p>
          <Link href="/admin/projects/new" className="mt-4 inline-block">
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Create Project
            </Button>
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      )}
    </div>
  );
}
