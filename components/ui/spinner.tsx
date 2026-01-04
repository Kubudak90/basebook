import * as React from "react"
import { Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

export interface SpinnerProps extends React.SVGProps<SVGSVGElement> {
    size?: number
    className?: string
}

export function Spinner({ size = 24, className, ...props }: SpinnerProps) {
    return (
        <Loader2
            className={cn("animate-spin text-primary", className)}
            size={size}
            {...props}
        />
    )
}
