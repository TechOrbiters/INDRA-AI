import { useRef, type FormEvent } from 'react';

interface SearchBarProps {
  value: string;
  onChange: (v: string) => void;
  onSearch: (q: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
  compact?: boolean;
}

export default function SearchBar({
  value,
  onChange,
  onSearch,
  placeholder = 'Search knowledge…',
  autoFocus = false,
  compact = false,
}: SearchBarProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    onSearch(value);
  };

  return (
    <form
      onSubmit={handleSubmit}
      role="search"
      className={`relative flex items-center ${compact ? 'max-w-xl' : 'w-full'}`}
    >
      <label htmlFor="indra-search" className="sr-only">
        Search knowledge
      </label>

      {/* Icon */}
      <span
        aria-hidden="true"
        className={`absolute left-4 text-white/40 pointer-events-none ${compact ? 'text-sm' : 'text-base'}`}
      >
        🔍
      </span>

      <input
        id="indra-search"
        ref={inputRef}
        type="search"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        autoFocus={autoFocus}
        autoComplete="off"
        spellCheck={false}
        className={`w-full bg-white/5 border border-white/10 rounded-2xl pl-11 pr-24 text-white placeholder:text-white/30 focus:outline-none focus:border-[#0F62FE] focus:ring-2 focus:ring-[#0F62FE]/20 transition-all duration-200 ${
          compact ? 'py-2.5 text-sm' : 'py-4 text-base'
        }`}
      />

      {/* AI badge */}
      <span
        aria-hidden="true"
        className="absolute right-14 text-[10px] font-bold text-[#8A3FFC] bg-[#8A3FFC]/10 border border-[#8A3FFC]/20 rounded-full px-2 py-0.5"
      >
        AI
      </span>

      <button
        type="submit"
        aria-label="Search"
        className={`absolute right-2 bg-[#0F62FE] hover:bg-[#0043CE] text-white font-medium rounded-xl transition-all duration-200 hover:shadow-lg hover:shadow-[#0F62FE]/30 ${
          compact ? 'px-3 py-1.5 text-xs' : 'px-4 py-2 text-sm'
        }`}
      >
        Search
      </button>
    </form>
  );
}
