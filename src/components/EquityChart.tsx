import React from 'react';
import './EquityChart.css';

interface EquityChartProps {
  data: { date: Date; value: number }[];
}

const EquityChart: React.FC<EquityChartProps> = ({ data }) => {
  if (data.length === 0) {
    return (
      <div className="equity-chart-empty">
        <p>No equity data yet. Start trading to see your portfolio growth!</p>
      </div>
    );
  }

  // Generate sample data if we don't have enough
  const generateSampleData = () => {
    const sampleData: { date: Date; value: number }[] = [];
    const startValue = data.length > 0 ? data[0].value : 10000;
    const endValue = data.length > 0 ? data[data.length - 1].value : startValue;
    
    for (let i = 0; i < 30; i++) {
      const date = new Date();
      date.setDate(date.getDate() - (30 - i));
      const progress = i / 29;
      const value = startValue + (endValue - startValue) * progress + (Math.random() - 0.5) * 500;
      sampleData.push({ date, value: Math.max(0, value) });
    }
    return sampleData;
  };

  const chartData = data.length >= 7 ? data : generateSampleData();
  const values = chartData.map((d) => d.value);
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  const range = maxValue - minValue || 1;
  const padding = range * 0.1;

  const width = 800;
  const height = 300;
  const chartWidth = width - 80;
  const chartHeight = height - 60;

  const points = chartData.map((point, index) => {
    const x = (index / (chartData.length - 1 || 1)) * chartWidth + 40;
    const y = height - 40 - ((point.value - minValue + padding) / (range + padding * 2)) * chartHeight;
    return `${x},${y}`;
  }).join(' ');

  const pathData = `M ${points.split(' ')[0]} L ${points}`;

  // Format dates for x-axis
  const formatDate = (date: Date) => {
    const month = date.toLocaleDateString('en-US', { month: 'short' });
    const day = date.getDate();
    return `${month} ${day}`;
  };

  // Generate y-axis labels
  const yAxisLabels = 5;
  const yLabels = Array.from({ length: yAxisLabels }, (_, i) => {
    const value = minValue - padding + ((range + padding * 2) / (yAxisLabels - 1)) * i;
    return Math.round(value);
  }).reverse();

  // Generate x-axis labels (show 8 dates)
  const xLabels = chartData
    .filter((_, i) => i % Math.ceil(chartData.length / 8) === 0 || i === chartData.length - 1)
    .map((d) => formatDate(d));

  return (
    <div className="equity-chart">
      <svg viewBox={`0 0 ${width} ${height}`} className="chart-svg">
        {/* Grid lines */}
        {yLabels.map((label, i) => {
          const y = 40 + (i / (yAxisLabels - 1)) * chartHeight;
          return (
            <g key={i}>
              <line
                x1="40"
                y1={y}
                x2={width - 40}
                y2={y}
                className="grid-line"
              />
            </g>
          );
        })}

        {/* Y-axis labels */}
        {yLabels.map((label, i) => {
          const y = 40 + (i / (yAxisLabels - 1)) * chartHeight;
          return (
            <text key={i} x="35" y={y + 4} className="axis-label">
              {label}
            </text>
          );
        })}

        {/* X-axis labels */}
        {xLabels.map((label, i) => {
          const x = 40 + (i / (xLabels.length - 1 || 1)) * chartWidth;
          return (
            <text key={i} x={x} y={height - 15} className="axis-label">
              {label}
            </text>
          );
        })}

        {/* Chart line */}
        <polyline
          points={points}
          fill="none"
          stroke="var(--accent-blue)"
          strokeWidth="2"
          className="equity-line"
        />

        {/* Area under curve */}
        <polygon
          points={`40,${height - 40} ${points} ${width - 40},${height - 40}`}
          fill="url(#gradient)"
          opacity="0.2"
        />

        <defs>
          <linearGradient id="gradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="var(--accent-blue)" stopOpacity="0.4" />
            <stop offset="100%" stopColor="var(--accent-blue)" stopOpacity="0" />
          </linearGradient>
        </defs>
      </svg>
    </div>
  );
};

export default EquityChart;

