'use client';

// "Install the app" CTA (DEC-019). Always renders a button. Uses the browser's
// beforeinstallprompt where available (Android/desktop Chrome); on iOS (no programmatic
// prompt) it reveals Add-to-Home-Screen instructions.
import { useEffect, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function InstallButton({
  className = '',
  label = 'Install Tally',
  help = 'On iPhone: tap Share → “Add to Home Screen.” On Android: menu → “Install app.”',
  installedText = 'Installed ✓ — find Tally on your home screen.',
}: {
  className?: string;
  label?: string;
  help?: string;
  installedText?: string;
}) {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

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

  if (installed) {
    return <p className="text-sm text-gray-500">{installedText}</p>;
  }

  return (
    <div className={className}>
      <button
        onClick={async () => {
          if (deferred) {
            await deferred.prompt();
            setDeferred(null);
          } else {
            setShowHelp((v) => !v);
          }
        }}
        className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-6 py-3 text-base font-medium text-white transition-colors hover:bg-primary-hover"
      >
        {label}
      </button>
      {showHelp && !deferred && <p className="mt-3 text-sm text-gray-500">{help}</p>}
    </div>
  );
}
