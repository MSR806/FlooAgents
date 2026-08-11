"use client";

import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import SkillForm from "../SkillForm";

export default function NewSkillPage() {
  return (
    <div className="flex flex-col gap-4">
      <Link href="/skills" className="text-sm text-muted-foreground hover:text-foreground">
        ← Skills
      </Link>
      <PageHeader title="New skill" className="mb-0" />
      <SkillForm mode="create" />
    </div>
  );
}
