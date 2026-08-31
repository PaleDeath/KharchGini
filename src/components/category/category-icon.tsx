'use client';

import {
  Anchor,
  Apple,
  Baby,
  Banknote,
  Bath,
  Bed,
  Beer,
  Bike,
  BookOpen,
  Briefcase,
  Building2,
  Bus,
  Cake,
  Camera,
  Car,
  Carrot,
  Cat,
  CircleDashed,
  CirclePlus,
  Clapperboard,
  Coffee,
  CreditCard,
  Croissant,
  Dog,
  Droplet,
  Dumbbell,
  Flame,
  Footprints,
  Fuel,
  Gamepad2,
  Gift,
  Globe,
  GraduationCap,
  Hammer,
  HandCoins,
  Headphones,
  Heart,
  HeartPulse,
  Home,
  IceCream,
  Key,
  Landmark,
  Laptop,
  Leaf,
  Lightbulb,
  MapPin,
  Music,
  Package,
  Palette,
  Percent,
  Phone,
  PiggyBank,
  Pill,
  Pizza,
  Plane,
  Receipt,
  Repeat,
  Rocket,
  Scissors,
  Shield,
  Shirt,
  ShoppingBag,
  ShoppingBasket,
  Smartphone,
  Sofa,
  Sparkles,
  Stethoscope,
  Target,
  Ticket,
  TrainFront,
  TrendingUp,
  Trophy,
  Tv,
  Umbrella,
  Undo2,
  Users,
  Utensils,
  Wallet,
  Wifi,
  Wine,
  Wrench,
  Zap,
  type LucideIcon,
} from 'lucide-react';

import { cn } from '@/lib/utils';

/**
 * The icon vocabulary.
 *
 * An explicit map rather than a dynamic lookup: every icon here is a real
 * import, so an unknown name is impossible at runtime and the bundler only ships
 * what is listed. Categories store the key, not the component, which keeps the
 * database free of anything React-shaped.
 */
export const ICONS: Record<string, LucideIcon> = {
  // Home and bills
  home: Home,
  zap: Zap,
  wifi: Wifi,
  droplet: Droplet,
  flame: Flame,
  lightbulb: Lightbulb,
  wrench: Wrench,
  hammer: Hammer,
  sofa: Sofa,
  bed: Bed,
  bath: Bath,
  key: Key,

  // Food
  'shopping-basket': ShoppingBasket,
  utensils: Utensils,
  bike: Bike,
  coffee: Coffee,
  pizza: Pizza,
  croissant: Croissant,
  'ice-cream': IceCream,
  cake: Cake,
  apple: Apple,
  carrot: Carrot,
  beer: Beer,
  wine: Wine,

  // Getting about
  bus: Bus,
  car: Car,
  'train-front': TrainFront,
  fuel: Fuel,
  plane: Plane,
  'map-pin': MapPin,
  globe: Globe,
  anchor: Anchor,

  // Body and mind
  'heart-pulse': HeartPulse,
  stethoscope: Stethoscope,
  pill: Pill,
  dumbbell: Dumbbell,
  scissors: Scissors,
  'graduation-cap': GraduationCap,
  'book-open': BookOpen,

  // Life
  'shopping-bag': ShoppingBag,
  shirt: Shirt,
  footprints: Footprints,
  clapperboard: Clapperboard,
  music: Music,
  headphones: Headphones,
  gamepad: Gamepad2,
  ticket: Ticket,
  camera: Camera,
  palette: Palette,
  tv: Tv,
  gift: Gift,
  users: Users,
  heart: Heart,
  baby: Baby,
  cat: Cat,
  dog: Dog,
  leaf: Leaf,
  umbrella: Umbrella,

  // Devices and services
  laptop: Laptop,
  smartphone: Smartphone,
  phone: Phone,
  repeat: Repeat,
  package: Package,

  // Money
  wallet: Wallet,
  banknote: Banknote,
  'credit-card': CreditCard,
  'piggy-bank': PiggyBank,
  'trending-up': TrendingUp,
  landmark: Landmark,
  percent: Percent,
  'hand-coins': HandCoins,
  receipt: Receipt,
  shield: Shield,
  briefcase: Briefcase,
  'building-2': Building2,
  'undo-2': Undo2,

  // Aspirations
  target: Target,
  trophy: Trophy,
  rocket: Rocket,
  sparkles: Sparkles,

  // Fallbacks
  'circle-dashed': CircleDashed,
  'plus-circle': CirclePlus,
};

/** Every key above, in insertion order. Drives the icon picker. */
export const ICON_NAMES: string[] = Object.keys(ICONS);

export function CategoryIcon({
  name,
  color,
  className,
}: {
  name?: string;
  /** The category's own colour. Falls back to inheriting the text colour. */
  color?: string;
  className?: string;
}) {
  const Icon = (name ? ICONS[name] : undefined) ?? CircleDashed;
  return (
    <Icon
      className={cn('h-4 w-4 stroke-[1.8]', className)}
      style={color ? { color } : undefined}
      aria-hidden
    />
  );
}

/**
 * The icon inside its own tinted squircle — crafted with a subtle gradient,
 * soft ambient glow, and hairline border for an Apple/Linear grade finish.
 */
export function CategoryChip({
  name,
  color,
  className,
}: {
  name?: string;
  color?: string;
  className?: string;
}) {
  const customColor = color || '#0d9488';
  return (
    <span
      className={cn(
        'relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl shadow-xs transition-all',
        className,
      )}
      style={{
        background: `linear-gradient(135deg, ${customColor}26 0%, ${customColor}0d 100%)`,
        border: `1px solid ${customColor}33`,
        boxShadow: `0 2px 6px -1px ${customColor}18`,
      }}
    >
      <CategoryIcon
        name={name}
        color={customColor}
        className="h-4 w-4 drop-shadow-[0_1px_1.5px_rgba(0,0,0,0.08)]"
      />
    </span>
  );
}
