import { Extension, ReactRenderer } from '@tiptap/react';
import Suggestion from '@tiptap/suggestion';
import { PluginKey } from '@tiptap/pm/state';
import tippy, { type Instance } from 'tippy.js';
import type { Note } from '../types';
import { WikiLinkMenu } from '../components/WikiLinkMenu';

export const WikiLinkSuggestion = Extension.create({
    name: 'wikiLinkSuggestion',
    addOptions() {
        return {
            allNotesRef: { current: [] as Note[] },
        };
    },
    addProseMirrorPlugins() {
        return [
            Suggestion({
                editor: this.editor,
                char: '[[',
                pluginKey: new PluginKey('wikiLinkSuggestion'),
                command: ({ editor, range, props }: any) => {
                    const { id, anchor, label } = props;
                    const encodedId = id.split('/').map((s: string) => encodeURIComponent(s)).join('/');
                    const url = `note://${encodedId}${anchor ? `#${anchor}` : ''}`;

                    // Calculate replacement range: covers trigger [[ + query + any auto-added ]]
                    const { state } = editor;
                    let from = range.from;
                    let to = range.to;

                    // The range usually covers the [[ and the query.
                    // We also want to suck in any trailing ]] that we might have auto-inserted.
                    if (state.doc.textBetween(range.to, range.to + 2) === ']]') {
                        to = range.to + 2;
                    } else if (state.doc.textBetween(range.to, range.to + 1) === ']') {
                        to = range.to + 1;
                    }

                    editor
                        .chain()
                        .focus()
                        .deleteRange({ from, to })
                        .setLink({ href: url })
                        .insertContent(`[[${label}]]`)
                        .run();
                },
                items: ({ query }: { query: string }) => {
                    const allNotes = this.options.allNotesRef.current || [];
                    const cleanQuery = query.toLowerCase();
                    const filtered = allNotes.filter((note: Note) =>
                        note.filename.toLowerCase().includes(cleanQuery) ||
                        (note.folder && note.folder.toLowerCase().includes(cleanQuery))
                    );

                    if (query === '') {
                        return allNotes.slice(0, 10);
                    }
                    return filtered.slice(0, 10);
                },
                render: () => {
                    let component: any;
                    let popup: Instance[];

                    return {
                        onStart: props => {
                            // Auto-insert closing brackets when suggest starts.
                            // Since char is '[[' and we just finished typing it,
                            // we can insert ]] and place selection between them.
                            const { editor, range } = props;

                            // Check if they are already there (e.g. if backspacing and re-triggering)
                            if (editor.state.doc.textBetween(range.to, range.to + 2) !== ']]') {
                                editor.chain().insertContent(']]').setTextSelection(range.to).run();
                            }

                            component = new ReactRenderer(WikiLinkMenu, {
                                props,
                                editor: props.editor,
                            });

                            popup = tippy('body', {
                                getReferenceClientRect: props.clientRect as any,
                                appendTo: () => document.body,
                                content: component.element,
                                showOnCreate: true,
                                interactive: true,
                                trigger: 'manual',
                                placement: 'bottom-start',
                                zIndex: 999,
                            });
                        },
                        onUpdate(props) {
                            component.updateProps(props);
                            if (popup && popup[0]) {
                                popup[0].setProps({
                                    getReferenceClientRect: props.clientRect as any,
                                });
                            }
                        },
                        onKeyDown(props) {
                            if (props.event.key === 'Escape') {
                                popup?.[0]?.hide();
                                return true;
                            }
                            return component.ref?.onKeyDown(props);
                        },
                        onExit() {
                            popup?.[0]?.destroy();
                            component?.destroy();
                        },
                    };
                },
            }),
        ];
    },
});
