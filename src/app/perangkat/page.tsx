import SharedLayout from '@/components/layout/SharedLayout';
import { db } from '@/lib/db';
import { deviceHeartbeats, actuators as actuatorsTable } from '@/lib/schema';
import { desc, eq } from 'drizzle-orm';
import PerangkatClient from './PerangkatClient';

export const dynamic = 'force-dynamic';

async function getData() {
    const allDevices = await db.query.devices.findMany();
    const devicesWithDetails = await Promise.all(
        allDevices.map(async (d) => {
            const hb = await db.query.deviceHeartbeats.findFirst({
                where: eq(deviceHeartbeats.deviceId, d.id),
                orderBy: [desc(deviceHeartbeats.createdAt)],
            });
            const deviceActuators = await db.query.actuators.findMany({
                where: eq(actuatorsTable.deviceId, d.id),
            });
            return {
                ...d,
                isOnline: hb ? Date.now() - new Date(hb.createdAt).getTime() < 120000 : false,
                lastSeen: hb?.createdAt ?? null,
                rssi: hb?.rssi ?? null,
                freeHeap: hb?.freeHeap ?? null,
                uptime: hb?.uptime ?? null,
                actuators: deviceActuators,
            };
        })
    );
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
