"use client"
 
import * as React from "react"
import { Moon, Sun, Laptop } from "lucide-react"
import { useTheme } from "next-themes"
import { Button } from "@/components/ui/button"
 
export function DarkModeToggle() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = React.useState(false)

  React.useEffect(() => {
    setMounted(true)
  }, [])

  const cycleTheme = () => {
    if (theme === 'light') setTheme('dark')
    else if (theme === 'dark') setTheme('system')
    else setTheme('light')
  }

  if (!mounted) {
    return (
      <Button variant="outline" size="icon">
        <div className="relative w-[1.2rem] h-[1.2rem]">
          <Sun className="h-[1.2rem] w-[1.2rem]" />
        </div>
        <span className="sr-only">Toggle between light, dark, and system theme</span>
      </Button>
    )
  }

  return (
    <Button variant="outline" size="icon" onClick={cycleTheme}>
      <div className="relative w-[1.2rem] h-[1.2rem]">
        <Sun className="h-[1.2rem] w-[1.2rem] absolute transition-all rotate-0 scale-100
          data-[state=dark]:-rotate-90 data-[state=dark]:scale-0
          data-[state=system]:-rotate-90 data-[state=system]:scale-0"
          data-state={theme}
        />
        <Moon className="h-[1.2rem] w-[1.2rem] absolute transition-all rotate-90 scale-0
          data-[state=dark]:rotate-0 data-[state=dark]:scale-100
          data-[state=system]:rotate-90 data-[state=system]:scale-0"
          data-state={theme}
        />
        <Laptop className="h-[1.2rem] w-[1.2rem] absolute transition-all rotate-90 scale-0
          data-[state=system]:rotate-0 data-[state=system]:scale-100"
          data-state={theme}
        />
      </div>
      <span className="sr-only">Toggle between light, dark, and system theme</span>
    </Button>
  )
}