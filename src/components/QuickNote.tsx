import { useState, useEffect, useRef } from 'react';
import { useNotes } from '../hooks/useNotes';
import { invoke } from '@tauri-apps/api/core';
import { Loader2, X, Zap } from 'lucide-react';

export function QuickNote() {
  const { currentFolder, saveNote, notes, isLoading, getNoteId, reloadNotes } = useNotes();
  const [content, setContent] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Focus on mount
  useEffect(() => {
    if (!isLoading && currentFolder && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [isLoading, currentFolder]);

  const handleSave = async () => {
    if (!currentFolder || !content.trim()) return;
    setIsSaving(true);
    try {
      const existingNote = notes.find(n => n.filename === 'Quick Note.md');
      const timestamp = new Date().toLocaleString('de-DE', { 
        day: '2-digit', month: '2-digit', year: 'numeric', 
        hour: '2-digit', minute: '2-digit' 
      });
      
      const newEntry = `### ${timestamp}\n${content.trim()}\n\n---\n\n`;
      const existingContent = existingNote?.content || '';
      
      // Robust header preservation:
      // 1. Split by lines
      // 2. Filter out the exact header line if it exists at the top
      // 3. Prepend header and new entry to the rest
      const lines = existingContent.split(/\r?\n/);
      // Check if first line is the header, if so skip it to avoid duplicates
      const hasHeader = lines.length > 0 && lines[0].trim() === '# Quick Note';
      const filteredExisting = (hasHeader ? lines.slice(1) : lines).join('\n').trim();
      
      const finalContent = `# Quick Note\n\n${newEntry}${filteredExisting}`;

      const id = existingNote ? getNoteId(existingNote) : getNoteId({ filename: 'Quick Note.md', folder: '', content: '' } as any);
      
      await saveNote(id, 'Quick Note.md', finalContent, '', true);
      await reloadNotes(false);
      setContent(''); // Clear after save
    } catch (e) {
      console.error('Failed to save quick note', e);
    } finally {
      setIsSaving(false);
    }
  };

  const handleClose = async () => {
    if (content.trim()) {
      await handleSave();
    }
    await invoke('hide_quick_note');
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      handleClose();
    } else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      handleClose();
    }
  };

  if (!currentFolder) {
    return (
      <div className="flex items-center justify-center h-screen bg-white dark:bg-gray-900">
        <Loader2 className="animate-spin text-primary-500" />
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden shadow-2xl">
      <div className="flex items-center justify-between px-4 py-3 bg-gray-50/50 dark:bg-gray-800/50 border-bottom border-gray-100 dark:border-gray-700 drag">
        <div className="flex items-center gap-2">
          <Zap size={16} className="text-primary-500" />
          <span className="text-sm font-bold text-gray-700 dark:text-gray-200">Quick Note</span>
        </div>
        <button 
          onClick={handleClose}
          className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors no-drag"
        >
          <X size={16} className="text-gray-500" />
        </button>
      </div>

      <div className="flex-1 p-4 flex flex-col">
        <textarea
          ref={textareaRef}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="What's on your mind?"
          className="flex-1 w-full bg-transparent border-none outline-none resize-none text-gray-800 dark:text-gray-200 leading-relaxed text-sm placeholder-gray-400"
        />
      </div>

      <div className="px-4 py-2 bg-gray-50/30 dark:bg-gray-800/30 flex items-center justify-between">
        <span className="text-[10px] text-gray-400 uppercase tracking-wider font-medium">
          {isSaving ? 'Saving...' : 'Draft saved'}
        </span>
        <span className="text-[10px] text-gray-400">
          Cmd + Enter to save & close
        </span>
      </div>
    </div>
  );
}
