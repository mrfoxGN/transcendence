import Placeholder from '@tiptap/extension-placeholder';
import TaskItem from '@tiptap/extension-task-item';
import TaskList from '@tiptap/extension-task-list';
import { Markdown } from '@tiptap/markdown';
import { EditorContent, useEditor, useEditorState } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import {
  Bold,
  Code,
  Italic,
  Link2,
  List,
  ListOrdered,
  ListTodo,
  Minus,
  Quote,
  Redo2,
  Undo2,
} from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import { Select } from '../../../shared/controls/Select';
import { Button, Input } from '../../../shared/ui';

export function NoteRichEditor({
  value,
  onChange,
  editable = true,
}: {
  value: string;
  onChange?: (value: string) => void;
  editable?: boolean;
}) {
  const callback = useRef(onChange);
  callback.current = onChange;
  const [linkOpen, setLinkOpen] = useState(false);
  const [url, setUrl] = useState('');
  const [linkError, setLinkError] = useState('');
  const linkId = useId();
  const linkInput = useRef<HTMLInputElement>(null);
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        link: {
          openOnClick: !editable,
          HTMLAttributes: { rel: 'noopener noreferrer', target: '_blank' },
        },
      }),
      Markdown,
      Placeholder.configure({
        placeholder: 'Start writing. Use the toolbar or Markdown shortcuts to format your note…',
      }),
      TaskList,
      TaskItem.configure({ nested: true }),
    ],
    content: value,
    contentType: 'markdown',
    editable,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: 'wu-note-prose',
        role: 'textbox',
        'aria-label': editable ? 'Note content' : 'Note text',
        'aria-multiline': 'true',
        'aria-readonly': String(!editable),
        spellcheck: 'true',
      },
    },
    onUpdate: ({ editor }) => callback.current?.(editor.getMarkdown()),
  });
  const state = useEditorState({
    editor,
    selector: ({ editor }) =>
      editor
        ? {
            bold: editor.isActive('bold'),
            italic: editor.isActive('italic'),
            bullet: editor.isActive('bulletList'),
            ordered: editor.isActive('orderedList'),
            task: editor.isActive('taskList'),
            quote: editor.isActive('blockquote'),
            code: editor.isActive('code'),
            link: editor.isActive('link'),
            block: editor.isActive('heading', { level: 1 })
              ? 'h1'
              : editor.isActive('heading', { level: 2 })
                ? 'h2'
                : editor.isActive('heading', { level: 3 })
                  ? 'h3'
                  : editor.isActive('codeBlock')
                    ? 'code'
                    : 'paragraph',
            canUndo: editor.can().undo(),
            canRedo: editor.can().redo(),
            text: editor.getText(),
          }
        : null,
  });
  useEffect(() => {
    if (linkOpen) linkInput.current?.focus();
  }, [linkOpen]);
  if (!editor)
    return (
      <p role="status" className="wu-muted">
        Loading editor…
      </p>
    );
  const text = state?.text ?? editor.getText();
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  function applyLink() {
    const candidate = url.trim();
    if (!candidate) {
      editor?.chain().focus().extendMarkRange('link').unsetLink().run();
      setLinkOpen(false);
      return;
    }
    try {
      const parsed = new URL(candidate);
      if (!['http:', 'https:', 'mailto:'].includes(parsed.protocol)) throw Error();
      editor?.chain().focus().extendMarkRange('link').setLink({ href: parsed.href }).run();
      setLinkOpen(false);
      setLinkError('');
    } catch {
      setLinkError('Enter a valid https://, http://, or mailto: link.');
    }
  }
  return (
    <div className={'wu-note-rich-editor' + (!editable ? ' wu-note-rich-editor--reading' : '')}>
      {editable && (
        <>
          <div className="wu-note-formatbar" role="group" aria-label="Text formatting">
            <Select
              aria-label="Text style"
              value={state?.block ?? 'paragraph'}
              onChange={(event) => {
                const value = event.target.value;
                if (value === 'paragraph') editor.chain().focus().setParagraph().run();
                else if (value === 'code') editor.chain().focus().toggleCodeBlock().run();
                else
                  editor
                    .chain()
                    .focus()
                    .toggleHeading({ level: Number(value.slice(1)) as 1 | 2 | 3 })
                    .run();
              }}
            >
              <option value="paragraph">Normal text</option>
              <option value="h1">Heading 1</option>
              <option value="h2">Heading 2</option>
              <option value="h3">Heading 3</option>
              <option value="code">Code block</option>
            </Select>
            {[
              {
                label: 'Bold',
                Icon: Bold,
                active: state?.bold,
                run: () => editor.chain().focus().toggleBold().run(),
              },
              {
                label: 'Italic',
                Icon: Italic,
                active: state?.italic,
                run: () => editor.chain().focus().toggleItalic().run(),
              },
              {
                label: 'Bulleted list',
                Icon: List,
                active: state?.bullet,
                run: () => editor.chain().focus().toggleBulletList().run(),
              },
              {
                label: 'Numbered list',
                Icon: ListOrdered,
                active: state?.ordered,
                run: () => editor.chain().focus().toggleOrderedList().run(),
              },
              {
                label: 'Checklist',
                Icon: ListTodo,
                active: state?.task,
                run: () => editor.chain().focus().toggleTaskList().run(),
              },
              {
                label: 'Quote',
                Icon: Quote,
                active: state?.quote,
                run: () => editor.chain().focus().toggleBlockquote().run(),
              },
              {
                label: 'Inline code',
                Icon: Code,
                active: state?.code,
                run: () => editor.chain().focus().toggleCode().run(),
              },
            ].map(({ label, Icon, active, run }) => (
              <button
                key={label}
                type="button"
                aria-label={label}
                title={label}
                aria-pressed={!!active}
                onMouseDown={(event) => event.preventDefault()}
                onClick={run}
              >
                <Icon size={16} aria-hidden="true" />
              </button>
            ))}
            <button
              type="button"
              aria-label="Insert link"
              title="Insert link"
              aria-expanded={linkOpen}
              aria-controls={linkId}
              aria-pressed={!!state?.link}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                setUrl(editor.getAttributes('link').href ?? '');
                setLinkError('');
                setLinkOpen((value) => !value);
              }}
            >
              <Link2 size={16} aria-hidden="true" />
            </button>
            <button
              type="button"
              aria-label="Horizontal rule"
              title="Horizontal rule"
              onClick={() => editor.chain().focus().setHorizontalRule().run()}
            >
              <Minus size={16} aria-hidden="true" />
            </button>
            <span className="wu-note-formatbar-spacer" />
            <button
              type="button"
              aria-label="Undo"
              title="Undo"
              disabled={!state?.canUndo}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => editor.chain().focus().undo().run()}
            >
              <Undo2 size={16} aria-hidden="true" />
            </button>
            <button
              type="button"
              aria-label="Redo"
              title="Redo"
              disabled={!state?.canRedo}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => editor.chain().focus().redo().run()}
            >
              <Redo2 size={16} aria-hidden="true" />
            </button>
          </div>
          {linkOpen && (
            <div className="wu-note-link-input" id={linkId} role="group" aria-label="Link options">
              <label>
                Link URL
                <Input
                  ref={linkInput}
                  type="url"
                  value={url}
                  placeholder="https://example.com"
                  onChange={(event) => setUrl(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      applyLink();
                    }
                  }}
                />
              </label>
              <Button type="button" variant="secondary" onClick={applyLink}>
                Apply link
              </Button>
              <button type="button" className="wu-text-button" onClick={() => setLinkOpen(false)}>
                Cancel
              </button>
              {linkError && <p role="alert">{linkError}</p>}
            </div>
          )}
        </>
      )}
      <EditorContent editor={editor} />
      <div className="wu-note-editor-count">
        {words} {words === 1 ? 'word' : 'words'}
        <span>{text.length} characters</span>
      </div>
    </div>
  );
}
