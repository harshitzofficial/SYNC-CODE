import { ChevronDown } from "lucide-react"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
  } from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"


interface LanguageDropdownProps {
  value: string
  onChange: (language: string) => void
}

const languages = [
  {
    value: "javascript",
    label: "JavaScript",
  },
  {
    value: "python",
    label: "Python",
  },
  {
    value: "cpp",
    label: "C++",
  },
  {
    value: "java",
    label: "Java",
  },
  {
    value: "rust",
    label: "Rust",
  },
  {
    value: "go",
    label: "Go",
  },
]

export const LanguageDropdown = ({ value, onChange }: LanguageDropdownProps) => {
  const selectedLanguage = languages.find((lang) => lang.value === value)

  return (
    <div className="relative">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            className="bg-gray-800/90 border-gray-600 text-white hover:bg-gray-700/90 hover:text-white backdrop-blur-sm transition-all duration-200 min-w-[140px] justify-between focus:ring-2 focus:ring-blue-500 focus:ring-offset-0 data-[state=open]:bg-gray-700/90"
            type="button"
          >
            <div className="flex items-center gap-2">
              <span className="text-white">{selectedLanguage?.label || "Select Language"}</span>
            </div>
            <ChevronDown className="h-4 w-4 opacity-70 text-white transition-transform data-[state=open]:rotate-180" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          className="bg-gray-800/95 border-gray-600 text-white min-w-[140px] backdrop-blur-sm"
          align="end"
          sideOffset={4}
          style={{ zIndex: 9999 }}
          avoidCollisions={true}
          collisionPadding={8}
        >
          {languages.map((language) => (
            <DropdownMenuItem
              key={language.value}
              onClick={() => onChange(language.value)}
              className="text-white hover:bg-gray-700/80 hover:text-gray-100 focus:bg-gray-700/80 focus:text-gray-100 cursor-pointer transition-colors"
            >
              <div className="flex items-center gap-3">
                <span>{language.label}</span>
              </div>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}



