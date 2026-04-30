import React from 'react'
import { AreaChart, Area, ResponsiveContainer, YAxis } from 'recharts'

interface SparklineChartProps {
  data: number[]
  color?: string
  height?: number
}

const SparklineChart: React.FC<SparklineChartProps> = ({
  data,
  color = '#166534',
  height = 48,
}) => {
  const chartData = data.map((value, index) => ({ index, value }))
  const gradientId = `sparkline-gradient-${color.replace('#', '')}`

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={chartData}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.2} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <YAxis domain={['dataMin', 'dataMax']} hide />
        <Area
          type="monotone"
          dataKey="value"
          stroke={color}
          strokeWidth={2}
          fill={`url(#${gradientId})`}
          isAnimationActive={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}

export default SparklineChart
