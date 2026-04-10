import SharedLayout from '@/components/layout/SharedLayout';
import SensorLogClient from './SensorLogClient';

export const dynamic = 'force-dynamic';

export default async function SensorLogPage() {
    return (
        <SharedLayout>
            <SensorLogClient />
        </SharedLayout>
    );
}
