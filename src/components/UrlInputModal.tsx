import React from 'react';
import { X } from 'lucide-react';
import type { Note } from '../types';
import clsx from 'clsx';
import { useUrlInputModal } from '../hooks/useUrlInputModal';
import { LinkInsertForm } from './LinkInsertForm';
import { ImageInsertForm } from './ImageInsertForm';

interface UrlInputModalProps {
    isOpen: boolean;
    type: 'link' | 'image';
    initialUrl?: string;
    initialText?: string;
    initialCaption?: string;
    allNotes?: Note[];
    onClose: () => void;
    onSave: (url: string, text?: string, caption?: string) => void;
    workspacePath?: string;
    isIOS?: boolean;
}

/**
 * UrlInputModal
 * A versatile modal used for inserting both hyperlink and image references.
 */
export const UrlInputModal: React.FC<UrlInputModalProps> = (props) => {
    const { isOpen, type, onClose, allNotes = [], isIOS = false } = props;

    const {
        url,
        setUrl,
        text,
        setText,
        caption,
        setCaption,
        linkType,
        setLinkType,
        searchNoteTerm,
        setSearchNoteTerm,
        selectedNote,
        setSelectedNote,
        selectedHeadline,
        setSelectedHeadline,
        inputRef,
        fileInputRef,
        localFileName,
        previewUrl,
        filteredNotes,
        headlines,
        handleFileSelect,
        handleSubmit,
    } = useUrlInputModal(props);

    if (!isOpen) return null;

    return (
        <div className={clsx(
            "fixed inset-0 z-50 flex p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200",
            isIOS ? "items-start" : "items-center justify-center",
        )} style={isIOS ? { paddingTop: 'max(env(safe-area-inset-top, 0px), 24px)' } : undefined} onClick={onClose}>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 w-full max-w-md p-4 animate-in zoom-in-95 duration-200 max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-100">
                        {type === 'link' ? 'Insert Link' : 'Insert Image'}
                    </h3>
                    <button onClick={onClose} className="p-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit}>
                    {type === 'link' ? (
                        <LinkInsertForm
                            text={text}
                            setText={setText}
                            linkType={linkType}
                            setLinkType={setLinkType}
                            url={url}
                            setUrl={setUrl}
                            inputRef={inputRef}
                            searchNoteTerm={searchNoteTerm}
                            setSearchNoteTerm={setSearchNoteTerm}
                            selectedNote={selectedNote}
                            setSelectedNote={setSelectedNote}
                            filteredNotes={filteredNotes}
                            headlines={headlines}
                            selectedHeadline={selectedHeadline}
                            setSelectedHeadline={setSelectedHeadline}
                        />
                    ) : (
                        <ImageInsertForm
                            url={url}
                            setUrl={setUrl}
                            caption={caption}
                            setCaption={setCaption}
                            previewUrl={previewUrl}
                            localFileName={localFileName}
                            fileInputRef={fileInputRef}
                            inputRef={inputRef}
                            handleFileSelect={handleFileSelect}
                        />
                    )}

                    <div className="flex justify-end gap-2">
                        <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-md transition-colors">Cancel</button>
                        <button type="submit" disabled={!url} className="px-4 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-md transition-colors">Save</button>
                    </div>
                </form>
            </div>
        </div>
    );
};
