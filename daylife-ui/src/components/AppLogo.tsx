import { APP_NAME } from '../lib/brand';
import { cn } from '../lib/utils';

interface AppLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  showShadow?: boolean;
}

const sizes = {
  sm: 'w-8 h-8 rounded-lg',
  md: 'w-10 h-10 rounded-xl',
  lg: 'w-14 h-14 rounded-2xl',
  xl: 'w-16 h-16 rounded-2xl',
};

export function AppLogo({ size = 'md', className, showShadow = true }: AppLogoProps) {
  const base = import.meta.env.BASE_URL || '/';
  return (
    <img
      src={`${base}icon.svg`}
      alt={APP_NAME}
      className={cn(sizes[size], showShadow && 'shadow-md', className)}
    />
  );
}
