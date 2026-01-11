import Link from "next/link";
import { unstable_noStore as noStore } from "next/cache";
import { db, initializeSchema } from "@/lib/db";
import { type ProjectRow, projectFromRow } from "@/types";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { ProjectCard } from "@/components/admin/project-card";

async function getProjects() {
  noStore();
  await initializeSchema();
  const result = await db.execute("SELECT * FROM projects ORDER BY created_at DESC");
  return result.rows.map((row) => projectFromRow(row as unknown as ProjectRow));
}

export default async function ProjectsPage() {
  const projects = await getProjects();

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Projects</h1>
          <p className="text-muted-foreground">
            Manage your client style understanding projects
          </p>
        </div>
        <Link href="/admin/projects/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            New Project
          </Button>
        </Link>
      </div>

      {projects.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center">
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
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      )}
    </div>
  );
}
