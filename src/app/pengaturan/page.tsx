import SharedLayout from '@/components/layout/SharedLayout';
import PengaturanClient from './PengaturanClient';

export const dynamic = 'force-dynamic';

export default async function PengaturanPage() {
    return (
        <SharedLayout>
            <PengaturanClient />
        </SharedLayout>
    );
}
