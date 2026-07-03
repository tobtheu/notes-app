import { forwardRef, useImperativeHandle } from 'react';
import type { Note } from '../types';
import { EditorContent } from '@tiptap/react';
import { BubbleMenu } from '@tiptap/react/menus';
import { convertFileSrc } from '@tauri-apps/api/core';
import clsx from 'clsx';

import { EditorToolbar } from './EditorToolbar';
import { UrlInputModal } from './UrlInputModal';
import { BubbleToolbarContent } from './BubbleToolbarContent';
import { ImageLightbox } from './ImageLightbox';
import { DropIndicator } from './DropIndicator';
import { useMarkdownEditor } from '../hooks/useMarkdownEditor';

export interface MarkdownEditorRef {
    focus: (position?: 'start' | 'end') => void;
}

interface MarkdownEditorProps {
    content: string;
    allNotes?: Note[];
    onChange: (markdown: string) => void;
    onNavigate?: (id: string, anchor?: string) => void;
    toolbarVisible?: boolean;
    spellcheckEnabled?: boolean;
    imageCloudSync?: boolean;
    workspacePath: string;
    header?: React.ReactNode;
    isFocusMode?: boolean;
    iosLandscapeFullscreen?: boolean;
    onArrowUpAtStart?: () => void;
    onBlur?: () => void;
}

/**
 * MarkdownEditor Component
 * A feature-rich WYSIWYG editor powered by Tiptap.
 * Provides: Markdown parsing, Slash Commands, Wiki-style internal linking,
 * Image handling (drag & drop), and dynamic toolbars.
 */
export const MarkdownEditor = forwardRef<MarkdownEditorRef, MarkdownEditorProps>((props, ref) => {
    const {
        toolbarVisible = true,
        workspacePath,
        imageCloudSync = false,
        header,
        isFocusMode = false,
        iosLandscapeFullscreen = false,
        allNotes,
        onNavigate
    } = props;

    const {
        editor,
        localAssetsDir,
        isLinkModalOpen,
        setIsLinkModalOpen,
        linkModalData,
        isImageModalOpen,
        setIsImageModalOpen,
        imageModalData,
        hoveredLink,
        setHoveredLink,
        lightboxImage,
        setLightboxImage,
        isScrolling,
        isIOS,
        keyboardHeight,
        isDragging,
        setIsDragging,
        scrollContainerRef,
        toolbarRef,
        clearHideTimeout,
        startHideTimeout,
        handleScroll,
        openLinkModal,
        openImageModal,
        saveLink,
        saveImage
    } = useMarkdownEditor(props);

    useImperativeHandle(ref, () => ({
        focus: (position?: 'start' | 'end') => {
            if (!editor) return;
            if (position === 'start') {
                editor.chain().focus().setTextSelection(1).run();
            } else if (position === 'end') {
                editor.chain().focus('end').run();
            } else {
                editor.chain().focus().run();
            }
        }
    }), [editor]);

    if (!editor) {
        return null;
    }

    return (
        <div
            className={clsx(
                "flex flex-col flex-1 w-full relative overflow-hidden",
                isScrolling && "is-scrolling"
            )}
            onMouseLeave={() => setHoveredLink(null)}
            style={{ backgroundColor: 'var(--app-bg)' }}
        >
            {/* Link Modal */}
            <UrlInputModal
                isOpen={isLinkModalOpen}
                type="link"
                initialUrl={linkModalData.url}
                initialText={linkModalData.text}
                allNotes={allNotes}
                onClose={() => setIsLinkModalOpen(false)}
                onSave={saveLink}
                isIOS={isIOS}
            />

            {/* Image Modal */}
            <UrlInputModal
                isOpen={isImageModalOpen}
                type="image"
                initialUrl={imageModalData.src}
                initialCaption={imageModalData.caption}
                onClose={() => setIsImageModalOpen(false)}
                onSave={saveImage}
                workspacePath={workspacePath}
                isIOS={isIOS}
            />

            {/* Merged Formatting & Link Menu */}
            {editor && (
                <BubbleMenu
                    pluginKey="formattingMenu"
                    editor={editor}
                    updateDelay={0}
                    shouldShow={({ from, to, editor }) => {
                        if (isIOS) return false;
                        return from !== to || editor.isActive('image');
                    }}
                >
                    <BubbleToolbarContent
                        editor={editor}
                        onLinkClick={openLinkModal}
                        onRemoveLink={() => setHoveredLink(null)}
                        onImageEdit={() => {
                            const attrs = editor.getAttributes('image');
                            openImageModal(attrs);
                        }}
                        onImagePreview={() => {
                            const attrs = editor.getAttributes('image');
                            let previewSrc = attrs.src;
                            if (previewSrc && previewSrc.startsWith('.assets/')) {
                                try {
                                    previewSrc = convertFileSrc(`${workspacePath}/${previewSrc}`);
                                } catch (e) {
                                    console.warn("Could not convert image src to asset URL:", e);
                                }
                            } else if (previewSrc && previewSrc.startsWith('local-asset://')) {
                                try {
                                    const filename = previewSrc.replace('local-asset://', '');
                                    if (localAssetsDir) {
                                        previewSrc = convertFileSrc(`${localAssetsDir}/${filename}`);
                                    }
                                } catch (e) {
                                    console.warn("Could not convert local image src to asset URL:", e);
                                }
                            }
                            setLightboxImage({ src: previewSrc, caption: attrs.alt });
                        }}
                        onNavigate={onNavigate}
                    />
                </BubbleMenu>
            )}

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

            {/* Image Lightbox */}
            {lightboxImage && (
                <ImageLightbox
                    src={lightboxImage.src}
                    caption={lightboxImage.caption}
                    onClose={() => setLightboxImage(null)}
                />
            )}

            {/* Drop Indicator */}
            {isDragging && <DropIndicator />}

            {/* Content area - isolated scroll area */}
            <div
                ref={scrollContainerRef}
                className={clsx(
                    "flex-1 overflow-y-auto custom-scrollbar min-h-0 cursor-text group/editor",
                    isFocusMode && "focus-mode-active"
                )}
                style={isIOS && keyboardHeight > 0 ? { paddingBottom: `${keyboardHeight + 80}px` } : undefined}
                onScroll={handleScroll}
                onDragEnter={(e) => {
                    e.preventDefault();
                    setIsDragging(true);
                }}
                onDragOver={(e) => {
                    e.preventDefault();
                    setIsDragging(true);
                }}
                onDragLeave={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    if (
                        e.clientX <= rect.left ||
                        e.clientX >= rect.right ||
                        e.clientY <= rect.top ||
                        e.clientY >= rect.bottom
                    ) {
                        setIsDragging(false);
                    }
                }}
                onDrop={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setIsDragging(false);
                    if (e.dataTransfer?.files?.length) {
                        const file = e.dataTransfer.files[0];
                        if (file.type.startsWith('image/')) {
                            const reader = new FileReader();
                            reader.onload = async (re) => {
                                if (re.target?.result && editor) {
                                    const base64 = re.target.result as string;
                                    const extension = file.name.split('.').pop() || 'png';
                                    const filename = `img-${Date.now()}.${extension}`;

                                    try {
                                        const res = imageCloudSync
                                            ? await window.tauriAPI.saveAsset(workspacePath, filename, base64)
                                            : await window.tauriAPI.saveLocalAsset(filename, base64);

                                        if (res.success && res.path) {
                                            editor.chain().focus().setImage({ src: res.path }).run();
                                        } else {
                                            console.error("Failed to save asset:", res.error);
                                        }
                                    } catch (err) {
                                        console.error("Save asset error:", err);
                                    }
                                }
                            };
                            reader.readAsDataURL(file);
                        }
                    }
                }}
                onClick={(e) => {
                    if (e.target === e.currentTarget || (e.target as HTMLElement).classList.contains('max-w-4xl')) {
                        editor.chain().focus('end').run();
                    }
                }}
            >
                <div
                    className="max-w-4xl mx-auto pt-0 pb-8 px-4 md:px-8 min-h-full flex flex-col w-full"
                    style={iosLandscapeFullscreen ? {
                        paddingLeft: 'max(10%, env(safe-area-inset-left, 16px))',
                        paddingRight: 'max(10%, env(safe-area-inset-right, 16px))',
                    } : undefined}
                >
                    {header}
                    <EditorContent editor={editor} className="prose dark:prose-invert prose-sm sm:prose-base lg:prose-lg xl:prose-2xl flex-1 flex flex-col break-words [overflow-wrap:anywhere]" />
                </div>
            </div>

            {/* Footer Toolbar - native accessory bar on iOS, floating web bar on desktop */}
            {toolbarVisible && !isIOS && (
                <div
                    ref={toolbarRef}
                    className="px-2 backdrop-blur-md border-t border-gray-100 dark:border-gray-800 flex items-center justify-center w-full box-content"
                    style={keyboardHeight > 0
                        ? { backgroundColor: 'var(--app-bg)', position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 9998, paddingTop: 4, paddingBottom: 4 }
                        : { backgroundColor: 'var(--app-bg)', paddingTop: 8, paddingBottom: 'calc(8px + var(--safe-bottom, 0vh))' }
                    }
                >
                    <EditorToolbar
                        editor={editor}
                        onLinkClick={() => openLinkModal()}
                        onImageClick={openImageModal}
                        mobile={keyboardHeight > 0}
                    />
                </div>
            )}
        </div>
    );
});

MarkdownEditor.displayName = 'MarkdownEditor';
