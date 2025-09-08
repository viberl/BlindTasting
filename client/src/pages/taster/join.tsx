import { useState } from "react";
import { useRoute, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

type Tasting = {
  id: number;
  title: string;
  requiresPassword: boolean;
  isPublic: boolean;
};

export default function JoinPage() {
  const [match, params] = useRoute("/taster/join/:id");
  const tastingId = params?.id as string;
  const [password, setPassword] = useState("");
  const toast = useToast();
  const [, setLocation] = useLocation();

  const { data: tasting, isLoading, error } = useQuery<Tasting, Error>({
    queryKey: ["tasting", tastingId],
    queryFn: () =>
      fetch(`/api/tastings/${tastingId}`)
        .then((res) => {
          if (!res.ok) throw new Error("Fehler beim Laden der Verkostung");
          return res.json();
        })
  });

  const { mutate: joinTasting, isPending: isJoining } = useMutation({
    mutationFn: () =>
      fetch(`/api/tastings/${tastingId}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      }).then(async (res) => {
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || err.message || "Fehler beim Beitreten");
        }
        return res.json();
      }),
    onSuccess: () => setLocation(`/taster/waiting/${tastingId}`),
    onError: (error: Error) => {
      toast.toast({
        title: "Fehler beim Beitreten",
        description: error.message,
        variant: "destructive" as const
      });
    },
  });

  if (isLoading) {
    return <div className="p-4">Lädt...</div>;
  }
  if (error) {
    return <div className="p-4 text-red-600">Fehler: {(error as Error).message}</div>;
  }

  if (!tasting) {
    return <div className="p-4">Verkostung nicht gefunden</div>;
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (tasting.requiresPassword && !password) return;
    joinTasting();
  };

  return (
    <div className="p-4 max-w-md mx-auto">
      <h1 className="text-2xl font-bold mb-4">
        Beitreten zur Verkostung "{tasting.title}"
      </h1>
      {tasting.requiresPassword && (
        <div className="mb-4">
          <label className="block mb-1">Passwort</label>
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Passwort eingeben"
          />
        </div>
      )}
      <form onSubmit={handleSubmit} className="space-y-4">
        <Button
          type="submit"
          disabled={isJoining}
          className="w-full"
        >
          {isJoining ? "Beitreten..." : "Beitreten"}
        </Button>
      </form>
    </div>
  );
}