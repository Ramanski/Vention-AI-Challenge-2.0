export type Quarter = 'Q1' | 'Q2' | 'Q3' | 'Q4'

export type ActivityCategory =
  | 'Code'
  | 'Review'
  | 'Mentoring'
  | 'Delivery'
  | 'Quality'

export interface ActivityRecord {
  activity: string
  category: ActivityCategory
  date: string
  points: number
}

export interface LeaderboardEmployee {
  id: string
  fullName: string
  position: string
  departmentCode: string
  year: number
  quarter: Quarter
  score: number
  focusCategories: ActivityCategory[]
  focusCategoryCount: number
  avatarGradientFrom: string
  avatarGradientTo: string
  activities: ActivityRecord[]
}
