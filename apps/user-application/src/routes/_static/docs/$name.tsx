import { createFileRoute, notFound } from "@tanstack/react-router";
import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkBreaks from "remark-breaks";
import rehypeHighlight from "rehype-highlight";
import "highlight.js/styles/github-dark.css";
import { Copy, Check } from "lucide-react";

export const Route = createFileRoute("/_static/docs/$name")({
  component: RouteComponent,
  loader: async (event) => {
    const response = await fetch(`${event.location.url}.md`);
    if (!response.ok) throw notFound();
    const markdown = await response.text();
    console.log(markdown);
    return { markdown };
  },
});

const markdownStyles = {
  h1: "text-2xl sm:text-3xl font-bold my-3 sm:my-4",
  h2: "text-xl sm:text-2xl font-semibold my-2 sm:my-3 border-b border-border pb-2",
  h3: "text-lg sm:text-xl font-medium my-2",
  p: "my-2 leading-relaxed text-sm sm:text-base",
  a: "text-primary underline break-words",
  ul: "list-disc ml-4 sm:ml-6 my-2 text-sm sm:text-base",
  ol: "list-decimal ml-4 sm:ml-6 my-2 text-sm sm:text-base",
  li: "my-1",
  code: "bg-muted px-1.5 py-0.5 rounded font-mono text-xs sm:text-sm text-muted-foreground border border-border",
  pre: "bg-muted p-2 sm:p-4 rounded-b-lg overflow-x-auto text-xs sm:text-sm shadow-md border border-border",
  blockquote:
    "border-l-4 border-primary pl-3 sm:pl-4 italic my-3 sm:my-4 text-sm sm:text-base",
};

function CodeBlock({ children, ...props }: any) {
  const [copied, setCopied] = useState(false);

  const codeChild = Array.isArray(children) ? children[0] : children;
  const codeClassName = codeChild?.props?.className || "";
  const language = (
    codeClassName.match(/language-([a-z0-9+#-]+)/i)?.[1] || "text"
  ).toUpperCase();

  const extractText = (node: any): string => {
    if (typeof node === "string") return node;
    if (node?.props?.children) return extractText(node.props.children);
    if (Array.isArray(node)) return node.map(extractText).join("");
    return "";
  };

  const handleCopy = async () => {
    const codeText = extractText(codeChild ?? children);
    try {
      await navigator.clipboard.writeText(codeText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy text: ", err);
    }
  };

  return (
    <div className="relative my-4 group">
      <div className="flex items-center justify-between px-3 py-2 bg-muted/50 backdrop-blur-sm border border-b-0 border-border rounded-t-lg">
        <span className="font-mono text-[10px] sm:text-xs tracking-wider uppercase text-muted-foreground">
          {language}
        </span>
        <button
          onClick={handleCopy}
          className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-foreground bg-primary/10 hover:bg-primary/20 transition-colors"
          aria-label="Copy code"
          title={copied ? "Copied!" : "Copy"}
        >
          {copied ? (
            <Check className="h-3.5 w-3.5" />
          ) : (
            <Copy className="h-3.5 w-3.5" />
          )}
          <span className="hidden sm:inline">{copied ? "Copied" : "Copy"}</span>
        </button>
      </div>
      <pre className={markdownStyles.pre + " rounded-t-none"} {...props}>
        {children}
      </pre>
    </div>
  );
}

function RouteComponent() {
  const { markdown: content } = Route.useLoaderData();

  return (
    <div className="w-full">
      <div className="p-4 sm:p-6 max-w-4xl mx-auto">
        <ReactMarkdown
          remarkPlugins={[remarkGfm, remarkBreaks]}
          rehypePlugins={[rehypeHighlight]}
          components={{
            h1: ({ children }) => (
              <h1 className={markdownStyles.h1}>{children}</h1>
            ),
            h2: ({ children }) => (
              <h2 className={markdownStyles.h2}>{children}</h2>
            ),
            h3: ({ children }) => (
              <h3 className={markdownStyles.h3}>{children}</h3>
            ),
            p: ({ children }) => <p className={markdownStyles.p}>{children}</p>,
            a: ({ href, children }) => (
              <a
                href={href}
                className={markdownStyles.a}
                target="_blank"
                rel="noopener noreferrer"
              >
                {children}
              </a>
            ),
            ul: ({ children }) => (
              <ul className={markdownStyles.ul}>{children}</ul>
            ),
            ol: ({ children }) => (
              <ol className={markdownStyles.ol}>{children}</ol>
            ),
            li: ({ children }) => (
              <li className={markdownStyles.li}>{children}</li>
            ),
            code: ({ className, children, ...props }: any) =>
              !className || !className.includes("language-") ? (
                <code className={markdownStyles.code} {...props}>
                  {children}
                </code>
              ) : (
                <code className={className} {...props}>
                  {children}
                </code>
              ),
            pre: CodeBlock,
            blockquote: ({ children }) => (
              <blockquote className={markdownStyles.blockquote}>
                {children}
              </blockquote>
            ),
            br: () => <br className="my-2" />,
            hr: () => <hr className="my-9 border-border" />,
          }}
        >
          {content}
        </ReactMarkdown>
      </div>
    </div>
  );
}
