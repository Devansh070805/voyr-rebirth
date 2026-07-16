"use client";

import PartnerGate from "../../components/partner/PartnerGate";
import PartnerShell from "../../components/partner/PartnerShell";
import { BookingsContent } from "../../bookings/BookingsContent";

export default function PartnerBookingsPage() {
  return (
    <PartnerGate>
      <PartnerShell title="Partner bookings" subtitle="Confirmed trips for your partner account">
        <div className="mt-6">
          <BookingsContent embedded />
        </div>
      </PartnerShell>
    </PartnerGate>
  );
}
