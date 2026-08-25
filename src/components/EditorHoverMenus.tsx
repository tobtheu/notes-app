import type { Editor as TipTapEditor } from '@tiptap/react';
import { BubbleMenu } from '@tiptap/react/menus';
import { UrlInputModal } from './UrlInputModal';
import { BubbleToolbarContent } from './BubbleToolbarContent';

interface EditorHoverMenusProps {
    editor: TipTapEditor | null;
    isLinkModalOpen: boolean;
    setIsLinkModalOpen: (open: boolean) => void;
    linkModalData: { url: string; text: string };
    saveLink: (url: string, text: string) => void;
    isIOS: boolean;
    hoveredLink: { url: string; rect: DOMRect } | null;
    setHoveredLink: (link: { url: string; rect: DOMRect } | null) => void;
    clearHideTimeout: () => void;
    startHideTimeout: () => void;
    openLinkModal: () => void;
    onNavigate?: (id: string, anchor?: string) => void;
}

export function EditorHoverMenus({
    editor,
    isLinkModalOpen,
    setIsLinkModalOpen,
    linkModalData,
    saveLink,
    isIOS,
    hoveredLink,
    setHoveredLink,
    clearHideTimeout,
    startHideTimeout,
    openLinkModal,
    onNavigate,
}: EditorHoverMenusProps) {
    if (!editor) return null;

    return (
        <>
            {/* Link Modal */}
            <UrlInputModal
                isOpen={isLinkModalOpen}
                type="link"
                initialUrl={linkModalData.url}
                initialText={linkModalData.text}
                onClose={() => setIsLinkModalOpen(false)}
                onSave={saveLink}
                isIOS={isIOS}
            />

            {/* Merged Formatting & Link Menu */}
            <BubbleMenu
                pluginKey="formattingMenu"
                editor={editor}
                updateDelay={0}
                shouldShow={({ from, to }) => {
                    if (isIOS) return false;
                    return from !== to;
                }}
            >
                <BubbleToolbarContent
                    editor={editor}
                    onLinkClick={openLinkModal}
                    onRemoveLink={() => setHoveredLink(null)}
                    onNavigate={onNavigate}
                />
            </BubbleMenu>

            {/* Hover-based Link Toolbar */}
            {hoveredLink && editor.state.selection.empty && (
                <div
                    className="fixed z-[100] animate-fade-in-up"
                    style={{
                        top: hoveredLink.rect.top - 45,
                        left: Math.max(10, Math.min(window.innerWidth - 250, hoveredLink.rect.left + (hoveredLink.rect.width / 2) - 100))
                    }}
                    onMouseEnter={clearHideTimeout}
                    onMouseLeave={startHideTimeout}
                >
                    <BubbleToolbarContent
                        editor={editor}
                        onLinkClick={openLinkModal}
                        onRemoveLink={() => setHoveredLink(null)}
                        hoveredLink={hoveredLink}
                        onNavigate={onNavigate}
                    />
                </div>
            )}
        </>
    );
}
