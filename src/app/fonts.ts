// Marketing font (landing + pricing). The app shell loads its own Geist with a CSS variable.
import { Geist } from 'next/font/google';

export const geist = Geist({ subsets: ['latin'], display: 'swap' });
