import React, { useState } from 'react';
import { Copy, Check, X, KeyRound } from 'lucide-react';

interface Props {
  code: string;
  title?: string;
  subtitle?: string;
  onClose: () => void;
}

export function RecoveryCodeModal({
  code,
  title = 'Save your recovery code',
  subtitle = 'You need this to reset your PIN if you forget it. Store it somewhere safe — we cannot show it again unless you generate a new one in Settings.',
  onClose,
}: Props) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard may be unavailable */
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white w-full sm:max-w-md rounded-2xl shadow-xl z-10 p-6">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
              <KeyRound size={20} className="text-amber-700" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">{title}</h2>
              <p className="text-sm text-gray-500 mt-1">{subtitle}</p>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close">
            <X size={20} />
          </button>
        </div>

        <div className="bg-gray-50 border rounded-xl p-4 text-center">
          <p className="text-2xl font-bold tracking-widest text-gray-900 font-mono">{code}</p>
        </div>

        <div className="flex gap-2 mt-4">
          <button
            type="button"
            onClick={copy}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 border rounded-xl text-sm font-medium hover:bg-gray-50"
          >
            {copied ? <Check size={16} className="text-green-600" /> : <Copy size={16} />}
            {copied ? 'Copied' : 'Copy code'}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 bg-brand-600 text-white rounded-xl text-sm font-semibold hover:bg-brand-700"
          >
            I saved it
          </button>
        </div>
      </div>
    </div>
  );
}
