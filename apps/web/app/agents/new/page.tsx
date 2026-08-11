"use client";

import { Sparkles } from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { builderChatHref } from "@/lib/builder";
import AgentForm from "../AgentForm";

export default function NewAgentPage() {
  return (
    <div className="flex flex-col gap-4">
      <Link href="/agents" className="text-sm text-muted-foreground hover:text-foreground">
        ← Agents
      </Link>
      <PageHeader title="New agent" className="mb-0">
        <Button
          variant="outline"
          size="sm"
          render={<Link href={builderChatHref()} />}
          nativeButton={false}
        >
          <Sparkles /> Create via chat
        </Button>
      </PageHeader>
      <AgentForm mode="create" />
    </div>
  );
}
