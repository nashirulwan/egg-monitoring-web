import type { Actuator, Device } from '@prisma/client';
import SharedLayout from '@/components/layout/SharedLayout';
import { db } from '@/lib/db';
import PerangkatClient from './PerangkatClient';

export const dynamic = 'force-dynamic';

type DeviceWithDetails = Device & {
    isOnline: boolean;
    lastSeen: string | null;
    rssi: number | null;
    freeHeap: number | null;
    uptime: number | null;
    actuators: Actuator[];
};

async function getData() {
    const now = new Date();
    const allDevices = await db.device.findMany({
        include: {
            heartbeats: {
                where: { createdAt: { lte: now } },
                orderBy: { createdAt: 'desc' },
                take: 1,
            },
            actuators: true,
        },
    });

    const devicesWithDetails: DeviceWithDetails[] = allDevices.map((d) => {
        const hb = d.heartbeats[0];
        return {
            ...d,
            isOnline: hb ? now.getTime() - new Date(hb.createdAt).getTime() < 120000 : false,
            lastSeen: hb?.createdAt.toISOString() ?? null,
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
            <PerangkatClient devices={devices} />
        </SharedLayout>
    );
}
