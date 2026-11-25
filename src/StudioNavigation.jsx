import React, { useState } from "react";
import { BookOpen, BookMarked, ClipboardCheck, Home, Menu, MessageCircle, Settings, X } from "lucide-react";

// Adapted from 21st.dev's Aceternity Sidebar for this app's tab navigation.
const groups = [
  { title: "Your learning", items: [
    ["Home", "Today", Home], ["Words", "Words", BookMarked], ["Review", "Review", ClipboardCheck], ["Practice", "Practice", MessageCircle],
  ] },
  { title: "Explore", items: [
    ["Mission", "B1 learning plan"], ["Grammar", "Grammar"], ["GrammarGaps", "Grammar gaps"], ["Articles", "Article practice"], ["Lessons", "Grammar lessons"], ["Stories", "Stories"], ["VocabTop1000", "Top 1000"], ["Adventure", "Adventure"],
  ] },
  { title: "More practice", items: [["Chat", "Chat with Lena"], ["Writing", "Writing"], ["Phrases", "Sentence Lab"], ["Think", "Think in German"]] },
  { title: "Your account", items: [["Dashboard", "Progress & settings", Settings]] },
];

function NavigationLinks({ activeTab, onNavigate }) {
  return <nav aria-label="Learning navigation" className="studio-nav-groups">{groups.map(group => <div key={group.title} className="studio-nav-group">
    <p className="studio-nav-label">{group.title}</p>
    {group.items.map(([key, label, Icon = BookOpen]) => <button type="button" key={key} onClick={() => onNavigate(key)} aria-current={activeTab === key || (key === "Words" && activeTab === "Vocab") ? "page" : undefined} className="studio-nav-link"><Icon size={17} aria-hidden="true" /><span>{label}</span></button>)}
  </div>)}</nav>;
}

export default function StudioNavigation({ activeTab, onNavigate, onSignOut }) {
  const [open, setOpen] = useState(false);
  const navigate = (tab) => { onNavigate(tab); setOpen(false); };
  return <>
    <aside className="studio-sidebar"><button type="button" className="studio-brand" onClick={() => navigate("Home")}><span className="studio-brand-mark">D<span>.</span></span><span><strong>Deutsch Meister</strong><small>YOUR LEARNING STUDIO</small></span></button><NavigationLinks activeTab={activeTab} onNavigate={navigate}/><div className="studio-sidebar-footer">{onSignOut && <button type="button" onClick={onSignOut} className="studio-nav-link">Sign out</button>}<span>Dein Deutsch, jeden Tag.</span><small>A little practice goes a long way.</small></div></aside>
    <header className="studio-mobile-header"><button type="button" className="studio-brand" onClick={() => navigate("Home")}><span className="studio-brand-mark">D<span>.</span></span><span><strong>Deutsch Meister</strong><small>YOUR LEARNING STUDIO</small></span></button><button type="button" className="studio-menu-button" aria-expanded={open} aria-controls="mobile-navigation" aria-label={open ? "Close navigation" : "Open navigation"} onClick={() => setOpen(!open)}>{open ? <X size={21}/> : <Menu size={21}/>}</button></header>
    {open && <div id="mobile-navigation" className="studio-mobile-menu"><NavigationLinks activeTab={activeTab} onNavigate={navigate}/>{onSignOut && <button type="button" onClick={onSignOut} className="studio-nav-link">Sign out</button>}</div>}
  </>;
}
