'use client';

// "Install the app" affordance for the landing page (DEC-019). Uses the browser's
// beforeinstallprompt where available (Android/desktop Chrome); shows Add-to-Home-Screen
// instructions on iOS (which has no programmatic prompt).
import { useEffect, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function InstallButton() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => setInstalled(true);
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  if (installed) return <p className="text-sm text-gray-500">Installed ✓ — find Tally on your home screen.</p>;

  if (deferred) {
    return (
      <button
        onClick={async () => {
          await deferred.prompt();
          setDeferred(null);
        }}
        className="rounded-md bg-primary hover:bg-primary-hover px-5 py-2.5 text-white"
      >
        Install Tally
      </button>
    );
  }

  // iOS / not-yet-eligible fallback.
  return (
    <p className="text-sm text-gray-500">
      Add Tally to your phone: on <span className="font-medium">iPhone</span> tap Share → &ldquo;Add to Home
      Screen&rdquo;; on <span className="font-medium">Android</span> use the menu → &ldquo;Install app.&rdquo;
    </p>
  );
}
