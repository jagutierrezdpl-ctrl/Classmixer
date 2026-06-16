import {
  Heart,
  Briefcase,
  UsersRound,
  XCircle,
  Crown,
  HelpingHand,
  Smile,
  AlertTriangle,
  Eye,
  Shield,
  Users,
  ShieldAlert,
  HelpCircle,
  type LucideIcon,
} from "lucide-react"

// El catálogo (question_types.icon) guarda el nombre del icono como string para
// no acoplar la base de datos a lucide-react. Este registro traduce ese string
// al componente real. Si se añade un tipo de pregunta nuevo con un icono que no
// está aquí, cae al icono por defecto en vez de romper el render.
const QUESTION_ICONS: Record<string, LucideIcon> = {
  Heart,
  Briefcase,
  UsersRound,
  XCircle,
  Crown,
  HelpingHand,
  Smile,
  AlertTriangle,
  Eye,
  Shield,
  Users,
  ShieldAlert,
}

export function getQuestionIcon(name?: string | null): LucideIcon {
  return (name && QUESTION_ICONS[name]) || HelpCircle
}
