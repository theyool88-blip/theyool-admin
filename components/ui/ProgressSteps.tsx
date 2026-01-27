'use client'

import { ReactNode } from 'react'
import { Check } from 'lucide-react'

export interface Step {
  id: string | number
  label: string
  description?: string
}

interface ProgressStepsProps {
  steps: Step[]
  currentStep: number // 0-indexed
  orientation?: 'horizontal' | 'vertical'
  size?: 'sm' | 'md'
  onStepClick?: (stepIndex: number) => void
  className?: string
}

export default function ProgressSteps({
  steps,
  currentStep,
  orientation = 'horizontal',
  size = 'md',
  onStepClick,
  className = '',
}: ProgressStepsProps) {
  const getStepStatus = (index: number) => {
    if (index < currentStep) return 'completed'
    if (index === currentStep) return 'active'
    return 'pending'
  }

  if (orientation === 'vertical') {
    return (
      <div className={`flex flex-col gap-0 ${className}`}>
        {steps.map((step, index) => {
          const status = getStepStatus(index)
          const isLast = index === steps.length - 1

          return (
            <div key={step.id} className="flex gap-3">
              <div className="flex flex-col items-center">
                <button
                  type="button"
                  onClick={() => onStepClick?.(index)}
                  disabled={!onStepClick || status === 'pending'}
                  className={`progress-step ${status}`}
                >
                  <span className="progress-step-indicator">
                    {status === 'completed' ? (
                      <Check className="w-4 h-4" />
                    ) : (
                      index + 1
                    )}
                  </span>
                </button>
                {!isLast && (
                  <div
                    className={`w-0.5 h-8 ${
                      status === 'completed'
                        ? 'bg-[var(--color-success)]'
                        : 'bg-[var(--border-default)]'
                    }`}
                  />
                )}
              </div>
              <div className="pb-8">
                <span className={`progress-step ${status}`}>
                  <span className="progress-step-label font-medium">
                    {step.label}
                  </span>
                </span>
                {step.description && (
                  <p className="text-caption mt-1">{step.description}</p>
                )}
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  // Horizontal layout
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {steps.map((step, index) => {
        const status = getStepStatus(index)
        const isLast = index === steps.length - 1

        return (
          <div key={step.id} className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onStepClick?.(index)}
              disabled={!onStepClick || status === 'pending'}
              className={`progress-step ${status}`}
            >
              <span
                className={`progress-step-indicator ${
                  size === 'sm' ? 'w-6 h-6 text-[10px]' : ''
                }`}
              >
                {status === 'completed' ? (
                  <Check className={size === 'sm' ? 'w-3 h-3' : 'w-4 h-4'} />
                ) : (
                  index + 1
                )}
              </span>
              <span className={`progress-step-label ${size === 'sm' ? 'text-[10px]' : ''}`}>
                {step.label}
              </span>
            </button>
            {!isLast && (
              <div
                className={`progress-step-connector flex-1 min-w-4 ${
                  status === 'completed' ? 'completed' : ''
                }`}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}

// Simple progress indicator (dots)
interface ProgressDotsProps {
  total: number
  current: number
  className?: string
}

export function ProgressDots({ total, current, className = '' }: ProgressDotsProps) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {Array.from({ length: total }).map((_, index) => (
        <div
          key={index}
          className={`w-2 h-2 rounded-full transition-all ${
            index <= current
              ? 'bg-[var(--sage-primary)]'
              : 'bg-[var(--border-default)]'
          } ${index === current ? 'w-4' : ''}`}
        />
      ))}
    </div>
  )
}

// Step content container
interface StepContentProps {
  children: ReactNode
  className?: string
}

export function StepContent({ children, className = '' }: StepContentProps) {
  return <div className={`mt-6 animate-fadeIn ${className}`}>{children}</div>
}

// Step navigation buttons
interface StepNavigationProps {
  currentStep: number
  totalSteps: number
  onPrevious: () => void
  onNext: () => void
  onSubmit?: () => void
  isSubmitting?: boolean
  previousLabel?: string
  nextLabel?: string
  submitLabel?: string
  className?: string
}

export function StepNavigation({
  currentStep,
  totalSteps,
  onPrevious,
  onNext,
  onSubmit,
  isSubmitting = false,
  previousLabel = '이전',
  nextLabel = '다음',
  submitLabel = '완료',
  className = '',
}: StepNavigationProps) {
  const isFirstStep = currentStep === 0
  const isLastStep = currentStep === totalSteps - 1

  return (
    <div className={`flex items-center justify-between pt-6 border-t border-[var(--border-default)] ${className}`}>
      <button
        type="button"
        onClick={onPrevious}
        disabled={isFirstStep}
        className="btn btn-secondary"
      >
        {previousLabel}
      </button>

      {isLastStep && onSubmit ? (
        <button
          type="button"
          onClick={onSubmit}
          disabled={isSubmitting}
          className="btn btn-primary"
        >
          {isSubmitting ? '처리 중...' : submitLabel}
        </button>
      ) : (
        <button
          type="button"
          onClick={onNext}
          className="btn btn-primary"
        >
          {nextLabel}
        </button>
      )}
    </div>
  )
}
