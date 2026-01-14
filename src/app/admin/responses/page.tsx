import Link from "next/link";
import { redirect } from "next/navigation";
import { unstable_noStore as noStore } from "next/cache";
import { db, initializeSchema } from "@/lib/db";
import { auth } from "@/lib/auth";
import { type ProjectRow, projectFromRow } from "@/types";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ChevronRight, MessageSquare, ClipboardList } from "lucide-react";

interface ProjectStats {
  voteCount: number;
  questionnaireCount: number;
}

async function getProjectsWithStats(userId: string) {
  noStore();
  await initializeSchema();

  // OPTIMIZED: Fetch all data in parallel with batch queries (instead of N+1 queries)
  const [projectResult, voteCountsResult, questionnaireCountsResult] = await Promise.all([
    db.execute({
      sql: "SELECT * FROM projects WHERE user_id = ? ORDER BY name",
      args: [userId],
    }),
    // Get vote counts grouped by project (single query for all projects)
    db.execute({
      sql: `SELECT p.project_id, COUNT(*) as count FROM votes v
            JOIN screenshots s ON v.screenshot_id = s.id
            LEFT JOIN sections sec ON s.section_id = sec.id
            LEFT JOIN pages p ON s.page_id = p.id OR sec.page_id = p.id
            JOIN projects pr ON p.project_id = pr.id
            WHERE pr.user_id = ?
            GROUP BY p.project_id`,
      args: [userId],
    }),
    // Get questionnaire response counts grouped by project (single query for all projects)
    db.execute({
      sql: `SELECT q.project_id, COUNT(DISTINCT qr.respondent_email) as count
            FROM question_responses qr
            JOIN questions q ON qr.question_id = q.id
            JOIN projects pr ON q.project_id = pr.id
            WHERE pr.user_id = ?
            GROUP BY q.project_id`,
      args: [userId],
    }),
  ]);

  // Build lookup maps for O(1) access
  const voteCountsByProject = new Map<string, number>();
  for (const row of voteCountsResult.rows) {
    const r = row as unknown as { project_id: string; count: number };
    voteCountsByProject.set(r.project_id, Number(r.count));
  }

  const questionnaireCountsByProject = new Map<string, number>();
  for (const row of questionnaireCountsResult.rows) {
    const r = row as unknown as { project_id: string; count: number };
    questionnaireCountsByProject.set(r.project_id, Number(r.count));
  }

  // Build result using maps
  const projectRows = projectResult.rows as unknown as ProjectRow[];
  const projectsWithStats = projectRows.map((projectRow) => {
    const project = projectFromRow(projectRow);
    return {
      project,
      stats: {
        voteCount: voteCountsByProject.get(project.id) || 0,
        questionnaireCount: questionnaireCountsByProject.get(project.id) || 0,
      } as ProjectStats,
    };
  });

  return projectsWithStats;
}

export default async function ResponsesPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const projectsWithStats = await getProjectsWithStats(session.user.id);

  const totalVotes = projectsWithStats.reduce((sum, p) => sum + p.stats.voteCount, 0);
  const totalQuestionnaires = projectsWithStats.reduce((sum, p) => sum + p.stats.questionnaireCount, 0);

  return (
    <div>
      <div className="mb-6 sm:mb-8">
        <h1 className="text-2xl font-bold sm:text-3xl">Responses</h1>
        <p className="text-sm text-muted-foreground sm:text-base">
          View votes and questionnaire responses from clients
        </p>
      </div>

      {/* Summary */}
      <div className="mb-6 grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              Total Votes
            </CardDescription>
            <CardTitle className="text-3xl">{totalVotes}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <ClipboardList className="h-4 w-4" />
              Questionnaire Submissions
            </CardDescription>
            <CardTitle className="text-3xl">{totalQuestionnaires}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Projects list */}
      <Card>
        <CardHeader>
          <CardTitle>Select a Project</CardTitle>
          <CardDescription>
            Choose a project to view detailed responses
          </CardDescription>
        </CardHeader>
        <CardContent>
          {projectsWithStats.length === 0 ? (
            <p className="py-8 text-center text-muted-foreground">
              No projects yet. Create a project to start collecting responses.
            </p>
          ) : (
            <div className="divide-y">
              {projectsWithStats.map(({ project, stats }) => (
                <Link
                  key={project.id}
                  href={`/admin/responses/${project.id}`}
                  className="flex items-center justify-between gap-4 py-4 transition-colors hover:bg-muted/50 -mx-4 px-4 first:pt-0 last:pb-0"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium truncate">{project.name}</h3>
                      <Badge variant="outline" className="flex-shrink-0">
                        {project.type}
                      </Badge>
                    </div>
                    <div className="mt-1 flex items-center gap-4 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <MessageSquare className="h-3 w-3" />
                        {stats.voteCount} vote{stats.voteCount !== 1 ? "s" : ""}
                      </span>
                      <span className="flex items-center gap-1">
                        <ClipboardList className="h-3 w-3" />
                        {stats.questionnaireCount} questionnaire{stats.questionnaireCount !== 1 ? "s" : ""}
                      </span>
                    </div>
                  </div>
                  <ChevronRight className="h-5 w-5 flex-shrink-0 text-muted-foreground" />
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
