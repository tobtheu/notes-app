import Image, { type ImageOptions } from '@tiptap/extension-image';
import { mergeAttributes, ReactNodeViewRenderer } from '@tiptap/react';
import { convertFileSrc } from '@tauri-apps/api/core';
import { ResizableImageNode } from '../components/ResizableImageNode';

export interface ImageWithCaptionOptions extends ImageOptions {
    workspacePathRef: { current: string };
}

export const ImageWithCaption = Image.extend<ImageWithCaptionOptions>({
    addOptions() {
        return {
            ...this.parent?.(),
            workspacePathRef: { current: '' },
        } as ImageWithCaptionOptions;
    },
    addAttributes() {
        return {
            ...this.parent?.(),
            width: {
                default: null,
                parseHTML: element => element.getAttribute('width'),
                renderHTML: attributes => {
                    return {
                        width: attributes.width,
                    };
                },
            },
            alt: {
                default: null,
                parseHTML: element => element.getAttribute('alt') || element.getAttribute('data-caption') || element.getAttribute('caption'),
                renderHTML: attributes => {
                    return {
                        alt: attributes.alt,
                        'data-caption': attributes.alt,
                    };
                },
            },
        };
    },

    renderHTML({ HTMLAttributes }) {
        const { alt, src, width, ...imgAttributes } = HTMLAttributes;
        let finalSrc = src;

        if (finalSrc && finalSrc.startsWith('.assets/') && this.options.workspacePathRef?.current) {
            const absolutePath = `${this.options.workspacePathRef.current}/${finalSrc}`;
            try {
                finalSrc = convertFileSrc(absolutePath);
            } catch (e) {
                console.warn("Could not convert image src to asset URL:", e);
            }
        }

        const mergedImgAttributes = mergeAttributes(this.options.HTMLAttributes, imgAttributes, { alt, src: finalSrc, width });

        if (!alt) {
            return ['img', mergedImgAttributes];
        }

        return [
            'figure',
            { class: 'image-with-caption' },
            ['img', mergedImgAttributes],
            ['figcaption', { class: 'image-caption' }, alt],
        ];
    },

    addNodeView() {
        return ReactNodeViewRenderer(ResizableImageNode);
    },

    addStorage() {
        return {
            markdown: {
                serialize(state: any, node: any) {
                    if (node.attrs.width) {
                        // Persist width as an HTML tag in the Markdown
                        state.write(`<img src="${state.esc(node.attrs.src)}" alt="${state.esc(node.attrs.alt || '')}" width="${state.esc(node.attrs.width)}" />`);
                    } else {
                        // Standard markdown image fallback
                        state.write(`![${state.esc(node.attrs.alt || '')}](${state.esc(node.attrs.src)})`);
                    }
                },
                parse: {
                    setup(_markdownit: any) {
                        // HTML parsing is enabled globally in tiptap-markdown config, 
                        // so <img> tags will be automatically parsed back to this Node.
                    }
                }
            }
        };
    }
});
