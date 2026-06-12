import { colorOf } from './identityColor'

export function Avatar({ name, id, size = 28 }: { name: string; id: string; size?: number }) {
  return (
    <span
      aria-hidden
      className="flex shrink-0 items-center justify-center rounded-full font-bold text-white"
      style={{ width: size, height: size, backgroundColor: colorOf(id), fontSize: size * 0.46 }}
    >
      {name.slice(0, 1)}
    </span>
  )
}
