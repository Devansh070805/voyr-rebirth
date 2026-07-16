"use client";

import { PiAirplaneTiltFill, PiArrowRightBold } from "react-icons/pi";
import OptionList from "./cards/OptionList";
import OptionCardShell from "./cards/OptionCardShell";
import SelectButton from "./cards/SelectButton";
import ListingBadge from "./cards/ListingBadge";
import { optionKey, isVoyrPick, type CuratedOptionMeta } from "./cards/option-utils";

interface FlightRouteOption extends CuratedOptionMeta {
  route_id: string;
  airline_iata: string;
  departure_iata: string;
  arrival_iata: string;
  label: string;
  sell_amount?: number;
  currency?: string;
}

interface FlightOptionsCardProps {
  destination: string;
  note?: string;
  options: FlightRouteOption[];
  onSelect?: (route: FlightRouteOption) => void;
  selectedId?: string;
  selectingId?: string | null;
}

export default function FlightOptionsCard({
  destination,
  note,
  options,
  onSelect,
  selectedId,
  selectingId,
}: FlightOptionsCardProps) {
  return (
    <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm animate-scale-in">
      <div className="border-b border-slate-100 px-5 py-4">
        <h3 className="font-bold text-slate-900">
          <PiAirplaneTiltFill className="mr-1.5 inline-block h-5 w-5 -mt-0.5 text-violet-500" />
          Flight Routes — {destination}
        </h3>
        {note && <p className="mt-1 text-xs text-slate-500">{note}</p>}
      </div>

      <OptionList>
        {options.map((route, idx) => {
          const id = optionKey(route);
          const selected = selectedId === id;
          const loading = selectingId === id;
          return (
            <OptionCardShell
              key={id}
              option={route}
              selected={selected}
              loading={loading}
              layout="row"
              animationDelay={idx * 60}
              className="!border-0 !bg-transparent !p-0 !shadow-none hover:!translate-y-0"
            >
              <div className="flex items-center justify-between gap-4 px-5 py-3.5">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="flex items-center gap-2 font-semibold text-slate-900">
                      <span>{route.departure_iata}</span>
                      <PiArrowRightBold className="h-3.5 w-3.5 text-slate-400" />
                      <span>{route.arrival_iata}</span>
                    </div>
                    {isVoyrPick(route) && (
                      <ListingBadge label={route.badges?.[0] || "Voyr Pick"} />
                    )}
                  </div>
                  <p className="mt-0.5 text-sm text-slate-500">
                    Airline {route.airline_iata} · {route.label}
                  </p>
                </div>
                <SelectButton
                  label="Select route"
                  selectedLabel="Route selected"
                  selected={selected}
                  loading={loading}
                  onClick={onSelect ? () => onSelect(route) : undefined}
                  className="!mt-0 !w-auto shrink-0"
                />
              </div>
            </OptionCardShell>
          );
        })}
      </OptionList>
    </div>
  );
}
