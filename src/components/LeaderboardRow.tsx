import { useMemo, useState } from 'react'
import type { ActivityCategory, LeaderboardEmployee } from '../types/leaderboard'
import { AvatarPhoto } from './AvatarPhoto'
import { CategoryIcon, ChevronDownIcon, StarIcon } from './icons'

interface LeaderboardRowProps {
  employee: LeaderboardEmployee
  rank: number
  selectedCategory: ActivityCategory | 'all'
}

export function LeaderboardRow({ employee, rank, selectedCategory }: LeaderboardRowProps) {
  const [expanded, setExpanded] = useState(false)

  const recentActivity = useMemo(() => employee.activities.slice(0, 5), [employee.activities])
  const activityCountByCategory = useMemo(() => {
    return employee.activities.reduce<Record<ActivityCategory, number>>(
      (accumulator, activity) => {
        accumulator[activity.category] += 1
        return accumulator
      },
      {
        Code: 0,
        Review: 0,
        Mentoring: 0,
        Delivery: 0,
        Quality: 0,
      },
    )
  }, [employee.activities])

  const visibleCategories = useMemo(() => {
    if (selectedCategory !== 'all') {
      return employee.focusCategories.includes(selectedCategory) ? [selectedCategory] : []
    }

    return employee.focusCategories
  }, [employee.focusCategories, selectedCategory])

  const formatDate = (value: string) => {
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) {
      return value
    }

    const day = String(date.getDate()).padStart(2, '0')
    const month = date.toLocaleDateString('en-GB', { month: 'short' })
    const year = date.getFullYear()
    return `${day}-${month}-${year}`
  }

  const avatarSizeClass = 'h-12 w-12'

  return (
    <div
      className={`overflow-hidden rounded-2xl bg-white transition ${
        expanded ? 'border border-[#0ea5e9]/80 shadow-sm' : 'border border-slate-100'
      }`}
    >
      <div className="grid grid-cols-[34px_56px_minmax(180px,1fr)_64px_94px_44px] items-center gap-3 px-4 py-4 min-[769px]:grid-cols-[40px_72px_minmax(260px,1fr)_auto_52px] min-[769px]:px-7 min-[769px]:py-6">
        <div className="text-[40px] font-bold leading-none text-slate-400">{rank}</div>

        <AvatarPhoto
          fullName={employee.fullName}
          gradientFrom={employee.avatarGradientFrom}
          gradientTo={employee.avatarGradientTo}
          borderClassName="border-transparent"
          sizeClassName={avatarSizeClass}
        />

        <div>
          <p className="truncate text-[24px] font-bold leading-tight text-slate-900">{employee.fullName}</p>
          <p className="truncate text-[14px] text-[#46658b]">
            {employee.position} ({employee.departmentCode})
          </p>
        </div>

        <div className="hidden h-full items-center justify-end min-[769px]:flex">
          <div className="inline-flex items-start gap-4 text-[#0ea5e9]">
            {visibleCategories.map((cat) => (
              <div key={cat} className="inline-flex flex-col items-center">
                <CategoryIcon category={cat} className="h-6 w-6" />
                <span className="mt-1 text-[12px] font-semibold leading-none text-[#475569]">{activityCountByCategory[cat]}</span>
              </div>
            ))}
          </div>

          <div className="ml-4 flex h-full flex-col items-end border-l border-slate-200 pl-4">
            <span className="text-[12px] font-semibold uppercase tracking-wide text-slate-400">Total</span>
            <span className="mt-1 inline-flex items-center gap-2 text-[24px] font-bold text-[#0ea5e9]">
              <StarIcon className="h-6 w-6" />
              {employee.score}
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setExpanded((previous) => !previous)}
          className={`hidden h-11 w-11 items-center justify-center rounded-full text-[#0ea5e9] transition min-[769px]:inline-flex ${
            expanded ? 'bg-[#d8ecf9] hover:bg-[#c7e4f8]' : 'bg-slate-100 hover:bg-slate-200'
          }`}
          aria-expanded={expanded}
          aria-label={`Toggle recent activity for ${employee.fullName}`}
        >
          <ChevronDownIcon className={`h-6 w-6 transition-transform ${expanded ? 'rotate-180' : ''}`} />
        </button>
      </div>

      <div className="mt-3 flex items-center justify-between border-t border-slate-200 px-4 pb-4 pt-3 min-[769px]:hidden">
        <div className="inline-flex items-start gap-3 text-[14px] text-[#2e4a6e]">
          {visibleCategories.map((cat) => (
            <div key={cat} className="inline-flex flex-col items-center">
              <CategoryIcon category={cat} className="h-4 w-4 text-[#0ea5e9]" />
              <span className="mt-0.5 text-[14px] font-semibold leading-none">{activityCountByCategory[cat]}</span>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setExpanded((previous) => !previous)}
          className={`inline-flex h-11 w-11 items-center justify-center rounded-full text-[#0ea5e9] transition ${
            expanded ? 'bg-[#d8ecf9] hover:bg-[#c7e4f8]' : 'bg-slate-100 hover:bg-slate-200'
          }`}
          aria-expanded={expanded}
          aria-label={`Toggle recent activity for ${employee.fullName}`}
        >
          <ChevronDownIcon className={`h-6 w-6 transition-transform ${expanded ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {expanded ? (
        <div className="border-t border-slate-200 px-4 pb-2 pt-6 min-[769px]:px-7">
          <p className="mb-6 text-[12px] font-semibold uppercase tracking-wide text-[#46658b]">Recent Activity</p>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[460px] table-auto text-left">
              <thead>
                <tr className="border-b border-slate-200 text-[12px] uppercase tracking-wide text-[#46658b]">
                  <th className="px-2 pb-4 font-semibold">Activity</th>
                  <th className="w-[140px] px-2 pb-4 font-semibold">Category</th>
                  <th className="w-[96px] px-2 pb-4 font-semibold">Date</th>
                  <th className="w-[72px] px-2 pb-4 text-right font-semibold">Points</th>
                </tr>
              </thead>
              <tbody>
                {recentActivity.map((activity) => (
                  <tr key={`${employee.id}-${activity.activity}-${activity.date}`} className="border-b border-slate-200 text-[14px] text-[#46658b]">
                    <td className="whitespace-normal break-words [overflow-wrap:anywhere] px-2 py-5 text-[14px] font-semibold text-slate-900">{activity.activity}</td>
                    <td className="px-2 py-5">
                      <span className="inline-flex rounded-2xl bg-slate-200 px-4 py-1 text-[12px] text-[#46658b]">{activity.category}</span>
                    </td>
                    <td className="break-words px-2 py-5 text-[14px]">{formatDate(activity.date).replace(/-/g, '-\u200b')}</td>
                    <td className="whitespace-nowrap px-2 py-5 text-right text-[14px] font-bold text-[#0ea5e9]">+{activity.points}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  )
}
