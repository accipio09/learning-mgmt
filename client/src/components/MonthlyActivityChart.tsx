import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import {
  ComposedChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { getRecentActivity, type DayActivity } from "@/lib/api";
import { getTodayLanguage } from "@/i18n/index";

interface Props {
  language?: string;
  source?: string;
}

export default function MonthlyActivityChart({ language, source }: Props) {
  const { t } = useTranslation();
  const [data, setData] = useState<DayActivity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    getRecentActivity({ language, source })
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [language, source]);

  if (loading) {
    return (
      <div className="mb-6 h-[200px] rounded-xl glow-border bg-card flex items-center justify-center">
        <span className="text-xs font-terminal text-muted-foreground animate-pulse">
          ...
        </span>
      </div>
    );
  }

  const todayLang = getTodayLanguage();

  // Cap per-day count to filter out unrealistic spikes (bulk imports, etc.)
  const DAILY_CAP = 100;

  const chartData = data.map((d) => {
    const capped = Math.min(d.count, DAILY_CAP);
    const dateObj = new Date(d.date + "T00:00:00");
    const weekday = dateObj.toLocaleDateString(todayLang, { weekday: "short" });
    return {
      weekday,
      count: capped,
      date: d.date,
    };
  });

  const maxCount = Math.max(...data.map((d) => Math.min(d.count, DAILY_CAP)), 1);

  // Nice Y-axis ticks
  const yMax = niceMax(maxCount);
  const yTicks = computeTicks(yMax);

  return (
    <div className="mb-6 rounded-xl glow-border bg-card px-5 pt-4 pb-2">
      <div className="mb-3">
        <span className="text-xs font-terminal text-muted-foreground">
          {t("activity.last7days")}
        </span>
      </div>

      <ResponsiveContainer width="100%" height={150}>
        <ComposedChart
          data={chartData}
          margin={{ top: 4, right: 8, bottom: 0, left: -12 }}
        >
          <defs>
            <linearGradient id="activityGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#3F3F46" stopOpacity={0.25} />
              <stop offset="100%" stopColor="#3F3F46" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="#E4E4E7"
            strokeOpacity={0.5}
            vertical={false}
          />
          <XAxis
            dataKey="weekday"
            tick={{ fontSize: 10, fontFamily: "Courier New", fill: "#A1A1AA" }}
            axisLine={{ stroke: "#E4E4E7" }}
            tickLine={false}
            interval={0}
          />
          <YAxis
            tick={{ fontSize: 10, fontFamily: "Courier New", fill: "#A1A1AA" }}
            axisLine={false}
            tickLine={false}
            domain={[0, yMax]}
            ticks={yTicks}
            width={36}
          />
          <Tooltip
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const d = payload[0].payload;
              return (
                <div className="rounded-lg border border-border bg-card px-3 py-2 shadow-md">
                  <p className="text-xs font-terminal text-muted-foreground">
                    {d.weekday}
                  </p>
                  <p className="text-sm font-terminal font-medium text-foreground">
                    {d.count} {t("activity.activities")}
                  </p>
                </div>
              );
            }}
          />
          <Area
            type="monotone"
            dataKey="count"
            stroke="#3F3F46"
            strokeWidth={2}
            fill="url(#activityGradient)"
            dot={(props: Record<string, unknown>) => {
              const { cx, cy, payload, index } = props as {
                cx: number;
                cy: number;
                payload: { count: number };
                index: number;
              };
              if (typeof cx !== "number" || typeof cy !== "number") return <g />;
              // Highlight last point (today)
              if (index === chartData.length - 1) {
                return (
                  <circle
                    key="today"
                    cx={cx}
                    cy={cy}
                    r={4}
                    fill="#3F3F46"
                    stroke="#FFFFFF"
                    strokeWidth={2}
                  />
                );
              }
              if (payload.count > 0) {
                return (
                  <circle
                    key={`dot-${cx}`}
                    cx={cx}
                    cy={cy}
                    r={2}
                    fill="#3F3F46"
                    fillOpacity={0.5}
                    stroke="none"
                  />
                );
              }
              return <g />;
            }}
            activeDot={{
              r: 5,
              fill: "#3F3F46",
              stroke: "#FFFFFF",
              strokeWidth: 2,
            }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Round up to a nice number for Y-axis max */
function niceMax(max: number): number {
  if (max <= 5) return 5;
  if (max <= 10) return 10;
  if (max <= 25) return 25;
  if (max <= 50) return 50;
  if (max <= 100) return 100;
  const magnitude = Math.pow(10, Math.floor(Math.log10(max)));
  const normalized = max / magnitude;
  if (normalized <= 2) return 2 * magnitude;
  if (normalized <= 5) return 5 * magnitude;
  return 10 * magnitude;
}

/** Generate clean tick values */
function computeTicks(max: number): number[] {
  if (max <= 5) return [0, 1, 2, 3, 4, 5];
  if (max <= 10) return [0, 5, 10];
  if (max <= 25) return [0, 5, 10, 15, 20, 25];
  if (max <= 50) return [0, 10, 20, 30, 40, 50];
  if (max <= 100) return [0, 25, 50, 75, 100];
  const step = max / 4;
  return [0, step, step * 2, step * 3, max];
}
