
import React from 'react';
import type { Editor } from '@tiptap/react';
import { Bold, Italic, Heading1, Heading2, Heading3, List, CheckSquare, Quote, Code, Table, Highlighter, Link as LinkIcon, Image as ImageIcon, type LucideIcon } from 'lucide-react';
import clsx from 'clsx';

interface ToolbarButtonProps {
    icon: LucideIcon;
    label: string;
    action: () => void;
    isActive?: boolean;
}

const ToolbarButton: React.FC<ToolbarButtonProps> = ({ icon: Icon, label, action, isActive }) => (
    <button
        onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            action();
        }}
        className={clsx(
            "p-1.5 rounded-md transition-colors flex items-center justify-center",
            isActive
                ? "bg-primary-100 dark:bg-primary-900/50 text-primary-600 dark:text-primary-400"
                : "text-gray-500 dark:text-gray-400 hover:bg-primary-50 dark:hover:bg-primary-900/30 hover:text-primary-600 dark:hover:text-primary-400"
        )}
        title={label}
    >
        <Icon size={16} strokeWidth={2.5} />
    </button>
);

interface EditorToolbarProps {
    editor: Editor | null;
    mode?: 'full' | 'compact';
    onLinkClick?: () => void;
    onImageClick?: () => void;
}

export const EditorToolbar: React.FC<EditorToolbarProps> = ({ editor, mode = 'full', onLinkClick, onImageClick }) => {
    if (!editor) return null;

    const isCompact = mode === 'compact';

    return (
        <div className={clsx(
            "flex items-center gap-1 p-1 bg-white dark:bg-gray-800 shadow-xl border border-gray-200 dark:border-gray-700 rounded-lg animate-in fade-in zoom-in duration-200 w-fit",
            isCompact ? "bg-opacity-90 backdrop-blur-sm" : ""
        )}>
            <ToolbarButton
                icon={Bold}
                label="Bold"
                action={() => editor.chain().focus().toggleBold().run()}
                isActive={editor.isActive('bold')}
            />
            <ToolbarButton
                icon={Italic}
                label="Italic"
                action={() => editor.chain().focus().toggleItalic().run()}
                isActive={editor.isActive('italic')}
            />
            <ToolbarButton
                icon={Highlighter}
                label="Highlight"
                action={() => editor.chain().focus().toggleHighlight().run()}
                isActive={editor.isActive('highlight')}
            />

            {!isCompact && (
                <>
                    <div className="w-px h-4 bg-gray-200 dark:bg-gray-700 mx-0.5" />

                    <ToolbarButton
                        icon={Heading1}
                        label="Heading 1"
                        action={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
                        isActive={editor.isActive('heading', { level: 1 })}
                    />
                    <ToolbarButton
                        icon={Heading2}
                        label="Heading 2"
                        action={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
                        isActive={editor.isActive('heading', { level: 2 })}
                    />
                    <ToolbarButton
                        icon={Heading3}
                        label="Heading 3"
                        action={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
                        isActive={editor.isActive('heading', { level: 3 })}
                    />

                    <div className="w-px h-4 bg-gray-200 dark:bg-gray-700 mx-0.5" />

                    <ToolbarButton
                        icon={List}
                        label="Bullet List"
                        action={() => editor.chain().focus().toggleBulletList().run()}
                        isActive={editor.isActive('bulletList')}
                    />
                    <ToolbarButton
                        icon={CheckSquare}
                        label="Task List"
                        action={() => editor.chain().focus().toggleTaskList().run()}
                        isActive={editor.isActive('taskList')}
                    />

                    <div className="w-px h-4 bg-gray-200 dark:bg-gray-700 mx-0.5" />

                    <ToolbarButton
                        icon={Quote}
                        label="Quote"
                        action={() => editor.chain().focus().toggleBlockquote().run()}
                        isActive={editor.isActive('blockquote')}
                    />
                    <ToolbarButton
                        icon={Code}
                        label="Inline Code"
                        action={() => editor.chain().focus().toggleCode().run()}
                        isActive={editor.isActive('code')}
                    />

                    <div className="w-px h-4 bg-gray-200 dark:bg-gray-700 mx-0.5" />

                    <ToolbarButton
                        icon={Table}
                        label="Insert Table"
                        action={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
                        isActive={editor.isActive('table')}
                    />
                </>
            )}

            <div className="w-px h-4 bg-gray-200 dark:bg-gray-700 mx-0.5" />

            <ToolbarButton
                icon={LinkIcon}
                label="Link"
                action={() => {
                    // Check if handler is provided, otherwise fallback or do nothing
                    if (onLinkClick) {
                        onLinkClick();
                    } else {
                        // Fallback or legacy behavior (though getting rid of prompt is the goal)
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
            <ToolbarButton
                icon={ImageIcon}
                label="Image"
                action={() => {
                    if (onImageClick) {
                        onImageClick();
                    } else {
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
