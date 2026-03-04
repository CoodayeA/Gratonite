export const getDeterministicColor = (str: string) => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    const hue = Math.abs(hash) % 360;
    return `hsl(${hue}, 70%, 50%)`;
};

export const getDeterministicGradient = (str: string) => {
    let hash1 = 0;
    let hash2 = 0;
    for (let i = 0; i < str.length; i++) {
        hash1 = str.charCodeAt(i) + ((hash1 << 5) - hash1);
        hash2 = str.charCodeAt(i) + ((hash2 << 7) - hash2);
    }
    const hue1 = Math.abs(hash1) % 360;
    const hue2 = Math.abs(hash2) % 360;

    // Create an energetic gradient
    return `linear-gradient(135deg, hsl(${hue1}, 80%, 65%), hsl(${hue2}, 80%, 45%))`;
};
