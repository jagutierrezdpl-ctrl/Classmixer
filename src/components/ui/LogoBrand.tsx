import Image from "next/image"

type LogoBrandSize = "xs" | "sm" | "md" | "lg"

const SIZE_MAP: Record<LogoBrandSize, { px: number; className: string }> = {
  xs: { px: 24, className: "w-6 h-6 rounded-lg" },
  sm: { px: 32, className: "w-8 h-8 rounded-xl" },
  md: { px: 48, className: "w-12 h-12 rounded-2xl mb-3" },
  lg: { px: 64, className: "w-16 h-16 rounded-2xl mb-4" },
}

export default function LogoBrand({ size = "sm", className }: { size?: LogoBrandSize; className?: string }) {
  const { px, className: baseClass } = SIZE_MAP[size]
  return (
    <Image
      src="/logonew.png"
      alt="ClassMixer"
      width={px}
      height={px}
      className={`${baseClass} shrink-0 ${className ?? ""}`}
      priority
    />
  )
}
