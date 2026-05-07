import type { ActivityCategory, Quarter } from '../types/leaderboard'

interface FilterCardProps {
  years: number[]
  quarters: Quarter[]
  categories: ActivityCategory[]
  selectedYear: string
  selectedQuarter: string
  selectedCategory: string
  searchValue: string
  onYearChange: (value: string) => void
  onQuarterChange: (value: string) => void
  onCategoryChange: (value: string) => void
  onSearchChange: (value: string) => void
}

const selectClassName =
  'h-8 w-[150px] appearance-none rounded-[2px] border border-[#373737] bg-[#ebebed] px-3 pr-9 text-[14px] font-normal text-black outline-none shadow-none transition focus:border-black focus:ring-0 focus:shadow-[0_0_0_1px_#000] sm:w-[160px]'

const searchClassName =
  'h-8 w-full rounded-[2px] border border-[#373737] bg-[#ebebed] py-[1px] pl-11 pr-3 text-[14px] font-normal text-black outline-none shadow-none transition-all placeholder:text-slate-700 focus:border-black focus:ring-0 focus:shadow-[0_0_0_1px_#000] focus:pl-3'

export function FilterCard({
  years,
  quarters,
  categories,
  selectedYear,
  selectedQuarter,
  selectedCategory,
  searchValue,
  onYearChange,
  onQuarterChange,
  onCategoryChange,
  onSearchChange,
}: FilterCardProps) {
  return (
    <section className="rounded-2xl bg-[#f1f5f9] p-4 shadow-sm ring-1 ring-[#e2e8f0] sm:p-5">
      <div
        className="flex flex-wrap items-stretch gap-3"
        style={{
          fontFamily:
            'Segoe UI, Segoe UI Web (West European), Segoe UI, -apple-system, BlinkMacSystemFont, Roboto, Helvetica Neue, sans-serif',
          WebkitFontSmoothing: 'antialiased',
          boxSizing: 'border-box',
          margin: 0,
          padding: 0,
        }}
      >
        <div className="relative w-fit">
          <select value={selectedYear} onChange={(event) => onYearChange(event.target.value)} className={selectClassName}>
            <option value="all">All Years</option>
            {years.map((year) => (
              <option key={year} value={String(year)}>
                {year}
              </option>
            ))}
          </select>
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden="true"
            className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500"
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        </div>

        <div className="relative w-fit">
          <select value={selectedQuarter} onChange={(event) => onQuarterChange(event.target.value)} className={selectClassName}>
            <option value="all">All Quarters</option>
            {quarters.map((quarter) => (
              <option key={quarter} value={quarter}>
                {quarter}
              </option>
            ))}
          </select>
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden="true"
            className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500"
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        </div>

        <div className="relative w-fit">
          <select value={selectedCategory} onChange={(event) => onCategoryChange(event.target.value)} className={selectClassName}>
            <option value="all">All Categories</option>
            {categories.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden="true"
            className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500"
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        </div>

        <label className="group relative block min-w-[250px] flex-1">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-600 transition-all duration-300 ease-in-out group-focus-within:-translate-x-8 group-focus-within:opacity-0"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
          <input
            value={searchValue}
            onChange={(event) => onSearchChange(event.target.value)}
            className={searchClassName}
            type="text"
            placeholder="Search employee..."
          />
        </label>
      </div>
    </section>
  )
}
