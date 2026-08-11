import { PageHeader } from "@/components/page-header";
import ConnectionForm from "../ConnectionForm";
import { safeAgentReturnTo } from "../connection-helpers";

export default async function NewConnectionPage({
  searchParams,
}: {
  searchParams: Promise<{ bindTo?: string | string[]; returnTo?: string | string[] }>;
}) {
  const params = await searchParams;
  const bindTo = typeof params.bindTo === "string" ? params.bindTo : undefined;
  const returnTo = safeAgentReturnTo(
    typeof params.returnTo === "string" ? params.returnTo : undefined,
  );

  return (
    <section>
      <PageHeader title="New Slack bot" />
      <ConnectionForm mode="create" bindTo={bindTo} returnTo={returnTo ?? undefined} />
    </section>
  );
}
