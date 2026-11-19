import { useId, useRef, useState } from 'react';
import { X } from 'lucide-react';
import './legal.css';

const policies = {
  privacy: {
    title: 'Privacy Policy',
    sections: [
      ['Account information', 'DevUP uses your email address and username to create your account and identify you to people you work with. You can add an optional profile picture. The server stores a password hash for sign-in.'],
      ['Workspace content', 'DevUP stores the tasks, notes, files, messages, and activity you create so authorized people can access them. Workspace content is available according to workspace permissions. Direct messages are available to their participants.'],
      ['Browser storage', 'DevUP uses browser session storage for sign-in and chat drafts. It uses local storage for interface preferences such as the sidebar state.'],
      ['Connected services', 'If the operator configures email delivery, DevUP uses Resend to send verification, password reset, and invitation emails. Connecting GitHub lets DevUP retrieve account and repository information needed for the integration. An avatar from an external URL is fetched by your browser from the host you selected.'],
      ['Managing your information', 'You can change your profile in account settings. Contact the operator of the DevUP instance you use for questions about your information, retention, or deletion.'],
    ],
  },
  terms: {
    title: 'Terms of Service',
    sections: [
      ['Using DevUP', 'DevUP is a workspace for organizing tasks, sharing files and notes, and communicating with your team. Keep your sign-in credentials private and only use accounts and workspaces you are authorized to access.'],
      ['Content you share', 'Only upload or share content you have permission to use. Check who has access to a workspace or conversation before sharing confidential information.'],
      ['Acceptable use', 'Respect other users and their privacy. Do not use DevUP to send spam, harass people, distribute harmful files, or bypass access controls.'],
      ['Connected services', 'If you connect a GitHub account or repository, follow GitHub’s terms and ensure you have permission to connect it.'],
      ['Questions and support', 'Contact the operator of your DevUP instance for questions about these terms or to report misuse.'],
    ],
  },
} as const;

export function LegalLinks() {
  const dialog = useRef<HTMLDialogElement>(null);
  const headingId = useId();
  const [policy, setPolicy] = useState<keyof typeof policies>('privacy');
  const { title, sections } = policies[policy];

  function open(next: keyof typeof policies) {
    setPolicy(next);
    dialog.current?.showModal();
  }

  return <>
    <div className="footer-legal" role="group" aria-label="Legal">
      <button type="button" aria-haspopup="dialog" onClick={() => open('privacy')}>Privacy Policy</button>
      <button type="button" aria-haspopup="dialog" onClick={() => open('terms')}>Terms of Service</button>
    </div>
    <dialog ref={dialog} className="legal-dialog" aria-labelledby={headingId} onClose={() => { if (dialog.current) dialog.current.scrollTop = 0; }}>
      <header>
        <h2 id={headingId}>{title}</h2>
        <button type="button" aria-label="Close dialog" onClick={() => dialog.current?.close()}>
          <X size={20} aria-hidden="true" />
        </button>
      </header>
      {sections.map(([heading, body]) => <section key={heading}>
        <h3>{heading}</h3>
        <p>{body}</p>
      </section>)}
    </dialog>
  </>;
}
