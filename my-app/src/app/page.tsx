import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default async function Home() {
  const { userId } = await auth();
  if (userId) redirect("/dashboard");

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-black">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      <main className="flex flex-col items-center gap-6 px-6 text-center">
        <h1 className="text-4xl font-bold tracking-tight">ViewSQL</h1>
        <p className="max-w-md text-lg text-muted-foreground">
          Visualize how your SQL queries work. Understand complex joins and CTEs
          at a glance using your own database schema.
        </p>
        <Link href="/sign-in">
          <Button size="lg">Get Started</Button>
        </Link>
      </main>
    </div>
  );
}
