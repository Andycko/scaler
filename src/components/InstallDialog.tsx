import type { Platform } from '../install';
import { Modal } from './Modal';

const ShareIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" className="inline-icon">
    <path d="M12 3l4 4-1.4 1.4L13 6.8V15h-2V6.8L9.4 8.4 8 7z M5 10h3v2H7v7h10v-7h-1v-2h3v11H5z" fill="currentColor" />
  </svg>
);

export function InstallDialog({ platform, onClose }: { platform: Platform; onClose: () => void }) {
  return (
    <Modal title="Install Scaler" onClose={onClose}>
      <div className="install">
        <p className="install-lead">
          Add Scaler to your home screen and it opens <strong>full-screen, without the browser bars</strong>, in landscape — and keeps working offline.
        </p>
        {platform === 'ios' && (
          <ol className="steps">
            <li>
              Open this page in <strong>Safari</strong>.
            </li>
            <li>
              Tap the <strong>Share</strong> button <ShareIcon /> (bottom bar, or top-right on iPad).
            </li>
            <li>
              Scroll down and tap <strong>Add to Home Screen</strong>, then <strong>Add</strong>.
            </li>
            <li>Launch Scaler from its new home-screen icon.</li>
          </ol>
        )}
        {platform === 'android' && (
          <ol className="steps">
            <li>
              Open the browser menu <strong>⋮</strong> (top-right in Chrome; bottom in Firefox / Samsung Internet).
            </li>
            <li>
              Tap <strong>Install app</strong> or <strong>Add to Home screen</strong>.
            </li>
            <li>Confirm, then launch Scaler from the home screen or app drawer.</li>
          </ol>
        )}
        {platform === 'desktop' && (
          <ol className="steps">
            <li>
              In Chrome or Edge, click the <strong>install icon</strong> at the right end of the address bar (or menu → <strong>Install Scaler</strong>).
            </li>
            <li>
              In Safari on macOS: <strong>File → Add to Dock</strong>.
            </li>
          </ol>
        )}
        <button className="primary" onClick={onClose}>
          Got it
        </button>
      </div>
    </Modal>
  );
}
