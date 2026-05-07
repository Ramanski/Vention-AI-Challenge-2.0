import type { ActivityCategory, LeaderboardEmployee } from '../types/leaderboard'
import { LeaderboardRow } from './LeaderboardRow'

interface LeaderboardListProps {
  employees: LeaderboardEmployee[]
  rankByEmployeeId: Record<string, number>
  selectedCategory: ActivityCategory | 'all'
}

export function LeaderboardList({ employees, rankByEmployeeId, selectedCategory }: LeaderboardListProps) {
  return (
    <section className="mt-8 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100 sm:p-5">
      <div className="space-y-3">
        {employees.map((employee) => (
          <LeaderboardRow
            key={employee.id}
            employee={employee}
            rank={rankByEmployeeId[employee.id] ?? 0}
            selectedCategory={selectedCategory}
          />
        ))}
      </div>
    </section>
  )
}
