"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/page-header";
import ConnectionForm from "../ConnectionForm";
import type { SlackConnection } from "../connection-helpers";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "/api";

export default function ConnectionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [conn, setConn] = useState<SlackConnection | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${API_BASE}/slack/connections/${id}`)
      .then((r) => {
        if (!r.ok) throw new Error(`Request failed (${r.status})`);
        return r.json() as Promise<SlackConnection>;
      })
      .then(setConn)
      .catch((e: unknown) =>
        setError(e instanceof Error ? e.message : "Failed to load connection"),
      );
  }, [id]);

  return (
    <div className="flex flex-col gap-6">
      <Link href="/connections" className="text-sm text-muted-foreground hover:text-foreground">
        ← Connections
      </Link>

      {error ? (
        <p className="text-sm text-destructive">{error}</p>
      ) : conn === null ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <>
          <PageHeader title={conn.name} />
          <ConnectionForm
            mode="edit"
            id={conn.id}
            initial={{ name: conn.name }}
            onSaved={() => router.push("/connections")}
          />
        </>
      )}
    </div>
  );
}
