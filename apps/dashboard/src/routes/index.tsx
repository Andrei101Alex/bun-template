import { Button } from "@repo/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/card";
import { Input } from "@repo/ui/components/input";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

import { api } from "@/lib/api";

export const Route = createFileRoute("/")({
  component: HomePage,
});

function HomePage() {
  const [name, setName] = useState("world");

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["greeting", name],
    queryFn: async () => {
      const { data, error } = await api.greeting({ name }).get();
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
          <CardTitle>Greeting from the API</CardTitle>
          <CardDescription>
            Type a name and fetch a type-safe response from the Elysia service.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex gap-2">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter a name"
            />
            <Button onClick={() => refetch()} disabled={isFetching}>
              {isFetching ? "Loading…" : "Refetch"}
            </Button>
          </div>
          <p className="text-sm">{isLoading ? "Loading…" : (data?.greeting ?? "No data yet")}</p>
        </CardContent>
      </Card>
    </main>
  );
}
