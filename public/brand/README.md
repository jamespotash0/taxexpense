# Brand assets

Drop the icon/logo source files here. Anything in `public/` is served at the
site root, so a file at `public/brand/icon.svg` is reachable at `/brand/icon.svg`.

## Suggested files

| File | Use |
|------|-----|
| `icon.svg`      | Primary app icon (square, scalable). The one to add now. |
| `logo.svg`      | Full wordmark/logo for the landing header (optional). |
| `icon-mono.svg` | Single-color variant for dark/light surfaces (optional). |

## Wiring it in

Once `icon.svg` is here, reference it like any static asset:

```tsx
// favicon / tab + apple touch icon — src/app/layout.tsx
export const metadata = {
  icons: { icon: '/brand/icon.svg', apple: '/icon-192.png' },
};

// inline in a component
import Image from 'next/image';
<Image src="/brand/icon.svg" alt="Tally" width={32} height={32} />
```

> PNG fallbacks (`/icon-192.png`, `/icon-512.png`) and the PWA `manifest.webmanifest`
> still live at the `public/` root — update those if you regenerate the icon.
