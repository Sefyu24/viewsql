"use client";

import { useParams } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import { Id } from "../../../../../convex/_generated/dataModel";
import { Skeleton } from "@/components/ui/skeleton";
import { PGliteProvider } from "@/providers/pglite-provider";
import { ProjectWorkspace } from "@/components/project-workspace";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function ProjectPage() {
  const { id } = useParams<{ id: string }>();
  const project = useQuery(api.projects.getProject, {
    id: id as Id<"projects">,
  });

  if (project === undefined) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Skeleton className="h-12 w-48" />
      </div>
    );
  }

  if (project === null) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4">
        <p className="text-muted-foreground">Project not found.</p>
        <Link href="/dashboard">
          <Button variant="outline">Back to Dashboard</Button>
        </Link>
      </div>
    );
  }

  return (
    <PGliteProvider options={{ initSql: project.schemaSql }}>
      <ProjectWorkspace projectName={project.name} />
    </PGliteProvider>
  );
}
