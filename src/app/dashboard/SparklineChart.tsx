import React from 'react'
import { AreaChart, Area, ResponsiveContainer, YAxis } from 'recharts'

interface SparklineChartProps {
  data: number[]
  color?: string
  height?: number
}

/**
 * SparklineChart component renders a small area chart (sparkline) displaying a series of numeric data.
 *
 * @param {number[]} data - Array of numeric values to display in the sparkline.
 * @param {string} [color='#2E9A82'] - Color of the sparkline curve and gradient.
 * @param {number} [height=48] - Height of the chart in pixels.
 * @returns {JSX.Element} The rendered sparkline chart component.
 */
const SparklineChart: React.FC<SparklineChartProps> = ({
  data,
  color = '#2E9A82',
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
