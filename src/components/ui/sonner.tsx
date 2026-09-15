import { useTheme } from "next-themes"
import { Toaster as Sonner, toast } from "sonner"

type ToasterProps = React.ComponentProps<typeof Sonner>

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      position="bottom-center"
      expand={false}
      richColors
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-card/98 group-[.toaster]:text-card-foreground dark:group-[.toaster]:text-white group-[.toaster]:border-2 group-[.toaster]:border-primary/30 group-[.toaster]:shadow-[0_8px_32px_rgba(0,0,0,0.12)] group-[.toaster]:backdrop-blur-xl group-[.toaster]:rounded-2xl group-[.toaster]:font-sans group-[.toaster]:font-medium group-[.toaster]:animate-[slide-in-from-bottom_0.4s_ease-out]",
          description: "group-[.toast]:text-card-foreground dark:group-[.toast]:text-gray-200 group-[.toast]:font-medium group-[.toast]:opacity-85",
          actionButton:
            "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground group-[.toast]:font-semibold group-[.toast]:rounded-xl group-[.toast]:px-4",
          cancelButton:
            "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground group-[.toast]:font-semibold group-[.toast]:rounded-xl",
          title: "group-[.toast]:font-bold group-[.toast]:text-base group-[.toast]:tracking-tight group-[.toast]:text-card-foreground dark:group-[.toast]:text-white",
          success: "group-[.toaster]:border-green-500/30 group-[.toaster]:shadow-[0_0_24px_rgba(34,197,94,0.15)]",
          error: "group-[.toaster]:border-destructive/40 group-[.toaster]:shadow-[0_0_24px_rgba(239,68,68,0.25)] dark:group-[.toaster]:text-white",
          warning: "group-[.toaster]:border-yellow-500/30 group-[.toaster]:shadow-[0_0_24px_rgba(234,179,8,0.15)]",
          info: "group-[.toaster]:border-blue-500/30 group-[.toaster]:shadow-[0_0_24px_rgba(59,130,246,0.15)]",
        },
      }}
      {...props}
    />
  )
}

export { Toaster, toast }
