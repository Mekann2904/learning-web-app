"use client"

import { useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { Gift, PawPrint, Sparkles } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { cn } from "@/lib/utils"

interface RewardCardProps {
  visible: boolean
  monthLabel: string
  alreadyCelebrated: boolean
  onCelebrate: () => void
}

export default function RewardCard({ visible, monthLabel, alreadyCelebrated, onCelebrate }: RewardCardProps) {
  const [open, setOpen] = useState(false)

  const handleCelebrate = () => {
    onCelebrate()
    setOpen(false)
    // TODO: Hook Supabase here when remote persistence is ready.
  }

  return (
    <AnimatePresence>
      {visible ? (
        <motion.div
          key="reward"
          initial={{ x: 40, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: 40, opacity: 0 }}
          transition={{ type: "spring", stiffness: 160, damping: 18 }}
          className="h-full"
        >
          <Card className="flex h-full flex-col justify-between rounded-3xl border border-primary/30 bg-gradient-to-br from-primary/15 via-background to-background shadow-lg">
            <CardHeader className="space-y-1">
              <CardTitle className="flex items-center gap-2 text-base font-semibold text-primary">
                <Gift className="size-5" aria-hidden />
                猫缶アンロック
              </CardTitle>
              <p className="text-sm text-muted-foreground">{monthLabel}は100%達成！お祝いしよう。</p>
            </CardHeader>
            <CardContent className="space-y-4">
              <MotionCan alreadyOpened={alreadyCelebrated} />
              <AlertDialog open={open} onOpenChange={setOpen}>
                <AlertDialogTrigger asChild>
                  <Button className="w-full gap-2 rounded-2xl text-sm font-semibold">
                    <Sparkles className="size-4" aria-hidden /> 開ける
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent className="rounded-3xl border border-primary/20">
                  <AlertDialogHeader>
                    <AlertDialogTitle className="flex items-center gap-2 text-lg font-semibold text-primary">
                      <PawPrint className="size-5" aria-hidden />
                      猫缶を開封！
                    </AlertDialogTitle>
                    <AlertDialogDescription className="text-sm text-muted-foreground">
                      猫は歓喜の舞を披露中（※音声演出はここに実装可能）。
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <div className="flex flex-col items-center gap-3 py-4">
                    <motion.div
                      layout
                      initial={{ rotate: -6, y: 20, scale: 0.95 }}
                      animate={{ rotate: [-6, 6, -4, 4, 0], y: [20, -4, 4, -2, 0], scale: 1 }}
                      transition={{ duration: 0.8, ease: "easeOut" }}
                      className="relative h-28 w-28"
                    >
                      <div className="absolute inset-0 rounded-[32px] bg-primary/10" />
                      <div className="absolute bottom-3 left-1/2 w-20 -translate-x-1/2 rounded-xl bg-primary/20 py-2 text-center text-sm text-primary">
                        猫缶
                      </div>
                      <motion.div
                        className="absolute -top-2 left-1/2 h-12 w-14 -translate-x-1/2 rounded-t-[18px] border-2 border-primary bg-background"
                        initial={{ rotate: -18 }}
                        animate={{ rotate: [-18, -12, -6], y: [-6, -12, -18] }}
                        transition={{ duration: 0.8, ease: "easeOut" }}
                      />
                    </motion.div>
                    <p className="text-xs text-muted-foreground">
                      猫は満足げに「にゃー」と鳴いた（音声フック用コメント）。
                    </p>
                  </div>
                  <AlertDialogFooter>
                    <AlertDialogCancel asChild>
                      <Button type="button" variant="ghost" className="rounded-2xl">
                        閉じる
                      </Button>
                    </AlertDialogCancel>
                    <AlertDialogAction asChild>
                      <Button type="button" className="rounded-2xl bg-primary text-primary-foreground" onClick={handleCelebrate}>
                        祝杯！
                      </Button>
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </CardContent>
          </Card>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}

const MotionCan = ({ alreadyOpened }: { alreadyOpened: boolean }) => (
  <motion.div
    className={cn(
      "relative flex h-40 items-center justify-center overflow-hidden rounded-3xl border border-primary/20 bg-background",
      alreadyOpened ? "ring-2 ring-primary/40" : ""
    )}
    initial={{ opacity: 0, y: 12 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.6, ease: "easeOut" }}
  >
    <motion.div
      className="absolute h-20 w-20 rounded-full bg-primary/20"
      animate={alreadyOpened ? { scale: [1, 1.1, 1], opacity: [0.8, 1, 0.8] } : { scale: 1, opacity: 0.6 }}
      transition={{ duration: 1.8, repeat: alreadyOpened ? Infinity : 0, repeatType: "reverse" }}
    />
    <div className="relative z-10 flex flex-col items-center gap-1 text-primary">
      <PawPrint className="size-7" aria-hidden />
      <span className="text-sm font-semibold">猫のご褒美</span>
      <span className="text-xs text-muted-foreground">100%でアンロック</span>
    </div>
  </motion.div>
)
