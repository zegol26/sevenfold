"use client";

import { Tag } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { ChangelogEntry } from "@/lib/changelog";

export function VersionBadge({ version, changelog }: { version: string; changelog: ChangelogEntry[] }) {
  const latest = changelog[0];

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          className="hidden items-center gap-2 rounded-full border border-border bg-muted/50 px-3 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted lg:flex"
          type="button"
        >
          <Tag className="h-3 w-3" />
          <span className="font-mono font-semibold text-foreground">v{version}</span>
          <span className="max-w-[220px] truncate">{latest?.slogan}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent>
        <div className="mb-2 text-sm font-semibold">What&apos;s new</div>
        <div className="grid max-h-80 gap-4 overflow-y-auto">
          {changelog.slice(0, 5).map((entry) => (
            <div key={entry.version} className="grid gap-1">
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="font-mono">v{entry.version}</Badge>
                <span className="text-xs text-muted-foreground">{entry.date}</span>
              </div>
              <div className="text-sm font-medium">{entry.slogan}</div>
              <ul className="ms-4 list-disc text-xs text-muted-foreground">
                {entry.highlights.map((highlight) => (
                  <li key={highlight}>{highlight}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
