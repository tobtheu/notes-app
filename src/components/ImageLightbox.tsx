import { X } from 'lucide-react';

interface ImageLightboxProps {
    src: string;
    caption?: string;
    onClose: () => void;
}

export function ImageLightbox({ src, caption, onClose }: ImageLightboxProps) {
    return (
        <div
            className="image-lightbox"
            onClick={onClose}
        >
            <button className="image-lightbox-close" onClick={onClose}>
                <X size={24} />
            </button>
            <div className="image-lightbox-content" onClick={e => e.stopPropagation()}>
                <img src={src} alt={caption || 'Preview'} />
                {caption && (
                    <div className="image-lightbox-caption">
                        {caption}
                    </div>
                )}
            </div>
        </div>
    );
}
