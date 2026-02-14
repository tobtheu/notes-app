import { useNotes } from './hooks/useNotes';
import { Sidebar } from './components/Sidebar';
import { NoteList } from './components/NoteList';
import { Editor } from './components/Editor';

function App() {
  const {
    currentFolder,
    notes,
    selectedNote,
    setSelectedNote,
    searchTerm,
    setSearchTerm,
    selectFolder,
    saveNote,
    createNote,
    deleteNote
  } = useNotes();

  if (!currentFolder) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-gray-50 text-gray-800 dark:bg-gray-900 dark:text-gray-100">
        <h1 className="text-3xl font-bold mb-4">Welcome to NotizApp</h1>
        <p className="mb-8 text-gray-500">Please select a folder to store your notes.</p>
        <button
          onClick={selectFolder}
          className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
        >
          Select Folder
        </button>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 overflow-hidden">
      {/* Sidebar (Folders/Tags) - Placeholder for now, simplistic view */}
      <Sidebar
        className="w-16 md:w-64 flex-shrink-0 border-r border-gray-200 dark:border-gray-800"
        onCreateNote={createNote}
      />

      {/* Note List */}
      <NoteList
        className="w-64 md:w-80 flex-shrink-0 border-r border-gray-200 dark:border-gray-800"
        notes={notes}
        selectedNote={selectedNote}
        onSelectNote={(note) => setSelectedNote(note.filename)}
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        onDeleteNote={deleteNote}
      />

      {/* Editor */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {selectedNote ? (
          <Editor
            key={selectedNote.filename} // Remount on switch to avoid stale state if needed, or handle in useEffect
            note={selectedNote}
            onSave={saveNote}
          />
        ) : (
          <div className="flex items-center justify-center h-full text-gray-400">
            Select a note to view or edit
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
