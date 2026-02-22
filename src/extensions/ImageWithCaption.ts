import Image from '@tiptap/extension-image';
import { mergeAttributes } from '@tiptap/core';

export const ImageWithCaption = Image.extend({
    addAttributes() {
        return {
            ...this.parent?.(),
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
        const { alt, ...imgAttributes } = HTMLAttributes;
        const mergedImgAttributes = mergeAttributes(this.options.HTMLAttributes, imgAttributes, { alt });

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
});
