const MARKDOWN_LINK = /\[([^\]]+)\]\(([^)]+)\)/g;

// Case/project text comes from freeform GitHub issue and milestone bodies, which
// sometimes use markdown-style links - including the common mistake of pasting the
// real URL as the link *label* and leaving a placeholder like "(url)" in the
// target. Render a real, clickable link either way instead of the raw
// "[label](target)" syntax showing up as text.
export default function FormattedText({ text }: { text: string }) {
  if (!text) return null;

  const nodes: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;
  MARKDOWN_LINK.lastIndex = 0;
  while ((match = MARKDOWN_LINK.exec(text))) {
    if (match.index > lastIndex) nodes.push(text.slice(lastIndex, match.index));
    const [full, label, target] = match;
    const href = /^https?:\/\//i.test(label) ? label : target;
    nodes.push(
      <a key={key++} href={href} target="_blank" rel="noopener noreferrer">
        {label}
      </a>,
    );
    lastIndex = match.index + full.length;
  }
  if (lastIndex < text.length) nodes.push(text.slice(lastIndex));

  return <>{nodes}</>;
}
