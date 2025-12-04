import { cn } from "../lib/utils"

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn(
        "relative isolate overflow-hidden rounded-xl border border-border/60 bg-gradient-to-br from-muted/80 via-muted to-muted/80",
        "shadow-[0_1px_0_rgba(255,255,255,0.05)]",
        "after:pointer-events-none after:absolute after:inset-0 after:bg-gradient-to-r after:from-transparent after:via-foreground/10 after:to-transparent after:animate-[pulse_1.6s_ease-in-out_infinite]",
        className
      )}
      {...props}
    />
  )
}

export { Skeleton }
