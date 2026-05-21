interface AvatarPhotoProps {
  fullName: string
  gradientFrom: string
  gradientTo: string
  borderClassName: string
  sizeClassName: string
}

export function AvatarPhoto({ fullName, gradientFrom, gradientTo, borderClassName, sizeClassName }: AvatarPhotoProps) {
  const initials = fullName
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  return (
    <div
      className={`${sizeClassName} ${borderClassName} flex items-center justify-center rounded-full border-4 text-xl font-bold text-white shadow-sm`}
      style={{ backgroundImage: `linear-gradient(135deg, ${gradientFrom}, ${gradientTo})` }}
      aria-label={`${fullName} avatar`}
    >
      {initials}
    </div>
  )
}
