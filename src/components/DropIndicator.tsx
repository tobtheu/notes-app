import { Upload } from 'lucide-react';

export function DropIndicator() {
    return (
        <div className="drop-indicator">
            <div className="drop-indicator-text">
                <Upload size={20} />
                <span>Drop images to insert</span>
            </div>
        </div>
    );
}
