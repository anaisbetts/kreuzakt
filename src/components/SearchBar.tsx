import { type ComponentPropsWithoutRef, forwardRef } from "react";

export interface SearchBarProps
  extends Omit<ComponentPropsWithoutRef<"input">, "size"> {
  size?: "sm" | "md" | "lg";
  onSearch?: (query: string) => void;
  onClear?: () => void;
  showClearButton?: boolean;
}

const sizeStyles = {
  sm: "h-9 text-sm px-3",
  md: "h-11 text-base px-4",
  lg: "h-14 text-lg px-5",
} as const;

export const SearchBar = forwardRef<HTMLInputElement, SearchBarProps>(
  function SearchBar(
    {
      size = "md",
      placeholder = "Search documents…",
      onSearch,
      onClear,
      showClearButton = false,
      className = "",
      ...props
    },
    ref,
  ) {
    return (
      <div className={`relative flex items-center ${className}`}>
        <svg
          aria-hidden="true"
          className="pointer-events-none absolute left-3 h-5 w-5 text-ink-mute"
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
          ref={ref}
          type="search"
          placeholder={placeholder}
          className={[
            "w-full rounded-field border border-line bg-surface pl-10 text-ink shadow-card placeholder:text-ink-mute hover:border-line-strong",
            /* Hide native search clear so only our custom button shows */
            "[&::-webkit-search-cancel-button]:hidden [&::-ms-clear]:hidden",
            showClearButton ? "pr-10" : "",
            "transition-colors focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/25",
            sizeStyles[size],
          ].join(" ")}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              onSearch?.(e.currentTarget.value);
            }
          }}
          {...props}
        />
        {showClearButton && (
          <button
            type="button"
            onClick={onClear}
            className="absolute right-3 rounded-field text-ink-mute transition-colors hover:text-accent"
            aria-label="Clear search"
          >
            <svg
              aria-hidden="true"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
              className="h-4 w-4"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        )}
      </div>
    );
  },
);
