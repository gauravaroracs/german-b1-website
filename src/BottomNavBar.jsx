import { motion } from "framer-motion";
import { BookMarked, BookOpen, Home, MessageCircle } from "lucide-react";

const items = [
  { key: "Home", label: "Today", icon: Home },
  { key: "Words", label: "Words", icon: BookMarked },
  { key: "Grammar", label: "Grammar", icon: BookOpen },
  { key: "Practice", label: "Talk", icon: MessageCircle },
];

export default function BottomNavBar({ activeTab, onNavigate }) {
  return (
    <motion.nav
      initial={{ y: 18, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ type: "spring", stiffness: 300, damping: 28 }}
      aria-label="Main navigation"
      className="fixed inset-x-0 bottom-0 z-30 flex justify-center px-3 pb-[max(.55rem,env(safe-area-inset-bottom))] sm:hidden"
    >
      <div className="flex h-14 w-full max-w-md items-center justify-around rounded-full border border-[#E5E7EB] bg-white/95 p-1.5 shadow-[0_8px_30px_rgba(30,35,55,.12)] backdrop-blur">
        {items.map(({ key, label, icon: Icon }) => {
          const active = activeTab === key || (key === "Words" && activeTab === "Vocab");
          return (
            <motion.button
              key={key}
              type="button"
              whileTap={{ scale: 0.96 }}
              onClick={() => onNavigate(key)}
              aria-current={active ? "page" : undefined}
              aria-label={label}
              className={`flex h-11 min-w-11 items-center justify-center gap-2 rounded-full px-3 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#176c5f] ${active ? "bg-[#eaf5ed] text-[#176c5f]" : "text-[#777983] hover:bg-[#f3f7f3] hover:text-[#252832]"}`}
            >
              <Icon size={19} aria-hidden="true" />
              <motion.span
                initial={false}
                animate={{ width: active ? "auto" : 0, opacity: active ? 1 : 0 }}
                transition={{ type: "spring", stiffness: 350, damping: 32 }}
                className="overflow-hidden whitespace-nowrap"
              >
                {label}
              </motion.span>
            </motion.button>
          );
        })}
      </div>
    </motion.nav>
  );
}
