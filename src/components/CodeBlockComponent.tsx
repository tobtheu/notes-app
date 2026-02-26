import React, { useState } from 'react';
import { NodeViewWrapper, NodeViewContent } from '@tiptap/react';
import type { NodeViewProps } from '@tiptap/react';
import { Copy, Check, ChevronDown } from 'lucide-react';
import clsx from 'clsx';

export const CodeBlockComponent: React.FC<NodeViewProps> = (props) => {
    const { node, updateAttributes, extension } = props;
    const { language: defaultLanguage } = node.attrs;
    const [copied, setCopied] = useState(false);

    // Get available languages from lowlight
    // @ts-ignore
    const languages = extension.options.lowlight.listLanguages();

    const handleCopy = () => {
        // @ts-ignore
        const text = node.textContent || '';
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <NodeViewWrapper className="relative group my-6">
            <div
                className="absolute right-4 top-4 flex items-center gap-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity"
                contentEditable={false}
            >
                {/* Language Selector */}
                <div className="relative">
                    <select
                        contentEditable={false}
                        className="appearance-none bg-gray-800/80 hover:bg-gray-800 text-gray-300 text-[10px] font-bold uppercase tracking-wider pl-3 pr-7 py-1.5 rounded-md border border-white/10 backdrop-blur-md cursor-pointer outline-none transition-colors"
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
                    <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                </div>

                {/* Copy Button */}
                <button
                    onClick={handleCopy}
                    className={clsx(
                        "p-1.5 rounded-md border backdrop-blur-md transition-all",
                        copied
                            ? "bg-green-500/20 border-green-500/50 text-green-400"
                            : "bg-gray-800/80 hover:bg-gray-800 border-white/10 text-gray-300"
                    )}
                    title="Copy code"
                >
                    {copied ? <Check size={14} /> : <Copy size={14} />}
                </button>
            </div>

            <pre className="rounded-xl overflow-hidden shadow-lg border border-gray-200 dark:border-gray-800">
                {/* @ts-ignore */}
                <NodeViewContent as="code" className={clsx(defaultLanguage && `language-${defaultLanguage}`)} />
            </pre>
        </NodeViewWrapper>
    );
};
