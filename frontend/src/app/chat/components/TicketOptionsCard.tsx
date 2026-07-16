"use client";

import { PiTicketFill, PiCalendarBlankFill, PiMapPinFill } from "react-icons/pi";
import OptionList from "./cards/OptionList";
import OptionCardShell from "./cards/OptionCardShell";
import PriceTag from "./cards/PriceTag";
import SelectButton from "./cards/SelectButton";
import ListingBadge from "./cards/ListingBadge";
import { optionKey, isVoyrPick, type CuratedOptionMeta } from "./cards/option-utils";

interface TicketOption extends CuratedOptionMeta {
  name: string;
  venue?: string;
  event_date?: string;
  seat_class?: string;
  price: number;
  currency: string;
  description?: string;
}

interface TicketOptionsCardProps {
  destination: string;
  tickets: TicketOption[];
  onSelect?: (ticket: TicketOption) => void;
  selectedId?: string;
  selectingId?: string | null;
}

export default function TicketOptionsCard({
  destination,
  tickets,
  onSelect,
  selectedId,
  selectingId,
}: TicketOptionsCardProps) {
  return (
    <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm animate-scale-in">
      <div className="border-b border-slate-100 px-5 py-4">
        <h3 className="font-bold text-slate-900">
          <PiTicketFill className="mr-1.5 inline-block h-5 w-5 -mt-0.5 text-violet-500" />
          Tickets & Events — {destination}
        </h3>
      </div>

      <OptionList>
        {tickets.map((ticket, idx) => {
          const id = optionKey(ticket);
          const selected = selectedId === id;
          const loading = selectingId === id;
          return (
            <OptionCardShell
              key={id}
              option={ticket}
              selected={selected}
              loading={loading}
              layout="row"
              animationDelay={idx * 60}
              className="!border-0 !bg-transparent !p-0 !shadow-none hover:!translate-y-0"
            >
              <div className="flex items-start justify-between gap-4 px-5 py-3.5">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h4 className="font-semibold text-slate-900">{ticket.name}</h4>
                    {isVoyrPick(ticket) && (
                      <ListingBadge label={ticket.badges?.[0] || "Voyr Pick"} />
                    )}
                  </div>
                  {ticket.description && (
                    <p className="mt-0.5 text-sm text-slate-500">{ticket.description}</p>
                  )}
                  <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-slate-400">
                    {ticket.venue && (
                      <span className="flex items-center gap-1">
                        <PiMapPinFill className="h-3 w-3" /> {ticket.venue}
                      </span>
                    )}
                    {ticket.event_date && (
                      <span className="flex items-center gap-1">
                        <PiCalendarBlankFill className="h-3 w-3" /> {ticket.event_date}
                      </span>
                    )}
                    {ticket.seat_class && (
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 font-medium text-slate-500">
                        {ticket.seat_class}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-2">
                  <PriceTag amount={ticket.price} currency={ticket.currency} size="sm" />
                  <SelectButton
                    label="Select ticket"
                    selectedLabel="Ticket selected"
                    selected={selected}
                    loading={loading}
                    onClick={onSelect ? () => onSelect(ticket) : undefined}
                    className="!mt-0 !w-auto"
                  />
                </div>
              </div>
            </OptionCardShell>
          );
        })}
      </OptionList>
    </div>
  );
}
