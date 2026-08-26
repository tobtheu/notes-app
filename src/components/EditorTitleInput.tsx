import React from 'react';
import clsx from 'clsx';
import { useTranslation } from '../i18n';

interface EditorTitleInputProps {
    title: string;
    titleRef: React.RefObject<HTMLTextAreaElement | null>;
    isFocusMode: boolean;
    spellcheckEnabled: boolean;
    onChange: (value: string) => void;
    onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
    onBlur: () => void;
}

export function EditorTitleInput({
    title,
    titleRef,
    isFocusMode,
    spellcheckEnabled,
    onChange,
    onKeyDown,
    onBlur,
}: EditorTitleInputProps) {
    const { t } = useTranslation();

    return (
        <div className={clsx("w-full", isFocusMode ? "pt-8 mb-6" : "pt-4 pb-2")}>
            <textarea
                ref={titleRef as React.RefObject<HTMLTextAreaElement>}
                autoFocus={!title || title.trim() === ''}
                className={clsx(
                    "w-full p-0 font-extrabold bg-transparent border-none outline-none resize-none overflow-hidden text-[var(--text-main)] leading-tight placeholder-[var(--text-muted)]",
                    isFocusMode ? "text-5xl font-black text-center" : "text-3xl pr-12"
                )}
                placeholder={t('editor.titlePlaceholder')}
                value={title}
                onChange={(e) => onChange(e.target.value)}
                onKeyDown={onKeyDown}
                onBlur={onBlur}
                spellCheck={spellcheckEnabled}
                rows={1}
            />
        </div>
    );
}
