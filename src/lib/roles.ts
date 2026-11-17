import {
  LayoutDashboard, ClipboardList, Users, Stethoscope, Pill,
  Wallet, CalendarClock, BarChart3, Settings, Baby, HeartPulse, type LucideIcon,
} from "lucide-react";

export type Role = "dokter" | "asisten";

export type MenuItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  roles: Role[];
};

// Hak akses menu sesuai spesifikasi §6. (Penegakan sebenarnya ada di RLS database.)
export const MENU: MenuItem[] = [
  { href: "/dashboard", label: "Beranda", icon: LayoutDashboard, roles: ["dokter", "asisten"] },
  { href: "/hari-ini", label: "Pasien Hari Ini", icon: ClipboardList, roles: ["dokter", "asisten"] },
  { href: "/pasien", label: "Data Pasien", icon: Users, roles: ["dokter", "asisten"] },
  { href: "/rekam-medis", label: "Rekam Medis", icon: Stethoscope, roles: ["dokter"] },
  { href: "/anak", label: "Klinik Anak", icon: Baby, roles: ["dokter"] },
  { href: "/lansia", label: "Klinik Lansia", icon: HeartPulse, roles: ["dokter"] },
  { href: "/obat", label: "Obat & Resep", icon: Pill, roles: ["dokter", "asisten"] },
  { href: "/kasir", label: "Kasir", icon: Wallet, roles: ["dokter", "asisten"] },
  { href: "/kontrol", label: "Jadwal Kontrol", icon: CalendarClock, roles: ["dokter", "asisten"] },
  { href: "/laporan", label: "Laporan", icon: BarChart3, roles: ["dokter"] },
  { href: "/pengaturan", label: "Pengaturan", icon: Settings, roles: ["dokter"] },
];

export const NAMA_ROLE: Record<Role, string> = { dokter: "Dokter", asisten: "Asisten" };
