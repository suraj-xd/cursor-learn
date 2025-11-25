"use client"

import { useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import type { ComponentType } from 'react'
import { Button } from './ui/button'

interface CollapsibleCodeBlockProps {
  code: string
  language: string
  style: any
}

export function CollapsibleCodeBlock({ code, language, style }: CollapsibleCodeBlockProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const Highlighter = SyntaxHighlighter as unknown as ComponentType<any>
  
  const lineCount = code.split('\n').length
  const shouldCollapse = lineCount > 20

  return (
    <div className="relative min-w-0 max-w-full">
      <div 
        className="overflow-x-auto overflow-y-hidden transition-all duration-300"
        style={{
          maxHeight: !shouldCollapse || isExpanded ? 'none' : '400px',
        }}
      >
        <Highlighter
          style={style}
          language={language}
          PreTag="div"
          customStyle={{
            margin: 0,
            borderRadius: '0.5rem',
          }}
          wrapLongLines={false}
        >
          {code}
        </Highlighter>
      </div>
      
      {shouldCollapse && (
        <div className="sticky bottom-0 left-0 right-0">
          <div 
            className={`absolute bottom-0 left-0 right-0 h-24 pointer-events-none transition-opacity ${
              isExpanded ? 'opacity-0' : 'opacity-100'
            }`}
          />
          <div className="flex justify-center pt-2 pb-2 bg-transparent">
            <Button
              variant="default"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
              className="gap-1 text-xs"
            >
              {isExpanded ? (
                <>
                  <ChevronUp className="w-3 h-3" />
                  Collapse
                </>
              ) : (
                <>
                  <ChevronDown className="w-3 h-3" />
                  Show more ({lineCount} lines)
                </>
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

