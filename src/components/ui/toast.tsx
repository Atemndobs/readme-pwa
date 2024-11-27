import * as React from "react"
import { Toaster as Sonner, toast } from "sonner"

interface ToasterProps {
  title: string
  description?: string
  variant?: "default" | "destructive"
}

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg",
          description: "group-[.toast]:text-muted-foreground",
          actionButton:
            "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton:
            "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }

export function useToast() {
  const showToast = (props: ToasterProps) => {
    const { title, description, variant = "default" } = props
    return toast(title, {
      description,
      className: variant === "destructive" ? "destructive" : undefined,
    })
  }

  return { toast: showToast }
}
