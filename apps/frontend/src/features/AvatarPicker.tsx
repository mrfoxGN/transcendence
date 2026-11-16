import { useState, type FormEvent } from 'react';
import { Check, Plus } from 'lucide-react';

const portraits = [
  { path: '/team/board.jpg', label: 'Portrait 1' },
  { path: '/team/chat.jpg', label: 'Portrait 2' },
  { path: '/team/team.jpg', label: 'Portrait 3' },
  { path: '/team/files.jpg', label: 'Portrait 4' },
  { path: '/team/github.jpg', label: 'Portrait 5' },
];
export type AvatarSelection = { avatarUrl: string };

export function AvatarPicker({ onSave, onSkip, saving, error, saveLabel = 'Save and continue', skipLabel = 'Skip for now' }: {
  onSave: (avatar: AvatarSelection) => void; onSkip: () => void; saving: boolean; error: string;
  saveLabel?: string; skipLabel?: string;
}) {
  const [selection, setSelection] = useState('');
  const [url, setUrl] = useState('');
  const [previewUrl, setPreviewUrl] = useState('');
  const [previewError, setPreviewError] = useState(false);
  const [inputError, setInputError] = useState('');
  const custom = selection === 'custom';
  const busy = saving;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selection || busy) return;
    if (!custom) onSave({ avatarUrl: selection });
    else {
      const address = url.trim();
      if (!/^https:\/\//i.test(address)) {
        setInputError('Enter an HTTPS image URL.');
        return;
      }
      onSave({ avatarUrl: address });
    }
  }

  return <form className="auth-form" onSubmit={submit}>
    <div className="avatar-picker-grid" role="group" aria-label="Avatar choices">
      {portraits.map(portrait => <button key={portrait.path} type="button" className="avatar-choice"
        aria-label={portrait.label} aria-pressed={selection === portrait.path} disabled={busy}
        onClick={() => { setSelection(portrait.path); setInputError(''); }}>
        <img src={portrait.path} alt="" width={88} height={88} />
        {selection === portrait.path && <span className="avatar-choice-check"><Check size={13} aria-hidden="true" /></span>}
      </button>)}
      <button type="button" className="avatar-choice avatar-choice--custom" aria-label="Use your own image"
        aria-pressed={custom} aria-expanded={custom} aria-controls="avatar-custom-options" disabled={busy}
        onClick={() => { setSelection('custom'); setInputError(''); }}>
        {custom && previewUrl && !previewError
          ? <img src={previewUrl} alt="" width={88} height={88} onError={() => setPreviewError(true)} />
          : <Plus size={29} aria-hidden="true" />}
      </button>
    </div>
    {custom && <div id="avatar-custom-options" className="avatar-custom-options">
      <label>Image URL
        <input type="url" maxLength={500} value={url} placeholder="https://example.com/avatar.png" disabled={busy}
          onChange={event => {
            setUrl(event.currentTarget.value);
            setPreviewUrl('');
            setPreviewError(false);
            setInputError('');
          }}
          onBlur={event => {
            setPreviewError(false);
            if (event.currentTarget.validity.valid && /^https:\/\//i.test(url.trim())) setPreviewUrl(url.trim());
          }} />
      </label>
      {previewError && <p className="auth-description">The image preview couldn’t load. Check the URL.</p>}
    </div>}
    {(inputError || error) && <p className="auth-error" role="alert">{inputError || error}</p>}
    <button className="button button--primary" type="submit" disabled={busy || !selection || (custom && !url.trim())}>
      {saving ? 'Saving…' : saveLabel}
    </button>
    <button className="button button--secondary" type="button" disabled={saving} onClick={onSkip}>{skipLabel}</button>
  </form>;
}
