
import React from 'react';
import type { Editor } from '@tiptap/react';
import { Bold, Italic, Heading1, Heading2, Heading3, List, CheckSquare, Quote, Code, Table, Highlighter, Link as LinkIcon, Image as ImageIcon, type LucideIcon } from 'lucide-react';
import clsx from 'clsx';
import { toggleSmartMark } from '../utils/editor';

interface ToolbarButtonProps {
    icon: LucideIcon;
    label: string;
    action: () => void;
    isActive?: boolean;
    iconSize?: number;
    btnPadding?: string;
}

const ToolbarButton: React.FC<ToolbarButtonProps> = ({ icon: Icon, label, action, isActive, iconSize = 16, btnPadding = "p-1.5" }) => (
    <button
        onMouseDown={(e) => {
            e.preventDefault();
        }}
        onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            action();
        }}
        className={clsx(
            "rounded-md transition-colors flex items-center justify-center",
            btnPadding,
            isActive
                ? "bg-primary-100 dark:bg-primary-900/50 text-primary-600 dark:text-primary-400"
                : "text-gray-500 dark:text-gray-400 hover:bg-primary-50 dark:hover:bg-primary-900/30 hover:text-primary-600 dark:hover:text-primary-400"
        )}
        title={label}
    >
        <Icon size={iconSize} strokeWidth={2.5} />
    </button>
);

interface EditorToolbarProps {
    editor: Editor | null;
    mode?: 'full' | 'compact';
    onLinkClick?: () => void;
    onImageClick?: () => void;
    mobile?: boolean;
}

/**
 * EditorToolbar Component
 * A floating formatting bar for the Tiptap editor.
 * Features:
 * - Basic formatting (Bold, Italic, Highlight)
 * - Headings and Lists
 * - Advanced items (Blockquote, Code, Table)
 * - Custom Modal integration for Links and Images
 * - Responsive "Compact" vs "Full" modes
 */
export const EditorToolbar: React.FC<EditorToolbarProps> = ({ editor, mode = 'full', onLinkClick, onImageClick, mobile = false }) => {
    /**
     * --- FORCED UPDATES ---
     * Tiptap's internal state (selection, isActive) doesn't always trigger React re-renders.
     * We subscribe to 'transaction' to ensure the toolbar buttons reflect the current formatting.
     */
    const [, setUpdateCount] = React.useState(0);

    React.useEffect(() => {
        if (!editor) return;

        const updateHandler = () => {
            setUpdateCount(prev => prev + 1);
        };

        editor.on('transaction', updateHandler);

        return () => {
            editor.off('transaction', updateHandler);
        };
    }, [editor]);

    if (!editor) return null;

    const isCompact = mode === 'compact';
    const iconSize = mobile ? 20 : 16;
    const btnPadding = mobile ? "p-2.5" : "p-1.5";

    const Btn: React.FC<Omit<ToolbarButtonProps, 'iconSize' | 'btnPadding'>> = (props) => (
        <ToolbarButton {...props} iconSize={iconSize} btnPadding={btnPadding} />
    );

    return (
        <div className={clsx(
            "flex items-center gap-1 p-1 bg-white dark:bg-gray-800 shadow-xl border border-gray-200 dark:border-gray-700 rounded-lg animate-in fade-in zoom-in duration-200 w-full md:w-fit max-w-[calc(100vw-2rem)] overflow-x-auto no-scrollbar shrink-0",
            isCompact ? "bg-opacity-90 backdrop-blur-sm" : ""
        )}>
            {/* --- BASIC FORMATTING --- */}
            <Btn
                icon={Bold}
                label="Bold"
                action={() => toggleSmartMark(editor, 'bold')}
                isActive={editor.isActive('bold')}
            />
            <Btn
                icon={Italic}
                label="Italic"
                action={() => toggleSmartMark(editor, 'italic')}
                isActive={editor.isActive('italic')}
            />
            <Btn
                icon={Highlighter}
                label="Highlight"
                action={() => toggleSmartMark(editor, 'highlight')}
                isActive={editor.isActive('highlight')}
            />

            {!isCompact && (
                <>
                    <div className="w-px h-4 bg-gray-200 dark:bg-gray-700 mx-0.5" />

                    {/* --- HEADINGS --- */}
                    <Btn
                        icon={Heading1}
                        label="Heading 1"
                        action={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
                        isActive={editor.isActive('heading', { level: 1 })}
                    />
                    <Btn
                        icon={Heading2}
                        label="Heading 2"
                        action={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
                        isActive={editor.isActive('heading', { level: 2 })}
                    />
                    <Btn
                        icon={Heading3}
                        label="Heading 3"
                        action={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
                        isActive={editor.isActive('heading', { level: 3 })}
                    />

                    <div className="w-px h-4 bg-gray-200 dark:bg-gray-700 mx-0.5" />

                    {/* --- LISTS --- */}
                    <Btn
                        icon={List}
                        label="Bullet List"
                        action={() => editor.chain().focus().toggleBulletList().run()}
                        isActive={editor.isActive('bulletList')}
                    />
                    <Btn
                        icon={CheckSquare}
                        label="Task List"
                        action={() => editor.chain().focus().toggleTaskList().run()}
                        isActive={editor.isActive('taskList')}
                    />

                    <div className="w-px h-4 bg-gray-200 dark:bg-gray-700 mx-0.5" />

                    {/* --- ADVANCED BLOCKS --- */}
                    <Btn
                        icon={Quote}
                        label="Quote"
                        action={() => editor.chain().focus().toggleBlockquote().run()}
                        isActive={editor.isActive('blockquote')}
                    />
                    <Btn
                        icon={Code}
                        label="Code Block"
                        action={() => editor.chain().focus().toggleCodeBlock().run()}
                        isActive={editor.isActive('codeBlock')}
                    />

                    <div className="w-px h-4 bg-gray-200 dark:bg-gray-700 mx-0.5" />

                    <Btn
                        icon={Table}
                        label="Insert Table"
                        action={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
                        isActive={editor.isActive('table')}
                    />
                </>
            )}

            <div className="w-px h-4 bg-gray-200 dark:bg-gray-700 mx-0.5" />

            {/* --- MEDIA & LINKS --- */}
            <Btn
                icon={LinkIcon}
                label="Link"
                action={() => {
                    // Prefer the custom UrlInputModal via onLinkClick
                    if (onLinkClick) {
                        onLinkClick();
                    } else {
                        // Fallback to native prompt (used if parent doesn't provide modal)
                        const previousUrl = editor.getAttributes('link').href;
                        const url = window.prompt('URL', previousUrl);
                        if (url === null) return;
                        if (url === '') {
                            editor.chain().focus().extendMarkRange('link').unsetLink().run();
                            return;
                        }
                        editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
                    }
                }}
                isActive={editor.isActive('link')}
            />
            <Btn
                icon={ImageIcon}
                label="Image"
                action={() => {
                    // Prefer the custom UrlInputModal via onImageClick
                    if (onImageClick) {
                        onImageClick();
                    } else {
                        // Fallback to native prompt
                        const url = window.prompt('Image URL');
                        if (url) {
                            editor.chain().focus().setImage({ src: url }).run();
                        }
                    }
                }}
                isActive={editor.isActive('image')}
            />
        </div>
    );
};
