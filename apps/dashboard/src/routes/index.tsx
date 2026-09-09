import { Button } from "@repo/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/card";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";

import { api } from "@/lib/api";

export const Route = createFileRoute("/")({
  component: HomePage,
});

function HomePage() {
  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["health"],
    queryFn: async () => {
      const { data, error } = await api.health.get();
      if (error) throw error;
      return data;
    },
  });

  return (
    <main className="mx-auto flex max-w-xl flex-col gap-6 px-6 py-16">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Acme Dashboard</h1>
        <p className="text-muted-foreground mt-1">
          Vite + TanStack Router/Query + shadcn/ui, typed end-to-end via Eden.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>API health</CardTitle>
          <CardDescription>
            A type-safe call to the Elysia service, checked against the route definition itself.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <p className="text-sm">
            {isLoading
              ? "Loading…"
              : data
                ? `${data.status} · up ${Math.round(data.uptime)}s`
                : "No data yet"}
          </p>
          <Button onClick={() => refetch()} disabled={isFetching} className="self-start">
            {isFetching ? "Loading…" : "Refetch"}
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
