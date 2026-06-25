import type { Metadata } from 'next';
import KernelHealthDashboard from '@/components/kernel/KernelHealthDashboard';

export const metadata: Metadata = {
  title: 'Kernel Health — ITOS Shadow Verification',
  description: 'Core State Kernel shadow verification dashboard. SystemState is authoritative.',
};

export default function KernelHealthPage() {
  return <KernelHealthDashboard />;
}
