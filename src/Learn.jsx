import React from "react";
import { ArrowRight, BookOpen, BookText, CheckCircle2, Layers, MessageSquareText, PenLine, Route, Sparkles } from "lucide-react";
import StudioCard from "./StudioCard";
import StudioProgress from "./StudioProgress";

const sections = [
  { title: "Build your grammar", description: "Learn a rule, try an exercise, and pick up where you left off.", items: [["Grammar", "Grammar lessons", "Work through the B1 topics", BookOpen], ["GrammarGaps", "Grammar gaps", "Complete a round of ten", Layers], ["Articles", "Article practice", "Practise der, die and das", CheckCircle2], ["Lessons", "Saved grammar", "Review lessons from conversations", BookText]] },
  { title: "Read and express yourself", description: "Use German in stories, sentences and everyday situations.", items: [["Stories", "Stories", "Read and explore new vocabulary", BookText], ["Writing", "Writing practice", "Put your ideas into words", PenLine], ["Phrases", "Sentence Lab", "Explore useful expressions", MessageSquareText], ["Think", "Think in German", "Practise expressing a thought", Sparkles]] },
  { title: "Keep exploring", description: "Find more ways to build your vocabulary and follow your plan.", items: [["Mission", "B1 learning plan", "See the full learning path", Route], ["VocabTop1000", "Top 1000", "Explore frequent German words", Layers], ["Adventure", "Vocabulary adventure", "Learn through missions", Sparkles], ["Chat", "Chat with Lena", "Open your tutor conversation", MessageSquareText]] },
];

export default function Learn({ onNavigate, grammarProgress }) {
  const completed = (grammarProgress.completedTopics || []).length;
  return <div className="learn-page">
    <header className="learn-heading"><p className="studio-eyebrow">YOUR LEARNING LIBRARY</p><h2>Learn at your own pace.</h2><p>Choose what you want to work on today. Your progress stays with you.</p></header>
    <StudioCard as="section" className="learn-continue"><div><p className="studio-eyebrow">PICK UP WHERE YOU LEFT OFF</p><h3>Continue your B1 grammar</h3><p>Learn a topic and put it into practice.</p><button type="button" onClick={() => onNavigate("Grammar")}>Continue grammar <ArrowRight size={16}/></button></div><div className="learn-continue-progress"><StudioProgress value={Math.min(completed, 10)} max={10} label="Grammar topics completed" /></div></StudioCard>
    {sections.map(section => <section key={section.title} className="learn-section"><div className="learn-section-heading"><h3>{section.title}</h3><p>{section.description}</p></div><div className="learn-grid">{section.items.map(([key, title, description, Icon]) => <StudioCard as="article" className="learn-card" key={key}><button type="button" onClick={() => onNavigate(key)}><span className="learn-icon"><Icon size={19}/></span><span className="learn-card-copy"><strong>{title}</strong><small>{description}</small></span><ArrowRight className="learn-arrow" size={17}/></button></StudioCard>)}</div></section>)}
  </div>;
}
