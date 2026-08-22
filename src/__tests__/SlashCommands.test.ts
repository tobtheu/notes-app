import { describe, it, expect } from 'vitest';
import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import BulletList from '@tiptap/extension-bullet-list';
import OrderedList from '@tiptap/extension-ordered-list';
import CodeBlock from '@tiptap/extension-code-block';
import { SlashCommands } from '../extensions/SlashCommands';

describe('SlashCommands extension suggestion trigger rules', () => {
    const createEditor = (content: string) => {
        return new Editor({
            content,
            extensions: [
                StarterKit.configure({
                    bulletList: false,
                    orderedList: false,
                    codeBlock: false,
                }),
                BulletList,
                OrderedList,
                TaskList,
                TaskItem,
                CodeBlock,
                SlashCommands,
            ],
        });
    };

    it('activates suggestion at the start of a paragraph', () => {
        const editor = createEditor('<p>/</p>');
        editor.commands.setTextSelection(2); // Cursor right after '/'
        
        const slashPlugin = editor.state.plugins.find(
            (p) => (p as any).key?.startsWith('slashCommands')
        );
        expect(slashPlugin).toBeDefined();

        const pluginState = slashPlugin?.getState(editor.state);
        expect(pluginState?.active).toBe(true);
        editor.destroy();
    });

    it('does NOT activate suggestion in the middle/end of existing text', () => {
        const editor = createEditor('<p>Hello /world</p>');
        editor.commands.setTextSelection(8); // Cursor right after '/' in 'Hello /'
        
        const slashPlugin = editor.state.plugins.find(
            (p) => (p as any).key?.startsWith('slashCommands')
        );
        const pluginState = slashPlugin?.getState(editor.state);
        expect(pluginState?.active).toBe(false);
        editor.destroy();
    });

    it('does NOT activate suggestion inside a bullet list item', () => {
        const editor = createEditor('<ul><li><p>/</p></li></ul>');
        editor.commands.setTextSelection(3); // Inside list item paragraph after '/'
        
        const slashPlugin = editor.state.plugins.find(
            (p) => (p as any).key?.startsWith('slashCommands')
        );
        const pluginState = slashPlugin?.getState(editor.state);
        expect(pluginState?.active).toBe(false);
        editor.destroy();
    });

    it('does NOT activate suggestion inside an ordered list item', () => {
        const editor = createEditor('<ol><li><p>/</p></li></ol>');
        editor.commands.setTextSelection(3);
        
        const slashPlugin = editor.state.plugins.find(
            (p) => (p as any).key?.startsWith('slashCommands')
        );
        const pluginState = slashPlugin?.getState(editor.state);
        expect(pluginState?.active).toBe(false);
        editor.destroy();
    });

    it('does NOT activate suggestion inside a task list item', () => {
        const editor = createEditor('<ul data-type="taskList"><li data-type="taskItem"><p>/</p></li></ul>');
        editor.commands.setTextSelection(3);
        
        const slashPlugin = editor.state.plugins.find(
            (p) => (p as any).key?.startsWith('slashCommands')
        );
        const pluginState = slashPlugin?.getState(editor.state);
        expect(pluginState?.active).toBe(false);
        editor.destroy();
    });

    it('does NOT activate suggestion inside a code block', () => {
        const editor = createEditor('<pre><code>/</code></pre>');
        editor.commands.setTextSelection(2);
        
        const slashPlugin = editor.state.plugins.find(
            (p) => (p as any).key?.startsWith('slashCommands')
        );
        const pluginState = slashPlugin?.getState(editor.state);
        expect(pluginState?.active).toBe(false);
        editor.destroy();
    });
});
