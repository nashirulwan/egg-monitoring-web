import SharedLayout from '@/components/layout/SharedLayout';
import { db } from '@/lib/db';
import PerangkatClient from './PerangkatClient';

export const dynamic = 'force-dynamic';

async function getData() {
    const allDevices = await db.device.findMany({
        include: {
            heartbeats: {
                orderBy: { createdAt: 'desc' },
                take: 1,
            },
            actuators: true,
        },
    });

    const devicesWithDetails = allDevices.map((d) => {
        const hb = d.heartbeats[0];
        return {
            ...d,
            isOnline: hb ? Date.now() - new Date(hb.createdAt).getTime() < 120000 : false,
            lastSeen: hb?.createdAt ?? null,
            rssi: hb?.rssi ?? null,
            freeHeap: hb?.freeHeap ?? null,
            uptime: hb?.uptime ?? null,
            actuators: d.actuators,
        };
    });

    return devicesWithDetails;
}

export default async function PerangkatPage() {
    const devices = await getData();

    return (
        <SharedLayout>
            <PerangkatClient devices={devices as any} />
        </SharedLayout>
    );
}