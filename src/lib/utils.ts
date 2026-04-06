export function cn(...classes: (string | undefined | false | null)[]): string {
    return classes.filter(Boolean).join(' ');
}

export function formatTemperature(temp: number): string {
    return `${temp.toFixed(1)}°C`;
}

export function formatHumidity(hum: number): string {
    return `${hum.toFixed(1)}%`;
}

export function timeAgo(date: Date | string): string {
    const now = new Date();
    const d = new Date(date);
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'Baru saja';
    if (diffMins < 60) return `${diffMins} menit lalu`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours} jam lalu`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays} hari lalu`;
}

export function isDeviceOnline(lastHeartbeat: Date | string | null): boolean {
    if (!lastHeartbeat) return false;
    const now = new Date();
    const last = new Date(lastHeartbeat);
    return (now.getTime() - last.getTime()) < 2 * 60 * 1000; // 2 minutes
}
