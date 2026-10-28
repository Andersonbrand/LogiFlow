import React from "react";
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Cell,
} from "recharts";

const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload?.length) {
        return (
            <div className="bg-white border border-slate-200 rounded-lg shadow-elevated px-3 py-2 text-sm">
                <p className="font-heading font-semibold text-gray-700">{label}</p>
                <p className="text-blue-700 font-data">
                    Utilização: <strong>{payload?.[0]?.value}%</strong>
                </p>
            </div>
        );
    }
    return null;
};

const FleetUtilizationChart = ({ data }) => {
    // Guard: filtra dados inválidos que causam erro de arc no SVG
    const safeData = (data || []).filter(d => d && isFinite(d.utilizacao) && d.utilizacao >= 0);
    if (safeData.length === 0) return (
        <div className="bg-white rounded-lg border border-slate-200 shadow-card overflow-hidden">
            <div className="px-4 md:px-6 py-4 border-b border-slate-200" style={{ backgroundColor: "#404040" }}>
                <h2 className="text-base md:text-lg font-heading font-semibold text-white">Utilização da Frota por Veículo</h2>
            </div>
            <div className="p-8 text-center text-gray-400 text-sm">Nenhum veículo cadastrado</div>
        </div>
    );
    return (
        <div className="bg-white rounded-lg border border-slate-200 shadow-card overflow-hidden">
            <div
                className="px-4 md:px-6 py-4 border-b border-slate-200"
                style={{ backgroundColor: "#404040" }}
            >
                <h2 className="text-base md:text-lg font-heading font-semibold text-white">
                    Utilização da Frota por Veículo
                </h2>
            </div>
            <div className="p-4 md:p-5">
                <div className="w-full h-48 md:h-56" aria-label="Gráfico de utilização da frota por veículo">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={safeData} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                            <XAxis
                                dataKey="placa"
                                tick={{ fontSize: 11, fontFamily: "JetBrains Mono, monospace", fill: "#6B7280" }}
                                axisLine={false}
                                tickLine={false}
                            />
                            <YAxis
                                tick={{ fontSize: 11, fontFamily: "Inter, sans-serif", fill: "#6B7280" }}
                                axisLine={false}
                                tickLine={false}
                                domain={[0, 100]}
                                tickFormatter={(v) => `${v}%`}
                            />
                            <Tooltip content={<CustomTooltip />} />
                            <Bar dataKey="utilizacao" radius={[4, 4, 0, 0]} minPointSize={0} isAnimationActive={false}>
                                {safeData?.map((entry, index) => (
                                    <Cell
                                        key={`cell-${index}`}
                                        fill={
                                            entry?.utilizacao >= 90
                                                ? "#DC2626"
                                                : entry?.utilizacao >= 70
                                                    ? "#D97706" : "#1E3A5F"
                                        }
                                    />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>
                <div className="flex items-center gap-4 mt-3 flex-wrap">
                    <div className="flex items-center gap-1.5">
                        <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: "#1E3A5F" }} />
                        <span className="text-xs text-gray-500 font-caption">Normal (&lt;70%)</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: "#D97706" }} />
                        <span className="text-xs text-gray-500 font-caption">Alto (70-89%)</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: "#DC2626" }} />
                        <span className="text-xs text-gray-500 font-caption">Crítico (&ge;90%)</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default FleetUtilizationChart;