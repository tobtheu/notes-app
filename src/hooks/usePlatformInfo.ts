import { useState, useEffect } from 'react';
import { platform } from '@tauri-apps/plugin-os';

export function usePlatformInfo() {
    const [isIOS, setIsIOS] = useState(false);
    const [isWindows, setIsWindows] = useState(false);

    useEffect(() => {
        try {
            const p = platform();
            setIsIOS(p === 'ios');
            setIsWindows(p === 'windows');
            document.documentElement.setAttribute('data-os', p);
        } catch {
            const isWin = typeof navigator !== 'undefined' && /Win/.test(navigator.userAgent || navigator.platform);
            if (isWin) {
                setIsWindows(true);
                document.documentElement.setAttribute('data-os', 'windows');
            }
            const isLinux = typeof navigator !== 'undefined' && /Linux/.test(navigator.userAgent || navigator.platform);
            if (isLinux) {
                document.documentElement.setAttribute('data-os', 'linux');
            }
        }
    }, []);

    return { isIOS, isWindows };
}
