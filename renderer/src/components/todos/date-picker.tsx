"use client"

import { useState, useCallback } from "react"
import { motion, AnimatePresence } from "motion/react"
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameMonth,
  addMonths,
  subMonths,
  isToday,
  startOfWeek,
  endOfWeek,
} from "date-fns"
import { Calendar, ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useTodosStore } from "@/store/todos"
import { cn } from "@/lib/utils"

interface DatePickerProps {
  className?: string
}

export function DatePicker({ className }: DatePickerProps) {
  const { selectedDate, setSelectedDate, datesWithTodos } = useTodosStore()
  const [isOpen, setIsOpen] = useState(false)
  const [viewDate, setViewDate] = useState(new Date())

  const monthStart = startOfMonth(viewDate)
  const monthEnd = endOfMonth(viewDate)
  const calendarStart = startOfWeek(monthStart)
  const calendarEnd = endOfWeek(monthEnd)
  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd })

  const datesSet = new Set(datesWithTodos)

  const handleDateSelect = useCallback((date: Date) => {
    setSelectedDate(format(date, "yyyy-MM-dd"))
    setIsOpen(false)
  }, [setSelectedDate])

  const handlePrevMonth = useCallback(() => {
    setViewDate((prev) => subMonths(prev, 1))
  }, [])

  const handleNextMonth = useCallback(() => {
    setViewDate((prev) => addMonths(prev, 1))
  }, [])

  const handleTodayClick = useCallback(() => {
    const today = new Date()
    setViewDate(today)
    setSelectedDate(format(today, "yyyy-MM-dd"))
    setIsOpen(false)
  }, [setSelectedDate])

  return (
    <div className={cn("absolute top-2 right-6", className)}>
      <Button
        variant="ghost"
        size="sm"
        className="h-8 gap-1.5 text-[#666] hover:text-[#888] hover:bg-[#2a2a2a]"
        onClick={() => setIsOpen(!isOpen)}
      >
        <Calendar className="h-4 w-4" />
      </Button>

      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40"
              onClick={() => setIsOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, y: -10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              transition={{ duration: 0.15 }}
              className="absolute top-full right-0 mt-1 z-50 bg-[#252525] border border-[#333] rounded-lg shadow-xl p-3 w-[280px]"
            >
              <div className="flex items-center justify-between mb-3">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-[#888] hover:text-[#ccc] hover:bg-[#333]"
                  onClick={handlePrevMonth}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm font-medium text-[#e8e8e8]">
                  {format(viewDate, "MMMM yyyy")}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-[#888] hover:text-[#ccc] hover:bg-[#333]"
                  onClick={handleNextMonth}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>

              <div className="grid grid-cols-7 gap-1 mb-1">
                {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((day) => (
                  <div
                    key={day}
                    className="h-7 flex items-center justify-center text-[10px] font-medium text-[#666]"
                  >
                    {day}
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-7 gap-1">
                {days.map((day) => {
                  const dateStr = format(day, "yyyy-MM-dd")
                  const isCurrentMonth = isSameMonth(day, viewDate)
                  const isSelected = dateStr === selectedDate
                  const isTodayDate = isToday(day)
                  const hasTodos = datesSet.has(dateStr)

                  return (
                    <button
                      key={dateStr}
                      onClick={() => handleDateSelect(day)}
                      className={cn(
                        "h-8 w-8 rounded-md text-xs transition-colors relative",
                        "hover:bg-[#333]",
                        !isCurrentMonth && "text-[#444]",
                        isCurrentMonth && "text-[#888]",
                        isSelected && "bg-[#444] text-[#e8e8e8] hover:bg-[#444]",
                        isTodayDate && !isSelected && "border border-[#444]"
                      )}
                    >
                      {format(day, "d")}
                      {hasTodos && !isSelected && (
                        <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-[#666]" />
                      )}
                    </button>
                  )
                })}
              </div>

              <div className="mt-3 pt-2 border-t border-[#333]">
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full h-7 text-xs text-[#888] hover:text-[#ccc] hover:bg-[#333]"
                  onClick={handleTodayClick}
                >
                  Go to Today
                </Button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}
