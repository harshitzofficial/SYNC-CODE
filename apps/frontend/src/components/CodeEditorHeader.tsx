"use client"

import { Code2, Play, Loader2, PenTool, Layout, Circle, Share2, Check, Users } from "lucide-react"
import { LanguageDropdown } from "./LanguageDropDown"
import { Button } from "./ui/button"

interface CodeEditorHeaderProps {
  language: string
  onLanguageChange: (language: string) => void
  onSubmit: () => void
  isLoading: boolean
  currentButtonState: string
  activeView: 'editor' | 'whiteboard'
  onViewChange: (view: 'editor' | 'whiteboard') => void
  onInvite: () => void
  inviteCopied: boolean
  connectedUsersCount: number
}

export const CodeEditorHeader = ({
  language,
  onLanguageChange,
  onSubmit,
  isLoading,
  currentButtonState,
  activeView,
  onViewChange,
  onInvite,
  inviteCopied,
  connectedUsersCount,
}: CodeEditorHeaderProps) => {
  return (
    <div
      className="flex flex-col items-start justify-between gap-4 rounded-2xl border border-white/[.1] bg-[#111a2b]/85 p-4 shadow-2xl shadow-black/20 backdrop-blur-xl sm:flex-row sm:items-center sm:px-5"
      style={{ position: "relative", zIndex: 10 }}
    >
      <div className="flex items-center justify-center gap-3">
        <div className="rounded-xl bg-gradient-to-br from-cyan-400 to-blue-600 p-2.5 shadow-lg shadow-cyan-950/30">
          <Code2 className="h-5 w-5 text-slate-950" />
        </div>
        <div><div className="text-lg font-extrabold tracking-tight text-white">CodeSync</div><div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-emerald-300"><Circle size={7} fill="currentColor" /> Live workspace</div></div>
      </div>

      <div className="mx-auto flex shrink-0 rounded-xl border border-white/[.07] bg-[#080e1b]/70 p-1 sm:mx-4">
        <button
          onClick={() => onViewChange('editor')}
          className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-bold transition-all duration-200 ${activeView === 'editor' ? 'bg-cyan-400 text-slate-950 shadow-lg shadow-cyan-950/40' : 'text-slate-500 hover:bg-white/[.07] hover:text-white'}`}
        >
          <Layout size={16} />
          Editor
        </button>
        <button
          onClick={() => onViewChange('whiteboard')}
          className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-bold transition-all duration-200 ${activeView === 'whiteboard' ? 'bg-cyan-400 text-slate-950 shadow-lg shadow-cyan-950/40' : 'text-slate-500 hover:bg-white/[.07] hover:text-white'}`}
        >
          <PenTool size={16} />
          Whiteboard
        </button>
      </div>

      <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row items-center">
        <div className="flex items-center gap-2 rounded-xl border border-white/[.12] bg-[#080e1b]/70 px-3 py-2 text-sm font-bold text-slate-300 mr-2 shadow-inner">
          <Users size={16} className="text-cyan-400" />
          <span>{connectedUsersCount}</span>
        </div>

        {activeView === 'editor' && (
          <LanguageDropdown value={language} onChange={onLanguageChange} />
        )}

        <Button
          onClick={onInvite}
          type="button"
          variant="outline"
          className="h-10 rounded-xl border-white/[.12] bg-white/[.04] px-4 font-bold text-slate-200 transition hover:border-cyan-300/30 hover:bg-cyan-300/[.08] hover:text-cyan-100"
        >
          {inviteCopied ? <Check className="h-4 w-4 text-emerald-300" /> : <Share2 className="h-4 w-4" />}
          {inviteCopied ? "Link copied" : "Invite"}
        </Button>

        <Button
          onClick={onSubmit}
          disabled={isLoading}
          type="button"
          className={`
            h-10 rounded-xl px-5 font-extrabold transition-all duration-300 transform
            ${isLoading
              ? "bg-slate-700 cursor-not-allowed opacity-50"
              : "bg-gradient-to-r from-cyan-400 to-blue-500 text-slate-950 hover:from-cyan-300 hover:to-blue-400 hover:-translate-y-0.5 shadow-lg shadow-cyan-950/30"
            }
            flex items-center gap-2
          `}
        >
          {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
          <span>{currentButtonState}</span>
        </Button>
      </div>
    </div>
  )
}
