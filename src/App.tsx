import { useMemo, useState } from 'react'
import { FilterCard } from './components/FilterCard'
import { LeaderboardList } from './components/LeaderboardList'
import { TopPodium } from './components/TopPodium'
import { mockLeaderboard } from './data/mockLeaderboard'
import type { ActivityCategory } from './types/leaderboard'

function App() {
  const [selectedYear, setSelectedYear] = useState<string>('all')
  const [selectedQuarter, setSelectedQuarter] = useState<string>('all')
  const [selectedCategory, setSelectedCategory] = useState<'all' | ActivityCategory>('all')
  const [searchValue, setSearchValue] = useState<string>('')

  const years = useMemo(
    () => Array.from(new Set(mockLeaderboard.map((employee) => employee.year))).sort((a, b) => b - a),
    [],
  )

  const quarters = useMemo(() => Array.from(new Set(mockLeaderboard.map((employee) => employee.quarter))), [])

  const categories = useMemo(
    () => Array.from(new Set(mockLeaderboard.flatMap((employee) => employee.focusCategories))),
    [],
  )

  const employeesByPrimaryFilters = useMemo(() => {
    const shouldAggregate = selectedQuarter === 'all'

    const filtered = mockLeaderboard.filter((employee) => {
      const yearMatch = selectedYear === 'all' || String(employee.year) === selectedYear
      const quarterMatch = selectedQuarter === 'all' || employee.quarter === selectedQuarter
      const categoryMatch = selectedCategory === 'all' || employee.focusCategories.includes(selectedCategory)

      return yearMatch && quarterMatch && categoryMatch
    })

    // Aggregate scores by employee when no specific quarter is selected
    if (shouldAggregate) {
      const aggregated = new Map<string, typeof filtered[0]>()

      filtered.forEach((record) => {
        const existing = aggregated.get(record.fullName)

        if (existing) {
          existing.score += record.score
          existing.focusCategoryCount += record.focusCategoryCount
          existing.focusCategories = Array.from(new Set([...existing.focusCategories, ...record.focusCategories]))
          existing.activities = [...existing.activities, ...record.activities].sort(
            (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
          )
        } else {
          aggregated.set(record.fullName, { ...record, focusCategories: [...record.focusCategories] })
        }
      })

      return Array.from(aggregated.values()).sort((left, right) => right.score - left.score)
    }

    // Specific quarter selected — keep records as-is
    return filtered.sort((left, right) => right.score - left.score)
  }, [selectedCategory, selectedQuarter, selectedYear])

  const rankByEmployeeId = useMemo(() => {
    return employeesByPrimaryFilters.reduce<Record<string, number>>((accumulator, employee, index) => {
      accumulator[employee.id] = index + 1
      return accumulator
    }, {})
  }, [employeesByPrimaryFilters])

  const normalizedSearch = searchValue.trim().toLowerCase()

  const filteredEmployees = useMemo(() => {
    return employeesByPrimaryFilters.filter(
      (employee) => normalizedSearch.length === 0 || employee.fullName.toLowerCase().includes(normalizedSearch),
    )
  }, [employeesByPrimaryFilters, normalizedSearch])

  const topThree = employeesByPrimaryFilters.slice(0, 3)
  const displayedTopThree = useMemo(() => {
    if (normalizedSearch.length === 0) {
      return topThree
    }

    const filteredIds = new Set(filteredEmployees.map((employee) => employee.id))
    return topThree.filter((employee) => filteredIds.has(employee.id))
  }, [filteredEmployees, normalizedSearch, topThree])

  const shouldShowPodium = displayedTopThree.length > 0

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-[1100px] flex-col px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
      <header>
        <h1 className="text-left text-[24px] font-bold text-slate-900">Leaderboard</h1>
        <p className="mt-1 text-left text-[14px] text-[#64748b]">Top performers based on contributions and activity</p>
      </header>

      <div className="mt-6">
        <FilterCard
          years={years}
          quarters={quarters}
          categories={categories}
          selectedYear={selectedYear}
          selectedQuarter={selectedQuarter}
          selectedCategory={selectedCategory}
          searchValue={searchValue}
          onYearChange={setSelectedYear}
          onQuarterChange={setSelectedQuarter}
          onCategoryChange={(value) => setSelectedCategory(value as 'all' | ActivityCategory)}
          onSearchChange={setSearchValue}
        />
      </div>

      {shouldShowPodium ? <TopPodium topThree={displayedTopThree} rankByEmployeeId={rankByEmployeeId} /> : null}

      {filteredEmployees.length > 0 ? (
        <LeaderboardList
          employees={filteredEmployees}
          rankByEmployeeId={rankByEmployeeId}
          selectedCategory={selectedCategory}
        />
      ) : (
        <section className="mt-8 rounded-2xl bg-white p-8 text-center text-[14px] text-[#64748b] shadow-sm ring-1 ring-slate-100">
          No matching employees for current filters.
        </section>
      )}
    </main>
  )
}

export default App
