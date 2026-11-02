import { Fragment, type ReactNode } from 'react';
import { copyWithToast } from '../lib/files';
import { IconCopy } from './icons';

const TOKEN = /\*\*(.+?)\*\*|\*(.+?)\*|`([^`]+)`|\[([^\]]+)\]\(([^)\s]+)\)/g;

/**
 * Renders the help content's inline markup (**bold**, *italic*, `code`,
 * [label](https://…)) as React elements. No HTML is injected.
 */
export function Rich({ text }: { text: string }) {
  const out: ReactNode[] = [];
  let last = 0;
  for (const m of text.matchAll(TOKEN)) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const [, bold, italic, code, label, url] = m;
    const key = out.length;
    if (bold !== undefined) out.push(<strong key={key}>{bold}</strong>);
    else if (italic !== undefined) out.push(<em key={key}>{italic}</em>);
    else if (code !== undefined) out.push(<code key={key}>{code}</code>);
    else if (/^https?:\/\//.test(url!)) {
      out.push(
        <a key={key} href={url} target="_blank" rel="noreferrer">
          {label}
        </a>,
      );
    } else out.push(<Fragment key={key}>{label}</Fragment>);
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return <>{out}</>;
}

/** A command block with a copy button. */
export function CodeBlock({ code, label }: { code: string; label: string }) {
  return (
    <div className="code-block">
      <pre tabIndex={0} aria-label={label}>
        <code>{code}</code>
      </pre>
      <button
        type="button"
        className="btn ghost icon sm"
        aria-label={`Copy: ${label}`}
        title="Copy"
        onClick={() => void copyWithToast(code, 'Copied to the clipboard.')}
      >
        <IconCopy />
      </button>
    </div>
  );
}
