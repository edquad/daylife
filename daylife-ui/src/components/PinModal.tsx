import React, { useState } from 'react';
import { X } from 'lucide-react';

interface Props {
  title: string;
  subtitle?: string;
  submitLabel?: string;
  onSubmit: (pin: string) => Promise<void> | void;
  onClose: () => void;
  error?: string;
}

export function PinModal({ title, subtitle, submitLabel = 'Continue', onSubmit, onClose, error }: Props) {
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [localError, setLocalError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pin.length !== 4) {
      setLocalError('Enter a 4-digit PIN');
      return;
    }
    setLocalError('');
    setLoading(true);
    try {
      await onSubmit(pin);
    } catch (err: any) {
      setLocalError(err.message || 'Wrong PIN');
      setPin('');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white w-full sm:max-w-sm rounded-t-2xl sm:rounded-2xl shadow-xl z-10 p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold">{title}</h2>
            {subtitle && <p className="text-sm text-gray-500 mt-1">{subtitle}</p>}
          </div>
          <button type="button" onClick={onClose} aria-label="Close">
            <X size={20} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="password"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={4}
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
            placeholder="••••"
            autoFocus
            className="w-full text-center text-2xl tracking-[0.5em] px-3 py-3 border rounded-xl outline-none focus:ring-2 focus:ring-brand-500"
          />
          {(localError || error) && (
            <p className="text-sm text-red-600 text-center">{localError || error}</p>
          )}
          <button
            type="submit"
            disabled={loading || pin.length !== 4}
            className="w-full py-2.5 bg-brand-600 text-white rounded-lg font-medium hover:bg-brand-700 disabled:opacity-50"
          >
            {loading ? 'Checking…' : submitLabel}
          </button>
        </form>
      </div>
    </div>
  );
}
