import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface PnLChartProps {
  data: Array<{ date: string; pnl: number }>;
}

export default function PnLChart({ data }: PnLChartProps) {
  if (!data || data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>P&L Over Time</CardTitle>
          <CardDescription>Chart showing your profit and loss progression</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-64 flex items-center justify-center text-gray-500">
            No data available
          </div>
        </CardContent>
      </Card>
    );
  }

  const maxPnL = Math.max(...data.map(d => d.pnl));
  const minPnL = Math.min(...data.map(d => d.pnl));
  const range = maxPnL - minPnL;
  const width = 800;
  const height = 200;
  const padding = 40;

  const points = data.map((point, index) => {
    const x = padding + (index / (data.length - 1)) * (width - 2 * padding);
    const y = padding + (height - 2 * padding) - ((point.pnl - minPnL) / range) * (height - 2 * padding);
    return `${x},${y}`;
  }).join(' ');

  const linePath = `M ${points}`;

  return (
    <Card>
      <CardHeader>
        <CardTitle>P&L Over Time</CardTitle>
        <CardDescription>Chart showing your profit and loss progression</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <svg width={width} height={height} className="w-full">
            {/* Grid lines */}
            <defs>
              <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
                <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#f3f4f6" strokeWidth="1"/>
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)" />
            
            {/* Y-axis */}
            <line x1={padding} y1={padding} x2={padding} y2={height - padding} stroke="#d1d5db" strokeWidth="2" />
            
            {/* X-axis */}
            <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="#d1d5db" strokeWidth="2" />
            
            {/* Zero line */}
            {minPnL < 0 && maxPnL > 0 && (
              <line 
                x1={padding} 
                y1={padding + (height - 2 * padding) - ((0 - minPnL) / range) * (height - 2 * padding)} 
                x2={width - padding} 
                y2={padding + (height - 2 * padding) - ((0 - minPnL) / range) * (height - 2 * padding)} 
                stroke="#ef4444" 
                strokeWidth="1" 
                strokeDasharray="5,5"
              />
            )}
            
            {/* P&L line */}
            <path d={linePath} fill="none" stroke="#3b82f6" strokeWidth="3" />
            
            {/* Data points */}
            {data.map((point, index) => {
              const x = padding + (index / (data.length - 1)) * (width - 2 * padding);
              const y = padding + (height - 2 * padding) - ((point.pnl - minPnL) / range) * (height - 2 * padding);
              return (
                <circle 
                  key={index} 
                  cx={x} 
                  cy={y} 
                  r="4" 
                  fill={point.pnl >= 0 ? "#10b981" : "#ef4444"} 
                  stroke="white" 
                  strokeWidth="2"
                />
              );
            })}
            
            {/* Y-axis labels */}
            <text x={padding - 10} y={padding} textAnchor="end" className="text-xs fill-gray-500">
              ${maxPnL.toFixed(0)}
            </text>
            <text x={padding - 10} y={height - padding} textAnchor="end" className="text-xs fill-gray-500">
              ${minPnL.toFixed(0)}
            </text>
            {minPnL < 0 && maxPnL > 0 && (
              <text x={padding - 10} y={padding + (height - 2 * padding) - ((0 - minPnL) / range) * (height - 2 * padding)} textAnchor="end" className="text-xs fill-gray-500">
                $0
              </text>
            )}
            
            {/* X-axis labels */}
            {data.map((point, index) => {
              if (index % Math.ceil(data.length / 5) === 0 || index === data.length - 1) {
                const x = padding + (index / (data.length - 1)) * (width - 2 * padding);
                return (
                  <text key={index} x={x} y={height - padding + 20} textAnchor="middle" className="text-xs fill-gray-500">
                    {new Date(point.date).toLocaleDateString()}
                  </text>
                );
              }
              return null;
            })}
          </svg>
        </div>
      </CardContent>
    </Card>
  );
}
