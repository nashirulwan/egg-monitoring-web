import SharedLayout from '@/components/layout/SharedLayout';
import NotifikasiClient from './NotifikasiClient';

export const dynamic = 'force-dynamic';

export default async function NotifikasiPage() {
    return (
        <SharedLayout>
            <NotifikasiClient />
        </SharedLayout>
    );
}
