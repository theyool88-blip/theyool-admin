'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts'

interface MonthlyTrendData {
  month: string
  revenue: number
  expenses: number
  profit: number
}

interface CategoryData {
  name: string
  value: number
  percentage: number
  [key: string]: string | number
}

const COLORS = [
  '#3b82f6', // blue
  '#ef4444', // red
  '#10b981', // green
  '#f59e0b', // amber
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#14b8a6', // teal
  '#f97316', // orange
  '#6366f1', // indigo
]

export default function ExpenseCharts() {
  const [trendData, setTrendData] = useState<MonthlyTrendData[]>([])
  const [categoryData, setCategoryData] = useState<CategoryData[]>([])
  const [loading, setLoading] = useState(true)

  const fetchChartData = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/admin/expenses/charts')
      if (response.ok) {
        const data = await response.json()
        setTrendData(data.monthlyTrend || [])
        setCategoryData(data.categoryBreakdown || [])
      }
    } catch (error) {
      console.error('Failed to fetch chart data:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchChartData()
  }, [fetchChartData])

  if (loading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {[1, 2].map(i => (
          <div key={i} className="card p-6">
            <div className="animate-pulse">
              <div className="h-6 bg-[var(--bg-tertiary)] rounded w-1/3 mb-4"></div>
              <div className="h-64 bg-[var(--bg-primary)] rounded"></div>
            </div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* 월별 수익/지출 추이 */}
      <div className="card p-6">
        <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-4">월별 수익/지출 추이</h3>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={trendData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="month" />
            <YAxis tickFormatter={(value) => `${(value / 1000000).toFixed(0)}M`} />
            <Tooltip
              formatter={(value: number) => `${value.toLocaleString()}원`}
              labelStyle={{ color: '#000' }}
            />
            <Legend />
            <Line
              type="monotone"
              dataKey="revenue"
              stroke="#10b981"
              strokeWidth={2}
              name="매출"
              dot={{ r: 4 }}
            />
            <Line
              type="monotone"
              dataKey="expenses"
              stroke="#ef4444"
              strokeWidth={2}
              name="지출"
              dot={{ r: 4 }}
            />
            <Line
              type="monotone"
              dataKey="profit"
              stroke="#3b82f6"
              strokeWidth={2}
              name="순수익"
              dot={{ r: 4 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 카테고리별 지출 분포 (Pie Chart) */}
        <div className="card p-6">
          <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-4">카테고리별 지출 분포</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={categoryData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }: { name?: string; percent?: number }) => `${name || ''} ${((percent || 0) * 100).toFixed(1)}%`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {categoryData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(value: number) => `${value.toLocaleString()}원`} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* 카테고리별 지출 (Bar Chart) */}
        <div className="card p-6">
          <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-4">카테고리별 지출 금액</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={categoryData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" angle={-45} textAnchor="end" height={80} />
              <YAxis tickFormatter={(value) => `${(value / 1000000).toFixed(0)}M`} />
              <Tooltip
                formatter={(value: number) => `${value.toLocaleString()}원`}
                labelStyle={{ color: '#000' }}
              />
              <Bar dataKey="value" name="지출">
                {categoryData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 카테고리별 상세 테이블 */}
      <div className="card overflow-hidden">
        <div className="px-6 py-4 border-b border-[var(--border-default)]">
          <h3 className="text-lg font-semibold text-[var(--text-primary)]">카테고리별 상세</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-[var(--bg-primary)]">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-[var(--text-tertiary)] uppercase">카테고리</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-[var(--text-tertiary)] uppercase">금액</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-[var(--text-tertiary)] uppercase">비율</th>
              </tr>
            </thead>
            <tbody className="bg-[var(--bg-secondary)] divide-y divide-[var(--border-default)]">
              {categoryData.map((category, index) => (
                <tr key={category.name} className="hover:bg-[var(--bg-hover)]">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: COLORS[index % COLORS.length] }}
                      ></div>
                      <span className="text-sm font-medium text-[var(--text-primary)]">{category.name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium text-[var(--text-primary)]">
                    {category.value.toLocaleString()}원
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-[var(--text-tertiary)]">
                    {category.percentage.toFixed(1)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
