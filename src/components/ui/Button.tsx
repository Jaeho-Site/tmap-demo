import { cva, type VariantProps } from 'class-variance-authority'
import type { ButtonHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

// AllTrails 룩: 라임 pill(primary), 흰 pill(secondary), ghost, 원형 아이콘(icon)
const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 font-extrabold whitespace-nowrap transition-colors active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none select-none',
  {
    variants: {
      variant: {
        primary: 'bg-primary text-on-primary hover:brightness-95',
        secondary: 'bg-white text-black hover:brightness-95',
        surface: 'bg-surface-2 text-fg hover:brightness-110',
        ghost: 'bg-transparent text-fg hover:bg-surface-2',
        outline: 'bg-transparent text-fg border border-border hover:bg-surface-2',
      },
      size: {
        sm: 'h-9 px-4 text-sm rounded-full',
        md: 'h-11 px-5 text-[15px] rounded-full',
        lg: 'h-14 px-7 text-base rounded-full',
        icon: 'h-12 w-12 rounded-full',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
)

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export function Button({ className, variant, size, ...props }: ButtonProps) {
  return <button className={cn(buttonVariants({ variant, size }), className)} {...props} />
}

export { buttonVariants }
