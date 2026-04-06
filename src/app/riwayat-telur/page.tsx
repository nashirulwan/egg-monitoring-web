import SharedLayout from '@/components/layout/SharedLayout';
import RiwayatTelurClient from './RiwayatTelurClient';

export const dynamic = 'force-dynamic';

export default async function RiwayatTelurPage() {
    return (
        <SharedLayout>
            <RiwayatTelurClient />
        </SharedLayout>
    );
}
