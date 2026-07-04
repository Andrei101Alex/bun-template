import { Button } from "@repo/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/card";

import { api } from "@/lib/api";

async function getGreeting() {
  try {
    const { data, error } = await api.greeting({ name: "Acme" }).get();
    if (error) return null;
    return data;
  } catch {
    return null;
  }
}

export default async function HomePage() {
  const greeting = await getGreeting();

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 px-6 py-20">
      <div>
        <h1 className="text-4xl font-bold tracking-tight">Acme</h1>
        <p className="text-muted-foreground mt-2 text-lg">
          Next.js marketing site sharing the same shadcn/ui components as the dashboard, typed
          end-to-end via Eden.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Server-side greeting</CardTitle>
          <CardDescription>
            Fetched from the Elysia API in a React Server Component.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-between gap-4">
          <p className="text-sm">
            {greeting?.greeting ?? "API unavailable — start @repo/api on :3001"}
          </p>
          <Button>Get started</Button>
        </CardContent>
      </Card>
    </main>
  );
}
