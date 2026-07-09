import type { HTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

/** 기본 표면 카드 (shadcn형). 라운드 20px. */
export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('bg-surface rounded-[var(--radius-lg)] overflow-hidden', className)}
      {...props}
    />
  )
}

export function CardBody({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('p-4', className)} {...props} />
}
