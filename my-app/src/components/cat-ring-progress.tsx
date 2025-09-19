"use client"

import { useEffect } from "react"
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion"
import { TrendingUp } from "lucide-react"

import { Card, CardContent } from "@/components/ui/card"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"

interface CatRingProgressProps {
  percentage: number
  label: string
  meta?: string
}

const RADIUS = 68
const STROKE_WIDTH = 16
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

export default function CatRingProgress({ percentage, label, meta }: CatRingProgressProps) {
  const progress = useMotionValue(percentage)
  const animated = useSpring(progress, { stiffness: 120, damping: 25, mass: 0.4 })
  const dashOffset = useTransform(animated, (value: number) => CIRCUMFERENCE * (1 - value / 100))

  useEffect(() => {
    progress.set(Math.max(0, Math.min(100, percentage)))
  }, [percentage, progress])

  const headerMeta = meta ?? `${percentage}%`

  return (
    <Card className="rounded-2xl border border-border bg-card">
      <CardContent className="flex flex-col items-center gap-6 p-6">
        <div className="flex w-full items-center justify-between text-sm text-muted-foreground">
          <span className="flex items-center gap-2 font-medium text-foreground">
            <TrendingUp className="size-4 text-primary" aria-hidden />
            {label}
          </span>
          <span>{headerMeta}</span>
        </div>
        <Tooltip>
          <TooltipTrigger asChild>
            <div
              className="relative"
              role="img"
              aria-label={`${label} ${percentage}パーセント`}
            >
              <svg
                aria-hidden
                className="size-44"
                width={180}
                height={180}
                viewBox="0 0 180 180"
              >
                <circle
                  cx="90"
                  cy="90"
                  r={RADIUS}
                  fill="none"
                  strokeWidth={STROKE_WIDTH}
                  stroke="hsl(var(--muted))"
                  className="opacity-30"
                />
                <circle
                  cx="90"
                  cy="90"
                  r={RADIUS}
                  fill="none"
                  strokeWidth={STROKE_WIDTH + 8}
                  stroke="hsl(var(--muted))"
                  className="opacity-10"
                />
                <motion.circle
                  cx="90"
                  cy="90"
                  r={RADIUS}
                  fill="none"
                  strokeWidth={STROKE_WIDTH}
                  strokeLinecap="round"
                  stroke="#000"
                  strokeDasharray={CIRCUMFERENCE}
                  style={{ strokeDashoffset: dashOffset }}
                  initial={{ strokeDashoffset: CIRCUMFERENCE }}
                  transform="rotate(-90 90 90)"
                />
                <text
                  x="90"
                  y="86"
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize="36"
                  fontWeight="600"
                  className="fill-black"
                >
                  {percentage}%
                </text>
                <text
                  x="90"
                  y="110"
                  textAnchor="middle"
                  fontSize="12"
                  className="fill-muted-foreground tracking-wide"
                >
                  {label}
                </text>
              </svg>
            </div>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="rounded-xl bg-secondary text-secondary-foreground">
            猫リングは{label}に連動して伸び縮みします。
          </TooltipContent>
        </Tooltip>
      </CardContent>
    </Card>
  )
}
