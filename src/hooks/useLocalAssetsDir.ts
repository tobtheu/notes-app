import { useState, useEffect } from 'react';

export function useLocalAssetsDir() {
    const [localAssetsDir, setLocalAssetsDir] = useState<string | null>(null);

    useEffect(() => {
        if (window.tauriAPI?.getLocalAssetsDir) {
            window.tauriAPI.getLocalAssetsDir()
                .then(setLocalAssetsDir)
                .catch(console.error);
        }
    }, []);

    return localAssetsDir;
}
