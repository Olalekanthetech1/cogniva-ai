"use client";

import { memo, type ComponentProps } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import rehypeKatex from "rehype-katex";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import { normalizeTutorMathMarkdown } from "@/lib/tutor-markdown-normalize";

const remarkPlugins = [remarkGfm, remarkMath];
const katexOptions = {
  throwOnError: false,
  strict: "ignore" as const,
  trust: false,
  maxExpand: 100,
  maxSize: 20,
  output: "htmlAndMathml" as const
};
const rehypePlugins: ComponentProps<typeof ReactMarkdown>["rehypePlugins"] = [
  [rehypeKatex, katexOptions]
];

const markdownComponents: Components = {
  a({ href, children }) {
    if (typeof href !== "string") return <>{children}</>;

    const isExternal = /^https?:\/\//i.test(href);
    return (
      <a
        href={href}
        target={isExternal ? "_blank" : undefined}
        rel={isExternal ? "noopener noreferrer" : undefined}
      >
        {children}
      </a>
    );
  },
  img({ alt }) {
    return alt ? <span>[Image: {alt}]</span> : null;
  }
};

export const TutorMessageMarkdown = memo(function TutorMessageMarkdown({
  content
}: {
  content: string;
}) {
  return (
    <div className="tutor-message-content">
      <ReactMarkdown
        remarkPlugins={remarkPlugins}
        rehypePlugins={rehypePlugins}
        components={markdownComponents}
      >
        {normalizeTutorMathMarkdown(content)}
      </ReactMarkdown>
    </div>
  );
});
