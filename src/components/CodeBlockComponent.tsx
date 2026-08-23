import React, { useState } from 'react';
import { NodeViewWrapper, NodeViewContent } from '@tiptap/react';
import type { NodeViewProps } from '@tiptap/react';
import { Copy, Check, ChevronDown } from 'lucide-react';
import clsx from 'clsx';

/**
 * CodeBlockComponent
 * Custom NodeView for Tiptap code blocks.
 * Provides syntax highlighting language selection and a copy-to-clipboard feature.
 */
export const CodeBlockComponent: React.FC<NodeViewProps> = (props) => {
    const { node, updateAttributes, extension } = props;
    const { language: defaultLanguage } = node.attrs;
    const [copied, setCopied] = useState(false);

    // Get available languages from the lowlight extension configuration
    // @ts-ignore
    const languages = extension.options.lowlight.listLanguages();

    const handleCopy = () => {
        // @ts-ignore
        const text = node.textContent || '';
        navigator.clipboard.writeText(text);
        setCopied(true);
        // Reset copy state after 2 seconds
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <NodeViewWrapper className="relative group my-5">
            <div
                className="absolute right-3 top-3 flex items-center gap-1.5 z-10 opacity-0 group-hover:opacity-100 transition-opacity"
                contentEditable={false}
            >
                {/* --- LANGUAGE SELECTOR --- */}
                <div className="relative">
                    <select
                        contentEditable={false}
                        className="appearance-none bg-[var(--canvas-bg)]/90 hover:bg-[var(--card-hover)] text-[var(--text-main)] text-[10px] font-bold uppercase tracking-wider pl-2.5 pr-6 py-1 rounded-xl border border-[var(--border-subtle)] shadow-xs backdrop-blur-md cursor-pointer outline-none transition-colors"
                        value={defaultLanguage || 'auto'}
                        onChange={event => updateAttributes({ language: event.target.value })}
                    >
                        <option value="auto">Auto</option>
                        {languages.map((lang: string) => (
                            <option key={lang} value={lang}>
                                {lang}
                            </option>
                        ))}
                    </select>
                    <ChevronDown size={11} className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none" />
                </div>

                {/* --- COPY BUTTON --- */}
                <button
                    type="button"
                    onClick={handleCopy}
                    className={clsx(
                        "p-1.5 rounded-xl border backdrop-blur-md transition-all shadow-xs",
                        copied
                            ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-500"
                            : "bg-[var(--canvas-bg)]/90 hover:bg-[var(--card-hover)] border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-[var(--text-main)]"
                    )}
                    title="Copy code"
                >
                    {copied ? <Check size={13} /> : <Copy size={13} />}
                </button>
            </div>

            <pre className="p-4 rounded-2xl overflow-x-auto bg-[var(--card-hover)] border border-[var(--border-subtle)] font-mono text-xs text-[var(--text-main)] shadow-xs leading-relaxed">
                {/* The actual code content rendered by Tiptap */}
                {/* @ts-ignore */}
                <NodeViewContent as="code" className={clsx(defaultLanguage && `language-${defaultLanguage}`)} />
            </pre>
        </NodeViewWrapper>
    );
};
