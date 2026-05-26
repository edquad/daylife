import type { ItemVisibility } from '../lib/privacy';

interface Props {
  value: ItemVisibility;
  onChange: (value: ItemVisibility) => void;
  compact?: boolean;
}

export function VisibilityToggle({ value, onChange, compact }: Props) {
  return (
    <div>
      {!compact && <label className="block text-sm font-medium mb-1">Who can see this?</label>}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => onChange('PRIVATE')}
          className={`flex-1 px-3 py-2 rounded-lg text-sm border ${
            value === 'PRIVATE'
              ? 'bg-brand-50 border-brand-300 text-brand-800 font-medium'
              : 'border-gray-200 text-gray-500'
          }`}
        >
          Just me
        </button>
        <button
          type="button"
          onClick={() => onChange('SHARED')}
          className={`flex-1 px-3 py-2 rounded-lg text-sm border ${
            value === 'SHARED'
              ? 'bg-brand-50 border-brand-300 text-brand-800 font-medium'
              : 'border-gray-200 text-gray-500'
          }`}
        >
          Household
        </button>
      </div>
    </div>
  );
}
