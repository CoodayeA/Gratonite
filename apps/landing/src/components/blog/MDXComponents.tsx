import type { MDXRemoteProps } from "next-mdx-remote/rsc";

export const mdxComponents: MDXRemoteProps["components"] = {
  h1: ({ ref: _ref, ...props }) => (
    <h1
      className="font-display text-4xl sm:text-5xl font-bold tracking-tight mb-6 mt-12"
      {...props}
    />
  ),
  h2: ({ ref: _ref, ...props }) => (
    <h2
      className="font-display text-2xl sm:text-3xl font-bold tracking-tight mb-4 mt-10"
      {...props}
    />
  ),
  h3: ({ ref: _ref, ...props }) => (
    <h3
      className="font-display text-xl font-bold mb-3 mt-8"
      {...props}
    />
  ),
  p: (props) => (
    <p
      className="text-foreground/70 leading-relaxed mb-6 text-lg"
      {...props}
    />
  ),
  ul: (props) => <ul className="list-disc pl-6 mb-6 space-y-2" {...props} />,
  ol: (props) => (
    <ol className="list-decimal pl-6 mb-6 space-y-2" {...props} />
  ),
  li: (props) => (
    <li className="text-foreground/70 text-lg leading-relaxed" {...props} />
  ),
  blockquote: (props) => (
    <blockquote
      className="bg-yellow/20 neo-border-2 rounded-lg p-6 my-8 font-display text-lg font-medium"
      {...props}
    />
  ),
  code: (props) => (
    <code
      className="bg-charcoal text-white px-2 py-1 rounded text-sm font-mono neo-border-2"
      {...props}
    />
  ),
  pre: (props) => (
    <pre
      className="bg-charcoal text-white p-6 rounded-xl neo-border overflow-x-auto mb-6 text-sm"
      {...props}
    />
  ),
  a: (props) => (
    <a
      className="text-purple font-bold underline decoration-2 underline-offset-2 hover:text-purple-light transition-colors"
      {...props}
    />
  ),
  hr: () => <hr className="my-12" style={{ borderTop: "3px solid var(--neo-border-color)" }} />,
  img: (props) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      className="neo-border rounded-xl my-8 w-full"
      alt={props.alt || ""}
      {...props}
    />
  ),
};
