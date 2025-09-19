import { Flame, Trophy } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

interface StreakBoardProps {
  currentStreak: number
  longestStreak: number
}

export default function StreakBoard({ currentStreak, longestStreak }: StreakBoardProps) {
  return (
    <Card className="relative overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/5 via-background to-background">
      {/* 装飾画像 */}
        <img
          src="/images/548b6a8271bad588e23f3648555967a8.png"
        alt="見張り猫"
        aria-hidden
        className="pointer-events-none absolute -right-10 bottom-0 w-56 opacity-10 md:-right-6 md:w-64 lg:-right-2 lg:w-72"
      />
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <CardTitle className="flex items-center gap-2 text-base font-semibold text-foreground">
          <Flame className="size-5 text-primary" aria-hidden />
          連続記録
        </CardTitle>
        <Badge variant="secondary" className="rounded-xl">
          <Trophy className="mr-1 size-3.5" aria-hidden /> 最長 {longestStreak}日
        </Badge>
      </CardHeader>
      <CardContent className="flex items-end justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">今日までの連続達成</p>
          <p className="text-5xl font-bold tracking-tight text-primary">{currentStreak}</p>
          <p className="text-sm text-muted-foreground">日継続中</p>
        </div>
        <div className="hidden items-center gap-1 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-medium text-primary md:flex">
          <span>猫が見張り中</span>
        </div>
      </CardContent>
    </Card>
  )
}
