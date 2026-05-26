export function AndroidInstallSteps({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`text-sm text-gray-600 ${compact ? '' : 'bg-gray-50 rounded-xl p-4'} space-y-2`}>
      <p className="font-medium text-gray-800">Android (Chrome)</p>
      <ol className="list-decimal list-inside space-y-1.5">
        <li>
          Tap <strong>⋮</strong> (three dots) at the <strong>top-right</strong> of Chrome — not Share
        </li>
        <li>
          Tap <strong>Install app</strong> or <strong>Add to Home screen</strong>
        </li>
        <li>Confirm <strong>Install</strong></li>
      </ol>
      {!compact && (
        <p className="text-xs text-gray-500 pt-1">
          No Share button on Android. Use Chrome’s ⋮ menu. If missing, open{' '}
          <strong>https://edquad.github.io/daylife/</strong> in Chrome (not WhatsApp or Samsung browser).
        </p>
      )}
    </div>
  );
}

export function IosInstallSteps({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`text-sm text-gray-600 ${compact ? '' : 'bg-gray-50 rounded-xl p-4'} space-y-2`}>
      <p className="font-medium text-gray-800">iPhone / iPad (Safari)</p>
      <ol className="list-decimal list-inside space-y-1.5">
        <li>Open this site in <strong>Safari</strong></li>
        <li>
          Tap <strong>Share</strong> (square with arrow at the bottom)
        </li>
        <li>
          Choose <strong>Add to Home Screen</strong>
        </li>
      </ol>
    </div>
  );
}
