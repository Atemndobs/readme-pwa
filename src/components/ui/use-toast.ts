import { useToast as useHookToast } from "@/components/ui/toast"

export interface Toast {
  title: string
  description?: string
  variant?: 'default' | 'destructive'
}

export function useToast() {
  const { toast } = useHookToast()
  
  return {
    toast: (props: Toast) => {
      toast({
        title: props.title,
        description: props.description,
        variant: props.variant || 'default'
      })
    }
  }
}
