import { Link } from 'react-router-dom';
import type { ShareFeature } from '../lib/sharing';
import { SHARE_FEATURE_PAGES } from '../lib/sharing';

interface SharedFeatureLinksProps {
  features: ShareFeature[];
  className?: string;
}

export function SharedFeatureLinks({ features, className }: SharedFeatureLinksProps) {
  const links = features
    .map((f) => SHARE_FEATURE_PAGES[f])
    .filter(Boolean);

  if (links.length === 0) return null;

  return (
    <div className={className}>
      <p className="text-xs font-medium text-violet-800 mb-2">Where to find shared items:</p>
      <div className="flex flex-wrap gap-2">
        {links.map((link) => (
          <Link
            key={link.path + link.label}
            to={link.path}
            className="text-xs px-3 py-1.5 rounded-full bg-white border border-violet-200 text-violet-700 hover:bg-violet-50 touch-manipulation"
          >
            {link.label}
          </Link>
        ))}
      </div>
    </div>
  );
}
