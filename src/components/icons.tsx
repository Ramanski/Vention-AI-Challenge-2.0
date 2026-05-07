import type { ActivityCategory } from '../types/leaderboard'

export function StarIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
      <path d="M11.111 3.19a1 1 0 0 1 1.778 0l2.225 4.508 4.975.723a1 1 0 0 1 .554 1.706l-3.6 3.509.85 4.954a1 1 0 0 1-1.45 1.054L12 17.304l-4.45 2.34a1 1 0 0 1-1.45-1.054l.85-4.954-3.6-3.509a1 1 0 0 1 .554-1.706l4.975-.723 2.225-4.508Z" />
    </svg>
  )
}

export function ChevronDownIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" className={className}>
      <path d="m6 9 6 6 6-6" />
    </svg>
  )
}

export function CategoryIcon({ category, className = 'h-4 w-4' }: { category: ActivityCategory; className?: string }) {
  if (category === 'Code') {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" className={className}>
        <path d="m8 9-4 3 4 3" />
        <path d="m16 9 4 3-4 3" />
        <path d="m14 5-4 14" />
      </svg>
    )
  }

  if (category === 'Review') {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" className={className}>
        <path d="M4 5h16v14H4z" />
        <path d="m7 9 2 2 4-4" />
      </svg>
    )
  }

  if (category === 'Mentoring') {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" className={className}>
        <circle cx="8" cy="9" r="3" />
        <circle cx="16" cy="10" r="2.5" />
        <path d="M3 19c0-2.8 2.2-5 5-5s5 2.2 5 5" />
        <path d="M13 19c.1-2 1.7-3.5 3.7-3.5 2 0 3.3 1.4 3.3 3.5" />
      </svg>
    )
  }

  if (category === 'Delivery') {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" className={className}>
        <path d="M3 7h12v10H3z" />
        <path d="M15 10h3l3 3v4h-6z" />
        <circle cx="7" cy="19" r="2" />
        <circle cx="17" cy="19" r="2" />
      </svg>
    )
  }

  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" className={className}>
      <path d="M12 3v6" />
      <path d="M5.636 6.636 9.88 10.88" />
      <path d="M3 12h6" />
      <path d="m5.636 17.364 4.243-4.243" />
      <path d="M12 15v6" />
      <path d="m18.364 17.364-4.243-4.243" />
      <path d="M15 12h6" />
      <path d="M18.364 6.636 14.12 10.88" />
      <circle cx="12" cy="12" r="2" />
    </svg>
  )
}
