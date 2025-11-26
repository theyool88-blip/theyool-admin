'use client'

import { useEffect, useState } from 'react'
import AdminHeader from '@/components/AdminHeader'

interface ChannelStats {
  channel: string
  total: number
  retained: number
  conversionRate: number
  avgLeadScore: number
  highQuality: number
}

interface ConsultationStats {
  total: number
  byStatus: {
    pending: number
    contacted: number
    confirmed: number
    retained: number
    cancelled: number
  }
  byLeadScore: {
    high: number
    medium: number
    low: number
  }
  conversionRate: {
    overall: number
    highQuality: number
    mediumQuality: number
  }
  monthlyTrend: Array<{
    month: string
    total: number
    retained: number
  }>
  averageResponseTime: string
  byChannel: ChannelStats[]
  heatmapData: Array<Array<{
    day: number
    hour: number
    count: number
    conversionRate: number
  }>>
}

function getHeatmapIntensity(count: number) {
  if (count === 0) return { bg: 'bg-gray-100', text: 'text-gray-400' }
  if (count <= 3) return { bg: 'bg-sage-100', text: 'text-sage-700' }
  if (count <= 6) return { bg: 'bg-sage-200', text: 'text-sage-800' }
  if (count <= 10) return { bg: 'bg-sage-400', text: 'text-white' }
  return { bg: 'bg-sage-600', text: 'text-white' }
}

export default function ConsultationStatsPage() {
  const [stats, setStats] = useState<ConsultationStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [channelStats, setChannelStats] = useState<ChannelStats[]>([])

  useEffect(() => {
    fetchStats()
  }, [])

  async function fetchStats() {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/consultations/stats')
      const json = await res.json()
      if (json.success) {
        setStats(json.data)
        setChannelStats(json.data.byChannel || [])
      }
    } catch (error) {
      console.error('Failed to fetch consultation stats:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <AdminHeader title="상담 통계" />
        <div className="flex items-center justify-center pt-32">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-gray-300 border-t-gray-600"></div>
        </div>
      </div>
    )
  }

  if (!stats) {
    return (
      <div className="min-h-screen bg-gray-50">
        <AdminHeader title="상담 통계" />
        <div className="max-w-5xl mx-auto pt-20 pb-8 px-4">
          <div className="text-center py-12 text-gray-500 text-sm">통계 데이터를 불러올 수 없습니다.</div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminHeader title="상담 통계" />

      <div className="max-w-5xl mx-auto pt-20 pb-8 px-4">
        {/* Summary */}
        <div className="flex flex-wrap items-center gap-4 mb-5 text-sm">
          <div>
            <span className="text-gray-500">총 상담</span>
            <span className="ml-2 text-lg font-bold text-gray-900">{stats.total}건</span>
          </div>
          <div className="text-gray-300">|</div>
          <div>
            <span className="text-gray-500">전환율</span>
            <span className="ml-2 text-lg font-bold text-green-600">{stats.conversionRate.overall.toFixed(1)}%</span>
          </div>
          <div className="text-gray-300">|</div>
          <div>
            <span className="text-gray-500">고품질 리드</span>
            <span className="ml-2 font-semibold text-sage-600">{stats.byLeadScore.high}건</span>
          </div>
          <div className="text-gray-300">|</div>
          <div className="text-gray-500">
            평균 응답 <span className="font-medium text-gray-700">{stats.averageResponseTime}</span>
          </div>
        </div>

        {/* Status Overview */}
        <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4">
          <h2 className="text-sm font-semibold text-gray-900 mb-3">상담 현황</h2>
          <div className="grid grid-cols-5 gap-3">
            <div className="text-center">
              <div className="text-xs text-gray-500 mb-1">대기중</div>
              <div className="text-lg font-bold text-orange-600">{stats.byStatus.pending}</div>
            </div>
            <div className="text-center">
              <div className="text-xs text-gray-500 mb-1">연락완료</div>
              <div className="text-lg font-bold text-sage-600">{stats.byStatus.contacted}</div>
            </div>
            <div className="text-center">
              <div className="text-xs text-gray-500 mb-1">확정</div>
              <div className="text-lg font-bold text-purple-600">{stats.byStatus.confirmed}</div>
            </div>
            <div className="text-center">
              <div className="text-xs text-gray-500 mb-1">수임</div>
              <div className="text-lg font-bold text-green-600">{stats.byStatus.retained}</div>
            </div>
            <div className="text-center">
              <div className="text-xs text-gray-500 mb-1">취소</div>
              <div className="text-lg font-bold text-red-500">{stats.byStatus.cancelled}</div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
          {/* Conversion Funnel */}
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <h2 className="text-sm font-semibold text-gray-900 mb-3">전환 퍼널</h2>
            <div className="space-y-3">
              {[
                { label: '대기중', value: stats.byStatus.pending, color: 'bg-orange-500' },
                { label: '연락완료', value: stats.byStatus.contacted, color: 'bg-sage-500' },
                { label: '확정', value: stats.byStatus.confirmed, color: 'bg-purple-500' },
                { label: '수임', value: stats.byStatus.retained, color: 'bg-green-500' },
              ].map((item) => (
                <div key={item.label}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-gray-600">{item.label}</span>
                    <span className="text-xs font-medium text-gray-900">{item.value}건</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2">
                    <div
                      className={`${item.color} h-2 rounded-full`}
                      style={{ width: `${(item.value / stats.total) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
              <div className="pt-2 border-t border-gray-100">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-gray-600">취소</span>
                  <span className="text-xs font-medium text-red-600">{stats.byStatus.cancelled}건</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2">
                  <div
                    className="bg-red-400 h-2 rounded-full"
                    style={{ width: `${(stats.byStatus.cancelled / stats.total) * 100}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Lead Quality */}
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <h2 className="text-sm font-semibold text-gray-900 mb-3">리드 품질 분포</h2>
            <div className="space-y-3">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <div>
                    <span className="text-xs text-gray-600">고품질 (80+)</span>
                    <span className="ml-2 text-xs text-gray-400">전환율 {stats.conversionRate.highQuality.toFixed(1)}%</span>
                  </div>
                  <span className="text-sm font-semibold text-sage-600">{stats.byLeadScore.high}건</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-3">
                  <div
                    className="bg-sage-500 h-3 rounded-full"
                    style={{ width: `${(stats.byLeadScore.high / stats.total) * 100}%` }}
                  />
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <div>
                    <span className="text-xs text-gray-600">중품질 (50-79)</span>
                    <span className="ml-2 text-xs text-gray-400">전환율 {stats.conversionRate.mediumQuality.toFixed(1)}%</span>
                  </div>
                  <span className="text-sm font-semibold text-amber-600">{stats.byLeadScore.medium}건</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-3">
                  <div
                    className="bg-amber-400 h-3 rounded-full"
                    style={{ width: `${(stats.byLeadScore.medium / stats.total) * 100}%` }}
                  />
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-gray-600">저품질 (50 미만)</span>
                  <span className="text-sm font-semibold text-gray-500">{stats.byLeadScore.low}건</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-3">
                  <div
                    className="bg-gray-300 h-3 rounded-full"
                    style={{ width: `${(stats.byLeadScore.low / stats.total) * 100}%` }}
                  />
                </div>
              </div>
            </div>
            <div className="mt-3 pt-3 border-t border-gray-100">
              <p className="text-xs text-gray-500">
                고품질 리드는 중품질 대비 <span className="font-medium text-sage-600">{(stats.conversionRate.highQuality / Math.max(stats.conversionRate.mediumQuality, 1)).toFixed(1)}배</span> 높은 전환율
              </p>
            </div>
          </div>
        </div>

        {/* Time Heatmap */}
        <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4">
          <h2 className="text-sm font-semibold text-gray-900 mb-1">시간대별 상담 패턴</h2>
          <p className="text-xs text-gray-500 mb-3">요일 x 시간대 상담 분포</p>

          <div className="overflow-x-auto">
            <div className="min-w-[600px]">
              {/* Hours Header */}
              <div className="flex gap-0.5 mb-1 pl-8">
                {Array.from({ length: 24 }, (_, i) => (
                  <div key={i} className="w-5 text-center text-[10px] text-gray-400">
                    {i}
                  </div>
                ))}
              </div>

              {/* Heatmap Grid */}
              <div className="space-y-0.5">
                {[
                  { day: '월', dayIndex: 1 },
                  { day: '화', dayIndex: 2 },
                  { day: '수', dayIndex: 3 },
                  { day: '목', dayIndex: 4 },
                  { day: '금', dayIndex: 5 },
                  { day: '토', dayIndex: 6 },
                  { day: '일', dayIndex: 0 }
                ].map((row) => (
                  <div key={row.dayIndex} className="flex gap-0.5 items-center">
                    <div className="w-7 text-xs text-gray-500 text-right pr-1">{row.day}</div>
                    {Array.from({ length: 24 }, (_, hour) => {
                      const cellData = stats.heatmapData?.[row.dayIndex]?.[hour] || { count: 0, conversionRate: 0 }
                      const intensity = getHeatmapIntensity(cellData.count)
                      return (
                        <div
                          key={hour}
                          className={`w-5 h-5 rounded-sm ${intensity.bg} flex items-center justify-center`}
                          title={`${row.day}요일 ${hour}시 - ${cellData.count}건`}
                        >
                          {cellData.count > 0 && (
                            <span className={`text-[9px] font-medium ${intensity.text}`}>
                              {cellData.count}
                            </span>
                          )}
                        </div>
                      )
                    })}
                  </div>
                ))}
              </div>

              {/* Legend */}
              <div className="mt-3 flex items-center justify-end gap-1 text-xs text-gray-500">
                <span>적음</span>
                <div className="w-4 h-4 bg-gray-100 rounded-sm"></div>
                <div className="w-4 h-4 bg-sage-100 rounded-sm"></div>
                <div className="w-4 h-4 bg-sage-200 rounded-sm"></div>
                <div className="w-4 h-4 bg-sage-400 rounded-sm"></div>
                <div className="w-4 h-4 bg-sage-600 rounded-sm"></div>
                <span>많음</span>
              </div>
            </div>
          </div>
        </div>

        {/* Monthly Trend */}
        <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4">
          <h2 className="text-sm font-semibold text-gray-900 mb-3">월별 추이 (최근 6개월)</h2>
          <div className="space-y-2">
            {stats.monthlyTrend.map((month, index) => (
              <div key={index} className="flex items-center gap-3">
                <div className="w-16 text-xs text-gray-500">{month.month}</div>
                <div className="flex-1">
                  <div className="w-full bg-gray-100 rounded-full h-4 relative overflow-hidden">
                    <div
                      className="bg-sage-200 h-4 rounded-full absolute"
                      style={{ width: `${(month.total / Math.max(...stats.monthlyTrend.map(m => m.total))) * 100}%` }}
                    />
                    <div
                      className="bg-green-500 h-4 rounded-full absolute"
                      style={{ width: `${(month.retained / Math.max(...stats.monthlyTrend.map(m => m.total))) * 100}%` }}
                    />
                  </div>
                </div>
                <div className="w-24 text-right">
                  <span className="text-xs text-gray-500">{month.total}건</span>
                  <span className="text-xs text-green-600 ml-1">({month.retained} 수임)</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Channel Performance */}
        <div className="bg-white rounded-lg border border-gray-200">
          <div className="px-4 py-3 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-900">유입 채널별 성과</h2>
          </div>
          {channelStats.length === 0 ? (
            <div className="py-8 text-center text-gray-400 text-sm">채널 데이터 없음</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500 text-xs">
                <tr>
                  <th className="px-4 py-2 text-left font-medium">채널</th>
                  <th className="px-4 py-2 text-right font-medium">상담</th>
                  <th className="px-4 py-2 text-right font-medium">수임</th>
                  <th className="px-4 py-2 text-right font-medium">전환율</th>
                  <th className="px-4 py-2 text-right font-medium">평균 점수</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {[...channelStats].sort((a, b) => b.conversionRate - a.conversionRate).map((channel, index) => (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-2">
                        <div className={`w-1.5 h-1.5 rounded-full ${
                          channel.conversionRate >= 50 ? 'bg-green-500' :
                          channel.conversionRate >= 30 ? 'bg-sage-500' :
                          'bg-gray-400'
                        }`} />
                        <span className="font-medium text-gray-900">{channel.channel}</span>
                      </div>
                    </td>
                    <td className="px-4 py-2 text-right text-gray-600">{channel.total}건</td>
                    <td className="px-4 py-2 text-right text-green-600 font-medium">{channel.retained}건</td>
                    <td className="px-4 py-2 text-right">
                      <span className={`font-semibold ${
                        channel.conversionRate >= 50 ? 'text-green-600' :
                        channel.conversionRate >= 30 ? 'text-sage-600' :
                        'text-gray-500'
                      }`}>
                        {channel.conversionRate.toFixed(1)}%
                      </span>
                    </td>
                    <td className="px-4 py-2 text-right text-gray-600">{channel.avgLeadScore}점</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
