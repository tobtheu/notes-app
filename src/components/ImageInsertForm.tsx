import React from 'react';
import { Upload } from 'lucide-react';

interface ImageInsertFormProps {
    url: string;
    setUrl: (v: string) => void;
    caption: string;
    setCaption: (v: string) => void;
    previewUrl: string;
    localFileName: string | null;
    fileInputRef: React.RefObject<HTMLInputElement | null>;
    inputRef: React.RefObject<HTMLInputElement | null>;
    handleFileSelect: (file: File) => void;
}

export function ImageInsertForm({
    url,
    setUrl,
    caption,
    setCaption,
    previewUrl,
    localFileName,
    fileInputRef,
    inputRef,
    handleFileSelect
}: ImageInsertFormProps) {
    return (
        <div className="mb-6">
            <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFileSelect(file);
                }}
                className="hidden"
            />
            <button
                type="button"
                onDragOver={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    (e.currentTarget as HTMLElement).classList.add('border-primary-500', 'bg-primary-50', 'dark:bg-primary-900/20');
                }}
                onDragEnter={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                }}
                onDragLeave={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    (e.currentTarget as HTMLElement).classList.remove('border-primary-500', 'bg-primary-50', 'dark:bg-primary-900/20');
                }}
                onDrop={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    (e.currentTarget as HTMLElement).classList.remove('border-primary-500', 'bg-primary-50', 'dark:bg-primary-900/20');
                    const file = e.dataTransfer.files?.[0];
                    if (file) handleFileSelect(file);
                }}
                onClick={() => fileInputRef.current?.click()}
                className="w-full py-4 px-4 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg flex flex-col items-center gap-2 hover:border-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-all group overflow-hidden"
            >
                {previewUrl && (
                    previewUrl.startsWith('data:') ||
                    previewUrl.startsWith('asset://') ||
                    previewUrl.startsWith('http') ||
                    previewUrl.startsWith('local-asset://')
                ) ? (
                    <div className="relative w-full aspect-video rounded-md overflow-hidden bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700">
                        <img src={previewUrl} alt="Preview" className="w-full h-full object-contain" />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-medium">
                            Click or drop to change
                        </div>
                    </div>
                ) : (
                    <>
                        <div className="w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center group-hover:bg-primary-100 dark:group-hover:bg-primary-800 transition-colors">
                            <Upload className="text-gray-500 dark:text-gray-400 group-hover:text-primary-600" size={20} />
                        </div>
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300 group-hover:text-primary-700 dark:group-hover:text-primary-300">
                            {localFileName || 'Browse or Drop local files'}
                        </span>
                    </>
                )}
            </button>
            <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t border-gray-200 dark:border-gray-700"></span>
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-white dark:bg-gray-800 px-2 text-gray-500 dark:text-gray-400">Or use a URL</span>
                </div>
            </div>

            <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Image URL</label>
                <input
                    ref={inputRef}
                    type="text"
                    placeholder="https://example.com/image.png"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
            </div>
            <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Caption</label>
                <input
                    type="text"
                    placeholder="Add a caption..."
                    value={caption}
                    onChange={(e) => setCaption(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
            </div>
        </div>
    );
}
