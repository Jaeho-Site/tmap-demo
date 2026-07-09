import { cva, type VariantProps } from 'class-variance-authority'
import type { ButtonHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

// 필터/목적/카테고리 칩. selected 시 라임 채움.
const chipVariants = cva(
  'inline-flex items-center gap-1.5 h-9 px-4 rounded-full text-sm font-bold whitespace-nowrap border transition-colors active:scale-[0.98] select-none',
  {
    variants: {
      selected: {
        true: 'bg-primary text-on-primary border-primary',
        false: 'bg-surface-2 text-fg border-border hover:brightness-110',
      },
    },
    defaultVariants: { selected: false },
  },
)

export interface ChipProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof chipVariants> {}

export function Chip({ className, selected, ...props }: ChipProps) {
  return <button type="button" className={cn(chipVariants({ selected }), className)} {...props} />
}
