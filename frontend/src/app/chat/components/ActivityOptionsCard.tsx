"use client";

import {
  PiClockFill,
  PiTagFill,
  PiCrosshairFill,
  PiMountainsFill,
  PiBuildingsFill,
  PiHeartFill,
  PiTreeFill,
  PiForkKnifeFill,
  PiMoonFill,
  PiShoppingBagFill,
  PiDropFill,
} from "react-icons/pi";
import OptionList from "./cards/OptionList";
import OptionCardShell from "./cards/OptionCardShell";
import PriceTag from "./cards/PriceTag";
import SelectButton from "./cards/SelectButton";
import { optionKey, isVoyrPick, type CuratedOptionMeta } from "./cards/option-utils";
import ListingBadge from "./cards/ListingBadge";

interface ActivityOption extends CuratedOptionMeta {
  name: string;
  description: string;
  duration: string;
  price: number;
  currency: string;
  category: string;
  difficulty?: string;
  place_id?: string;
  address?: string;
}

interface ActivityOptionsCardProps {
  destination: string;
  activities: ActivityOption[];
  onSelect?: (activity: ActivityOption) => void;
  selectedIds?: string[];
  selectingId?: string | null;
}

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  Adventure: <PiMountainsFill className="h-5 w-5" />,
  Cultural: <PiBuildingsFill className="h-5 w-5" />,
  Relaxation: <PiHeartFill className="h-5 w-5" />,
  Nature: <PiTreeFill className="h-5 w-5" />,
  Food: <PiForkKnifeFill className="h-5 w-5" />,
  Nightlife: <PiMoonFill className="h-5 w-5" />,
  Shopping: <PiShoppingBagFill className="h-5 w-5" />,
  Water: <PiDropFill className="h-5 w-5" />,
};

export default function ActivityOptionsCard({
  destination,
  activities,
  onSelect,
  selectedIds = [],
  selectingId,
}: ActivityOptionsCardProps) {
  return (
    <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm animate-scale-in">
      <div className="border-b border-slate-100 px-5 py-4">
        <h3 className="font-bold text-slate-900">
          <PiCrosshairFill className="mr-1.5 inline-block h-5 w-5 -mt-0.5 text-violet-500" />
          Activities — {destination}
        </h3>
      </div>

      <OptionList>
        {activities.map((activity, idx) => {
          const id = optionKey(activity);
          const selected = selectedIds.includes(id);
          const loading = selectingId === id;
          return (
            <OptionCardShell
              key={id}
              option={activity}
              selected={selected}
              loading={loading}
              layout="row"
              animationDelay={idx * 60}
              className="!border-0 !bg-transparent !p-0 !shadow-none hover:!translate-y-0"
            >
              <div className="flex w-full items-start gap-4 px-5 py-3.5">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
                  {CATEGORY_ICONS[activity.category] || <PiTagFill className="h-5 w-5" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="font-semibold text-slate-900">{activity.name}</h4>
                      {isVoyrPick(activity) && (
                        <ListingBadge label={activity.badges?.[0] || "Voyr Pick"} />
                      )}
                    </div>
                    <PriceTag amount={activity.price} currency={activity.currency} size="sm" />
                  </div>
                  <p className="mt-0.5 text-sm text-slate-500">{activity.description}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-slate-400">
                    <span className="flex items-center gap-1">
                      <PiClockFill className="h-3 w-3" /> {activity.duration}
                    </span>
                    <span className="flex items-center gap-1">
                      <PiTagFill className="h-3 w-3" /> {activity.category}
                    </span>
                    {activity.difficulty && (
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">
                        {activity.difficulty}
                      </span>
                    )}
                  </div>
                  <SelectButton
                    label="Add to my trip"
                    selectedLabel="Added"
                    selected={selected}
                    loading={loading}
                    onClick={onSelect ? () => onSelect(activity) : undefined}
                    className="!w-auto"
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
