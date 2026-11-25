import { ChevronRight, Contrast, LogOut, UserRound, UsersRound } from 'lucide-react';
import { useHoverDisclosure } from '../../shared/controls/useHoverDisclosure';
import { useHoverPopover } from '../../shared/controls/useHoverPopover';
import { Avatar } from '../../shared/ui/Avatar';
import type { ThemePreference } from '../../shared/design-system/theme';

type ProfileMenuProps = {
  profileId: string;
  profileName: string;
  profileEmail?: string;
  profileAvatar?: string | null;
  theme: ThemePreference;
  loggingOut: boolean;
  onSettings: () => void;
  onSwitchAccount: () => void;
  onLogout: () => Promise<void>;
  onTheme: (theme: ThemePreference) => Promise<boolean>;
};

/** Owns account-menu interactions; authentication and saving remain with the shell. */
export function ProfileMenu({
  profileId,
  profileName,
  profileEmail,
  profileAvatar,
  theme,
  loggingOut,
  onSettings,
  onSwitchAccount,
  onLogout,
  onTheme,
}: ProfileMenuProps) {
  const accountMenu = useHoverPopover();
  const themeMenu = useHoverDisclosure();
  const profileInitials = profileName
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
  return (
    <>
      <button
        {...accountMenu.triggerProps}
        className="wu-user-button wu-profile-trigger"
        type="button"
        aria-label={'Account menu for ' + profileName}
        popoverTarget="wu-profile-menu"
      >
        {profileAvatar ? (
          <img className="wu-avatar" src={profileAvatar} alt="" />
        ) : (
          <Avatar initials={profileInitials} tone="blue" preview={false} />
        )}
      </button>
      <div
        {...accountMenu.panelProps}
        id="wu-profile-menu"
        popover="auto"
        className="wu-profile-menu"
        aria-label="Account"
      >
        <div className="wu-profile-identity">
          {profileAvatar ? (
            <img className="wu-avatar" src={profileAvatar} alt="" />
          ) : (
            <Avatar initials={profileInitials} tone="blue" preview={false} />
          )}
          <div>
            <strong>{profileName}</strong>
            {profileEmail && <span>{profileEmail}</span>}
          </div>
        </div>
        <div className="wu-profile-actions">
          <button type="button" onClick={() => onSettings()}>
            <UserRound size={17} aria-hidden="true" />
            Personal settings
          </button>
          <details {...themeMenu.detailsProps} className="wu-profile-theme">
            <summary {...themeMenu.summaryProps}>
              <Contrast size={17} aria-hidden="true" />
              Theme <ChevronRight className="wu-profile-chevron" size={15} aria-hidden="true" />
            </summary>
            <fieldset className="wu-theme-picker">
              <legend className="wu-visually-hidden">Theme</legend>
              {(['light', 'dark', 'system'] as const).map((mode) => (
                <label key={mode} className="wu-theme-option" data-selected={theme === mode}>
                  <input
                    type="radio"
                    name="workspace-theme"
                    checked={theme === mode}
                    disabled={!profileId}
                    onChange={() => void onTheme(mode)}
                  />
                  <span className={`wu-theme-preview wu-theme-preview--${mode}`} aria-hidden="true">
                    <i />
                    <b />
                  </span>
                  <span>
                    {mode === 'light' ? 'Light' : mode === 'dark' ? 'Dark' : 'Match browser'}
                  </span>
                </label>
              ))}
            </fieldset>
          </details>
        </div>
        <div className="wu-profile-actions wu-profile-footer">
          <button type="button" onClick={() => onSwitchAccount()}>
            <UsersRound size={17} aria-hidden="true" />
            Switch account
          </button>
          <button type="button" disabled={loggingOut} onClick={() => void onLogout()}>
            <LogOut size={17} aria-hidden="true" />
            {loggingOut ? 'Logging out…' : 'Log out'}
          </button>
        </div>
      </div>
    </>
  );
}
