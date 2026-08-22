import type { ReactNode } from "react";
import { Container } from "@/components/ui/Container";

/** Shared shell for text pages, so legal and editorial copy share one rhythm. */
export function Prose({
  title,
  intro,
  children,
}: {
  title: string;
  intro?: string;
  children: ReactNode;
}) {
  return (
    <Container className="py-16 sm:py-20">
      <div className="max-w-2xl">
        <h1 className="font-display text-4xl font-semibold tracking-tight text-ink sm:text-5xl">
          {title}
        </h1>
        {intro && (
          <p className="mt-4 text-lg leading-relaxed text-ink-muted">{intro}</p>
        )}
        <div className="mt-10 space-y-8 [&_h2]:font-display [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:text-ink [&_li]:leading-relaxed [&_p]:leading-relaxed [&_p]:text-ink-muted [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-5 [&_ul]:text-ink-muted">
          {children}
        </div>
      </div>
    </Container>
  );
}
