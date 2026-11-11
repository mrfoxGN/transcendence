import { useState, type FormEvent } from 'react';
import { Check, Plus, Upload } from 'lucide-react';

const portraits = [
  { path: '/team/board.jpg', label: 'Portrait 1' },
  { path: '/team/chat.jpg', label: 'Portrait 2' },
  { path: '/team/team.jpg', label: 'Portrait 3' },
  { path: '/team/files.jpg', label: 'Portrait 4' },
  { path: '/team/github.jpg', label: 'Portrait 5' },
];
const inputTypes = ['image/jpeg', 'image/png', 'image/webp'];

export type AvatarSelection = { avatarUrl: string } | { avatarImage: string };

async function prepareAvatar(file: File) {
  if (!inputTypes.includes(file.type) || file.size > 8 * 1024 * 1024) {
    throw new Error('Choose a JPEG, PNG, or WebP image up to 8 MB.');
  }
  const image = await createImageBitmap(file);
  try {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 128;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Could not prepare the image.');
    const side = Math.min(image.width, image.height);
    context.fillStyle = '#fff';
    context.fillRect(0, 0, 128, 128);
    context.drawImage(image, (image.width - side) / 2, (image.height - side) / 2, side, side, 0, 0, 128, 128);
    return canvas.toDataURL('image/jpeg', 0.8);
  } finally {
    image.close();
  }
}

export function AvatarPicker({ onSave, onSkip, saving, error }: {
  onSave: (avatar: AvatarSelection) => void; onSkip: () => void; saving: boolean; error: string;
}) {
  const [selection, setSelection] = useState('');
  const [image, setImage] = useState('');
  const [url, setUrl] = useState('');
  const [previewUrl, setPreviewUrl] = useState('');
  const [previewError, setPreviewError] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [inputError, setInputError] = useState('');
  const custom = selection === 'custom';
  const busy = saving || processing;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selection || busy) return;
    if (!custom) onSave({ avatarUrl: selection });
    else if (image) onSave({ avatarImage: image });
    else {
      const address = url.trim();
      if (!/^https:\/\//i.test(address)) {
        setInputError('Enter an HTTPS image URL.');
        return;
      }
      onSave({ avatarUrl: address });
    }
  }

  async function pickFile(file: File) {
    setProcessing(true);
    setInputError('');
    try {
      setImage(await prepareAvatar(file));
      setUrl('');
      setPreviewUrl('');
      setPreviewError(false);
    } catch (error) {
      setInputError(error instanceof Error ? error.message : 'Could not open that image.');
    } finally {
      setProcessing(false);
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
        {custom && (image || (previewUrl && !previewError))
          ? <img src={image || previewUrl} alt="" width={88} height={88} onError={() => setPreviewError(true)} />
          : <Plus size={29} aria-hidden="true" />}
      </button>
    </div>
    {custom && <div id="avatar-custom-options" className="avatar-custom-options">
      <label className="avatar-upload">
        <Upload size={17} aria-hidden="true" /> {processing ? 'Preparing image…' : 'Upload from computer'}
        <input type="file" accept={inputTypes.join(',')} disabled={busy} onChange={event => {
          const file = event.currentTarget.files?.[0];
          event.currentTarget.value = '';
          if (file) void pickFile(file);
        }} />
      </label>
      <label>Image URL
        <input type="url" maxLength={500} value={url} placeholder="https://example.com/avatar.png" disabled={busy}
          onChange={event => {
            setUrl(event.currentTarget.value);
            setImage('');
            setPreviewUrl('');
            setPreviewError(false);
            setInputError('');
          }}
          onBlur={event => {
            setPreviewError(false);
            if (event.currentTarget.validity.valid && /^https:\/\//i.test(url.trim())) setPreviewUrl(url.trim());
          }} />
      </label>
      {previewError && <p className="auth-description">The image preview couldn’t load. Check the URL or choose a file.</p>}
    </div>}
    {(inputError || error) && <p className="auth-error" role="alert">{inputError || error}</p>}
    <button className="button button--primary" type="submit" disabled={busy || !selection || (custom && !image && !url.trim())}>
      {saving ? 'Saving…' : 'Save and continue'}
    </button>
    <button className="button button--secondary" type="button" disabled={saving} onClick={onSkip}>Skip for now</button>
  </form>;
}
