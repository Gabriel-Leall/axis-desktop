import { TitleBar } from '@/components/titlebar/TitleBar'
import { Button } from '@/components/ui/button'

export function LoginPage() {
  return (
    <div className="flex h-screen w-full flex-col overflow-hidden bg-background">
      <TitleBar className="bg-transparent border-b-0 absolute top-0 w-full z-50" />
      <div className="flex flex-1 flex-row overflow-hidden relative">
        <div className="flex-1 flex flex-col items-center justify-center p-6 relative">
          <div className="max-w-lg w-full">
            <div className="font-mono text-[11px] text-muted-foreground uppercase tracking-[0.3em]">
              Conecte sua conta
            </div>
            <h1 className="mt-2 font-heading text-3xl leading-tight">
              Continue no Axis
            </h1>
            <p className="mt-2 text-muted-foreground text-sm">
              Sincronize seu progresso com segurança.
            </p>
            <div className="mt-8 flex flex-col gap-2">
              <Button size="lg">Conectar com GitHub</Button>
              <Button size="lg" variant="outline">
                Continuar com Google
              </Button>
            </div>
          </div>
        </div>
        <div className="hidden lg:flex w-1/2 bg-muted relative items-center justify-center overflow-hidden border-l border-border/50" />
      </div>
    </div>
  )
}
