import { ChevronDown, LoaderCircle } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { type ActivityItem, groupActivity } from "./activity";

export function Markdown({ children }: { children: string }) {
  return (
    <div className="break-words [&_a]:underline [&_blockquote]:border-l-2 [&_blockquote]:pl-4 [&_blockquote]:text-muted-foreground [&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[0.9em] [&_h1]:mt-5 [&_h1]:text-xl [&_h1]:font-semibold [&_h2]:mt-5 [&_h2]:text-lg [&_h2]:font-semibold [&_h3]:mt-4 [&_h3]:font-semibold [&_li]:ml-5 [&_ol]:list-decimal [&_p]:my-3 [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:bg-muted [&_pre]:p-3 [&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_strong]:font-semibold [&_ul]:list-disc">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          table: ({ children: tableChildren }) => (
            <div className="my-4 overflow-x-auto rounded-lg border">
              <table className="w-full border-collapse text-left text-sm">{tableChildren}</table>
            </div>
          ),
          th: ({ children: cellChildren }) => (
            <th className="border-b bg-muted px-3 py-2 font-medium">{cellChildren}</th>
          ),
          tr: ({ children: rowChildren }) => (
            <tr className="border-b last:border-b-0">{rowChildren}</tr>
          ),
          td: ({ children: cellChildren }) => <td className="px-3 py-2">{cellChildren}</td>,
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}

export function ActivityBlock({ items, running }: { items: ActivityItem[]; running: boolean }) {
  // Number the groups before windowing: while a run streams, `slice(-5)` shifts
  // every position within the window, so a key built from the slice index would
  // point at a different group each time a step arrives. The absolute position in
  // the append-only group list stays put.
  const groups = groupActivity(items).map((group, position) => ({ group, position }));
  const visibleGroups = running ? groups.slice(-5) : groups;
  const omittedGroups = groups.length - visibleGroups.length;
  return (
    <details
      open={running || undefined}
      className="group rounded-lg border border-border/60 bg-muted/30 text-xs text-muted-foreground"
    >
      <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2 font-medium text-foreground marker:content-none">
        {running ? (
          <LoaderCircle className="size-3.5 shrink-0 animate-spin text-primary" />
        ) : (
          <ChevronDown className="size-3.5 shrink-0 -rotate-90 transition-transform group-open:rotate-0" />
        )}
        <span>
          {running ? "Working" : "Activity"} · {items.length}{" "}
          {items.length === 1 ? "step" : "steps"}
        </span>
      </summary>
      <div className="space-y-1 border-t border-border/60 px-3 py-2">
        {omittedGroups > 0 ? (
          <p className="text-muted-foreground/80">{omittedGroups} earlier groups</p>
        ) : null}
        {visibleGroups.map(({ group, position }) => (
          <div key={position} className="flex min-w-0 gap-2 leading-5">
            <span className="shrink-0 font-medium text-foreground">{group.label}</span>
            {group.detail ? <span className="min-w-0 truncate">· {group.detail}</span> : null}
          </div>
        ))}
      </div>
    </details>
  );
}
