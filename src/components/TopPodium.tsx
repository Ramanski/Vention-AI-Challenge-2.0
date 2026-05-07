import { AvatarPhoto } from './AvatarPhoto'
import { StarIcon } from './icons'
import type { LeaderboardEmployee } from '../types/leaderboard'

interface TopPodiumProps {
  topThree: LeaderboardEmployee[]
  rankByEmployeeId: Record<string, number>
}

function TopCard({ employee, rank, place }: { employee: LeaderboardEmployee; rank: number; place: 1 | 2 | 3 }) {
  const isFirst = place === 1

  const rankStyles = {
    badge: isFirst
      ? 'bg-[rgb(234,179,8)] text-white'
      : place === 2
        ? 'bg-[#94a3b8] text-white'
        : 'bg-[#92400e] text-white',
    border: isFirst ? 'border-[rgb(251,191,36)]' : 'border-white',
    score: isFirst ? 'bg-[rgb(253,224,71)] text-[rgb(202,138,4)]' : 'bg-white text-[#0ea5e9]',
    podium: isFirst
      ? 'bg-[linear-gradient(180deg,#fef3c7,#fde68a)]'
      : 'bg-[linear-gradient(180deg,#d3dbe6,#c4cedc)]',
    podiumNumber: isFirst ? 'text-[rgba(202,138,4,0.22)]' : 'text-[rgba(100,116,139,0.2)]',
  }

  return (
    <article className="flex w-full max-w-[280px] flex-col items-center">
      <div className="relative mb-3">
        <AvatarPhoto
          fullName={employee.fullName}
          gradientFrom={employee.avatarGradientFrom}
          gradientTo={employee.avatarGradientTo}
          borderClassName={rankStyles.border}
          sizeClassName={isFirst ? 'h-28 w-28' : 'h-20 w-20'}
        />
        <span
          className={`absolute -bottom-1 -right-1 flex ${isFirst ? 'h-10 w-10' : 'h-8 w-8'} items-center justify-center rounded-full border-2 border-white ${isFirst ? 'text-[16px]' : 'text-[14px]'} font-bold ${rankStyles.badge}`}
        >
          {rank}
        </span>
      </div>

      <p className="text-center text-[24px] font-bold leading-tight text-slate-900">{employee.fullName}</p>
      <p className="mt-1 text-center text-[14px] text-slate-500">
        {employee.position} ({employee.departmentCode})
      </p>

      <div
        className={`mt-3 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[14px] font-bold ${rankStyles.score}`}
        style={
          isFirst
            ? {
                background: '#fef9c3',
                borderColor: '#fde047',
                color: '#ca8a04',
                fontSize: '20px',
                padding: '8px 20px',
                border: '1px solid #fde047',
              }
            : {
                color: '#0ea5e9',
                alignItems: 'center',
                background: '#fff',
                border: '1px solid #e2e8f0',
                borderRadius: '20px',
                boxShadow: '0 1px 2px rgba(0, 0, 0, .05)',
                display: 'flex',
                fontSize: '18px',
                fontWeight: '700',
                gap: '6px',
                padding: '6px 16px',
              }
        }
      >
        <StarIcon className="h-8 w-8" />
        <span>{employee.score}</span>
      </div>

      <div
        className={`relative mt-4 w-full rounded-t-[12px] border-t-2 ${rankStyles.podium}`}
        style={
          isFirst
            ? {
                background: 'linear-gradient(180deg, #fef3c7, #fde68a)',
                borderTopColor: '#fde047',
                height: '160px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
                position: 'relative',
              }
            : {
                height: '128px',
                alignItems: 'flex-start',
                background: 'linear-gradient(180deg, #e2e8f0, #cbd5e1)',
                borderRadius: '12px 12px 0 0',
                borderTop: '2px solid #cbd5e1',
                boxShadow: 'inset 0 2px 4px rgba(0, 0, 0, .06)',
                display: 'flex',
                justifyContent: 'center',
                overflow: 'hidden',
                paddingTop: '16px',
                position: 'relative',
                width: '100%',
              }
        }
      >
        <span
          className={`text-center text-[100px] font-black leading-none ${rankStyles.podiumNumber}`}
        >
          {rank}
        </span>
      </div>
    </article>
  )
}

export function TopPodium({ topThree, rankByEmployeeId }: TopPodiumProps) {
  const byPlace = topThree.reduce<Partial<Record<1 | 2 | 3, LeaderboardEmployee>>>((accumulator, employee) => {
    const place = rankByEmployeeId[employee.id]
    if (place === 1 || place === 2 || place === 3) {
      accumulator[place] = employee
    }
    return accumulator
  }, {})

  const first = byPlace[1]
  const second = byPlace[2]
  const third = byPlace[3]

  const shownCount = [first, second, third].filter(Boolean).length

  if (shownCount === 0) {
    return null
  }

  if (shownCount === 1) {
    const single = first ?? second ?? third
    const singlePlace = first ? 1 : second ? 2 : 3

    if (!single) {
      return null
    }

    return (
      <section className="mt-8 pb-2">
        <div className="mx-auto flex max-w-[900px] justify-center px-2">
          <TopCard employee={single} rank={rankByEmployeeId[single.id] ?? 0} place={singlePlace} />
        </div>
      </section>
    )
  }

  return (
    <section className="mt-8 pb-2">
      <div className="mx-auto flex max-w-[900px] flex-col items-center gap-5 px-2 md:flex-row md:items-end md:justify-center md:gap-6">
        {second ? (
          <div className="order-2 md:order-1">
            <TopCard employee={second} rank={rankByEmployeeId[second.id] ?? 0} place={2} />
          </div>
        ) : (
          <div className="order-2 hidden w-[280px] md:order-1 md:block" />
        )}

        {first ? (
          <div className="order-1 md:order-2">
            <TopCard employee={first} rank={rankByEmployeeId[first.id] ?? 0} place={1} />
          </div>
        ) : (
          <div className="order-1 hidden w-[280px] md:order-2 md:block" />
        )}

        {third ? (
          <div className="order-3 md:order-3">
            <TopCard employee={third} rank={rankByEmployeeId[third.id] ?? 0} place={3} />
          </div>
        ) : (
          <div className="order-3 hidden w-[280px] md:block" />
        )}
      </div>
    </section>
  )
}
