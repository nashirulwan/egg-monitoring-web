'use client';

import { useEffect, useState } from 'react';

const formatter = new Intl.DateTimeFormat('id-ID', {
    timeZone: 'Asia/Jakarta',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
});

export default function DashboardClock() {
    const [now, setNow] = useState(() => formatter.format(new Date()));

    useEffect(() => {
        const interval = window.setInterval(() => {
            setNow(formatter.format(new Date()));
        }, 1000);

        return () => window.clearInterval(interval);
    }, []);

    return <div className="header-time">{now} WIB</div>;
}
