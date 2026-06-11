import { Bike, Coffee, Luggage, MoonStar, Sun, TreePine, type LucideIcon } from 'lucide-react'
import type { EventType } from '@/data/events'

export const EVENT_TYPE_ICON: Record<EventType, LucideIcon> = {
  lunch: Sun,
  dinner: MoonStar,
  snack: Coffee,
  ride: Bike,
  outing: TreePine,
  trip: Luggage,
}
