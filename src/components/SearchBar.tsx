import { type ComponentPropsWithoutRef } from 'react';

export interface SearchBarProps extends Omit<ComponentPropsWithoutRef<'input'>, 'size'> {
  size?: 'sm' | 'md' | 'lg';
  onSearch?: (query: string) => void;
}

const sizeStyles = {
  sm: 'h-9 text-sm px-3',
  md: 'h-11 text-base px-4',
  lg: 'h-14 text-lg px-5',
} as const;

export function SearchBar({
  size = 'md',
  placeholder = 'Search documents…',
  onSearch,
  className = '',
  ...props
}: SearchBarProps) {
  return (
    <div className={`relative flex items-center ${className}`}>
      <svg
        className="pointer-events-none absolute left-3 h-5 w-5 text-neutral-400"
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={2}
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
        />
      </svg>
      <input
        type="search"
        placeholder={placeholder}
        className={[
          'w-full rounded-lg border border-neutral-300 bg-white pl-10 shadow-sm',
          'transition-colors focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20',
          sizeStyles[size],
        ].join(' ')}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            onSearch?.(e.currentTarget.value);
          }
        }}
        {...props}
      />
    </div>
  );
}
