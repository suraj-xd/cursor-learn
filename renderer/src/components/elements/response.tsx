"use client";

import { type ComponentProps, type CSSProperties, memo, useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";
import { useSettingsStore } from "@/store/settings";
import { codeThemeStyles } from "@/lib/code-themes";
import { CollapsibleCodeBlock } from "@/components/collapsible-code-block";

type ResponseProps = ComponentProps<"div"> & {
  children: string;
  codeThemeStyle?: { [key: string]: CSSProperties };
};

const CodeBlock = memo(function CodeBlock({
  code,
  language,
  style,
}: {
  code: string;
  language: string;
  style: { [key: string]: CSSProperties };
}) {
  return <CollapsibleCodeBlock code={code} language={language} style={style} />;
});

const MarkdownContent = memo(function MarkdownContent({
  text,
  codeThemeStyle,
}: {
  text: string;
  codeThemeStyle: { [key: string]: CSSProperties };
}) {
  const components = useMemo(
    () => ({
      code({
        inline,
        className,
        children,
        ...props
      }: {
        inline?: boolean;
        className?: string;
        children?: React.ReactNode;
      }) {
        const match = /language-(\w+)/.exec(className || "");

        if (!inline) {
          const codeString = String(children).replace(/\n$/, "");
          return (
            <CodeBlock
              code={codeString}
              language={match ? match[1] : "javascript"}
              style={codeThemeStyle}
            />
          );
        }

        return (
          <code
            className={cn(
              "bg-muted px-1.5 py-0.5 rounded text-sm font-mono",
              className
            )}
            {...props}
          >
            {children}
          </code>
        );
      },
    }),
    [codeThemeStyle]
  );

  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
      {text}
    </ReactMarkdown>
  );
});

export const Response = memo(
  ({ className, children, codeThemeStyle: customStyle, ...props }: ResponseProps) => {
    const codeTheme = useSettingsStore((state) => state.codeTheme);
    const themeStyle = useMemo(
      () => customStyle ?? codeThemeStyles[codeTheme] ?? codeThemeStyles.vscDarkPlus,
      [customStyle, codeTheme]
    );

    return (
      <div
        className={cn(
          "size-full min-w-0 break-words [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 prose dark:prose-invert prose-pre:p-0 prose-pre:bg-transparent prose-p:break-words prose-p:overflow-wrap-anywhere",
          className
        )}
        {...props}
      >
        <MarkdownContent text={children} codeThemeStyle={themeStyle} />
      </div>
    );
  },
  (prevProps, nextProps) =>
    prevProps.children === nextProps.children &&
    prevProps.codeThemeStyle === nextProps.codeThemeStyle
);

Response.displayName = "Response";
