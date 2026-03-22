import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_app/app/settings/')({
  component: RouteComponent,
})

function RouteComponent() {
  return <div>Hello "/app/settings/"!</div>
}
